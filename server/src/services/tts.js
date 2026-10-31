import { createHash } from 'node:crypto';
import { writeFile, mkdir, rm, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runFfmpeg } from './ffmpeg.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 90000;
const MAX_WAIT_MS = 70000;
const CACHE_DIR = path.resolve('storage', 'tts-cache');
const MIN_INTERVAL_MS = Number(process.env.TTS_MIN_INTERVAL_MS || 21000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (f) => access(f).then(() => true, () => false);

let lastApiCall = 0;
async function pace() {
  const wait = lastApiCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    console.log(`TTS: waiting ${Math.ceil(wait / 1000)}s (free-tier rate limit)`);
    await sleep(wait);
  }
  lastApiCall = Date.now();
}

// 3.8 models use the Interactions API (WAV out); older ones use generateContent (raw PCM out)
function buildRequest(text, voice) {
  const model = process.env.GEMINI_TTS_MODEL;
  if (!model) throw new Error('GEMINI_TTS_MODEL is not set');

  if (model.startsWith('gemini-3.8')) {
    return {
      kind: 'wav',
      url: `${API}/interactions`,
      body: {
        model,
        input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
      },
    };
  }

  return {
    kind: 'pcm',
    url: `${API}/models/${model}:generateContent`,
    body: {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    },
  };
}

function extractAudio(data, kind) {
  if (kind === 'wav') {
    const items = (data.steps ?? [])
      .filter((s) => s.type === 'model_output')
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === 'audio');
    return items.at(-1)?.data;
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

async function requestAudio(text, voice) {
  const { kind, url, body } = buildRequest(text, voice);
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = false;
    let waitMs = 1500 * 2 ** (attempt - 1);

    try {
      await pace();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = extractAudio(data, kind);
        if (b64) return { buffer: Buffer.from(b64, 'base64'), kind };
        lastError = new Error('TTS response contained no audio');
        retryable = true;
      } else {
        const detail = await res.text();
        const quotaIds = [...new Set([...detail.matchAll(/"quotaId":\s*"([^"]+)"/g)].map((m) => m[1]))];
        lastError = new Error(
          `TTS API error ${res.status}` + (quotaIds.length ? ` (${quotaIds.join(', ')})` : `: ${detail.slice(0, 300)}`)
        );

        if (res.status === 429) {
          if (quotaIds.some((q) => /PerDay/i.test(q))) {
            lastError.message += ' - DAILY quota used up, waiting will not help';
            lastError.fatal = true;
          } else {
            const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(detail);
            if (m) waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 1000;
            retryable = waitMs <= MAX_WAIT_MS;
          }
        } else {
          retryable = [500, 503].includes(res.status);
        }
      }
    } catch (err) {
      lastError = err;
      retryable = err.name === 'TimeoutError' || err.name === 'AbortError';
    }

    if (lastError?.fatal || !retryable || attempt === MAX_ATTEMPTS) break;
    console.warn(`TTS failed (${lastError.message.slice(0, 90)}), retrying in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }

  throw lastError;
}

// Offline fallback for development: Windows built-in voice (robotic, no network, no quota)
function synthesizeWindows(text, wavFile) {
  const script =
    'Add-Type -AssemblyName System.Speech; ' +
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ' +
    '$s.SetOutputToWaveFile($env:TTS_OUT); $s.Speak($env:TTS_TEXT); $s.Dispose()';

  return new Promise((resolve, reject) => {
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, TTS_TEXT: text, TTS_OUT: path.resolve(wavFile) }, // text goes via env, never into the command
      windowsHide: true,
    });
    let err = '';
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`Windows TTS failed: ${err.slice(-300)}`))
    );
  });
}

export async function synthesizeSpeech(text, outFile, { voice = process.env.TTS_VOICE || 'Kore' } = {}) {
  const provider = (process.env.TTS_PROVIDER || 'gemini').toLowerCase();
  if (!['gemini', 'windows'].includes(provider)) throw new Error(`Unknown TTS_PROVIDER: ${provider}`);

  const key = createHash('sha1')
    .update(`${provider}|${voice}|${process.env.GEMINI_TTS_MODEL || ''}|${text}`)
    .digest('hex');
  const cached = path.join(CACHE_DIR, `${key}.mp3`);

  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(outFile), { recursive: true });

  if (!(await exists(cached))) {
    if (provider === 'windows') {
      const wav = cached.replace(/\.mp3$/, '.wav');
      await synthesizeWindows(text, wav);
      await runFfmpeg(['-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', cached]);
      await rm(wav, { force: true });
    } else {
      const { buffer, kind } = await requestAudio(text, voice);
      const raw = cached.replace(/\.mp3$/, kind === 'wav' ? '.wav' : '.pcm');
      await writeFile(raw, buffer);
      const input = kind === 'wav' ? ['-i', raw] : ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', raw];
      await runFfmpeg([...input, '-c:a', 'libmp3lame', '-b:a', '128k', cached]);
      await rm(raw, { force: true });
    }
  }

  await copyFile(cached, outFile);
  return outFile;
}
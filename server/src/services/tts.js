import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { runFfmpeg } from './ffmpeg.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = [429, 500, 503];
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function requestPcm(text, voice) {
  const model = process.env.GEMINI_TTS_MODEL;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = false;

    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (b64) return Buffer.from(b64, 'base64');
        lastError = new Error('TTS response contained no audio');
        retryable = true; // TTS models occasionally return an empty result
      } else {
        const detail = await res.text();
        lastError = new Error(`TTS API error ${res.status}: ${detail.slice(0, 400)}`);
        retryable = RETRYABLE.includes(res.status);
      }
    } catch (err) {
      lastError = err;
      retryable = err.name === 'TimeoutError' || err.name === 'AbortError';
    }

    if (!retryable || attempt === MAX_ATTEMPTS) break;
    const delay = 1500 * 2 ** (attempt - 1);
    console.warn(`TTS failed (${lastError.message.slice(0, 80)}), retrying in ${delay}ms`);
    await sleep(delay);
  }

  throw lastError;
}

export async function synthesizeSpeech(text, outFile, { voice = process.env.TTS_VOICE || 'Kore' } = {}) {
  const pcm = await requestPcm(text, voice);
  await mkdir(path.dirname(outFile), { recursive: true });

  const pcmFile = outFile.replace(/\.mp3$/i, '.pcm');
  await writeFile(pcmFile, pcm);

  // Gemini TTS returns raw 16-bit little-endian PCM, 24 kHz, mono
  await runFfmpeg([
    '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcmFile,
    '-c:a', 'libmp3lame', '-b:a', '128k', outFile,
  ]);

  await rm(pcmFile, { force: true });
  return outFile;
}
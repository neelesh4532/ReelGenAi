import path from 'node:path';
import { synthesizeSpeech } from './tts.js';
import { getDuration } from './ffmpeg.js';

// Scenes run one after another on purpose: free-tier TTS has low rate limits
export async function generateNarration(script, outDir) {
  const results = [];

  for (const [i, scene] of script.scenes.entries()) {
    const file = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.mp3`);
    await synthesizeSpeech(scene.narration, file);
    const audioSec = await getDuration(file);
    results.push({ index: i, audioFile: file, audioSec });
  }

  return results;
}
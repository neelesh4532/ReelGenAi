import { generateNarration } from '../src/services/narration.js';
import { fetchFootage } from '../src/services/footage.js';
import { assembleReel } from '../src/services/assembler.js';
import { getDuration } from '../src/services/ffmpeg.js';

const script = {
  scenes: [
    { narration: 'Stop wasting your mornings. Wake up early and your whole day changes.', visualKeywords: ['early morning sunrise'], durationSec: 6 },
    { narration: 'Drink a full glass of water before you touch anything else.', visualKeywords: ['person drinking water'], durationSec: 5 },
    { narration: 'Then get outside and move your body for ten minutes.', visualKeywords: ['person running outdoors'], durationSec: 5 },
    { narration: 'Let the morning sunlight hit your face. It resets your focus.', visualKeywords: ['sunlight through window'], durationSec: 5 },
  ],
};

const base = 'storage/demo';
const reuse = process.argv.includes('--reuse');

console.log('1/3 Narration...');
let audio;
if (reuse) {
  audio = [];
  for (const [i] of script.scenes.entries()) {
    const file = `${base}/audio/scene-${String(i + 1).padStart(2, '0')}.mp3`;
    audio.push({ index: i, audioFile: file, audioSec: await getDuration(file) });
  }
} else {
  audio = await generateNarration(script, `${base}/audio`);
}

console.log('2/3 Footage...');
const footage = await fetchFootage(script, `${base}/footage`, {
  durations: audio.map((a) => a.audioSec),
});

console.log('3/3 Assembling...');
const scenes = audio.map((a, i) => ({
  clipFile: footage[i].file,
  audioFile: a.audioFile,
  audioSec: a.audioSec,
  narration: script.scenes[i].narration,
}));
const out = await assembleReel(scenes, `${base}/reel.mp4`, base);

console.log(`Done: ${out} (${(await getDuration(out)).toFixed(1)} seconds)`);
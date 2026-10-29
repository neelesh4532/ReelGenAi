import { generateNarration } from '../src/services/narration.js';

const script = {
  scenes: [
    { narration: 'Stop wasting your mornings. Here are three habits that will unlock laser focus all day.' },
    { narration: 'First, delay your phone. Do not touch it for the first thirty minutes.' },
    { narration: 'Second, drink a full glass of water before anything else.' },
  ],
};

const results = await generateNarration(script, 'storage/demo/audio');
console.table(
  results.map((r) => ({ scene: r.index + 1, file: r.audioFile, seconds: r.audioSec.toFixed(2) }))
);
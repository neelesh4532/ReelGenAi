import { fetchFootage } from '../src/services/footage.js';

const script = {
  scenes: [
    { visualKeywords: ['early-morning'], durationSec: 6 },
    { visualKeywords: ['water-at-beach'], durationSec: 6 },
    { visualKeywords: ['bridge'], durationSec: 6 },
    { visualKeywords: ['sunlight through window'], durationSec: 6 },
  ],
};

const results = await fetchFootage(script, 'storage/demo/footage');
console.table(
  results.map((r) => ({
    scene: r.index + 1,
    provider: r.provider,
    matched: r.keyword,
    id: r.id,
    size: `${r.width}x${r.height}`,
    seconds: Number(r.duration).toFixed(1),
  }))
);
import path from 'node:path';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { downloadFile } from './download.js';

const PROVIDERS = ['local', 'pixabay', 'pexels'];
const FALLBACK_KEYWORDS = ['city lights at night', 'nature landscape'];

async function loadProvider() {
  const name = (process.env.FOOTAGE_PROVIDER || 'local').toLowerCase();
  if (!PROVIDERS.includes(name)) throw new Error(`Unknown FOOTAGE_PROVIDER: ${name}`);
  const mod = await import(`./${name}.js`);
  return { findClip: mod.findClip, allowedHost: mod.ALLOWED_HOST };
}

// Scenes run one after another to stay inside provider rate limits.
// durations: optional array of real scene lengths (e.g. from narration audio)
export async function fetchFootage(script, outDir, { durations } = {}) {
  const { findClip, allowedHost } = await loadProvider();
  const usedIds = new Set();
  const results = [];

  for (const [i, scene] of script.scenes.entries()) {
    const minSeconds = durations?.[i] ?? scene.durationSec ?? 5;
    const clip = await findClip([...scene.visualKeywords, ...FALLBACK_KEYWORDS], {
      minSeconds,
      usedIds,
    });
    if (!clip) throw new Error(`No footage found for scene ${i + 1}`);

    usedIds.add(clip.id);
    const file = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.mp4`);

    if (clip.localPath) {
      await mkdir(outDir, { recursive: true });
      await copyFile(clip.localPath, file);
    } else {
      await downloadFile(clip.link, file, allowedHost);
    }

    results.push({ index: i, file, ...clip });
  }

  await writeFile(
    path.join(outDir, 'credits.json'),
    JSON.stringify(
      results.map((r) => ({ scene: r.index + 1, provider: r.provider, author: r.author, source: r.pageUrl })),
      null,
      2
    )
  );

  return results;
}
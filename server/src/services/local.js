import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { getDuration, getVideoSize } from './ffmpeg.js';

const LIBRARY_DIR = process.env.FOOTAGE_LIBRARY_DIR || 'storage/library';

export const ALLOWED_HOST = null; // not used: local files are copied, not downloaded

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

// Picks the library clip whose filename shares the most words with the scene keywords.
// If nothing matches, it still returns an unused clip so the pipeline never stops.
export async function findClip(keywords, { usedIds = new Set() } = {}) {
  const dir = path.resolve(LIBRARY_DIR);

  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /\.mp4$/i.test(f));
  } catch {
    // handled below
  }
  if (files.length === 0) throw new Error(`No .mp4 files found in ${dir}`);

  const wanted = new Set(keywords.flatMap(words));
  const candidates = files
    .filter((f) => !usedIds.has(f))
    .map((f) => ({ file: f, score: words(path.parse(f).name).filter((w) => wanted.has(w)).length }));

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const localPath = path.join(dir, best.file);
  const [duration, size] = await Promise.all([getDuration(localPath), getVideoSize(localPath)]);

  return {
    id: best.file,
    localPath,
    width: size.width,
    height: size.height,
    duration,
    pageUrl: '',
    author: 'Local library',
    keyword: best.score > 0 ? `filename match (${best.score})` : 'no match, any clip',
    provider: 'local',
  };
}
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function downloadFile(link, outFile, allowedHost) {
  const url = new URL(link);
  if (url.protocol !== 'https:' || !allowedHost.test(url.hostname)) {
    throw new Error(`Refusing to download from ${url.hostname}`);
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok || !res.body) throw new Error(`Download failed with status ${res.status}`);

  await mkdir(path.dirname(outFile), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outFile));
  return outFile;
}
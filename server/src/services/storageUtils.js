import { randomBytes } from 'node:crypto';

// The video URL is public, so the id must not be guessable
export function buildPublicId(projectId) {
  return `reelgen/${projectId}-${randomBytes(6).toString('hex')}`;
}

export function assertUploadSize(bytes, maxMb) {
  const limit = maxMb * 1024 * 1024;
  if (bytes > limit) {
    throw Object.assign(
      new Error(`Video is ${(bytes / 1024 / 1024).toFixed(1)} MB, above the ${maxMb} MB upload limit`),
      { permanent: true }
    );
  }
}
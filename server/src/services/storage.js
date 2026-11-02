import { stat } from 'node:fs/promises';

const PROVIDERS = ['local', 'cloudinary'];

function providerName() {
  const name = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (!PROVIDERS.includes(name)) {
    throw Object.assign(new Error(`Unknown STORAGE_PROVIDER: ${name}`), { permanent: true });
  }
  return name;
}

// Returns { provider, url, publicId, bytes }
export async function uploadVideo(file, projectId) {
  if (providerName() === 'cloudinary') {
    const mod = await import('./cloudinaryStorage.js');
    return mod.upload(file, projectId);
  }
  const { size } = await stat(file);
  return { provider: 'local', url: null, publicId: null, bytes: size };
}

export async function deleteVideo(publicId) {
  if (!publicId || providerName() !== 'cloudinary') return;
  const mod = await import('./cloudinaryStorage.js');
  await mod.remove(publicId);
}
import { stat } from 'node:fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { buildPublicId, assertUploadSize } from './storageUtils.js';
import { logger } from '../config/logger.js';

function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error('Cloudinary credentials are not set'), { permanent: true });
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// The SDK rejects with plain objects like { message, http_code }
function toError(err) {
  if (err instanceof Error) return err;
  return new Error(`Cloudinary API error ${err?.http_code ?? 'unknown'}: ${err?.message ?? 'upload failed'}`);
}

export async function upload(file, projectId) {
  configure();
  const { size } = await stat(file);
  assertUploadSize(size, Number(process.env.MAX_UPLOAD_MB || 95));

  try {
    // resource_type must be 'video', otherwise Cloudinary treats the file as an image
    const result = await cloudinary.uploader.upload(file, {
      resource_type: 'video',
      public_id: buildPublicId(projectId),
      overwrite: true,
      timeout: 120000,
    });
    return {
      provider: 'cloudinary',
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes ?? size,
    };
  } catch (err) {
    throw toError(err);
  }
}

// Best effort: failing to delete an old video must never fail a render
export async function remove(publicId) {
  try {
    configure();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
  } catch (err) {
    logger.warn({ publicId, err: err?.message }, 'Could not delete old video from Cloudinary');
  }
}
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1'; // lets us change the format or rotate keys later

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export const assertEncryptionKey = () => { getKey(); };

// AES-256-GCM: encrypted and tamper-evident. Output: v1:iv:authTag:ciphertext (base64 parts)
export function encrypt(plain, key = getKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(payload, key = getKey()) {
  const [version, iv, tag, data] = String(payload).split(':');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unsupported encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
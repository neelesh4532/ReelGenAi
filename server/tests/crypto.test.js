import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, assertEncryptionKey } from '../src/services/crypto.js';

process.env.TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);

test('encrypts and decrypts a value', () => {
  const secret = 'IGQVJ-example-token';
  const stored = encrypt(secret);
  assert.ok(stored.startsWith('v1:'));
  assert.ok(!stored.includes(secret));
  assert.equal(decrypt(stored), secret);
});

test('the same value encrypts differently each time', () => {
  assert.notEqual(encrypt('same'), encrypt('same'));
});

test('tampered data is rejected', () => {
  const [version, iv, tag, data] = encrypt('token').split(':');
  const bytes = Buffer.from(data, 'base64');
  bytes[0] ^= 1;
  assert.throws(() => decrypt([version, iv, tag, bytes.toString('base64')].join(':')));
});

test('the wrong key is rejected', () => {
  assert.throws(() => decrypt(encrypt('token'), Buffer.alloc(32, 7)));
});

test('a malformed key fails fast', () => {
  const saved = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = 'too-short';
  assert.throws(() => assertEncryptionKey());
  process.env.TOKEN_ENCRYPTION_KEY = saved;
});
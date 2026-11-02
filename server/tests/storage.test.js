import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicId, assertUploadSize } from '../src/services/storageUtils.js';
import { isRetryable } from '../src/services/retry.js';

test('public ids are namespaced, contain the project id and are unguessable', () => {
  const a = buildPublicId('6ae4429bb4bc7a9664b82bb1');
  const b = buildPublicId('6ae4429bb4bc7a9664b82bb1');
  assert.match(a, /^reelgen\/6ae4429bb4bc7a9664b82bb1-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('files under the limit are accepted', () => {
  assert.doesNotThrow(() => assertUploadSize(10 * 1024 * 1024, 95));
});

test('files over the limit are rejected and never retried', () => {
  let error;
  try {
    assertUploadSize(120 * 1024 * 1024, 95);
  } catch (err) {
    error = err;
  }
  assert.ok(error);
  assert.equal(error.permanent, true);
  assert.equal(isRetryable(error), false);
});

test('Cloudinary credential errors are permanent, timeouts are retried', () => {
  assert.equal(isRetryable(new Error('Cloudinary API error 401: Invalid Signature')), false);
  assert.equal(isRetryable(new Error('Cloudinary API error 499: Request Timeout')), true);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryable } from '../src/services/retry.js';
import { jobIdFor } from '../src/queue/constants.js';

const err = (message, extra = {}) => Object.assign(new Error(message), extra);

test('daily quota exhaustion is not retried', () => {
  assert.equal(
    isRetryable(err('TTS API error 429 (GenerateRequestsPerDayPerProjectPerModel-FreeTier) - DAILY quota used up', { fatal: true })),
    false
  );
});

test('a per-minute rate limit is retried', () => {
  assert.equal(
    isRetryable(err('TTS API error 429 (GenerateRequestsPerMinutePerProjectPerModel-FreeTier)')),
    true
  );
});

test('bad key or wrong model is not retried', () => {
  assert.equal(isRetryable(err('TTS API error 401')), false);
  assert.equal(isRetryable(err('TTS API error 404: model not found')), false);
});

test('server errors and timeouts are retried', () => {
  assert.equal(isRetryable(err('Pixabay API error 503')), true);
  assert.equal(isRetryable(err('The operation was aborted due to timeout', { name: 'TimeoutError' })), true);
  assert.equal(isRetryable(err('FFmpeg exited with code 1')), true);
});

test('missing footage or configuration is not retried', () => {
  assert.equal(isRetryable(err('No footage found for scene 2')), false);
  assert.equal(isRetryable(err('No .mp4 files found in C:\\x')), false);
  assert.equal(isRetryable(err('GEMINI_TTS_MODEL is not set')), false);
});

test('client-side errors with a 4xx status are not retried', () => {
  assert.equal(isRetryable(err('Project not found', { status: 404 })), false);
  assert.equal(isRetryable(err('Render already in progress', { status: 409 })), false);
  assert.equal(isRetryable(err('Queue down', { status: 503 })), true);
});

test('no error means no retry', () => {
  assert.equal(isRetryable(null), false);
});

test('job ids contain no colon (BullMQ restriction)', () => {
  assert.ok(!jobIdFor('6ae4429bb4bc7a9664b82bb1').includes(':'));
});
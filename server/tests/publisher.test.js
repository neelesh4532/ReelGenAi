import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaption, waitUntilFinished, createReelContainer, isRetryablePublish, MetaError,
} from '../src/services/publisher.js';

const sequence = (...bodies) => {
  let i = 0;
  return async () => ({ ok: true, status: 200, json: async () => bodies[Math.min(i++, bodies.length - 1)] });
};
const failure = (status, error) => async () => ({ ok: false, status, json: async () => ({ error }) });
const noSleep = async () => {};

test('caption joins text and hashtags and respects Instagram limits', () => {
  const caption = buildCaption({ caption: 'Hello', hashtags: Array.from({ length: 40 }, (_, i) => `#t${i}`) });
  assert.ok(caption.startsWith('Hello\n\n#t0'));
  assert.equal(caption.split('#').length - 1, 30);
  assert.ok(buildCaption({ caption: 'x'.repeat(3000), hashtags: [] }).length <= 2200);
});

test('waits until the container is FINISHED', async () => {
  await waitUntilFinished(
    { containerId: '1', token: 't', sleepFn: noSleep },
    sequence({ status_code: 'IN_PROGRESS' }, { status_code: 'IN_PROGRESS' }, { status_code: 'FINISHED' })
  );
});

test('an ERROR status is permanent', async () => {
  await assert.rejects(
    waitUntilFinished({ containerId: '1', token: 't', sleepFn: noSleep }, sequence({ status_code: 'ERROR' })),
    (err) => err.permanent === true && !isRetryablePublish(err)
  );
});

test('giving up while still processing is retryable', async () => {
  await assert.rejects(
    waitUntilFinished(
      { containerId: '1', token: 't', maxAttempts: 3, sleepFn: noSleep },
      sequence({ status_code: 'IN_PROGRESS' })
    ),
    (err) => err.transient === true && isRetryablePublish(err)
  );
});

test('transient Meta errors are retried, other 4xx errors are not', async () => {
  const input = { igUserId: '1', token: 't', videoUrl: 'https://example.test/v.mp4', caption: 'c' };
  await assert.rejects(
    createReelContainer(input, failure(400, { message: 'Temporary', is_transient: true })),
    (err) => err instanceof MetaError && isRetryablePublish(err)
  );
  await assert.rejects(
    createReelContainer(input, failure(400, { message: 'Bad parameter', code: 100 })),
    (err) => !isRetryablePublish(err)
  );
  await assert.rejects(
    createReelContainer(input, failure(400, { message: 'Upload failed', error_subcode: 2207001 })),
    (err) => isRetryablePublish(err)
  );
});

test('the token is sent in a header and never in the URL', async () => {
  let seen;
  const spy = async (url, options) => {
    seen = { url: String(url), options };
    return { ok: true, status: 200, json: async () => ({ id: '99' }) };
  };
  await createReelContainer({ igUserId: '1', token: 'secret-token', videoUrl: 'https://example.test/v.mp4', caption: 'c' }, spy);
  assert.equal(seen.options.headers.Authorization, 'Bearer secret-token');
  assert.ok(!seen.url.includes('secret-token'));
  assert.equal(JSON.parse(seen.options.body).media_type, 'REELS');
});

test('unknown errors are retried once more, permanent ones never', () => {
  assert.equal(isRetryablePublish(new Error('database hiccup')), true);
  assert.equal(isRetryablePublish(Object.assign(new Error('x'), { permanent: true })), false);
  assert.equal(isRetryablePublish(null), false);
});
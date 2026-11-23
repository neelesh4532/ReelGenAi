import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createLimiter } from '../src/middleware/rateLimits.js';

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('requests over the limit get a 429 with a JSON error', async () => {
  const app = express();
  app.use(createLimiter({ windowMs: 60_000, limit: 2 }));
  app.get('/', (req, res) => res.json({ ok: true }));

  await withServer(app, async (base) => {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base)).status, 200);
    const blocked = await fetch(base);
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /too many/i);
    assert.ok(blocked.headers.get('retry-after'));
  });
});

test('limits are counted separately per key', async () => {
  const app = express();
  app.use(createLimiter({ windowMs: 60_000, limit: 1, keyGenerator: (req) => req.get('x-user') }));
  app.get('/', (req, res) => res.json({ ok: true }));

  await withServer(app, async (base) => {
    assert.equal((await fetch(base, { headers: { 'x-user': 'a' } })).status, 200);
    assert.equal((await fetch(base, { headers: { 'x-user': 'a' } })).status, 429);
    assert.equal((await fetch(base, { headers: { 'x-user': 'b' } })).status, 200);
  });
});
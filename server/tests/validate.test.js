import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const schema = z.object({ name: z.string().trim().min(2) });

test('returns 400 with details for invalid input and does not continue', () => {
  const req = { body: { name: 'a' } };
  const res = mockRes();
  let called = false;
  validate(schema)(req, res, () => { called = true; });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid request');
  assert.ok(res.body.details.length > 0);
  assert.equal(called, false);
});

test('passes valid input on and replaces the body with parsed data', () => {
  const req = { body: { name: '  Neelesh  ', extra: 'dropped' } };
  const res = mockRes();
  let called = false;
  validate(schema)(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.body, { name: 'Neelesh' });
});
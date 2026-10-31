import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptSchema, scriptRequestSchema } from '../src/schemas/script.js';
import { registerSchema } from '../src/schemas/auth.js';

const scene = {
  narration: 'Stop wasting your mornings.',
  onScreenText: 'Wake Up Early',
  visualKeywords: ['alarm clock ringing', 'sunrise through window'],
  durationSec: 5,
};
const validScript = {
  title: 'Morning habits',
  scenes: [scene, scene, scene],
  caption: 'Try this tomorrow',
  hashtags: ['#morning'],
};

test('accepts a valid script', () => {
  assert.equal(scriptSchema.safeParse(validScript).success, true);
});

test('rejects a script with too few scenes', () => {
  assert.equal(scriptSchema.safeParse({ ...validScript, scenes: [scene] }).success, false);
});

test('rejects a scene that is too long', () => {
  const bad = { ...validScript, scenes: [{ ...scene, durationSec: 60 }, scene, scene] };
  assert.equal(scriptSchema.safeParse(bad).success, false);
});

test('rejects a script without hashtags', () => {
  assert.equal(scriptSchema.safeParse({ ...validScript, hashtags: [] }).success, false);
});

test('request schema trims input and applies defaults', () => {
  const r = scriptRequestSchema.parse({ topic: '  calm morning routine  ' });
  assert.equal(r.topic, 'calm morning routine');
  assert.equal(r.audience, 'General audience');
  assert.equal(r.tone, 'engaging');
  assert.equal(r.targetSeconds, 30);
});

test('request schema rejects a very short topic', () => {
  assert.equal(scriptRequestSchema.safeParse({ topic: 'hi' }).success, false);
});

test('register schema normalizes the email', () => {
  const r = registerSchema.parse({ email: '  Test@Example.COM ', password: 'Test12345!' });
  assert.equal(r.email, 'test@example.com');
});

test('register schema enforces password length limits', () => {
  assert.equal(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success, false);
  assert.equal(registerSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(73) }).success, false);
});
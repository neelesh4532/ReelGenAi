import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAss } from '../src/services/captions.js';

const LINE = /^Dialogue: 0,([^,]+),([^,]+),Default,,0,0,0,,(.*)$/;

function parseTime(t) {
  const [h, m, s] = t.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function events(ass) {
  return ass
    .split('\n')
    .map((l) => LINE.exec(l))
    .filter(Boolean)
    .map((m) => ({ start: parseTime(m[1]), end: parseTime(m[2]), text: m[3] }));
}

test('splits narration into chunks of at most 3 words', () => {
  const ev = events(buildAss('Stop wasting your mornings and start living today', 6));
  assert.ok(ev.length >= 3);
  for (const e of ev) assert.ok(e.text.split(' ').length <= 3, `too long: ${e.text}`);
});

test('uppercases text and strips trailing punctuation', () => {
  const ev = events(buildAss('Hello world.', 2));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].text, 'HELLO WORLD');
});

test('removes characters that could break ASS formatting', () => {
  const ev = events(buildAss('Hello {\\an8}world', 2));
  assert.ok(ev.every((e) => !/[{}\\]/.test(e.text)));
});

test('captions are contiguous and end with the audio', () => {
  const audioSec = 7.5;
  const ev = events(buildAss('Drink a full glass of water before you touch anything else', audioSec));
  assert.ok(Math.abs(ev[0].start) < 0.001);
  for (let i = 1; i < ev.length; i++) {
    assert.ok(Math.abs(ev[i].start - ev[i - 1].end) < 0.03, 'gap or overlap between captions');
  }
  assert.ok(Math.abs(ev.at(-1).end - audioSec) < 0.05);
});
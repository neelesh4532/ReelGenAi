import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule } from '../src/services/schedule.js';

const NOW = Date.parse('2026-11-20T10:00:00Z');

test('no value means publish now', () => {
  assert.equal(parseSchedule(undefined, NOW), null);
  assert.equal(parseSchedule(null, NOW), null);
});

test('a valid future time returns the date and the delay', () => {
  const result = parseSchedule('2026-11-20T12:00:00Z', NOW);
  assert.equal(result.delayMs, 2 * 3600 * 1000);
  assert.equal(result.date.toISOString(), '2026-11-20T12:00:00.000Z');
});

test('times in the past or under a minute away are rejected', () => {
  assert.throws(() => parseSchedule('2026-11-20T09:00:00Z', NOW), (e) => e.status === 400);
  assert.throws(() => parseSchedule('2026-11-20T10:00:30Z', NOW), (e) => e.status === 400);
});

test('more than 30 days ahead is rejected', () => {
  assert.throws(() => parseSchedule('2026-12-31T10:00:00Z', NOW), (e) => e.status === 400);
});

test('garbage input is rejected', () => {
  assert.throws(() => parseSchedule('not a date', NOW), (e) => e.status === 400);
  assert.throws(() => parseSchedule(12345, NOW), (e) => e.status === 400);
});

test('an ISO string with an offset is understood', () => {
  const result = parseSchedule('2026-11-20T17:30:00+05:30', NOW);
  assert.equal(result.date.toISOString(), '2026-11-20T12:00:00.000Z');
});
const MIN_MS = 60_000;
const MAX_MS = 30 * 86_400_000;

// Returns null for "publish now", or { date, delayMs } for a valid future time
export function parseSchedule(raw, now = Date.now()) {
  if (raw === undefined || raw === null) return null;

  const bad = (message) => Object.assign(new Error(message), { status: 400 });
  if (typeof raw !== 'string') throw bad('scheduledFor must be a date string');

  const date = new Date(raw);
  const delayMs = date.getTime() - now;
  if (Number.isNaN(delayMs)) throw bad('scheduledFor is not a valid date');
  if (delayMs < MIN_MS) throw bad('Pick a time at least one minute from now');
  if (delayMs > MAX_MS) throw bad('You can schedule at most 30 days ahead');

  return { date, delayMs };
}
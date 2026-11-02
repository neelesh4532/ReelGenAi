// Messages that retrying cannot fix
const PERMANENT_PATTERNS = [
  /DAILY quota/i,
  /API error (400|401|403|404)\b/i, // bad key, wrong model, bad request
  /No footage found/i,
  /No \.mp4 files found/i,
  /is not set/i,
  /Unknown (FOOTAGE|TTS)_PROVIDER/i,
  /Refusing to download/i,
  /Project has no script/i,
  /Project not found/i,
];

// true = a later attempt might succeed (timeouts, 5xx, rate limits, network hiccups)
export function isRetryable(err) {
  if (!err) return false;
  if (err.fatal || err.permanent) return false;
  if (typeof err.status === 'number' && err.status < 500) return false;

  const msg = String(err.message || '');
  return !PERMANENT_PATTERNS.some((pattern) => pattern.test(msg));
}
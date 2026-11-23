const graph = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v26.0'}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Meta error codes that are worth retrying (rate limiting, temporary upload failure)
const TRANSIENT_CODES = [4, 17, 32, 613];
const TRANSIENT_SUBCODES = [2207001];

export class MetaError extends Error {
  constructor(message, { status, code, subcode, transient = false, permanent = false } = {}) {
    super(message);
    this.name = 'MetaError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.transient = transient;
    this.permanent = permanent;
  }
}

// The token goes in a header, never in the URL, so it cannot end up in logs
async function call(path, { method = 'GET', token, body, params } = {}, fetchFn = fetch) {
  const url = new URL(`${graph()}${path}`);
  if (params) url.search = new URLSearchParams(params).toString();

  let res;
  try {
    res = await fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new MetaError('Could not reach Meta', { transient: true });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    throw new MetaError(e.error_user_msg || e.message || `Meta returned status ${res.status}`, {
      status: res.status,
      code: e.code,
      subcode: e.error_subcode,
      transient:
        Boolean(e.is_transient) ||
        res.status >= 500 ||
        TRANSIENT_CODES.includes(e.code) ||
        TRANSIENT_SUBCODES.includes(e.error_subcode),
    });
  }
  return data;
}

export function buildCaption(script) {
  const tags = (script.hashtags || []).slice(0, 30).join(' '); // Instagram allows 30 hashtags
  return `${script.caption}\n\n${tags}`.trim().slice(0, 2200); // and 2200 characters
}

export const createReelContainer = ({ igUserId, token, videoUrl, caption }, fetchFn) =>
  call(
    `/${igUserId}/media`,
    { method: 'POST', token, body: { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: true } },
    fetchFn
  );

// Instagram downloads and processes the video: wait until it says FINISHED
export async function waitUntilFinished(
  { containerId, token, intervalMs = 5000, maxAttempts = 60, sleepFn = sleep },
  fetchFn
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await call(`/${containerId}`, { token, params: { fields: 'status_code,status' } }, fetchFn);

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new MetaError(
        `Instagram could not process the video (${data.status_code}${data.status ? `: ${data.status}` : ''})`,
        { permanent: true }
      );
    }
    await sleepFn(intervalMs);
  }
  throw new MetaError('Instagram is still processing the video', { transient: true });
}

export const publishContainer = ({ igUserId, token, containerId }, fetchFn) =>
  call(`/${igUserId}/media_publish`, { method: 'POST', token, body: { creation_id: containerId } }, fetchFn);

export async function getPermalink({ mediaId, token }, fetchFn) {
  const data = await call(`/${mediaId}`, { token, params: { fields: 'permalink' } }, fetchFn);
  return data.permalink ?? null;
}

// Informational only: if the response looks different we simply skip the check
export async function getPublishingLimit({ igUserId, token }, fetchFn) {
  try {
    const data = await call(
      `/${igUserId}/content_publishing_limit`,
      { token, params: { fields: 'quota_usage,config' } },
      fetchFn
    );
    const row = data.data?.[0];
    if (!row || typeof row.quota_usage !== 'number') return null;
    return { used: row.quota_usage, total: row.config?.quota_total ?? 50 };
  } catch {
    return null;
  }
}

export function isRetryablePublish(err) {
  if (!err || err.permanent) return false;
  if (err instanceof MetaError) return Boolean(err.transient);
  return true; // unknown errors (for example a database hiccup) get another attempt
}
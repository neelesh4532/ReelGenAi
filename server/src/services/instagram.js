import { AppError } from '../middleware/errorHandler.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { encrypt, decrypt } from './crypto.js';

export function credentials() {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = process.env;
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !INSTAGRAM_REDIRECT_URI) {
    throw new AppError('Instagram integration is not configured on the server', 503);
  }
  return { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI };
}

async function metaFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new AppError('Could not reach Instagram, try again', 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error_message || data.error?.message || `status ${res.status}`;
    // Never put the URL in the error: it can contain tokens or the app secret
    throw new AppError(`Instagram API error: ${message}`, 502);
  }
  return data;
}

const withParams = (base, params) => {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url;
};

// Step 1: one-time code to a short-lived token (valid 1 hour)
export async function exchangeCode(code) {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = credentials();
  const data = await metaFetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code,
    }),
  });
  const entry = Array.isArray(data.data) ? data.data[0] : data;
  if (!entry?.access_token) throw new AppError('Instagram did not return an access token', 502);
  return entry.access_token;
}

// Step 2: short-lived to long-lived token (valid 60 days). Must run on the server.
export async function toLongLived(shortToken) {
  const { INSTAGRAM_APP_SECRET } = credentials();
  const data = await metaFetch(
    withParams('https://graph.instagram.com/access_token', {
      grant_type: 'ig_exchange_token',
      client_secret: INSTAGRAM_APP_SECRET,
      access_token: shortToken,
    })
  );
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) };
}

export async function getProfile(token) {
  const data = await metaFetch(
    withParams('https://graph.instagram.com/me', { fields: 'user_id,username', access_token: token })
  );
  return { igUserId: String(data.user_id ?? data.id), username: data.username };
}

// Tokens can be refreshed once they are 24 hours old and before they expire
export async function refreshLongLived(token) {
  const data = await metaFetch(
    withParams('https://graph.instagram.com/refresh_access_token', {
      grant_type: 'ig_refresh_token',
      access_token: token,
    })
  );
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) };
}

export function saveAccount(userId, { igUserId, username, accessToken, expiresIn }) {
  const now = new Date();
  return InstagramAccount.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        igUserId,
        username,
        accessTokenEnc: encrypt(accessToken),
        tokenIssuedAt: now,
        tokenExpiresAt: new Date(now.getTime() + expiresIn * 1000),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
}

export async function refreshAccount(userId) {
  const account = await InstagramAccount.findOne({ user: userId }).select('+accessTokenEnc');
  if (!account) throw new AppError('Instagram is not connected', 404);
  if (Date.now() - account.tokenIssuedAt.getTime() < 24 * 3600 * 1000) {
    throw new AppError('Tokens can only be refreshed once they are 24 hours old', 409);
  }
  const fresh = await refreshLongLived(decrypt(account.accessTokenEnc));
  return saveAccount(userId, {
    igUserId: account.igUserId,
    username: account.username,
    accessToken: fresh.accessToken,
    expiresIn: fresh.expiresIn,
  });
}
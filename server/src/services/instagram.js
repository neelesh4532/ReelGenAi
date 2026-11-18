import { AppError } from '../middleware/errorHandler.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { encrypt } from './crypto.js';

const graph = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v26.0'}`;

export function credentials() {
  const { META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID, INSTAGRAM_REDIRECT_URI } = process.env;
  if (!META_APP_ID || !META_APP_SECRET || !META_LOGIN_CONFIG_ID || !INSTAGRAM_REDIRECT_URI) {
    throw new AppError('Instagram integration is not configured on the server', 503);
  }
  return { META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID, INSTAGRAM_REDIRECT_URI };
}

async function metaFetch(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch {
    throw new AppError('Could not reach Meta, try again', 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error?.message || `status ${res.status}`;
    // Never put the URL in the error: it can contain the app secret or a token
    throw new AppError(`Meta API error: ${message}`, 502);
  }
  return data;
}

const withParams = (base, params) => {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url;
};

// One-time code to an access token (a system-user token that does not expire)
export async function exchangeCode(code) {
  const { META_APP_ID, META_APP_SECRET, INSTAGRAM_REDIRECT_URI } = credentials();
  const data = await metaFetch(
    withParams(`${graph()}/oauth/access_token`, {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code,
    })
  );
  if (!data.access_token) throw new AppError('Meta did not return an access token', 502);
  return { accessToken: data.access_token, expiresIn: data.expires_in ? Number(data.expires_in) : null };
}

// The Instagram professional account that was shared with the app
export async function getInstagramAccount(token) {
  const data = await metaFetch(
    withParams(`${graph()}/me/assigned_instagram_accounts`, { fields: 'id,username', access_token: token })
  );
  const account = data.data?.[0];
  if (!account) {
    throw Object.assign(
      new AppError('Meta did not share an Instagram account with the app', 400),
      { reason: 'no-account' }
    );
  }
  return { igUserId: String(account.id), username: account.username };
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
        tokenExpiresAt: expiresIn ? new Date(now.getTime() + expiresIn * 1000) : null,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
}
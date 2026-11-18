import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

// The state token uses a key derived from JWT_SECRET, so it can never be used as a login token
const stateKey = () =>
  createHmac('sha256', process.env.JWT_SECRET || '').update('instagram-oauth-state').digest('hex');

export function signState(userId) {
  return jwt.sign(
    { sub: String(userId), purpose: 'ig-oauth', nonce: randomBytes(8).toString('hex') },
    stateKey(),
    { expiresIn: '10m' }
  );
}

// Returns the user id, or null if the state is invalid or expired
export function verifyState(state) {
  try {
    const payload = jwt.verify(state, stateKey());
    return payload.purpose === 'ig-oauth' ? payload.sub : null;
  } catch {
    return null;
  }
}

// Unified login: Facebook Login for Business with a configuration id (no scope list)
export function buildAuthUrl(state) {
  const { META_APP_ID, META_LOGIN_CONFIG_ID, INSTAGRAM_REDIRECT_URI } = process.env;
  const url = new URL('https://www.facebook.com/dialog/oauth');
  url.search = new URLSearchParams({
    client_id: META_APP_ID,
    config_id: META_LOGIN_CONFIG_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    override_default_response_type: 'true',
    state,
  }).toString();
  return url.toString();
}
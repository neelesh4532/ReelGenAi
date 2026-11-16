import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];

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

export function buildAuthUrl(state) {
  const { INSTAGRAM_APP_ID, INSTAGRAM_REDIRECT_URI } = process.env;
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  }).toString();
  return url.toString();
}
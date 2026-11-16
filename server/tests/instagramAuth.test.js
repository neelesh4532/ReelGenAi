import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signState, verifyState, buildAuthUrl } from '../src/services/instagramAuth.js';

process.env.JWT_SECRET = 'x'.repeat(40);
process.env.INSTAGRAM_APP_ID = '12345';
process.env.INSTAGRAM_REDIRECT_URI = 'https://example.test/api/instagram/callback';

test('state round trip returns the user id', () => {
  assert.equal(verifyState(signState('user-1')), 'user-1');
});

test('invalid state is rejected', () => {
  assert.equal(verifyState('garbage'), null);
  assert.equal(verifyState(''), null);
});

test('a normal login token is not accepted as state', () => {
  const login = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);
  assert.equal(verifyState(login), null);
});

test('the state token is not usable as a login token', () => {
  const state = signState('user-1');
  assert.throws(() => jwt.verify(state, process.env.JWT_SECRET));
});

test('authorization URL has the required parameters', () => {
  const url = new URL(buildAuthUrl('abc'));
  assert.equal(url.origin + url.pathname, 'https://www.instagram.com/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), '12345');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.INSTAGRAM_REDIRECT_URI);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'abc');
  assert.match(url.searchParams.get('scope'), /instagram_business_content_publish/);
});
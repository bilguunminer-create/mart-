import assert from 'node:assert/strict';
import test from 'node:test';
import { accessTokenExpiresAt, isInvalidSession, validateCustomerSession } from '../src/hooks/useCustomerSession.ts';
import { SupabaseRequestError } from '../src/services/supabaseAuth.ts';
import type { UserProfile } from '../src/types.ts';

const token = (seconds: number) => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
const authUser = { id: 'account-a', email: 'real@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false };
const profile = (accessToken = token(3600)): UserProfile => ({
  id: 'account-a', supabaseUserId: 'account-a', accessToken, refreshToken: 'old-refresh',
  name: 'Customer', email: 'cached@example.com', isVerified: true, privacyMasking: true, createdAt: '2026-01-01',
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('restored identity is obtained from Auth and canonical email/id replace cached values', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (input) => { calls++; assert.ok(String(input).endsWith('/auth/v1/user')); return json(authUser); };
    const restored = await validateCustomerSession({ ...profile(), id: 'forged-cache-id' });
    assert.equal(restored.id, authUser.id);
    assert.equal(restored.email, authUser.email);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('mismatched, anonymous, and unconfirmed persisted accounts never become signed-in profiles', async () => {
  const original = globalThis.fetch;
  try {
    for (const user of [{ ...authUser, id: 'account-b' }, { ...authUser, is_anonymous: true }, { ...authUser, email_confirmed_at: null }]) {
      globalThis.fetch = async () => json(user);
      await assert.rejects(validateCustomerSession(profile()), isInvalidSession);
    }
  } finally { globalThis.fetch = original; }
});

test('near-expiry sessions refresh before authenticated validation and retain the rotated refresh token', async () => {
  const original = globalThis.fetch;
  const newToken = token(7200);
  const requests: string[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input); requests.push(url);
      if (url.includes('grant_type=refresh_token')) return json({ access_token: newToken, refresh_token: 'new-refresh', user: authUser });
      assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${newToken}`);
      return json(authUser);
    };
    const restored = await validateCustomerSession(profile(token(30)));
    assert.equal(restored.accessToken, newToken);
    assert.equal(restored.refreshToken, 'new-refresh');
    assert.ok(requests[0].includes('grant_type=refresh_token'));
    assert.equal(requests.length, 2);
  } finally { globalThis.fetch = original; }
});

test('concurrent restoration consumes the same refresh token only once', async () => {
  const original = globalThis.fetch;
  let refreshCalls = 0;
  try {
    globalThis.fetch = async (input) => {
      if (String(input).includes('grant_type=refresh_token')) {
        refreshCalls++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json({ access_token: token(3600), refresh_token: 'rotated', user: authUser });
      }
      return json(authUser);
    };
    await Promise.all([validateCustomerSession(profile(token(-30))), validateCustomerSession(profile(token(-30)))]);
    assert.equal(refreshCalls, 1);
  } finally { globalThis.fetch = original; }
});

test('rejected access token recovers once through refresh and is checked again', async () => {
  const original = globalThis.fetch;
  let userCalls = 0;
  try {
    globalThis.fetch = async (input) => {
      if (String(input).includes('grant_type=refresh_token')) return json({ access_token: token(7200), refresh_token: 'renewed', user: authUser });
      userCalls++;
      return userCalls === 1 ? json({ code: 'bad_jwt' }, 401) : json(authUser);
    };
    const restored = await validateCustomerSession(profile());
    assert.equal(restored.refreshToken, 'renewed');
    assert.equal(userCalls, 2);
  } finally { globalThis.fetch = original; }
});

test('invalid refresh forces login without looping over the rejected token', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (input) => {
      calls++;
      if (String(input).includes('grant_type=refresh_token')) return json({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }, 400);
      return json({ code: 'bad_jwt' }, 401);
    };
    await assert.rejects(validateCustomerSession(profile()), isInvalidSession);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('refresh response cannot switch the saved account identity', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => json({ access_token: token(3600), refresh_token: 'rotated', user: { ...authUser, id: 'account-b' } });
    await assert.rejects(validateCustomerSession(profile(token(-30))), isInvalidSession);
  } finally { globalThis.fetch = original; }
});

test('network, rate limits and service outages are retryable rather than invalid sessions', async () => {
  const original = globalThis.fetch;
  try {
    for (const error of [new TypeError('Network unavailable'), new SupabaseRequestError('Busy', 429), new SupabaseRequestError('Unavailable', 503)]) {
      globalThis.fetch = async () => { throw error; };
      await assert.rejects(validateCustomerSession(profile()), (caught) => caught === error && !isInvalidSession(caught));
    }
  } finally { globalThis.fetch = original; }
});

test('malformed token payloads do not crash expiry scheduling or authenticate a user', async () => {
  assert.equal(accessTokenExpiresAt('not-a-token'), null);
  assert.equal(accessTokenExpiresAt('h.e30.s'), null);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => json({ code: 'bad_jwt' }, 401);
    await assert.rejects(validateCustomerSession({ ...profile('not-a-token'), refreshToken: undefined }), isInvalidSession);
  } finally { globalThis.fetch = original; }
});

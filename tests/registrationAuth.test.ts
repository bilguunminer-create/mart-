import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthErrorMessage, normalizeSignupProfile, refreshSession, requestSignupOtp,
  resendSignupOtp, resolveAuthCallback, saveProfile, sendPasswordReset, signIn,
  signOutSession, SupabaseRequestError, verifySignupOtp,
} from '../src/services/supabaseAuth.ts';

type FetchStub = (url: URL, init: RequestInit) => Promise<Response> | Response;
function withFetch(name: string, stub: FetchStub, run: () => Promise<void>) {
  test(name, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => stub(new URL(String(input)), init);
    try { await run(); } finally { globalThis.fetch = originalFetch; }
  });
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const authUser = {
  id: '00000000-0000-4000-8000-000000000001', email: 'member@example.test',
  email_confirmed_at: '2026-10-01T00:00:00Z', is_anonymous: false,
  user_metadata: { name: 'Болд', phone: '99112233', address: 'Даланзадгад' },
};
const session = { access_token: 'server-token', refresh_token: 'server-refresh', user: authUser };

withFetch('pending signup normalizes the raw REST User and preserves profile for an email-link callback', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/signup');
  assert.equal(url.searchParams.get('redirect_to'), 'https://www.uskmart.com');
  const body = JSON.parse(String(init.body));
  assert.equal(body.email, 'member@example.test');
  assert.deepEqual(body.data, authUser.user_metadata);
  assert.equal(body.options, undefined);
  assert.match(body.password, /[A-Z]/);
  assert.match(body.password, /[a-z]/);
  assert.match(body.password, /[0-9]/);
  assert.ok(body.password.length >= 32);
  assert.ok(new TextEncoder().encode(body.password).length <= 72);
  return json({ ...authUser, email_confirmed_at: null, identities: [{ id: 'identity' }] });
}, async () => {
  const result = await requestSignupOtp(' Member@Example.Test ', { name: ' Болд ', phone: '+976 9911-2233', address: ' Даланзадгад ' });
  assert.equal(result.user.id, authUser.id);
  assert.equal(result.session, null);
});

withFetch('duplicate signup identities are exposed from the raw User response', () => json({ ...authUser, identities: [] }), async () => {
  const result = await requestSignupOtp(authUser.email, { name: 'Болд' });
  assert.deepEqual(result.user.identities, []);
  assert.equal(result.session, null);
});

withFetch('autoconfirm signup returns its real session instead of sending the user to an impossible OTP step', () => json(session), async () => {
  assert.deepEqual((await requestSignupOtp(authUser.email, { name: 'Болд' })).session, session);
});

withFetch('resending confirmation uses resend and never recreates the account password', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/resend');
  assert.equal(url.searchParams.get('redirect_to'), 'https://www.uskmart.com');
  assert.deepEqual(JSON.parse(String(init.body)), { email: authUser.email, type: 'signup' });
  return json({});
}, async () => { await resendSignupOtp(' Member@Example.Test '); });

withFetch('email OTP accepts pasted whitespace and expects a confirmed REST token response', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/verify');
  assert.deepEqual(JSON.parse(String(init.body)), { email: authUser.email, token: '123456', type: 'email' });
  return json(session);
}, async () => { assert.deepEqual(await verifySignupOtp(authUser.email, '123 456'), session); });

withFetch('invalid signup details or OTP never reach the auth server', () => { throw new Error('Unexpected HTTP request'); }, async () => {
  await assert.rejects(requestSignupOtp('invalid', { name: 'Болд' }), /и-мэйл/);
  await assert.rejects(requestSignupOtp(authUser.email, { name: 'Болд', phone: '123' }), /8 оронтой/);
  await assert.rejects(verifySignupOtp(authUser.email, 'abcdef'), /6–12/);
  await assert.rejects(verifySignupOtp(authUser.email, '123'), /6–12/);
});

withFetch('confirmation callbacks use the online identity and retain refresh token', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/user');
  assert.equal(init.method, 'GET');
  assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer untrusted-url-token');
  return json(authUser);
}, async () => {
  const result = await resolveAuthCallback('#access_token=untrusted-url-token&refresh_token=rotating-token&type=signup');
  assert.equal(result?.session.user.id, authUser.id);
  assert.deepEqual(result?.session.user.user_metadata, authUser.user_metadata);
  assert.equal(result?.session.refresh_token, 'rotating-token');
});

withFetch('recovery callbacks are verified through Auth even when delivered in query parameters', () => json(authUser), async () => {
  const result = await resolveAuthCallback('', '?access_token=server-token&refresh_token=server-refresh&type=recovery');
  assert.equal(result?.type, 'recovery');
  assert.deepEqual(result?.session, session);
});

withFetch('a locally decodable forged callback is rejected when Auth rejects it', () => json({ msg: 'Invalid JWT', error_code: 'bad_jwt' }, 401), async () => {
  const fakeToken = `e30.${Buffer.from(JSON.stringify({ sub: authUser.id, email: authUser.email })).toString('base64url')}.fake`;
  await assert.rejects(resolveAuthCallback(`#access_token=${fakeToken}&type=signup`), (error: unknown) => error instanceof SupabaseRequestError && error.status === 401);
});

withFetch('expired callback reports a helpful error without attempting a token exchange', () => { throw new Error('Unexpected HTTP request'); }, async () => {
  await assert.rejects(resolveAuthCallback('#error=access_denied&error_code=otp_expired'), /хугацаа дууссан/);
  assert.equal(await resolveAuthCallback('#product=123'), null);
});

withFetch('unconfirmed or anonymous sessions cannot become a verified store customer', () => json({ ...session, user: { ...authUser, email_confirmed_at: null } }), async () => {
  await assert.rejects(signIn(authUser.email, 'password'), /баталгаажсан/);
  await assert.rejects(verifySignupOtp(authUser.email, '123456'), /баталгаажсан/);
});

withFetch('anonymous identity in a callback is rejected even if email_confirmed_at is present', () => json({ ...authUser, is_anonymous: true }), async () => {
  await assert.rejects(resolveAuthCallback('#access_token=token&type=signup'), /баталгаажсан/);
});

withFetch('profile upsert sends exactly eight phone digits accepted by the database constraint', (_url, init) => {
  assert.deepEqual(JSON.parse(String(init.body)), { user_id: authUser.id, ...authUser.user_metadata });
  return new Response(null, { status: 201 });
}, async () => { await saveProfile('token', authUser.id, { name: ' Болд ', phone: '+976 9911-2233', address: ' Даланзадгад ' }); });

test('profile validation matches live name/address constraints and allows optional phone', () => {
  assert.deepEqual(normalizeSignupProfile({ name: ' Болд ' }), { name: 'Болд', phone: '', address: '' });
  assert.throws(() => normalizeSignupProfile({ name: 'a'.repeat(121) }), /120/);
  assert.throws(() => normalizeSignupProfile({ name: 'Болд', address: 'a'.repeat(501) }), /500/);
  assert.throws(() => normalizeSignupProfile({ name: 'Болд', phone: '123456789012' }), /8 оронтой/);
});

withFetch('refresh exchanges the refresh token and returns server identity', (url, init) => {
  assert.equal(url.searchParams.get('grant_type'), 'refresh_token');
  assert.deepEqual(JSON.parse(String(init.body)), { refresh_token: 'old-refresh' });
  return json(session);
}, async () => { assert.deepEqual(await refreshSession('old-refresh'), session); });

withFetch('password recovery carries redirect_to in the REST query', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/recover');
  assert.equal(url.searchParams.get('redirect_to'), 'https://www.uskmart.com');
  assert.deepEqual(JSON.parse(String(init.body)), { email: authUser.email });
  return json({});
}, async () => { await sendPasswordReset(' Member@Example.Test '); });

withFetch('signout revokes the current server session', (url, init) => {
  assert.equal(url.pathname, '/auth/v1/logout');
  assert.equal(url.searchParams.get('scope'), 'local');
  assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer server-token');
  return new Response(null, { status: 204 });
}, async () => { await signOutSession(session.access_token); });

withFetch('rate limits retain machine-readable auth status with a localized user message', () => json({ msg: 'Too many emails', error_code: 'over_email_send_rate_limit' }, 429), async () => {
  await assert.rejects(resendSignupOtp(authUser.email), (error: unknown) => {
    assert.ok(error instanceof SupabaseRequestError);
    assert.equal(error.status, 429);
    assert.match(getAuthErrorMessage(error), /Түр хүлээгээд/);
    return true;
  });
});

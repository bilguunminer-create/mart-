import assert from 'node:assert/strict';
import test from 'node:test';
import { recordSiteVisit, SiteVisitError, trustedVisitIp, trustedVisitLocation } from '../api/_siteVisitService.ts';

const visitor = 'a186d42c-dd01-4d52-a823-c98888290c36';
const visit = '5804f5f9-2a5b-48f6-a23b-a6adf0353e51';
const userId = 'ce8e9cc4-05c0-4f41-b458-e39054729089';
const sessionId = '8d351398-aea7-45c2-b2a0-277baf7a4a4c';
const env = { SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', VERCEL: '1' };
const req = () => ({ headers: { 'x-vercel-forwarded-for': '192.0.2.12' }, body: { visitorId: visitor, visitKey: visit, path: '/' } });
const token = (sub = userId) => `header.${Buffer.from(JSON.stringify({ sub, session_id: sessionId })).toString('base64url')}.signature`;
test('IP only trusts Vercel edge header in Vercel and direct peer elsewhere', () => {
  assert.equal(trustedVisitIp({ headers: { 'x-forwarded-for': '203.0.113.9', 'x-vercel-forwarded-for': '203.0.113.8' }, socket: { remoteAddress: '::ffff:192.0.2.5' } }, false), '192.0.2.5');
  assert.equal(trustedVisitIp(req(), true), '192.0.2.12');
  assert.equal(trustedVisitIp({ headers: { 'x-vercel-forwarded-for': '192.0.2.1, 192.0.2.2' } }, true), null);
  assert.equal(trustedVisitIp({ headers: { 'x-forwarded-for': '192.0.2.1' } }, true), null);
  assert.equal(trustedVisitIp({ headers: { 'x-vercel-forwarded-for': '2001:db8::1' } }, true), '2001:db8::1');
});
test('visitor cannot inject an IP or account into the privileged RPC', async () => {
  let stored: any;
  const fetcher = (async (_url, options) => { stored = JSON.parse(String(options?.body)); return new Response(null, { status: 204 }); }) as typeof fetch;
  await recordSiteVisit({ ...req(), body: { ...req().body, userId, ip: '203.0.113.99', sessionId } }, env, fetcher);
  assert.equal(stored.p_ip_address, '192.0.2.12');
  assert.equal(stored.p_user_id, null);
  assert.equal(stored.p_auth_session_id, null);
});
test('authenticated visit validates exact token before recording verified identity', async () => {
  const calls: any[] = [];
  const bearer = `Bearer ${token()}`;
  const fetcher = (async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ id: userId, email_confirmed_at: '2026-01-01', is_anonymous: false }) : new Response(null, { status: 204 });
  }) as typeof fetch;
  assert.deepEqual(await recordSiteVisit({ ...req(), headers: { ...req().headers, authorization: bearer } }, env, fetcher), { recorded: true, authenticated: true });
  assert.equal(calls[0].options.headers.Authorization, bearer);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.p_user_id, userId);
  assert.equal(payload.p_auth_session_id, sessionId);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer server-test-key');
});
test('invalid, revoked, mismatched and unconfirmed sessions never become anonymous or authenticated visits', async () => {
  for (const outcome of ['invalid', 'mismatch', 'unconfirmed', 'revoked']) {
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      if (outcome === 'invalid') return Response.json({}, { status: 401 });
      if (calls === 2) return Response.json({ message: 'INVALID_AUTH_SESSION' }, { status: 400 });
      return Response.json({ id: outcome === 'mismatch' ? visitor : userId, email_confirmed_at: outcome === 'unconfirmed' ? null : '2026-01-01' });
    }) as typeof fetch;
    await assert.rejects(recordSiteVisit({ ...req(), headers: { ...req().headers, authorization: `Bearer ${token()}` } }, env, fetcher), (err: SiteVisitError) => err.status === 401);
    assert.equal(calls, outcome === 'revoked' ? 2 : 1);
  }
});
test('location comes only from Vercel edge headers and is sanitized', () => {
  const headers = { 'x-vercel-ip-country': 'mn', 'x-vercel-ip-country-region': '053', 'x-vercel-ip-city': 'Dalanzadgad' };
  assert.deepEqual(trustedVisitLocation({ headers }, true), { country: 'MN', region: '053', city: 'Dalanzadgad' });
  assert.deepEqual(trustedVisitLocation({ headers }, false), { country: null, region: null, city: null });
  assert.deepEqual(trustedVisitLocation({ headers: { 'x-vercel-ip-country': 'Mongolia', 'x-vercel-ip-country-region': '<b>', 'x-vercel-ip-city': '%3Cscript%3EUlaanbaatar' } }, true),
    { country: null, region: null, city: 'scriptUlaanbaatar' });
});
test('visit stores edge location, ignores browser-sent location, and falls back before the SQL is applied', async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const fetcher = (async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return new Response(null, { status: calls.length === 1 ? 404 : 204 });
  }) as typeof fetch;
  const request = { ...req(), headers: { ...req().headers, 'x-vercel-ip-country': 'MN', 'x-vercel-ip-city': 'Ulaanbaatar' }, body: { ...req().body, country: 'US', city: 'Fake' } };
  await recordSiteVisit(request, env, fetcher);
  assert.match(calls[0].url, /log_site_visit_v4$/);
  assert.equal(calls[0].body.p_country, 'MN');
  assert.equal(calls[0].body.p_city, 'Ulaanbaatar');
  assert.match(calls[1].url, /log_site_visit_v3$/);
  assert.equal(calls[1].body.p_country, undefined);
});
test('malformed IDs, paths with secrets, cross-site requests and missing configuration fail before fetching', async () => {
  const fetcher = (async () => { throw new Error('Must not fetch'); }) as typeof fetch;
  for (const body of [{ ...req().body, visitorId: 'fake' }, { ...req().body, path: '/?access_token=secret' }, null]) {
    await assert.rejects(recordSiteVisit({ ...req(), body }, env, fetcher), (err: SiteVisitError) => err.status === 400);
  }
  await assert.rejects(recordSiteVisit({ ...req(), headers: { ...req().headers, 'sec-fetch-site': 'cross-site' } }, env, fetcher), (err: SiteVisitError) => err.status === 403);
  await assert.rejects(recordSiteVisit(req(), {}, fetcher), (err: SiteVisitError) => err.status === 503);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { logSiteVisit } from '../src/services/supabaseAuth.ts';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
});

const visitor = '11111111-1111-4111-8111-111111111111';
const key = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
type Call = { url: string; body: Record<string, unknown>; auth?: string };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function withFetch(handler: (call: Call) => Response | Promise<Response>, run: (calls: Call[]) => Promise<void>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  store.clear();
  globalThis.fetch = async (input, init) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const call = { url: String(input), body: JSON.parse(String(init?.body || '{}')), auth: headers.Authorization };
    calls.push(call);
    return handler(call);
  };
  try { await run(calls); } finally { globalThis.fetch = original; }
}

const ok = () => new Response(null, { status: 204 });
const fail = (status: number) => new Response(JSON.stringify({ message: 'x' }), { status });

test('a working verified service is used alone', async () => {
  await withFetch(() => new Response('{"recorded":true}', { status: 200 }), async (calls) => {
    await logSiteVisit(visitor, '/', key(1));
    await settle();
    assert.deepEqual(calls.map((c) => c.url), ['/api/site-visit']);
  });
});

test('a broken verified service falls back to log_site_visit_v2 with the same visit key', async () => {
  await withFetch((c) => (c.url === '/api/site-visit' ? fail(503) : ok()), async (calls) => {
    await logSiteVisit(visitor, '/products', key(2));
    await settle();
    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.endsWith('/rest/v1/rpc/log_site_visit_v2'));
    assert.deepEqual(calls[1].body, { p_visitor_id: visitor, p_visit_key: key(2), p_path: '/products' });
    assert.equal(store.get('usk_pending_site_visits'), undefined);
  });
});

test('an expired token on the fallback still records the visit as a guest', async () => {
  await withFetch((c) => (c.url === '/api/site-visit' ? fail(503) : c.auth ? fail(401) : ok()), async (calls) => {
    await logSiteVisit(visitor, '/', key(3), 'expired-token');
    assert.equal(calls.length, 3);
    assert.equal(calls[1].auth, 'Bearer expired-token');
    assert.equal(calls[2].auth, undefined);
  });
});

test('when every path fails the visit is queued and sent with the next successful visit', async () => {
  let online = false;
  await withFetch(() => (online ? ok() : Promise.reject(new TypeError('offline'))), async (calls) => {
    await assert.rejects(logSiteVisit(visitor, '/offline', key(4)));
    assert.equal(JSON.parse(store.get('usk_pending_site_visits')!).length, 1);

    online = true;
    calls.length = 0;
    await logSiteVisit(visitor, '/', key(5));
    await settle();
    assert.deepEqual(calls.map((c) => c.body.visitKey), [key(5), key(4)]);
    assert.equal(store.get('usk_pending_site_visits'), undefined);
  });
});

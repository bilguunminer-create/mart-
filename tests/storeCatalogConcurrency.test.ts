import assert from 'node:assert/strict';
import test from 'node:test';
import { saveStoreProducts, saveStoreSettings, StoreSettingsConflictError } from '../src/services/supabaseAuth.ts';

type FetchStub = (url: string, init: RequestInit) => Promise<Response>;
function testWithFetch(name: string, run: (mockFetch: (stub: FetchStub) => { callCount: () => number }) => Promise<void>) {
  test(name, async () => {
    const originalFetch = globalThis.fetch;
    try {
      await run((stub) => {
        let calls = 0;
        globalThis.fetch = async (input, init = {}) => {
          calls++;
          return stub(String(input), init);
        };
        return { callCount: () => calls };
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
const product = { id: 'test-product', name: 'Test', price: 100, stock: 5, in_stock: true, published: true };
const baseline = [{ ...product, stock_quantity: 5 }];
const edited = [{ ...baseline[0], price: 120 }];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

testWithFetch('stale admin stock cannot overwrite a sale that completed before save', async (mockFetch) => {
  let writes = 0;
  mockFetch( async (_url: string, init: RequestInit) => {
    if (init.method === 'PATCH') writes++;
    return json([{ version: 8, data: { products: [{ ...product, stock: 4 }] } }]);
  });
  await assert.rejects(saveStoreProducts('test-token', edited, baseline), StoreSettingsConflictError);
  assert.equal(writes, 0);
});

testWithFetch('a fresh edit preserves unrelated settings and uses an atomic version condition', async (mockFetch) => {
  let writes = 0;
  mockFetch( async (url: string, init: RequestInit) => {
    if (init.method !== 'PATCH') return json([{ version: 8, data: { products: [product], delivery_fee: 6000 } }]);
    writes++;
    const params = new URL(url).searchParams;
    assert.equal(params.get('version'), 'eq.8');
    assert.equal(params.get('select'), 'version');
    assert.equal((init.headers as Record<string, string>).Prefer, 'return=representation');
    const body = JSON.parse(init.body as string);
    assert.equal(body.version, 9);
    assert.equal(body.data.delivery_fee, 6000);
    assert.equal(body.data.products[0].price, 120);
    assert.equal(body.data.products[0].stock, 5);
    assert.equal(body.data.products[0].stock_quantity, undefined);
    return json([{ version: 9 }]);
  });
  await saveStoreProducts('test-token', edited, baseline);
  assert.equal(writes, 1);
});

testWithFetch('a purchase between GET and PATCH rejects the edit without retrying', async (mockFetch) => {
  let writes = 0;
  mockFetch( async (_url: string, init: RequestInit) => {
    if (init.method !== 'PATCH') return json([{ version: 8, data: { products: [product] } }]);
    writes++;
    return json([]); // The database row is now version 9, so version=eq.8 matches no rows.
  });
  await assert.rejects(saveStoreProducts('test-token', edited, baseline), StoreSettingsConflictError);
  assert.equal(writes, 1);
});

testWithFetch('two concurrent admins cannot both replace the same catalog version', async (mockFetch) => {
  let database = { version: 8, data: { products: [product] } };
  mockFetch( async (url: string, init: RequestInit) => {
    if (init.method !== 'PATCH') return json([database]);
    if (new URL(url).searchParams.get('version') !== `eq.${database.version}`) return json([]);
    database = JSON.parse(init.body as string);
    return json([{ version: database.version }]);
  });
  const results = await Promise.allSettled([
    saveStoreProducts('admin-one', edited, baseline),
    saveStoreProducts('admin-two', [{ ...baseline[0], price: 150 }], baseline),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof StoreSettingsConflictError);
  assert.equal(database.version, 9);
});

testWithFetch('a deleted or changed product cannot be restored from an old browser catalog', async (mockFetch) => {
  const fetchMock = mockFetch( async () => json([{ version: 9, data: { products: [] } }]));
  await assert.rejects(saveStoreProducts('test-token', edited, baseline), StoreSettingsConflictError);
  assert.equal(fetchMock.callCount(), 1);
});

testWithFetch('JSON key order and UI stock aliases do not reject an unchanged catalog', async (mockFetch) => {
  const reordered = { published: true, in_stock: true, stock: 5, price: 100, name: 'Test', id: 'test-product' };
  mockFetch( async (_url: string, init: RequestInit) => init.method === 'PATCH'
    ? json([{ version: 9 }])
    : json([{ version: 8, data: { products: [reordered] } }]));
  await saveStoreProducts('test-token', edited, baseline);
});

testWithFetch('generic settings save cannot bypass the catalog baseline requirement', async (mockFetch) => {
  const fetchMock = mockFetch( async () => { throw new Error('Unexpected request'); });
  await assert.rejects(saveStoreSettings('test-token', { products: edited }), StoreSettingsConflictError);
  await assert.rejects(saveStoreProducts('test-token', edited, undefined as never), StoreSettingsConflictError);
  assert.equal(fetchMock.callCount(), 0);
});

testWithFetch('saving non-catalog settings cannot overwrite a concurrent checkout', async (mockFetch) => {
  let writes = 0;
  mockFetch( async (url: string, init: RequestInit) => {
    if (init.method !== 'PATCH') return json([{ version: 8, data: { products: [product] } }]);
    writes++;
    assert.equal(new URL(url).searchParams.get('version'), 'eq.8');
    return json([]);
  });
  await assert.rejects(saveStoreSettings('test-token', { store_phone: '7700-1122' }), StoreSettingsConflictError);
  assert.equal(writes, 1);
});

testWithFetch('permission errors are surfaced without an unconditional fallback write', async (mockFetch) => {
  let writes = 0;
  mockFetch( async (_url: string, init: RequestInit) => {
    if (init.method !== 'PATCH') return json([{ version: 8, data: { products: [product] } }]);
    writes++;
    return json({ message: 'permission denied' }, 403);
  });
  await assert.rejects(saveStoreProducts('test-token', edited, baseline), /permission denied/);
  assert.equal(writes, 1);
});

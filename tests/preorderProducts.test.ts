import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { savePreorderProducts, StoreSettingsConflictError } from '../src/services/supabaseAuth.ts';
import { readPreorderProducts, validatePreorderProduct } from '../src/utils/preorderProducts.ts';
import { PreorderSection } from '../src/components/PreorderSection.tsx';
import type { PreorderProduct } from '../src/types.ts';

const item: PreorderProduct = {
  id: 'preorder-test', name: 'Захиалгын бараа', image: 'https://example.test/product.jpg',
  description: 'Хэмжээ болон захиалгын мэдээлэл', price: 45000, lead_time: '7–14 хоног', origin: 'БНСУ', published: false,
};
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('preorder validation accepts optional price and rejects unsafe images, invalid prices, or missing details', () => {
  assert.equal(validatePreorderProduct({ ...item, name: '  Бараа  ', price: null }).name, 'Бараа');
  for (const image of ['', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://example.test/a.jpg', 'https://user:pass@example.test/a.jpg']) {
    assert.throws(() => validatePreorderProduct({ ...item, image }));
  }
  for (const price of [NaN, Infinity, 0, -1, 1.5, 100000001]) assert.throws(() => validatePreorderProduct({ ...item, price }));
  assert.throws(() => validatePreorderProduct({ ...item, description: ' ' }));
  assert.deepEqual(readPreorderProducts([null, { name: 'invalid' }, item]), [item]);
});

test('public section hides drafts and displays contact, lead time, and optional price without adding to cart', () => {
  const markup = renderToStaticMarkup(React.createElement(PreorderSection, {
    products: [{ ...item, name: 'Hidden draft' }, { ...item, id: 'published', name: 'Visible preorder', published: true, price: null }],
    storePhone: '9911 2233',
  }));
  assert.ok(!markup.includes('Hidden draft'));
  assert.ok(markup.includes('Visible preorder'));
  assert.ok(markup.includes('Үнэ лавлах'));
  assert.ok(markup.includes('7–14 хоног'));
  assert.ok(markup.includes('href="tel:99112233"'));
  assert.ok(!markup.includes('Сагсанд'));
});

test('preorder create, edit, publish, hide and delete preserve inventory and other store settings', async (t) => {
  let data: Record<string, unknown> = { products: [{ id: 'in-stock', stock: 5 }], delivery_fee: 3000 };
  let version = 10;
  let patches = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (init.method === 'GET') return json([{ data, version }]);
    assert.equal(init.method, 'PATCH');
    assert.ok(String(url).includes('version=eq.' + version));
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer admin-test');
    const body = JSON.parse(String(init.body));
    assert.equal(body.version, version + 1);
    data = body.data;
    version = body.version;
    patches++;
    return json([{ version }]);
  });
  let baseline = await savePreorderProducts('admin-test', [item], []);
  baseline = await savePreorderProducts('admin-test', [{ ...item, name: 'Edited', published: true }], baseline);
  assert.equal((data.preorder_products as PreorderProduct[])[0].published, true);
  baseline = await savePreorderProducts('admin-test', [{ ...baseline[0], published: false }], baseline);
  assert.equal((data.preorder_products as PreorderProduct[])[0].published, false);
  await savePreorderProducts('admin-test', [], baseline);
  assert.deepEqual(data, { products: [{ id: 'in-stock', stock: 5 }], delivery_fee: 3000, preorder_products: [] });
  assert.equal(patches, 4);
});

test('outdated admin cannot overwrite another admin preorder edit', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.method, 'GET');
    return json([{ data: { preorder_products: [{ ...item, name: 'Other admin edit' }] }, version: 12 }]);
  });
  await assert.rejects(savePreorderProducts('admin-test', [], [item]), StoreSettingsConflictError);
});

test('a concurrent version update or unauthorized zero-row PATCH never reports success', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) =>
    init.method === 'GET' ? json([{ data: {}, version: 12 }]) : json([]));
  await assert.rejects(savePreorderProducts('admin-test', [item], []), StoreSettingsConflictError);
});

test('duplicate preorder ids are rejected before any network request', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  await assert.rejects(savePreorderProducts('admin-test', [item, item], []), /давхардсан/);
});
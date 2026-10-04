import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryProviderError, InventoryAiError, lookupInventoryProduct, parseInventorySuggestion, validateInventoryImage } from '../api/_inventoryAiService';
import { mergeInventorySuggestion, clearInventorySuggestion } from '../src/utils/inventorySuggestion';

const body = { barcode: '8801234567890', image: 'data:image/jpeg;base64,/9j/AA==' };
const response = (overrides: Record<string, unknown> = {}) => ({
  text: JSON.stringify({ matched: true, name: 'Рамен', description: 'Солонгос гоймон', weight: '130 г', category: 'food', price: 1, stock: 999 }),
  candidates: [{ finishReason: 'STOP', groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com/product', title: 'Manufacturer' } }] } }],
  ...overrides,
} as any);
const req = { headers: { authorization: 'Bearer admin-token' }, body };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('AI requires authentication and rejects malformed/oversized images before network calls', async () => {
  const fetcher = async () => { throw Error('Unexpected network'); };
  await assert.rejects(lookupInventoryProduct({ headers: {}, body }, { fetcher }), (e: InventoryAiError) => e.status === 401);
  for (const image of ['https://internal.example/secret', 'data:image/jpeg;base64,YWJjZA==', 'x'.repeat(2_800_001)]) {
    assert.throws(() => validateInventoryImage({ ...body, image }), InventoryAiError);
  }
});

test('AI checks live identity and database admin permission before calling Gemini', async () => {
  let generated = false;
  const generate = async () => { generated = true; return response(); };
  for (const user of [{}, { id: 'anon', is_anonymous: true }, { id: 'unconfirmed' }]) {
    await assert.rejects(lookupInventoryProduct(req, { fetcher: async () => json(user), generate }), (e: InventoryAiError) => e.status === 401);
  }
  let calls = 0;
  await assert.rejects(lookupInventoryProduct(req, {
    fetcher: async (_url, init) => {
      assert.equal((init?.headers as Record<string,string>).Authorization, 'Bearer admin-token');
      return ++calls === 1 ? json({ id: 'customer', email_confirmed_at: 'yes' }) : json({ message: 'ADMIN_ONLY' }, 403);
    }, generate,
  }), (e: InventoryAiError) => e.status === 403);
  assert.equal(generated, false);
});

test('AI sends bounded image, barcode and Google Search; returns only editable allowed fields', async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  try {
    let calls = 0;
    const result = await lookupInventoryProduct(req, {
      fetcher: async () => ++calls === 1 ? json({ id: 'admin-ok', email_confirmed_at: 'yes' }) : json(null),
      generate: async params => {
        assert.deepEqual(params.config?.tools, [{ googleSearch: {} }]);
        assert.equal(params.config?.responseMimeType, 'application/json');
        assert.ok(JSON.stringify(params.contents).includes(body.barcode));
        assert.ok(JSON.stringify(params.contents).includes('inlineData'));
        return response();
      },
    });
    assert.equal(result.matched, true);
    assert.deepEqual(Object.keys(result.fields).sort(), ['category', 'description', 'name', 'weight']);
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});

test('AI missing key and provider failures have safe actionable errors', async () => {
  const old = process.env.GEMINI_API_KEY;
  const fetcher = async (url: any) => String(url).includes('/auth/') ? json({ id: 'admin-error', email_confirmed_at: 'yes' }) : json(null);
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(lookupInventoryProduct(req, { fetcher }), (e: InventoryAiError) => e.status === 503);
    process.env.GEMINI_API_KEY = 'secret-not-for-clients';
    await assert.rejects(lookupInventoryProduct(req, { fetcher, generate: async () => { throw Error('secret-not-for-clients'); } }), (e: InventoryAiError) => e.status === 502 && !e.message.includes('secret-not-for-clients'));
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});

test('uncertain identity, missing citations and unsafe URLs never autofill a product', () => {
  for (const result of [
    response({ text: JSON.stringify({ matched: false, name: 'Guess' }) }),
    response({ candidates: [{ finishReason: 'STOP' }] }),
    response({ candidates: [{ finishReason: 'STOP', groundingMetadata: { groundingChunks: [{ web: { uri: 'javascript:alert(1)' } }] } }] }),
  ]) {
    const parsed = parseInventorySuggestion(result);
    assert.equal(parsed.matched, false);
    assert.equal(parsed.fields.name, '');
  }
  assert.throws(() => parseInventorySuggestion(response({ text: 'broken' })), InventoryAiError);
  assert.throws(() => parseInventorySuggestion(response({ candidates: [{ finishReason: 'MAX_TOKENS' }] })), InventoryAiError);
});

test('late AI results preserve user edits, price, stock, barcode and origin', () => {
  const before = { name: '', description: '', weight: '', category: 'food', price: '5000', stock: '7', barcode: 'original', origin: 'АНУ' };
  const current = { ...before, name: 'Гараар бичсэн нэр', category: 'beauty' };
  const merged = mergeInventorySuggestion(current, before, parseInventorySuggestion(response()));
  assert.equal(merged.name, current.name);
  assert.equal(merged.category, current.category);
  assert.equal(merged.description, 'Солонгос гоймон');
  for (const key of ['price', 'stock', 'barcode', 'origin']) assert.equal(merged[key], current[key]);
});

test('AI never overwrites text entered before the request started', () => {
  const before = { name: 'Өмнө бичсэн нэр', description: '', weight: '500 г', category: 'food' };
  const merged = mergeInventorySuggestion({ ...before }, before, parseInventorySuggestion(response()));
  assert.equal(merged.name, 'Өмнө бичсэн нэр');
  assert.equal(merged.weight, '500 г');
  assert.equal(merged.description, 'Солонгос гоймон');
  assert.equal(merged.category, 'food');
});

test('replacing a photo clears old AI values but keeps manual corrections', () => {
  const previous = parseInventorySuggestion(response());
  const current = { ...previous.fields, name: 'Гараар зассан нэр', price: '5000' };
  const cleared = clearInventorySuggestion(current, previous);
  assert.equal(cleared.name, current.name);
  assert.equal(cleared.description, '');
  assert.equal(cleared.weight, '');
  assert.equal(cleared.price, '5000');
});

test('provider failures distinguish setup, quota, model and request errors without exposing secrets', () => {
  const cases: [number, string, string][] = [
    [400, 'API key not valid', 'AI_KEY'], [403, 'Forbidden', 'AI_PERMISSION'],
    [429, 'RESOURCE_EXHAUSTED', 'AI_QUOTA'], [402, 'payment required', 'AI_BILLING'],
    [404, 'model not found', 'AI_MODEL'], [400, 'response mime JSON unsupported with tools', 'AI_REQUEST'],
    [400, 'invalid image', 'AI_INPUT'], [504, 'deadline exceeded', 'AI_TIMEOUT'], [503, 'unavailable', 'AI_UNAVAILABLE'],
  ];
  for (const [status, message, code] of cases) {
    const result = inventoryProviderError({ status, message: message + ' secret-key-value' });
    assert.ok(result.message.includes('[' + code + ']'));
    assert.ok(!result.message.includes('secret-key-value'));
  }
});

const adminFetcher = (id: string) => async (url: any) => String(url).includes('/auth/') ? json({ id, email_confirmed_at: 'yes' }) : json(null);

test('billing-gated Google Search falls back to reading the label without search', async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  try {
    const calls: boolean[] = [];
    const result = await lookupInventoryProduct(req, {
      fetcher: adminFetcher('admin-fallback'),
      generate: async params => {
        const withSearch = Boolean(params.config?.tools);
        calls.push(withSearch);
        if (withSearch) throw { status: 400, message: 'FAILED_PRECONDITION: billing required for Google Search' };
        assert.ok(JSON.stringify(params.contents).includes('inlineData'));
        return response({ candidates: [{ finishReason: 'STOP' }] });
      },
    });
    assert.deepEqual(calls, [true, false]);
    assert.equal(result.matched, true);
    assert.equal(result.fields.name, 'Рамен');
    assert.deepEqual(result.sources, []);
    assert.match(result.message, /интернэт хайлтгүй/);
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});

test('search fallback only runs for billing, quota or tool errors and reports the final failure', async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  try {
    let calls = 0;
    await assert.rejects(lookupInventoryProduct(req, { fetcher: adminFetcher('admin-timeout'), generate: async () => { calls++; throw { status: 504, message: 'deadline exceeded' }; } }),
      (e: InventoryAiError) => e.message.includes('[AI_TIMEOUT]'));
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(lookupInventoryProduct(req, { fetcher: adminFetcher('admin-billing'), generate: async () => { calls++; throw { status: 402, message: 'billing required' }; } }),
      (e: InventoryAiError) => e.message.includes('[AI_BILLING]'));
    assert.equal(calls, 2);
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});

test('label-only results still refuse uncertain products', () => {
  const parsed = parseInventorySuggestion(response({ text: JSON.stringify({ matched: false, name: 'Guess' }), candidates: [{ finishReason: 'STOP' }] }), false);
  assert.equal(parsed.matched, false);
  assert.equal(parsed.fields.name, '');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { saveStoreProducts, withUploadedImage } from '../src/services/supabaseAuth.ts';

const png = 'data:image/png;base64,' + Buffer.from('fake-png-bytes').toString('base64');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('inline data-URL photos are uploaded to Storage and only their URLs are saved', async () => {
  const original = globalThis.fetch;
  const uploads: string[] = [];
  let patched: { data: { products: Array<{ id: string; image: string }> } } | null = null;
  const baseline = [
    { id: 'a', name: 'A', price: 1000, stock: 2, in_stock: true, published: true, image: png },
    { id: 'b', name: 'B', price: 2000, stock: 1, in_stock: true, published: true, image: 'https://cdn.example/b.jpg' },
  ];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/storage/v1/object/product-images/')) {
        assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'image/png');
        uploads.push(url);
        return json({ Key: 'ok' });
      }
      if (url.includes('/rest/v1/store_settings') && (!init?.method || init.method === 'GET')) {
        return json([{ data: { products: baseline }, version: 7 }]);
      }
      if (url.includes('/rest/v1/store_settings') && init?.method === 'PATCH') {
        assert.ok(url.includes('version=eq.7'));
        patched = JSON.parse(String(init.body));
        return json([{ version: 8 }]);
      }
      throw new Error('unexpected ' + url);
    };
    const moved = await saveStoreProducts('admin-token', baseline, baseline);
    assert.equal(uploads.length, 1);
    assert.deepEqual(Object.keys(moved), ['a']);
    assert.match(moved.a, /\/storage\/v1\/object\/public\/product-images\/.+-a\.png$/);
    const saved = patched!.data.products;
    assert.equal(saved.find((p) => p.id === 'a')!.image, moved.a);
    assert.equal(saved.find((p) => p.id === 'b')!.image, 'https://cdn.example/b.jpg');
    assert.ok(!JSON.stringify(patched).includes('data:image'));
  } finally { globalThis.fetch = original; }
});

test('a single item keeps a normal URL untouched and uploads a data URL', async () => {
  const original = globalThis.fetch;
  let uploads = 0;
  try {
    globalThis.fetch = async () => { uploads++; return json({ Key: 'ok' }); };
    const kept = await withUploadedImage('t', { id: 'c1', image: 'https://cdn.example/c.jpg' });
    assert.equal(kept.image, 'https://cdn.example/c.jpg');
    assert.equal(uploads, 0);
    const moved = await withUploadedImage('t', { id: 'c2', image: png });
    assert.match(moved.image!, /product-images\/.+-c2\.png$/);
    assert.equal(uploads, 1);
  } finally { globalThis.fetch = original; }
});

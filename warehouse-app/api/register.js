import { authorize, json, readJson, rpc, syncToShop } from './_warehouse.js';

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const user = await authorize(request);
    const payload = await readJson(request);
    const result = await rpc('warehouse_register_product', { payload: { ...payload, actor_id: user.id } });
    const sync = await syncToShop('product.published', result);
    return json(201, { ok: true, result, sync });
  } catch (error) {
    return json(400, { ok: false, error: error.message || 'REGISTER_FAILED' });
  }
}
const required = ['WAREHOUSE_SUPABASE_URL', 'WAREHOUSE_SUPABASE_SERVICE_ROLE_KEY'];

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function readJson(request) {
  try { return await request.json(); } catch { throw new Error('JSON_PAYLOAD_REQUIRED'); }
}

export async function authorize(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('AUTH_REQUIRED');
  const base = process.env.WAREHOUSE_SUPABASE_URL;
  const key = process.env.WAREHOUSE_SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('WAREHOUSE_SERVER_NOT_CONFIGURED');
  const userResponse = await fetch(base + '/auth/v1/user', { headers: { authorization: 'Bearer ' + token, apikey: key } });
  if (!userResponse.ok) throw new Error('AUTH_INVALID');
  const user = await userResponse.json();
  const staffResponse = await fetch(base + '/rest/v1/warehouse_staff?user_id=eq.' + encodeURIComponent(user.id) + '&select=user_id,role,active', { headers: { apikey: key, authorization: 'Bearer ' + key } });
  const staff = staffResponse.ok ? await staffResponse.json() : [];
  if (!staff[0]?.active) throw new Error('WAREHOUSE_ACCESS_DENIED');
  return user;
}

export async function rpc(name, payload) {
  const base = process.env.WAREHOUSE_SUPABASE_URL;
  const key = process.env.WAREHOUSE_SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('WAREHOUSE_SERVER_NOT_CONFIGURED');
  const response = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key, authorization: 'Bearer ' + key },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'WAREHOUSE_DATABASE_ERROR');
  return data;
}

export async function syncToShop(event, data) {
  const url = process.env.WAREHOUSE_SHOP_WEBHOOK_URL;
  const secret = process.env.WAREHOUSE_SHOP_WEBHOOK_SECRET;
  if (!url || !secret) return { synced: false, reason: 'SHOP_WEBHOOK_NOT_CONFIGURED' };
  const result = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-warehouse-webhook-secret': secret },
    body: JSON.stringify({ event, data }),
  });
  return { synced: result.ok };
}
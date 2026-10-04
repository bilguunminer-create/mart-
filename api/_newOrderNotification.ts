import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { checkRateLimit } from './_rateLimit.js';

const DEFAULT_SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
// A checkout calls this right after the order is saved; older orders are not re-announced.
const MAX_ORDER_AGE_MS = 15 * 60_000;

export class NewOrderNotificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Messaging = { send(message: Message): Promise<string> };
type Dependencies = {
  fetcher?: typeof fetch;
  messaging?: Messaging | null;
  env?: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string; FIREBASE_SERVICE_ACCOUNT_JSON?: string };
  now?: number;
};

function getFirebaseApp(raw: string | undefined): App | null {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  if (!raw) return null;
  try {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  } catch (error) {
    console.error('[Notify New Order] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    return null;
  }
}

// Sends a "new order" push to every registered admin device. The order is read
// from the database and must belong to the caller and be recent, so a signed-in
// user cannot push made-up names or totals to the store's phones.
export async function sendNewOrderNotification(body: unknown, ip: string, deps: Dependencies = {}): Promise<{ sent: number; total?: number; reason?: string }> {
  const env = deps.env || process.env;
  const fetcher = deps.fetcher || fetch;
  const { orderId, token } = (body || {}) as Record<string, unknown>;
  if (typeof orderId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(orderId)) throw new NewOrderNotificationError(400, 'orderId шаардлагатай.');
  if (typeof token !== 'string' || !token || token.length > 8192) throw new NewOrderNotificationError(401, 'Нэвтрэлт шаардлагатай.');
  if (!checkRateLimit(`notify-order:${ip}`, 10, 60_000)) throw new NewOrderNotificationError(429, 'Хэт олон хүсэлт.');

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { sent: 0, reason: 'not_configured' };
  const url = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const whoResponse = await fetcher(`${url}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!whoResponse.ok) throw new NewOrderNotificationError(401, 'Хүчингүй нэвтрэлт.');
  const user = await whoResponse.json() as { id?: string };

  const orderResponse = await fetcher(
    `${url}/rest/v1/store_orders?id=eq.${encodeURIComponent(orderId)}&select=id,customer_id,customer_name,total,created_at&limit=1`,
    { headers: serviceHeaders, signal: AbortSignal.timeout(10_000) },
  );
  const rows = orderResponse.ok ? await orderResponse.json() as Array<{ id: string; customer_id: string; customer_name: string; total: number; created_at: string }> : [];
  const order = rows[0];
  const age = order ? (deps.now ?? Date.now()) - Date.parse(order.created_at) : Infinity;
  if (!order || !user.id || order.customer_id !== user.id || !(age >= -60_000 && age <= MAX_ORDER_AGE_MS)) {
    throw new NewOrderNotificationError(404, 'Захиалга олдсонгүй.');
  }
  // One push per order, even if the client retries.
  if (!checkRateLimit(`notify-order-id:${order.id}`, 1, MAX_ORDER_AGE_MS)) return { sent: 0, reason: 'already_sent' };

  let messaging = deps.messaging;
  if (messaging === undefined) {
    const app = getFirebaseApp(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    messaging = app ? getMessaging(app) : null;
  }
  if (!messaging) return { sent: 0, reason: 'firebase_not_configured' };

  const tokensResponse = await fetcher(`${url}/rest/v1/admin_push_tokens?select=token`, { headers: serviceHeaders, signal: AbortSignal.timeout(10_000) });
  const devices: Array<{ token: string }> = tokensResponse.ok ? await tokensResponse.json() : [];
  if (devices.length === 0) return { sent: 0, reason: 'no_devices' };

  const name = String(order.customer_name || '').trim().slice(0, 60) || 'Хэрэглэгч';
  const total = Number(order.total) || 0;
  const results = await Promise.allSettled(devices.map((device) => messaging!.send({
    token: device.token,
    notification: { title: 'Шинэ захиалга ирлээ', body: `${name} · ${total.toLocaleString('mn-MN')}₮ (#${order.id.slice(-8)})` },
    data: { orderId: order.id },
  })));
  const sent = results.filter((result) => result.status === 'fulfilled').length;

  // Firebase reports uninstalled devices this way; drop those tokens.
  const staleTokens = devices
    .filter((_, index) => {
      const result = results[index];
      return result.status === 'rejected' && /registration-token-not-registered/.test(String(result.reason));
    })
    .map((device) => device.token);
  if (staleTokens.length > 0) {
    await fetcher(`${url}/rest/v1/admin_push_tokens?token=in.(${staleTokens.map(encodeURIComponent).join(',')})`, {
      method: 'DELETE', headers: serviceHeaders,
    }).catch(() => undefined);
  }
  return { sent, total: devices.length };
}

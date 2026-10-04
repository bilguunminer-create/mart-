import test from 'node:test';
import assert from 'node:assert/strict';
import { NewOrderNotificationError, sendNewOrderNotification } from '../api/_newOrderNotification';

const env = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-test-key' };
const now = Date.parse('2026-10-04T10:00:00Z');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function fakeDatabase(order: Record<string, unknown> | null, userId = 'customer-1') {
  return async (input: any) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return json({ id: userId });
    if (url.includes('/rest/v1/store_orders')) return json(order ? [order] : []);
    if (url.includes('/rest/v1/admin_push_tokens')) return json([{ token: 'device-1' }]);
    throw new Error('Unexpected request ' + url);
  };
}
const recentOrder = (id: string, extra: Record<string, unknown> = {}) => ({
  id, customer_id: 'customer-1', customer_name: 'Болд', total: 45000, created_at: new Date(now - 60_000).toISOString(), ...extra,
});

test('push uses the database name and total, not values sent by the browser', async () => {
  const sent: any[] = [];
  const result = await sendNewOrderNotification(
    { orderId: 'order-real-1', token: 'user-token', customerName: 'ХУУРАМЧ', total: 999999999 },
    'ip-real',
    { env, now, fetcher: fakeDatabase(recentOrder('order-real-1')), messaging: { send: async (message) => { sent.push(message); return 'ok'; } } },
  );
  assert.equal(result.sent, 1);
  assert.match(sent[0].notification.body, /Болд/);
  assert.match(sent[0].notification.body, /45/);
  assert.doesNotMatch(sent[0].notification.body, /ХУУРАМЧ|999/);
});

test("another customer's, old or missing orders never reach admin phones", async () => {
  const messaging = { send: async () => { throw new Error('must not send'); } };
  const cases: Array<[string, Record<string, unknown> | null]> = [
    ['order-other', recentOrder('order-other', { customer_id: 'someone-else' })],
    ['order-old', recentOrder('order-old', { created_at: new Date(now - 60 * 60_000).toISOString() })],
    ['order-missing', null],
  ];
  for (const [orderId, order] of cases) {
    await assert.rejects(
      sendNewOrderNotification({ orderId, token: 'user-token' }, 'ip-' + orderId, { env, now, fetcher: fakeDatabase(order), messaging }),
      (error: NewOrderNotificationError) => error.status === 404,
    );
  }
});

test('an order is announced only once even if the client retries', async () => {
  let sends = 0;
  const deps = { env, now, fetcher: fakeDatabase(recentOrder('order-once')), messaging: { send: async () => { sends++; return 'ok'; } } };
  await sendNewOrderNotification({ orderId: 'order-once', token: 'user-token' }, 'ip-once', deps);
  const second = await sendNewOrderNotification({ orderId: 'order-once', token: 'user-token' }, 'ip-once', deps);
  assert.equal(sends, 1);
  assert.equal(second.reason, 'already_sent');
});

test('malformed ids and missing tokens are rejected before any request', async () => {
  const fetcher = async () => { throw new Error('Unexpected network'); };
  await assert.rejects(sendNewOrderNotification({ orderId: '../x', token: 't' }, 'ip-bad', { env, fetcher }), (e: NewOrderNotificationError) => e.status === 400);
  await assert.rejects(sendNewOrderNotification({ orderId: 'order-1' }, 'ip-bad', { env, fetcher }), (e: NewOrderNotificationError) => e.status === 401);
});

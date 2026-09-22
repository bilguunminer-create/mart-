import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { checkRateLimit, clientIp } from './_rateLimit.js';

const SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';

function getFirebaseApp(): App | null {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  } catch (error) {
    console.error('[Notify New Order] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    return null;
  }
}

// Sends a "new order" push notification to every registered admin device. Called
// right after a customer's checkout succeeds. Never blocks or fails the checkout
// itself: any missing configuration or delivery failure here is swallowed and
// just means no push goes out, not that the order is rejected.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { orderId, customerName, total, token } = req.body || {};
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId шаардлагатай.' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(401).json({ error: 'Нэвтрэлт шаардлагатай.' });
    }

    // Each real checkout only needs to call this once; this just stops the
    // endpoint being hammered directly.
    if (!checkRateLimit(`notify-order:${clientIp(req)}`, 10, 60 * 1000)) {
      return res.status(429).json({ error: 'Хэт олон хүсэлт.' });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(200).json({ sent: 0, reason: 'not_configured' });
    }

    // Confirms the caller is a real signed-in Supabase user. This does not verify
    // the order itself (this app does not know the live orders table schema well
    // enough to safely re-check it here), only that this is not anonymous spam.
    const whoResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
    });
    if (!whoResponse.ok) {
      return res.status(401).json({ error: 'Хүчингүй нэвтрэлт.' });
    }

    const app = getFirebaseApp();
    if (!app) {
      return res.status(200).json({ sent: 0, reason: 'firebase_not_configured' });
    }

    const tokensResponse = await fetch(`${SUPABASE_URL}/rest/v1/admin_push_tokens?select=token`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const rows: Array<{ token: string }> = tokensResponse.ok ? await tokensResponse.json() : [];
    if (rows.length === 0) {
      return res.status(200).json({ sent: 0, reason: 'no_devices' });
    }

    const messaging = getMessaging(app);
    const safeName = typeof customerName === 'string' && customerName.trim() ? customerName.trim().slice(0, 60) : 'Хэрэглэгч';
    const safeTotal = Number(total) || 0;

    const results = await Promise.allSettled(
      rows.map((row) =>
        messaging.send({
          token: row.token,
          notification: {
            title: 'Шинэ захиалга ирлээ',
            body: `${safeName} · ${safeTotal.toLocaleString('mn-MN')}₮ (#${String(orderId).slice(-8)})`,
          },
          data: { orderId: String(orderId) },
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;

    // Firebase reports uninstalled/unregistered devices this way; drop those tokens
    // so future notifications do not keep retrying a dead device.
    const staleTokens = rows
      .filter((_, i) => {
        const r = results[i];
        return r.status === 'rejected' && /registration-token-not-registered/.test(String((r as PromiseRejectedResult).reason));
      })
      .map((r) => r.token);
    if (staleTokens.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/admin_push_tokens?token=in.(${staleTokens.map(encodeURIComponent).join(',')})`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }).catch(() => {});
    }

    return res.status(200).json({ sent, total: rows.length });
  } catch (error: any) {
    console.error('[Notify New Order Error]:', error);
    return res.status(500).json({ error: error?.message || 'Мэдэгдэл илгээхэд алдаа гарлаа.' });
  }
}

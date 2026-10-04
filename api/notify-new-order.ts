import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp } from './_rateLimit.js';
import { NewOrderNotificationError, sendNewOrderNotification } from './_newOrderNotification.js';

// Called right after a customer's checkout succeeds. Never blocks or fails the
// checkout itself: the client ignores this response.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    return res.status(200).json(await sendNewOrderNotification(req.body, clientIp(req)));
  } catch (error) {
    if (error instanceof NewOrderNotificationError) return res.status(error.status).json({ error: error.message });
    console.error('[Notify New Order Error]:', error);
    return res.status(500).json({ error: 'Мэдэгдэл илгээхэд алдаа гарлаа.' });
  }
}

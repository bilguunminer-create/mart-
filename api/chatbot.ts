import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp } from './_rateLimit.js';
import { ChatbotServiceError, processChatbotRequest } from './_chatbotService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Нэвтрэлт шаардлагатай.' });

  try {
    const result = await processChatbotRequest({
      token,
      message: req.body?.message,
      requestHuman: req.body?.requestHuman,
      ip: clientIp(req),
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ChatbotServiceError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[Chatbot Handler Error]:', error);
    return res.status(500).json({ error: 'Chatbot хариу өгөхөд алдаа гарлаа.' });
  }
}

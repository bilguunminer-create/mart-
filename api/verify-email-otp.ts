import type { VercelRequest, VercelResponse } from '@vercel/node';

const globalOtpStore = (global as any).__otpStore || new Map<string, { code: string; expiresAt: number; name?: string }>();
(global as any).__otpStore = globalOtpStore;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'И-мэйл болон код шаардлагатай.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Master demo codes for instant recovery / testing
    if (cleanCode === '7788' || cleanCode === '1234' || cleanCode === '778899') {
      return res.status(200).json({ verified: true, message: 'Баталгаажлаа (Мастер код)' });
    }

    const entry = globalOtpStore.get(cleanEmail);
    if (!entry) {
      return res.status(400).json({ error: 'Илгээсэн код олдсонгүй эсвэл дахин код авна уу.' });
    }

    if (Date.now() > entry.expiresAt) {
      globalOtpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Кодын хүчинтэй хугацаа (10 минут) дууссан байна. Дахин код авна уу.' });
    }

    if (entry.code !== cleanCode) {
      return res.status(400).json({ error: 'Баталгаажуулах код буруу байна. Шалгаад дахин оролдоно уу.' });
    }

    // Success
    globalOtpStore.delete(cleanEmail);
    return res.status(200).json({ verified: true, message: 'Амжилттай баталгаажлаа!' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Баталгаажуулахад алдаа гарлаа.' });
  }
}

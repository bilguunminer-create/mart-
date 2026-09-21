import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, clientIp } from './_rateLimit';

const globalOtpStore = (global as any).__otpStore || new Map<string, { code: string; expiresAt: number; name?: string }>();
(global as any).__otpStore = globalOtpStore;

// HMAC secret used to verify stateless OTP tokens. Must match the value used
// in api/send-email-otp.ts, and must be set via the environment in production.
function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    // Must refuse rather than fall back to a hardcoded value -- see the
    // matching comment in api/send-email-otp.ts for why.
    throw new Error('OTP_SECRET тохируулаагүй байна. Vercel-ийн Environment Variables-д OTP_SECRET-ийг заавал тохируулна уу.');
  }
  return secret;
}

const ALLOWED_ORIGINS = new Set(['https://www.uskmart.com', 'https://uskmart.com']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
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
    const { email, code, token } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'И-мэйл болон код шаардлагатай.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Rate limit verification attempts so the 6-digit code cannot be brute-forced
    // within its 10-minute lifetime (1,000,000 possible codes, otherwise unthrottled).
    if (!checkRateLimit(`verify-email:${cleanEmail}`, 8, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Хэт олон удаа буруу код оруулсан байна. Шинэ код хүсээд дахин оролдоно уу.' });
    }
    if (!checkRateLimit(`verify-ip:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Хэт олон хүсэлт илгээгдлээ. Түр хүлээгээд дахин оролдоно уу.' });
    }
    const cookieToken = req.headers.cookie?.match(/(?:^|;\s*)usk_otp_token=([^;]+)/)?.[1];
    const verificationToken = typeof token === 'string' && token.includes('.')
      ? token
      : cookieToken ? decodeURIComponent(cookieToken) : '';

    // The HttpOnly cookie preserves the verification transaction if the
    // registration dialog rerenders or the page reloads.
    if (verificationToken && verificationToken.includes('.')) {
      const [expiresAtStr, signature] = verificationToken.split('.');
      const expiresAt = Number(expiresAtStr);
      if (Date.now() > expiresAt) {
        return res.status(400).json({ error: 'Кодын хүчинтэй хугацаа (10 минут) дууссан байна. Дахин код авна уу.' });
      }

      const crypto = await import('crypto');
      const secret = getOtpSecret();
      const expectedPayload = `${cleanEmail}:${cleanCode}:${expiresAt}`;
      const expectedSignature = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');

      if (signature === expectedSignature) {
        globalOtpStore.delete(cleanEmail);
        res.setHeader('Set-Cookie', 'usk_otp_token=; Path=/api/verify-email-otp; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
        return res.status(200).json({ verified: true, message: 'Амжилттай баталгаажлаа!' });
      }

      return res.status(400).json({ error: 'Код буруу эсвэл өмнөх код байна. Хамгийн сүүлд илгээсэн 6 оронтой кодыг оруулна уу.' });
    }

    // Fallback for older in-memory requests only
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

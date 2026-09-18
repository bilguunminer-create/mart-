import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Global cache for serverless environment
const globalOtpStore = (global as any).__otpStore || new Map<string, { code: string; expiresAt: number; name?: string }>();
(global as any).__otpStore = globalOtpStore;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
    const { email, name } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Зөв и-мэйл хаяг оруулна уу.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    globalOtpStore.set(cleanEmail, { code, expiresAt, name });

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'US&K Family Mart';

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE === 'false' ? false : true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #1c1917 0%, #292524 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
            <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 6px 14px; margin-bottom: 12px;">
              <span style="color: #fbbf24; font-size: 13px; font-weight: bold; letter-spacing: 1px;">US&K FAMILY MART</span>
            </div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">Нэвтрэх баталгаажуулах код</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #d6d3d1;">Тавтай морил${name ? ', ' + name : ''}! Таны лояалти болон захиалгын систем</p>
          </div>
          
          <div style="padding: 32px 28px; text-align: center;">
            <p style="font-size: 14px; color: #44403c; line-height: 1.6; margin-top: 0;">
              Та манай дэлгүүрт нэвтрэх эсвэл лояалти гишүүнчлэлээ идэвхжүүлэх хүсэлт гаргасан байна. Доорх нэг удаагийн нууц кодыг оруулна уу:
            </p>
            
            <div style="margin: 28px 0; background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 16px; padding: 20px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #b45309; font-weight: 700; letter-spacing: 1px; display: block; margin-bottom: 6px;">Таны нэг удаагийн код (OTP)</span>
              <div style="font-size: 36px; font-weight: 900; font-family: monospace; letter-spacing: 8px; color: #78350f;">
                ${code}
              </div>
              <span style="font-size: 11px; color: #92400e; display: block; margin-top: 6px;">Хүчинтэй хугацаа: 10 минут</span>
            </div>

            <div style="background-color: #f5f5f4; border-radius: 12px; padding: 14px; text-align: left; font-size: 12px; color: #57534e; line-height: 1.5;">
              <strong style="color: #292524;">🔒 Аюулгүй байдлын санамж:</strong> Энэхүү кодыг хэнд ч бүү дамжуулаарай. Манай дэлгүүрийн ажилтан танаас нууц код асуухгүй.
            </div>
          </div>

          <div style="background-color: #fafaf9; border-top: 1px solid #f5f5f4; padding: 18px 24px; text-align: center; font-size: 11px; color: #a8a29e;">
            US&K Family Mart • АНУ болон БНСУ-ын чанартай барааны дэлгүүр • Утас: 8089-8979
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: cleanEmail,
        subject: `[US&K Family Mart] Нэвтрэх баталгаажуулах код: ${code}`,
        html: htmlContent,
      });

      return res.status(200).json({
        success: true,
        isRealEmailSent: true,
        message: `${cleanEmail} хаяг руу баталгаажуулах код амжилттай илгээгдлээ! Та и-мэйл хайрцгаа (Inbox болон Spam) шалгана уу.`,
      });
    } else {
      // Preview fallback if credentials aren't configured yet
      return res.status(200).json({
        success: true,
        isRealEmailSent: false,
        previewCode: code,
        message: `Баталгаажуулах код бэлтгэгдлээ. (Туршилтын горимд код: ${code})`,
      });
    }
  } catch (error: any) {
    console.error('[Send OTP Error]:', error);
    return res.status(500).json({
      error: 'Имэйл илгээхэд алдаа гарлаа: ' + (error.message || 'Тодорхойгүй алдаа'),
    });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  return res.status(200).json({ status: 'ok', smtpConfigured });
}

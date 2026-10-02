import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const siteVisitTrackingConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return res.status(200).json({ status: 'ok', smtpConfigured, siteVisitTrackingConfigured });
}

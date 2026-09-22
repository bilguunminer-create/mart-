import type { VercelRequest, VercelResponse } from '@vercel/node';

// Temporary diagnostic endpoint: api/send-email-otp.ts, api/verify-email-otp.ts,
// and api/notify-new-order.ts all crash with FUNCTION_INVOCATION_FAILED on every
// request, including GET/OPTIONS, while api/health.ts (no third-party imports)
// works fine. This wraps each suspect import in a dynamic import() + try/catch
// so a module-load failure is reported in the JSON response instead of crashing
// the whole function -- Vercel does not expose the real stack trace to clients
// otherwise. Delete this file once the real cause is found.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const report: Record<string, string> = {
    nodeVersion: process.version,
  };

  try {
    const rl = await import('./_rateLimit');
    report.rateLimit = 'ok: ' + typeof rl.checkRateLimit;
  } catch (e: any) {
    report.rateLimit = 'FAIL: ' + (e?.stack || e?.message || String(e));
  }

  try {
    const nm = await import('nodemailer');
    report.nodemailer = 'ok: ' + typeof nm.default;
  } catch (e: any) {
    report.nodemailer = 'FAIL: ' + (e?.stack || e?.message || String(e));
  }

  try {
    const fa = await import('firebase-admin/app');
    report.firebaseAdminApp = 'ok: ' + typeof fa.initializeApp;
  } catch (e: any) {
    report.firebaseAdminApp = 'FAIL: ' + (e?.stack || e?.message || String(e));
  }

  try {
    const fm = await import('firebase-admin/messaging');
    report.firebaseAdminMessaging = 'ok: ' + typeof fm.getMessaging;
  } catch (e: any) {
    report.firebaseAdminMessaging = 'FAIL: ' + (e?.stack || e?.message || String(e));
  }

  try {
    const crypto = await import('crypto');
    report.crypto = 'ok: ' + typeof crypto.createHmac;
  } catch (e: any) {
    report.crypto = 'FAIL: ' + (e?.stack || e?.message || String(e));
  }

  return res.status(200).json(report);
}

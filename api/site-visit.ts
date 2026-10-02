import type { VercelRequest, VercelResponse } from '@vercel/node';
import { recordSiteVisit, SiteVisitError } from './_siteVisitService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try { return res.status(200).json(await recordSiteVisit(req)); }
  catch (error) {
    return res.status(error instanceof SiteVisitError ? error.status : 503).json({
      error: error instanceof SiteVisitError ? error.message : 'Хандалтыг бүртгэж чадсангүй.',
    });
  }
}

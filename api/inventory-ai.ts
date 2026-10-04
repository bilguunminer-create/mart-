import type { VercelRequest, VercelResponse } from '@vercel/node';
import { InventoryAiError, lookupInventoryProduct } from './_inventoryAiService.js';
export const config = { maxDuration: 120 };
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try { return res.status(200).json(await lookupInventoryProduct(req)); }
  catch (error) {
    return res.status(error instanceof InventoryAiError ? error.status : 503).json({
      error: error instanceof InventoryAiError ? error.message : 'AI хайлттай холбогдож чадсангүй. Гараар бөглөж болно.',
    });
  }
}

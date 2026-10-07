import type { VercelRequest, VercelResponse } from '@vercel/node';

// Facebook's crawler does not run JavaScript, so each shared product link
// (/p/<id>, rewritten here) returns its own Open Graph tags and then sends
// visitors on to the storefront, which opens that product.
const DEFAULT_SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
// Public, RLS-protected key — the same one the storefront ships with.
const PUBLISHABLE_KEY = 'sb_publishable_6cFfPZrw3hfRy-RqefprLQ_c94gv3Ik';

type SharedProduct = { id: string; name?: string; description?: string; price?: number; image?: string; published?: boolean };

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatMnt = (value: number) => `${Math.round(value).toLocaleString('en-US')}₮`;

async function findProduct(id: string): Promise<SharedProduct | null> {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${url}/rest/v1/store_settings?id=eq.true&select=data&limit=1`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
  });
  if (!response.ok) throw new Error(`store_settings ${response.status}`);
  const rows = await response.json() as Array<{ data?: { products?: SharedProduct[] } }>;
  const products = rows[0]?.data?.products;
  if (!Array.isArray(products)) return null;
  return products.find((product) => String(product.id) === id && product.published !== false) ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '').trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'www.uskmart.com');
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = String(req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https')).split(',')[0];
  const origin = `${proto}://${host}`;
  const storeUrl = `${origin}/?product=${encodeURIComponent(id)}`;

  let product: SharedProduct | null = null;
  try {
    product = id ? await findProduct(id) : null;
  } catch {
    return res.redirect(302, storeUrl);
  }
  if (!product) return res.redirect(302, `${origin}/`);

  const image = String(product.image ?? '');

  // Photos stored inline as data URLs are served as real images so Facebook can show them.
  if (req.query.img !== undefined) {
    const match = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(image);
    if (match) {
      res.setHeader('Content-Type', match[1]);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).send(Buffer.from(match[2], 'base64'));
    }
    if (/^https?:\/\//.test(image)) return res.redirect(302, image);
    return res.redirect(302, `${origin}/og-banner.jpg?v=1`);
  }

  const shareUrl = `${origin}/p/${encodeURIComponent(id)}`;
  const imageUrl = image.startsWith('data:')
    ? `${shareUrl}/image`
    : /^https?:\/\//.test(image) ? image : `${origin}/og-banner.jpg?v=1`;
  const name = String(product.name ?? 'US&K Family Mart');
  const price = Number(product.price);
  const description = String(product.description ?? '').replace(/\s+/g, ' ').trim();
  // Facebook usually hides og:description, so the price leads the title.
  const title = Number.isFinite(price) && price > 0 ? `${formatMnt(price)} · ${name}` : name;
  const summary = [Number.isFinite(price) && price > 0 ? `Үнэ: ${formatMnt(price)}` : '', description]
    .filter(Boolean).join(' · ').slice(0, 280);

  const html = `<!doctype html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(name)} | US&amp;K Family Mart</title>
<meta name="description" content="${escapeHtml(summary)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="US&amp;K Family Mart" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(summary)}" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:alt" content="${escapeHtml(name)}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${escapeHtml(shareUrl)}" />
<script>location.replace(${JSON.stringify(storeUrl).replace(/</g, '\\u003c')});</script>
</head>
<body style="font-family:sans-serif;padding:24px">
<p><a href="${escapeHtml(storeUrl)}">${escapeHtml(name)}</a> — US&amp;K Family Mart</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).send(html);
}

import { isIP } from 'node:net';
import { checkRateLimit } from './_rateLimit.ts';

type VisitRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  body?: unknown;
};
type VisitEnvironment = { VERCEL?: string; SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SiteVisitError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Vercel overwrites this header at its edge. Self-hosted deployments use the
// direct peer: arbitrary client X-Forwarded-For headers are never trusted.
export function trustedVisitIp(req: VisitRequest, vercel = process.env.VERCEL === '1'): string | null {
  const raw = vercel ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  const normalized = candidate.startsWith('::ffff:') && isIP(candidate.slice(7)) === 4 ? candidate.slice(7) : candidate;
  return isIP(normalized) ? normalized : null;
}

// Vercel's edge adds the visitor's approximate location (derived from the IP).
// Like the IP, it is never taken from the browser or outside Vercel.
export function trustedVisitLocation(req: VisitRequest, vercel = process.env.VERCEL === '1') {
  const header = (name: string) => {
    const value = vercel ? req.headers[name] : undefined;
    return typeof value === 'string' ? value.trim() : '';
  };
  const country = header('x-vercel-ip-country').toUpperCase();
  const region = header('x-vercel-ip-country-region').toUpperCase();
  let city = '';
  try { city = decodeURIComponent(header('x-vercel-ip-city')); } catch { /* malformed encoding */ }
  city = city.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: /^[A-Z0-9]{1,3}$/.test(region) ? region : null,
    city: city || null,
  };
}

export async function recordSiteVisit(req: VisitRequest, env: VisitEnvironment = process.env, fetcher: typeof fetch = fetch) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new SiteVisitError(503, 'Хандалтын бүртгэл тохируулагдаагүй байна.');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new SiteVisitError(403, 'Хүсэлт зөвшөөрөгдөөгүй.');
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SiteVisitError(400, 'Хүсэлт буруу байна.');
  const { visitorId, visitKey, path } = body as Record<string, unknown>;
  if (typeof visitorId !== 'string' || !uuid.test(visitorId) || typeof visitKey !== 'string' || !uuid.test(visitKey)
    || typeof path !== 'string' || !path.startsWith('/') || path.length > 200 || /[?#\r\n]/.test(path)) {
    throw new SiteVisitError(400, 'Хандалтын мэдээлэл буруу байна.');
  }
  const ip = trustedVisitIp(req, env.VERCEL === '1');
  if (!ip) throw new SiteVisitError(400, 'Хандалтын IP хаяг тодорхойгүй байна.');
  if (!checkRateLimit(`site-visit:${ip}`, 120, 60_000)) throw new SiteVisitError(429, 'Түр хүлээгээд дахин оролдоно уу.');
  const url = env.SUPABASE_URL || 'https://rebtikccivjcsxieeyxe.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let userId: string | null = null;
  let sessionId: string | null = null;
  const authorization = req.headers.authorization;
  if (authorization !== undefined) {
    if (typeof authorization !== 'string' || !/^Bearer \S+$/i.test(authorization) || authorization.length > 8192) {
      throw new SiteVisitError(401, 'Нэвтрэлт хүчингүй байна.');
    }
    const response = await fetcher(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new SiteVisitError(response.status >= 500 || response.status === 429 ? 503 : 401, 'Нэвтрэлтийг баталгаажуулж чадсангүй.');
    const user = await response.json();
    // Decode claims only AFTER Supabase has verified this exact signed token.
    let claims: Record<string, unknown>;
    try { claims = JSON.parse(Buffer.from(authorization.split(' ')[1].split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new SiteVisitError(401, 'Нэвтрэлт хүчингүй байна.'); }
    if (!uuid.test(user.id || '') || claims.sub !== user.id || typeof claims.session_id !== 'string'
      || !uuid.test(claims.session_id) || !user.email_confirmed_at || user.is_anonymous) {
      throw new SiteVisitError(401, 'Баталгаажсан нэвтрэлт шаардлагатай.');
    }
    userId = user.id;
    sessionId = claims.session_id;
  }
  const agent = req.headers['user-agent'];
  const visit = { p_visitor_id: visitorId, p_visit_key: visitKey, p_path: path,
    p_ip_address: ip, p_user_agent: typeof agent === 'string' ? agent.slice(0, 512) : '',
    p_user_id: userId, p_auth_session_id: sessionId };
  const location = trustedVisitLocation(req, env.VERCEL === '1');
  const log = (rpc: string, body: Record<string, unknown>) => fetcher(`${url}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  let response = await log('log_site_visit_v4', { ...visit, p_country: location.country, p_region: location.region, p_city: location.city });
  // Until supabase/add-site-visit-locations.sql is applied, v4 does not exist (404).
  if (response.status === 404) response = await log('log_site_visit_v3', visit);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (String(error.message).includes('INVALID_AUTH_SESSION')) throw new SiteVisitError(401, 'Нэвтрэлтийн хугацаа дууссан байна.');
    throw new SiteVisitError(503, 'Хандалтыг бүртгэж чадсангүй.');
  }
  return { recorded: true, authenticated: userId !== null };
}

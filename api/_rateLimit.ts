// In-memory rate limiting shared by the OTP endpoints. This is a real, effective
// guard on the long-running Express dev/self-host server (server.ts), where the
// process — and this Map — stays alive across requests. On Vercel, each
// serverless instance keeps its own copy, so a determined attacker spreading
// requests across cold starts can partially evade it; that gap can only be
// closed with a persistent store (e.g. a Postgres-backed counter). This still
// stops naive/scripted abuse, which is the realistic threat here.
const store: Map<string, { count: number; windowStart: number }> =
  (global as any).__otpRateLimitStore || new Map();
(global as any).__otpRateLimitStore = store;

/** Returns true if the action is allowed, false if the caller is over the limit. */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count += 1;
  return true;
}

export function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

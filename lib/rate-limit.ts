/**
 * Small in-memory rate limiter. It resets on cold start and is not shared between serverless
 * instances, so it slows abuse rather than stopping it. For stricter limits, replace the body of
 * `rateLimit` with an Upstash Redis call (placeholders UPSTASH_REDIS_REST_URL / _TOKEN in .env.example).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return b.count > limit ? { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) } : { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

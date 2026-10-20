import { NextResponse } from 'next/server';
import { createService } from '@/lib/supabase/service';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';
const reply = (b: object, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

/** Lets a shopper preview a coupon. Heavily rate limited so codes cannot be guessed. Returns the discount only. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ valid: false, message: 'Request blocked.' }, 403);
  const ip = clientIp(req);
  if (!rateLimit(`coupon:${ip}`, 8, 60_000).ok || !rateLimit(`coupon-h:${ip}`, 40, 3_600_000).ok) return reply({ valid: false, message: 'Too many attempts. Please try again later.' }, 429);
  let b: { code?: unknown; type?: unknown; subtotal_minor?: unknown };
  try { b = JSON.parse((await req.text()).slice(0, 1000)); } catch { return reply({ valid: false, message: 'Invalid request.' }, 400); }
  const code = typeof b.code === 'string' ? b.code.trim().slice(0, 30) : '';
  const type = ['retail', 'business', 'export'].includes(String(b.type)) ? String(b.type) : 'retail';
  const subtotal = Number(b.subtotal_minor);
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(code) || !Number.isSafeInteger(subtotal) || subtotal < 0) return reply({ valid: false, message: 'This coupon code is not valid.' });
  const svc = createService();
  if (!svc) return reply({ valid: false, message: 'Coupons are not available right now.' }, 503);
  const { data, error } = await svc.rpc('check_coupon', { p_code: code, p_customer_type: type, p_subtotal_minor: subtotal });
  if (error || !data) return reply({ valid: false, message: 'This coupon code is not valid.' });
  return reply({ valid: !!data.valid, discount_minor: data.valid ? data.discount_minor : 0, message: data.valid ? 'Coupon applied.' : data.message });
}

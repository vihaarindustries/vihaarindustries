import { NextResponse } from 'next/server';
import { createService } from '@/lib/supabase/service';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/admin/http';
import { isUuid } from '@/lib/admin/validate';

export const dynamic = 'force-dynamic';
const reply = (b: object, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Retail checkout. The browser only sends who is buying, where to deliver, and product ids with quantities.
 * Prices, discount, GST, coupon rules and the order itself are all decided by the database function place_retail_order().
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: 'Request blocked.' }, 403);
  const ip = clientIp(req);
  if (!rateLimit(`chk:${ip}`, 5, 10 * 60_000).ok || !rateLimit(`chk-h:${ip}`, 20, 3_600_000).ok) return reply({ error: 'Too many orders from this connection. Please try again later.' }, 429);
  let b: Record<string, unknown>;
  try { b = JSON.parse((await req.text()).slice(0, 30_000)); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!b || typeof b !== 'object') return reply({ error: 'Invalid request.' }, 400);

  const a = (b.address && typeof b.address === 'object' ? b.address : {}) as Record<string, unknown>;
  const address = { line1: str(a.line1, 200), line2: str(a.line2, 200), city: str(a.city, 80), state: str(a.state, 60), pincode: str(a.pincode, 6), country: 'India' };
  if (!/^[0-9]{6}$/.test(address.pincode)) return reply({ error: 'Please enter a valid 6-digit PIN code.' }, 422);

  // merge repeated products and validate quantities
  const merged = new Map<string, number>();
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 50) return reply({ error: 'Your cart is empty.' }, 422);
  for (const it of b.items as { product_id?: unknown; quantity?: unknown }[]) {
    const q = Number(it?.quantity);
    if (!isUuid(it?.product_id) || !Number.isFinite(q) || q <= 0 || q > 9999) return reply({ error: 'Something in your cart is not valid. Please review your cart.' }, 422);
    merged.set(it.product_id as string, Math.round(((merged.get(it.product_id as string) ?? 0) + q) * 1000) / 1000);
  }
  const payment = b.payment === 'bank_upi' ? 'bank_upi' : 'cod';
  const coupon = str(b.coupon, 30);
  if (coupon && !/^[A-Za-z0-9_-]{3,30}$/.test(coupon)) return reply({ error: 'This coupon code is not valid.' }, 422);

  const svc = createService();
  if (!svc) return reply({ error: 'Online ordering is not available right now. Please contact us to place your order.' }, 503);
  const { data, error } = await svc.rpc('place_retail_order', {
    p_name: str(b.name, 160), p_email: str(b.email, 254), p_phone: str(b.phone, 40), p_address: address,
    p_items: [...merged].map(([product_id, quantity]) => ({ product_id, quantity })),
    p_coupon_code: coupon || null, p_notes: str(b.notes, 500) || null, p_payment_method: payment,
  });
  if (error) {
    // VI001 and P0001 carry plain-language messages written for shoppers; anything else stays private.
    if (error.code === 'VI001' || error.code === 'P0001') return reply({ error: error.message }, 422);
    return reply({ error: 'We could not place your order right now. Please try again or contact us.' }, 500);
  }
  return reply({ order_number: data?.order_number, total_minor: data?.total_minor });
}

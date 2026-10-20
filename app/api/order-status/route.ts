import { NextResponse } from 'next/server';
import { createService } from '@/lib/supabase/service';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';
const reply = (b: object, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const NOT_FOUND = { error: 'We could not find an order with those details. Please check the order number and the email used for the order.' };

/** Customer order tracking: needs BOTH the order number and the email on the order. Same answer for every miss. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: 'Request blocked.' }, 403);
  const ip = clientIp(req);
  if (!rateLimit(`ostat:${ip}`, 6, 60_000).ok || !rateLimit(`ostat-h:${ip}`, 30, 3_600_000).ok) return reply({ error: 'Too many attempts. Please try again later.' }, 429);
  let b: { order?: unknown; email?: unknown };
  try { b = JSON.parse((await req.text()).slice(0, 1000)); } catch { return reply({ error: 'Invalid request.' }, 400); }
  const number = typeof b.order === 'string' ? b.order.trim().toUpperCase().slice(0, 30) : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 254) : '';
  if (!/^[A-Z0-9-]{4,30}$/.test(number) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(NOT_FOUND, 404);
  const svc = createService();
  if (!svc) return reply({ error: 'Order tracking is not available right now.' }, 503);
  const { data: o } = await svc.from('orders')
    .select('id, order_number, status, payment_status, placed_at, shipped_at, delivered_at, expected_delivery, courier_provider, courier_reference, tracking_url, customers(email)')
    .eq('order_number', number).maybeSingle();
  const owner = (o?.customers as unknown as { email?: string | null } | null)?.email?.toLowerCase();
  if (!o || !owner || owner !== email) return reply(NOT_FOUND, 404);
  const { data: events } = await svc.from('order_events').select('event_type, to_status, message, created_at').eq('order_id', o.id).eq('is_customer_visible', true).order('created_at');
  const { customers: _c, id: _id, ...safe } = o as Record<string, unknown>;
  void _c; void _id;
  return reply({ order: safe, events: events ?? [] });
}

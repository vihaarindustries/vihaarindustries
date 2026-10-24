import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEventEmail } from '@/lib/email/send';
import { createService } from '@/lib/supabase/service';

/**
 * Customer emails for order and payment events. The wording lives in Control room -> Email templates.
 * Nothing here ever throws or blocks: if email is not set up, or sending fails, the order action still succeeds
 * and the customer still sees every update on the Track order page and in their account.
 * IMPORTANT: callers must `await` these. On Vercel a request's background work can be stopped as soon as the response is sent.
 */
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export function money(minor: unknown, currency = 'INR'): string {
  if (typeof minor !== 'number' || !Number.isFinite(minor)) return '';
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}
const niceDate = (d?: string | null) => {
  if (!d) return '';
  const t = new Date(d); if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(d) ? 'UTC' : 'Asia/Kolkata' });
};
const PAY_LABEL: Record<string, string> = { cod: 'Cash on delivery', bank_upi: 'UPI / bank transfer' };
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

type Addr = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string } | null;
function addressText(a: Addr): string {
  if (!a || typeof a !== 'object') return '';
  const l3 = [a.city, a.state].filter(Boolean).join(', ') + (a.pincode ? ` - ${a.pincode}` : '');
  return [a.line1, a.line2, l3.trim(), a.country].filter((x) => x && String(x).trim()).join('\n');
}

type OrderRow = {
  order_number: string; currency: string | null; total_minor: number | null; amount_paid_minor: number | null; payment_provider: string | null;
  courier_provider: string | null; courier_reference: string | null; tracking_url: string | null; expected_delivery: string | null; shipping_address: Addr;
  customers: { name?: string | null; email?: string | null } | null;
  order_items: { product_name_snapshot: string; quantity: number }[] | null;
};
const ORDER_COLS = 'order_number, currency, total_minor, amount_paid_minor, payment_provider, courier_provider, courier_reference, tracking_url, expected_delivery, shipping_address, customers(name, email), order_items(product_name_snapshot, quantity)';

async function loadOrder(sb: SupabaseClient, by: { id: string } | { number: string }): Promise<OrderRow | null> {
  const q = sb.from('orders').select(ORDER_COLS);
  const { data } = await ('id' in by ? q.eq('id', by.id) : q.eq('order_number', by.number)).maybeSingle();
  return (data as unknown as OrderRow | null) ?? null;
}

/** Placeholder values shared by every order email. */
function orderVars(o: OrderRow): Record<string, string> {
  const cur = o.currency || 'INR';
  return {
    order_number: o.order_number,
    order_total: money(o.total_minor, cur),
    order_items: (o.order_items ?? []).map((i) => `${qty(Number(i.quantity))} × ${i.product_name_snapshot}`).join('\n'),
    shipping_address: addressText(o.shipping_address),
    payment_method: o.payment_provider ? (PAY_LABEL[o.payment_provider] ?? o.payment_provider) : '',
    track_url: `${site()}/account`,
  };
}
const who = (o: OrderRow) => ({ to: o.customers?.email ?? '', toName: o.customers?.name ?? '', orderNumber: o.order_number });

// ── Website checkout ────────────────────────────────────────────────────────────────────────────

export async function notifyOrderPlaced(o: { to: string; name: string; orderNumber?: string; totalMinor?: number }) {
  if (!o.to || !o.orderNumber) return;
  try {
    const svc = createService();
    const row = svc ? await loadOrder(svc, { number: o.orderNumber }) : null;
    const vars = row ? orderVars(row) : { order_number: o.orderNumber, order_total: money(o.totalMinor), track_url: `${site()}/account` };
    await sendEventEmail('order_placed', o.to, vars, { toName: o.name, orderNumber: o.orderNumber });
  } catch { /* never block the customer */ }
}

// ── Control room actions ────────────────────────────────────────────────────────────────────────

/** Read BEFORE the database action runs. A refund resets "amount paid" to zero, so the refund amount must be captured first. */
export type Before = { refundMinor?: number };
export async function snapshotBefore(sb: SupabaseClient, name: string, args: Record<string, unknown>): Promise<Before> {
  try {
    if (name === 'set_order_status' && args.p_new === 'refunded') {
      const { data } = await sb.from('orders').select('amount_paid_minor').eq('id', args.p_order as string).maybeSingle();
      return { refundMinor: Number(data?.amount_paid_minor) || 0 };
    }
  } catch { /* ignore */ }
  return {};
}

/** Call after a control-room action succeeded. Sends whichever customer email (if any) belongs to that action. */
export async function notifyAfterAction(sb: SupabaseClient, name: string, args: Record<string, unknown>, before: Before) {
  try {
    const id = args.p_order as string | undefined;
    if (!id) return;
    let event: string | null = null;
    if (name === 'ship_order') event = 'order_shipped';
    else if (name === 'record_payment') event = 'payment_received';
    else if (name === 'set_order_status') {
      event = ({ confirmed: 'order_accepted', shipped: 'order_shipped', delivered: 'order_delivered', refunded: 'payment_refunded' } as Record<string, string>)[String(args.p_new)] ?? null;
      if (event === 'payment_refunded' && !(before.refundMinor && before.refundMinor > 0)) event = null;   // nothing was paid, so nothing was refunded
    }
    if (!event) return;
    const o = await loadOrder(sb, { id });
    if (!o?.customers?.email) return;
    const cur = o.currency || 'INR';
    const vars = orderVars(o);
    if (event === 'order_shipped') Object.assign(vars, { courier: o.courier_provider ?? '', tracking_id: o.courier_reference ?? '', tracking_url: o.tracking_url ?? '', expected_delivery: niceDate(o.expected_delivery) });
    if (event === 'order_delivered') vars.delivered_on = niceDate(new Date().toISOString());
    if (event === 'payment_received') {
      const total = Number(o.total_minor) || 0; const paid = Number(o.amount_paid_minor) || 0; const due = Math.max(total - paid, 0);
      Object.assign(vars, {
        amount_received: money(Number(args.p_amount_minor), cur), payment_method: String(args.p_method ?? ''), payment_reference: String(args.p_reference ?? ''),
        amount_paid_total: money(paid, cur), balance_due: due > 0 ? money(due, cur) : `${money(0, cur)} (fully paid)`,
      });
    }
    if (event === 'payment_refunded') vars.refund_amount = money(before.refundMinor, cur);
    await sendEventEmail(event, o.customers.email, vars, who(o));
  } catch { /* an email problem never undoes the action */ }
}

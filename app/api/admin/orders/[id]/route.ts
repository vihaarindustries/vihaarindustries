import { dbError, fail, ok, requireStaff } from '@/lib/admin/http';
import { isUuid } from '@/lib/admin/validate';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> | { id: string } };

/** Everything the order screen needs in one request. All reads go through row-level security. */
export async function GET(req: Request, { params }: Ctx) {
  const id = (await params).id;
  if (!isUuid(id)) return fail('Not found.', 404);
  const g = await requireStaff(req, ['owner', 'admin', 'operations', 'finance']);
  if ('res' in g) return g.res;
  const sb = g.ctx.supabase;
  const [o, items, events, payments] = await Promise.all([
    sb.from('orders').select('*, customers(id, name, email, phone, company, gstin, customer_type)').eq('id', id).maybeSingle(),
    sb.from('order_items').select('id, product_name_snapshot, sku_snapshot, quantity, unit_price_minor, discount_minor, tax_rate, tax_minor, line_total_minor').eq('order_id', id).order('created_at', { ascending: true }),
    sb.from('order_events').select('id, event_type, from_status, to_status, message, is_customer_visible, created_at, profiles(full_name)').eq('order_id', id).order('created_at', { ascending: false }),
    sb.from('payments').select('id, amount_minor, payment_method, provider_reference, status, received_at').eq('order_id', id).order('received_at', { ascending: false }),
  ]);
  if (o.error) return dbError(o.error);
  if (!o.data) return fail('Not found.', 404);
  return ok({ order: o.data, items: items.data ?? [], events: events.data ?? [], payments: payments.data ?? [] });
}

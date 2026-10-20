import { ok, requireStaff } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';

/** Small counters shown beside menu items. Failures are silent: badges are a convenience. */
export async function GET(req: Request) {
  const g = await requireStaff(req);
  if ('res' in g) return g.res;
  const { supabase, role } = g.ctx;
  const out: Record<string, number> = {};
  if (['owner', 'admin', 'operations'].includes(role)) {
    const e = await supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
    if (!e.error) out.enquiries = e.count ?? 0;
  }
  if (['owner', 'admin', 'operations', 'finance'].includes(role)) {
    const o = await supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending_payment', 'confirmed', 'processing', 'packed']);
    if (!o.error) out.orders = o.count ?? 0;
    const m = await supabase.rpc('dashboard_metrics', { p_from: new Date(Date.now() - 86400000).toISOString(), p_to: new Date().toISOString(), p_segment: 'all' });
    if (!m.error && m.data?.low_stock) out.lowstock = Number(m.data.low_stock);
  }
  return ok(out);
}

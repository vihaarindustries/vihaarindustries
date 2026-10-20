'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, PageHeader, PeriodSelect, Spinner, Stat } from '../ui';
import Collapse from '../Collapse';
import { BarList, Funnel, LineChart } from '../charts';
import { useRole } from '../role';
import { rpc, errMsg } from '@/lib/admin/client';
import { fmtMoney, titleCase } from '@/lib/format';

type Dash = { revenue_minor: number; orders: number; avg_order_minor: number; collected_minor: number; receivables_minor: number; payables_minor: number; in_progress: number; awaiting_payment: number; low_stock: number; expiring_soon: number; open_enquiries: number; new_enquiries: number; new_customers: number; by_status: Record<string, number>; by_segment: { name: string; revenue_minor: number; orders: number }[]; trend: { d: string; orders: number; revenue_minor: number }[]; top_products: { name: string; quantity: number; revenue_minor: number }[] };
type Traffic = { views: number; visitors: number; returning_visitors: number; by_day: { d: string; views: number; visitors: number }[]; top_pages: { path: string; views: number }[]; referrers: { name: string; count: number }[]; devices: { name: string; count: number }[]; countries: { name: string; count: number }[]; funnel: { visitors: number; enquiries: number; new_customers: number; orders: number; paid_orders: number } };

export const range = (days: string) => { const to = new Date(); const from = new Date(); if (days === '1') from.setHours(0, 0, 0, 0); else from.setTime(to.getTime() - Number(days) * 86400000); return { p_from: from.toISOString(), p_to: to.toISOString() }; };
const short = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function DashboardView() {
  const role = useRole();
  const showBiz = role !== 'content_manager';
  const [days, setDays] = useState('30'); const [segment, setSegment] = useState('all');
  const [dash, setDash] = useState<Dash | null>(null); const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = range(days);
      const [d, t] = await Promise.all([showBiz ? rpc<Dash>('dashboard_metrics', { ...r, p_segment: segment }) : Promise.resolve(null), rpc<Traffic>('traffic_summary', r)]);
      setDash(d); setTraffic(t);
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  }, [days, segment, showBiz]);
  useEffect(() => { load(); }, [load]);

  const m = (n?: number) => fmtMoney(n ?? 0, 'INR', { compact: true });
  const f = traffic?.funnel;
  return <div>
    <PageHeader title="Overview" subtitle="Key numbers for the period you choose. Open or close each section with the bars below."
      actions={<>{showBiz && <select aria-label="Customer segment" value={segment} onChange={(e) => setSegment(e.target.value)} className="field !w-auto !py-2 text-sm font-semibold"><option value="all">All customers</option><option value="retail">Retail</option><option value="business">Business</option><option value="export">Export</option></select>}<PeriodSelect value={days} onChange={setDays} /></>} />
    {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
    {loading && !traffic ? <Spinner /> : <>
      {showBiz && dash && <>
        <Collapse id="sales" title="Sales & money" hint="Revenue, orders and what is owed">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Revenue" value={m(dash.revenue_minor)} hint={`${dash.orders} orders`} />
            <Stat label="Average order" value={m(dash.avg_order_minor)} />
            <Stat label="Cash collected" value={m(dash.collected_minor)} />
            <Stat label="New customers" value={dash.new_customers} />
            <Stat label="To collect (receivables)" value={m(dash.receivables_minor)} tone={dash.receivables_minor > 0 ? 'warn' : undefined} hint={<Link href="/control-room/finance/receivables" className="underline">View</Link>} />
            <Stat label="To pay (payables)" value={m(dash.payables_minor)} hint={<Link href="/control-room/finance/payables" className="underline">View</Link>} />
            <Stat label="Awaiting payment" value={dash.awaiting_payment} hint="orders" />
            <Stat label="Orders in progress" value={dash.in_progress} hint={<Link href="/control-room/orders" className="underline">Open orders</Link>} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Revenue trend" className="lg:col-span-2"><LineChart data={dash.trend.map((t) => ({ label: short(t.d), value: t.revenue_minor / 100 }))} format={(n) => fmtMoney(n * 100, 'INR', { compact: true })} label="Revenue" /></Card>
            <Card title="By customer type"><BarList items={dash.by_segment.map((s) => ({ name: titleCase(s.name), value: s.revenue_minor / 100, sub: `${s.orders} orders` }))} format={(n) => fmtMoney(n * 100, 'INR', { compact: true })} /></Card>
            <Card title="Top products"><BarList items={dash.top_products.map((p) => ({ name: p.name, value: p.revenue_minor / 100, sub: `${p.quantity} sold` }))} format={(n) => fmtMoney(n * 100, 'INR', { compact: true })} empty="No sales in this period." /></Card>
            <Card title="Orders by status" className="lg:col-span-2"><BarList items={Object.entries(dash.by_status).map(([k, v]) => ({ name: titleCase(k), value: v }))} empty="No orders in this period." /></Card>
          </div>
        </Collapse>
        <Collapse id="ops" title="Stock & enquiries" hint="Things that need attention">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Low stock products" value={dash.low_stock} tone={dash.low_stock ? 'bad' : 'good'} hint={<Link href="/control-room/inventory" className="underline">Inventory</Link>} />
            <Stat label="Batches expiring in 30 days" value={dash.expiring_soon} tone={dash.expiring_soon ? 'warn' : 'good'} />
            <Stat label="Open enquiries" value={dash.open_enquiries} hint={`${dash.new_enquiries} new in period`} />
            <Stat label="Quick action" value={<Link href="/control-room/orders" className="text-base underline">New order →</Link>} />
          </div>
        </Collapse>
      </>}
      {traffic && <Collapse id="traffic" title="Website traffic" hint="Visitors, pages, sources and conversion" defaultOpen={!showBiz}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label="Visitors" value={traffic.visitors.toLocaleString('en-IN')} /><Stat label="Page views" value={traffic.views.toLocaleString('en-IN')} />
          <Stat label="Returning visitors" value={traffic.returning_visitors.toLocaleString('en-IN')} />
          <Stat label="Visit → enquiry" value={f && f.visitors ? `${(Math.round((f.enquiries / f.visitors) * 1000) / 10)}%` : '—'} />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Visitors per day" className="lg:col-span-2"><LineChart data={traffic.by_day.map((t) => ({ label: short(t.d), value: t.visitors, value2: t.views }))} label="Visitors" label2="Page views" /></Card>
          <Card title="Conversion funnel">{f && <Funnel steps={[{ label: 'Visitors', value: f.visitors }, { label: 'Enquiries', value: f.enquiries }, { label: 'New customers', value: f.new_customers }, { label: 'Orders', value: f.orders }]} />}</Card>
          <Card title="Top pages"><BarList items={traffic.top_pages.slice(0, 6).map((p) => ({ name: p.path, value: p.views }))} /></Card>
          <Card title="Where visitors come from"><BarList items={traffic.referrers.slice(0, 6).map((p) => ({ name: p.name, value: p.count }))} /></Card>
          <Card title="Devices & countries"><BarList items={[...traffic.devices.map((p) => ({ name: titleCase(p.name), value: p.count })), ...traffic.countries.slice(0, 3).map((p) => ({ name: p.name, value: p.count }))]} /></Card>
        </div>
        <p className="text-xs muted mt-3">Counts are anonymous and respect browsers&apos; Do-Not-Track setting. No IP address is stored.</p>
      </Collapse>}
    </>}
  </div>;
}

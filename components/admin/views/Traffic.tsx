'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, PageHeader, PeriodSelect, Spinner, Stat, Table, Td, Th } from '../ui';
import { BarList, Funnel, LineChart } from '../charts';
import { range } from './Dashboard';
import { rpc, errMsg } from '@/lib/admin/client';
import { titleCase } from '@/lib/format';

type T = { views: number; visitors: number; returning_visitors: number; by_day: { d: string; views: number; visitors: number }[]; top_pages: { path: string; views: number }[]; referrers: { name: string; count: number }[]; devices: { name: string; count: number }[]; countries: { name: string; count: number }[]; funnel: { visitors: number; enquiries: number; new_customers: number; orders: number; paid_orders: number } };
const short = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function TrafficView() {
  const [days, setDays] = useState('30'); const [t, setT] = useState<T | null>(null); const [err, setErr] = useState('');
  const load = useCallback(async () => { setErr(''); try { setT(await rpc<T>('traffic_summary', range(days))); } catch (e) { setErr(errMsg(e)); } }, [days]);
  useEffect(() => { load(); }, [load]);
  return <div>
    <PageHeader title="Website traffic" subtitle="Anonymous visit statistics collected by your own website." actions={<PeriodSelect value={days} onChange={setDays} />} />
    {err && <Alert tone="error">{err}</Alert>}
    {!t ? !err && <Spinner /> : <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Visitors" value={t.visitors.toLocaleString('en-IN')} /><Stat label="Page views" value={t.views.toLocaleString('en-IN')} />
        <Stat label="Pages per visitor" value={t.visitors ? (t.views / t.visitors).toFixed(1) : '—'} /><Stat label="Returning visitors" value={t.returning_visitors.toLocaleString('en-IN')} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Visitors and page views per day" className="lg:col-span-2"><LineChart data={t.by_day.map((x) => ({ label: short(x.d), value: x.visitors, value2: x.views }))} label="Visitors" label2="Page views" /></Card>
        <Card title="From visit to order"><Funnel steps={[{ label: 'Visitors', value: t.funnel.visitors }, { label: 'Enquiries sent', value: t.funnel.enquiries }, { label: 'New customers', value: t.funnel.new_customers }, { label: 'Orders', value: t.funnel.orders }, { label: 'Paid orders', value: t.funnel.paid_orders }]} /></Card>
        <Card title="Sources"><BarList items={t.referrers.map((x) => ({ name: x.name, value: x.count }))} /></Card>
        <Card title="Devices"><BarList items={t.devices.map((x) => ({ name: titleCase(x.name), value: x.count }))} /></Card>
        <Card title="Countries"><BarList items={t.countries.map((x) => ({ name: x.name, value: x.count }))} /></Card>
      </div>
      <Card title="Top pages"><Table><thead><tr><Th>Page</Th><Th right>Views</Th></tr></thead><tbody>{t.top_pages.map((p) => <tr key={p.path}><Td>{p.path}</Td><Td right>{p.views.toLocaleString('en-IN')}</Td></tr>)}{!t.top_pages.length && <tr><Td>No visits recorded yet.</Td><Td /></tr>}</tbody></Table></Card>
    </div>}
  </div>;
}

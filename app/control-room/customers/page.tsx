'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Empty, PageHeader, Spinner, Table, Td, Th } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';
import { api } from '@/lib/admin/client';
import { fmtDate, fmtMoney } from '@/lib/format';

type O = { id: string; order_number: string; status: string; total_minor: number; placed_at: string; payment_status: string };
function CustomerOrders({ id }: { id: string }) {
  const [rows, setRows] = useState<O[] | null>(null);
  useEffect(() => { api<O[]>(`/api/admin/r/orders?f_customer_id=${id}&size=50`).then(setRows).catch(() => setRows([])); }, [id]);
  if (!rows) return <Spinner />;
  if (!rows.length) return <Empty>No orders yet.</Empty>;
  const lifetime = rows.filter((o) => !['cancelled', 'draft'].includes(o.status)).reduce((s, o) => s + o.total_minor, 0);
  return <div><p className="text-sm mb-3">Lifetime value: <b>{fmtMoney(lifetime)}</b> across {rows.length} orders.</p>
    <Table><thead><tr><Th>Order</Th><Th>Status</Th><Th>Payment</Th><Th right>Total</Th><Th>Date</Th></tr></thead>
      <tbody>{rows.map((o) => <tr key={o.id}><Td><Link href={`/control-room/orders/${o.id}`} className="font-bold underline">{o.order_number}</Link></Td><Td><Badge>{o.status.replace(/_/g, ' ')}</Badge></Td><Td>{o.payment_status}</Td><Td right>{fmtMoney(o.total_minor)}</Td><Td>{fmtDate(o.placed_at)}</Td></tr>)}</tbody></Table></div>;
}

export default function Page() {
  return <div><PageHeader title="Customers" subtitle="Everyone who buys from you, including phone, business and export customers without a website login. Visible to the sales, finance and admin teams only." />
    <ResourceManager resource="customers" extraTab={{ label: 'Orders', render: (r) => <CustomerOrders id={r.id} /> }} /></div>;
}

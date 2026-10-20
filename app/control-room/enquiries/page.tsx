'use client';
import { useState } from 'react';
import { Alert, Btn, PageHeader } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';
import { rpc, errMsg } from '@/lib/admin/client';

export default function Page() {
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null); const [key, setKey] = useState(0);
  return <div><PageHeader title="Enquiries" subtitle="Messages from the website enquiry form. Move each one through the stages and convert good leads into customers." />
    {msg && <div className="mb-4"><Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}
    <ResourceManager resource="enquiries" refreshKey={key} rowActions={(r, reload) => r.customer_id ? <span className="text-xs muted">Customer ✓</span> :
      <Btn size="sm" variant="outline" onClick={async () => { try { await rpc('convert_enquiry_to_customer', { p_enquiry: r.id }); setMsg({ tone: 'success', text: 'Customer record created from this enquiry.' }); reload(); setKey((k) => k + 1); } catch (e) { setMsg({ tone: 'error', text: errMsg(e) }); } }}>Make customer</Btn>} /></div>;
}

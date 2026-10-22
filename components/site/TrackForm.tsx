'use client';
import { useState } from 'react';

type Res = { order: { order_number: string; status: string; payment_status: string; placed_at: string; shipped_at: string | null; delivered_at: string | null; expected_delivery: string | null; courier_provider: string | null; courier_reference: string | null; tracking_url: string | null }; events: { event_type: string; to_status: string | null; message: string | null; created_at: string }[] };
const STEPS = ['confirmed', 'processing', 'packed', 'shipped', 'delivered'];
const nice = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const d = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function TrackForm() {
  const [order, setOrder] = useState(''); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<Res | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/order-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, email }) });
      const j = await r.json(); if (!r.ok) setErr(j.error || 'Something went wrong.'); else setRes(j);
    } catch { setErr('Connection problem. Please try again.'); } finally { setBusy(false); }
  }
  const idx = res ? STEPS.indexOf(res.order.status) : -1;
  return <div className="container max-w-xl py-14">
    <h1 className="text-3xl font-black">Track your order</h1>
    <p className="muted mt-2">Enter the order number from your confirmation and the email address used for the order.</p>
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 mt-6 space-y-4">
      <label className="block text-sm font-semibold">Order number<input className="field block mt-2" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. VI-26-001042" required maxLength={30} /></label>
      <label className="block text-sm font-semibold">Email<input className="field block mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></label>
      <button className="btn w-full" disabled={busy}>{busy ? 'Looking up…' : 'Track order'}</button>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </form>
    {res && <section className="bg-white border border-gray-200 rounded-xl p-6 mt-6" aria-live="polite">
      <div className="flex justify-between items-start gap-3"><div><div className="text-xs muted">Order</div><div className="font-black text-xl">{res.order.order_number}</div></div><span className="text-xs font-bold bg-[#e3f4e9] text-[#006b38] rounded-full px-3 py-1.5">{nice(res.order.status)}</span></div>
      {idx >= 0 && <ol className="flex mt-6">{STEPS.map((s, i) => <li key={s} className="flex-1 text-center"><div className={`h-1.5 ${i <= idx ? 'bg-vihaar-green' : 'bg-gray-200'}`} /><div className={`text-[10px] mt-1.5 font-bold ${i <= idx ? 'text-vihaar-deep' : 'text-gray-400'}`}>{nice(s)}</div></li>)}</ol>}
      <dl className="text-sm mt-6 space-y-1.5"><div className="flex justify-between"><dt className="muted">Placed</dt><dd>{d(res.order.placed_at)}</dd></div>
        {res.order.expected_delivery && <div className="flex justify-between"><dt className="muted">Expected delivery</dt><dd>{d(res.order.expected_delivery)}</dd></div>}
        {res.order.courier_provider && <div className="flex justify-between"><dt className="muted">Courier</dt><dd>{res.order.courier_provider}{res.order.courier_reference ? ` · ${res.order.courier_reference}` : ''}</dd></div>}
        <div className="flex justify-between"><dt className="muted">Payment</dt><dd>{nice(res.order.payment_status)}</dd></div></dl>
      {res.order.tracking_url && /^https:\/\//.test(res.order.tracking_url) && <a href={res.order.tracking_url} target="_blank" rel="noopener noreferrer" className="btn mt-5">Open courier tracking ↗</a>}
      {res.events.length > 0 && <ol className="mt-6 space-y-3 border-t border-gray-100 pt-5">{[...res.events].reverse().map((e, i) => <li key={i} className="text-sm border-l-2 border-gray-200 pl-3"><div className="font-semibold">{e.to_status ? nice(e.to_status) : nice(e.event_type)}</div>{e.message && <div className="muted">{e.message}</div>}<div className="text-xs text-gray-400">{d(e.created_at)}</div></li>)}</ol>}
    </section>}
  </div>;
}

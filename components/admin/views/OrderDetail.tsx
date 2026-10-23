'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Alert, Badge, Btn, Card, Input, Label, Modal, Select, Spinner, Table, Td, Textarea, Th, useFlash } from '../ui';
import { useRole } from '../role';
import { api, rpc, errMsg } from '@/lib/admin/client';
import { ORDER_STATUS_BADGES, ORDER_STATUS_LABELS } from '@/lib/admin/resources';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, titleCase } from '@/lib/format';

type Item = { id: string; product_name_snapshot: string; sku_snapshot: string | null; quantity: number; unit_price_minor: number; discount_minor: number; tax_rate: number; tax_minor: number; line_total_minor: number };
type Ev = { id: string; event_type: string; from_status: string | null; to_status: string | null; message: string | null; is_customer_visible: boolean; created_at: string; profiles: { full_name: string | null } | null };
type Pay = { id: string; amount_minor: number; payment_method: string; provider_reference: string | null; status: string; received_at: string };
type Addr = { name?: string; line1?: string; city?: string; state?: string; postal_code?: string; country?: string };
type Order = { id: string; order_number: string; status: string; payment_status: string; order_type: string; currency: string; subtotal_minor: number; discount_minor: number; tax_minor: number; shipping_minor: number; total_minor: number; amount_paid_minor: number; placed_at: string; shipped_at: string | null; delivered_at: string | null; expected_delivery: string | null; incoterm: string | null; payment_provider: string | null; notes: string | null; internal_notes: string | null; courier_provider: string | null; courier_reference: string | null; tracking_url: string | null; shipping_address: Addr | null; coupon_id: string | null; referral_code: string | null; customers: { id: string; name: string; email: string | null; phone: string | null; company: string | null; gstin: string | null; customer_type: string } | null };

// Simple flow: Placed -> Accepted -> Shipped (courier + tracking ID) -> Delivered. Shipping an accepted order handles stock and
// invoicing automatically (the database function ship_order does the in-between steps).
const NEXT: Record<string, string[]> = { draft: ['confirmed', 'cancelled'], pending_payment: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'], processing: ['shipped', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered', 'refunded'], delivered: ['refunded'] };
const LABEL: Record<string, string> = { pending_payment: 'Placed', confirmed: 'Accept order', processing: 'Start processing', packed: 'Mark as packed', shipped: 'Ship order', delivered: 'Mark as delivered', cancelled: 'Cancel order', refunded: 'Refund order' };
const WARN: Record<string, string> = { confirmed: 'The customer is told their order has been accepted.', packed: 'Stock will be taken from the oldest-expiry batches and the cost of goods will be booked.', shipped: 'A sales invoice entry will be booked in Finance, and any advance payment will be applied to it.', cancelled: 'If stock was already taken it goes back to the shelf, and any advance payment is marked as refunded.', refunded: 'The sales entry is reversed and money received is marked as refunded. Put returned goods back in stock under Inventory → Adjust stock.' };
const STAGES = ['pending_payment', 'confirmed', 'shipped', 'delivered'];
const stageIndex = (st: string) => (st === 'processing' || st === 'packed' ? STAGES.indexOf('confirmed') : STAGES.indexOf(st));
const statusName = (st: string | null) => (st ? ORDER_STATUS_LABELS[st] ?? titleCase(st) : '');

export default function OrderDetail({ id }: { id: string }) {
  const role = useRole2(); const [d, setD] = useState<{ order: Order; items: Item[]; events: Ev[]; payments: Pay[] } | null>(null); const [err, setErr] = useState('');
  const [stage, setStage] = useState<string | null>(null); const [pay, setPay] = useState(false); const { show, node } = useFlash();
  const load = useCallback(() => { api<{ order: Order; items: Item[]; events: Ev[]; payments: Pay[] }>(`/api/admin/orders/${id}`).then(setD).catch((e) => setErr(errMsg(e))); }, [id]);
  useEffect(load, [load]);
  if (err) return <Alert tone="error">{err}</Alert>;
  if (!d) return <Spinner />;
  const { order: o, items, events, payments } = d; const c = o.customers;
  const canOps = ['owner', 'admin', 'operations'].includes(role); const canPay = canOps || role === 'finance';
  const next = NEXT[o.status] ?? []; const outstanding = o.total_minor - o.amount_paid_minor; const idx = stageIndex(o.status);
  const money = (n: number) => fmtMoney(n, o.currency);

  return <div>
    <Link href="/control-room/orders" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-black mb-4 print:hidden"><ArrowLeft size={15} />All orders</Link>
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div><h1 className="text-2xl md:text-3xl font-black">{o.order_number}</h1>
        <div className="flex flex-wrap gap-2 mt-2"><Badge tone={ORDER_STATUS_BADGES[o.status] ?? 'gray'}>{statusName(o.status)}</Badge><Badge tone={o.payment_status === 'paid' ? 'green' : o.payment_status === 'partial' ? 'amber' : 'red'}>{titleCase(o.payment_status)}</Badge><Badge>{titleCase(o.order_type)}</Badge>{o.payment_provider && <Badge tone="gray">{o.payment_provider === 'cod' ? 'Cash on delivery' : o.payment_provider === 'bank_upi' ? 'UPI / bank transfer' : titleCase(o.payment_provider)}</Badge>}</div>
        <p className="text-sm muted mt-2">Placed {fmtDateTime(o.placed_at)}{o.expected_delivery && <> · Expected {fmtDate(o.expected_delivery)}</>}</p></div>
      <div className="flex gap-2 print:hidden"><Btn variant="outline" onClick={() => window.print()}><Printer size={15} />Print summary</Btn></div>
    </div>
    {node && <div className="mb-4 print:hidden">{node}</div>}

    {idx >= 0 && <ol className="flex mb-6 print:hidden" aria-label="Progress">{STAGES.map((s, i) => <li key={s} className="flex-1 text-center"><div className={`h-1.5 ${i === 0 ? 'rounded-l' : ''} ${i === STAGES.length - 1 ? 'rounded-r' : ''} ${i <= idx ? 'bg-vihaar-green' : 'bg-gray-200'}`} /><div className={`text-[11px] mt-1.5 font-bold ${i <= idx ? 'text-vihaar-deep' : 'text-gray-400'}`}>{statusName(s)}</div></li>)}</ol>}
    {(o.status === 'cancelled' || o.status === 'refunded') && <div className="mb-6"><Alert tone="warn">This order is {o.status}. No further changes are possible.</Alert></div>}

    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Items"><Table><thead><tr><Th>Product</Th><Th right>Qty</Th><Th right>Price</Th><Th right>Tax</Th><Th right>Total</Th></tr></thead><tbody>
          {items.map((i) => <tr key={i.id}><Td><div className="font-semibold">{i.product_name_snapshot}</div>{i.sku_snapshot && <div className="text-xs muted">{i.sku_snapshot}</div>}</Td><Td right>{fmtNum(i.quantity)}</Td><Td right>{money(i.unit_price_minor)}</Td><Td right>{money(i.tax_minor)}<div className="text-[10px] muted">{i.tax_rate}%</div></Td><Td right>{money(i.line_total_minor)}</Td></tr>)}</tbody></Table>
          <dl className="mt-4 ml-auto max-w-xs text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="muted">Subtotal</dt><dd>{money(o.subtotal_minor)}</dd></div>
            {o.discount_minor > 0 && <div className="flex justify-between"><dt className="muted">Discount{o.referral_code ? ` (referral ${o.referral_code})` : ''}</dt><dd>− {money(o.discount_minor)}</dd></div>}
            <div className="flex justify-between"><dt className="muted">Tax</dt><dd>{money(o.tax_minor)}</dd></div>
            {o.shipping_minor > 0 && <div className="flex justify-between"><dt className="muted">Shipping</dt><dd>{money(o.shipping_minor)}</dd></div>}
            <div className="flex justify-between font-black text-base border-t border-gray-200 pt-2"><dt>Total</dt><dd>{money(o.total_minor)}</dd></div>
            <div className="flex justify-between"><dt className="muted">Paid</dt><dd>{money(o.amount_paid_minor)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Balance</dt><dd className={outstanding > 0 ? 'text-red-600' : ''}>{money(outstanding)}</dd></div></dl></Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card title="Customer">{c ? <div className="text-sm space-y-1"><Link href="/control-room/customers" className="font-bold underline">{c.name}</Link>{c.company && <div>{c.company}</div>}{c.email && <div className="muted">{c.email}</div>}{c.phone && <div className="muted">{c.phone}</div>}{c.gstin && <div className="muted">GSTIN {c.gstin}</div>}</div> : <span className="muted text-sm">—</span>}</Card>
          <Card title="Deliver to"><div className="text-sm space-y-0.5">{o.shipping_address?.name && <div className="font-bold">{o.shipping_address.name}</div>}<div>{o.shipping_address?.line1}</div><div>{[o.shipping_address?.city, o.shipping_address?.state, o.shipping_address?.postal_code].filter(Boolean).join(', ')}</div><div>{o.shipping_address?.country}</div>{o.incoterm && <div className="muted">Incoterm: {o.incoterm}</div>}</div></Card>
        </div>
        {o.notes && <Card title="Notes on the order"><p className="text-sm whitespace-pre-wrap">{o.notes}</p></Card>}
        <Card title="Payments received">{payments.length ? <Table><thead><tr><Th>Date</Th><Th>Method</Th><Th>Reference</Th><Th>Status</Th><Th right>Amount</Th></tr></thead><tbody>{payments.map((p) => <tr key={p.id}><Td>{fmtDate(p.received_at)}</Td><Td>{p.payment_method}</Td><Td>{p.provider_reference || '—'}</Td><Td><Badge tone={p.status === 'refunded' ? 'red' : 'green'}>{p.status}</Badge></Td><Td right>{money(p.amount_minor)}</Td></tr>)}</tbody></Table> : <p className="text-sm muted">No payments recorded yet.</p>}</Card>
      </div>

      <div className="space-y-4 print:hidden">
        {canOps && next.length > 0 && <Card title="Next step"><div className="space-y-2">{next.map((s) => <Btn key={s} className="w-full" variant={s === 'cancelled' || s === 'refunded' ? 'outline' : 'primary'} onClick={() => setStage(s)}>{LABEL[s]}</Btn>)}</div></Card>}
        {canPay && !['cancelled', 'refunded', 'draft'].includes(o.status) && outstanding > 0 && <Card title="Payment"><p className="text-sm mb-3">Balance due: <b>{money(outstanding)}</b></p><Btn className="w-full" variant="outline" onClick={() => setPay(true)}>Record a payment</Btn></Card>}
        {canOps && <TrackingCard o={o} onSaved={() => { show('success', 'Details saved.'); load(); }} onError={(m) => show('error', m)} />}
        {canOps && <NoteCard id={o.id} onSaved={() => { show('success', 'Note added.'); load(); }} onError={(m) => show('error', m)} />}
        <Card title="Timeline"><ol className="space-y-4">{events.map((e) => <li key={e.id} className="text-sm border-l-2 border-gray-200 pl-3">
          <div className="font-semibold">{e.to_status ? statusName(e.to_status) : titleCase(e.event_type)}{e.is_customer_visible && <span className="ml-2 text-[10px] font-bold text-vihaar-deep">VISIBLE TO CUSTOMER</span>}</div>
          {e.message && <div className="muted">{e.message}</div>}<div className="text-xs text-gray-400 mt-0.5">{fmtDateTime(e.created_at)}{e.profiles?.full_name ? ` · ${e.profiles.full_name}` : ''}</div></li>)}</ol></Card>
      </div>
    </div>
    {stage === 'shipped' && <ShipModal order={o} onClose={() => setStage(null)} onDone={() => { setStage(null); show('success', 'Order shipped. The customer has been notified.'); load(); }} />}
    {stage && stage !== 'shipped' && <StageModal order={o} to={stage} onClose={() => setStage(null)} onDone={() => { setStage(null); show('success', stage === 'confirmed' ? 'Order accepted. The customer has been notified.' : `Order moved to ${statusName(stage)}.`); load(); }} />}
    {pay && <PayModal order={o} outstanding={outstanding} onClose={() => setPay(false)} onDone={() => { setPay(false); show('success', 'Payment recorded.'); load(); }} />}
  </div>;
}
const useRole2 = () => useRole();

function StageModal({ order, to, onClose, onDone }: { order: Order; to: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState(''); const [vis, setVis] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go() { setBusy(true); setErr(''); try { await rpc('set_order_status', { p_order: order.id, p_new: to, ...(note ? { p_note: note } : to === 'confirmed' ? { p_note: 'Your order has been accepted.' } : {}), p_visible: vis }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); } }
  return <Modal title={LABEL[to] ?? titleCase(to)} onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Back</Btn><Btn busy={busy} variant={to === 'cancelled' || to === 'refunded' ? 'danger' : 'primary'} onClick={go}>Confirm</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}{WARN[to] && <Alert tone="warn">{WARN[to]}</Alert>}
      <Label>Note (optional)<Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Packed in 25 kg bags, 4 pallets" /></Label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-[#00994d] w-4 h-4" checked={vis} onChange={(e) => setVis(e.target.checked)} />Show this update to the customer on the tracking page</label></div></Modal>;
}

function ShipModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  useEffect(() => { api<Courier[]>('/api/admin/r/couriers?size=100').then((r) => setCouriers(r.filter((c) => c.is_active))).catch(() => {}); }, []);
  const zone = useMemo(() => detectZone(order), [order]);
  const [f, setF] = useState({ courier: order.courier_provider ?? '', tracking: order.courier_reference ?? '', url: order.tracking_url ?? '', expected: order.expected_delivery ?? '', note: '' });
  const [linkEdited, setLinkEdited] = useState(!!order.tracking_url); const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const serves = (c: Courier) => (zone === 'state' ? c.serves_state : zone === 'national' ? c.serves_national : c.serves_export);
  const suggested = couriers.filter(serves); const rest = couriers.filter((c) => !serves(c));
  const chosen = couriers.find((c) => c.name === f.courier);
  const isOther = other || (!!f.courier && !chosen);
  function pick(name: string) {
    if (name === OTHER) { setOther(true); setF({ ...f, courier: '' }); return; }
    setOther(false);
    const c = couriers.find((x) => x.name === name); const link = buildLink(c?.tracking_url_template, f.tracking);
    setF({ ...f, courier: name, ...(!linkEdited || !f.url ? { url: link } : {}) });
  }
  function setNumber(v: string) { const link = buildLink(chosen?.tracking_url_template, v); setF({ ...f, tracking: v, ...(!linkEdited && chosen?.tracking_url_template ? { url: link } : {}) }); }
  async function go() {
    if (!f.courier.trim()) { setErr('Choose or enter the courier company.'); return; }
    if (!f.tracking.trim()) { setErr('Enter the tracking ID.'); return; }
    if (f.url && !/^https:\/\//.test(f.url)) { setErr('Tracking link must start with https://'); return; }
    setBusy(true); setErr('');
    try { await rpc('ship_order', { p_order: order.id, p_courier: f.courier.trim(), p_tracking: f.tracking.trim(), ...(f.url ? { p_tracking_url: f.url } : {}), ...(f.expected ? { p_expected: f.expected } : {}), ...(f.note.trim() ? { p_note: f.note.trim() } : {}) }); onDone(); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return <Modal title={`Ship order · ${order.order_number}`} onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Back</Btn><Btn busy={busy} onClick={go}>Mark as shipped</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}
      <Alert tone="warn">{WARN.packed} {WARN.shipped} The customer is notified with the courier and tracking details.</Alert>
      <div className="text-xs"><span className="muted">Delivery zone: </span><Badge tone={zone === 'export' ? 'green' : zone === 'state' ? 'gray' : 'blue'}>{ZONE_LABEL[zone]}</Badge></div>
      <Label>Courier company
        <Select value={isOther ? OTHER : f.courier} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose…</option>
          {suggested.length > 0 && <optgroup label={`Handles ${ZONE_LABEL[zone].toLowerCase()}`}>{suggested.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
          {rest.length > 0 && <optgroup label="Other couriers">{rest.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
          <option value={OTHER}>Other (type the name)…</option>
        </Select></Label>
      {isOther && <Label>Courier name<Input maxLength={60} value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })} /></Label>}
      <Label>Tracking ID / LR number<Input maxLength={80} value={f.tracking} onChange={(e) => setNumber(e.target.value)} /></Label>
      <Label help={chosen && !chosen.tracking_url_template ? 'No link format is saved for this courier. Paste its tracking link, or save the format once under Couriers.' : chosen ? 'Filled in automatically from the tracking ID. You can still edit it.' : 'Optional. Customers use it to open the courier tracking page.'}>Tracking link
        <Input type="url" placeholder="https://" value={f.url} onChange={(e) => { setLinkEdited(true); setF({ ...f, url: e.target.value }); }} /></Label>
      <Label>Expected delivery (optional)<Input type="date" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Label>
      <Label>Message to the customer (optional)<Textarea rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Packed in 2 cartons" /></Label></div></Modal>;
}

function PayModal({ order, outstanding, onClose, onDone }: { order: Order; outstanding: number; onClose: () => void; onDone: () => void }) {
  const [amt, setAmt] = useState(String(outstanding / 100)); const [method, setMethod] = useState('Bank transfer'); const [ref, setRef] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go() { setBusy(true); setErr(''); try { await rpc('record_payment', { p_order: order.id, p_amount_minor: Math.round(Number(amt) * 100), p_method: method, ...(ref ? { p_reference: ref } : {}), p_received_on: date }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); } }
  return <Modal title={`Record payment · ${order.order_number}`} onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={go}>Save payment</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}
      <Label help={`Balance due ${fmtMoney(outstanding, order.currency)}`}>Amount received (₹)<Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} /></Label>
      <Label>Method<Select value={method} onChange={(e) => setMethod(e.target.value)}>{['UPI', 'Bank transfer', 'Cash', 'Cheque', 'Card', 'Online gateway', 'Other'].map((m) => <option key={m}>{m}</option>)}</Select></Label>
      <Label>Date received<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Label>
      <Label help="UTR number, cheque number or receipt id">Reference<Input maxLength={80} value={ref} onChange={(e) => setRef(e.target.value)} /></Label></div></Modal>;
}

/** Your own state. Deliveries inside it are "within state"; other Indian addresses are "rest of India"; anything outside India is "export". */
const HOME_STATE = 'Gujarat';
type Courier = { id: string; name: string; serves_state: boolean; serves_national: boolean; serves_export: boolean; tracking_url_template: string | null; is_active: boolean };
type Zone = 'state' | 'national' | 'export';
const ZONE_LABEL: Record<Zone, string> = { state: `Within ${HOME_STATE}`, national: 'Rest of India', export: 'Export (outside India)' };
const OTHER = '__other__';

function detectZone(o: Order): Zone {
  const country = (o.shipping_address?.country ?? '').trim().toLowerCase();
  if (o.order_type === 'export' || (country && country !== 'india' && country !== 'in')) return 'export';
  return (o.shipping_address?.state ?? '').trim().toLowerCase() === HOME_STATE.toLowerCase() ? 'state' : 'national';
}
const buildLink = (tpl: string | null | undefined, num: string) => (tpl && num.trim() ? tpl.replace('{tracking}', encodeURIComponent(num.trim())) : '');

function TrackingCard({ o, onSaved, onError }: { o: Order; onSaved: () => void; onError: (m: string) => void }) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  useEffect(() => { api<Courier[]>('/api/admin/r/couriers?size=100').then((r) => setCouriers(r.filter((c) => c.is_active))).catch(() => {}); }, []);
  const zone = useMemo(() => detectZone(o), [o]);
  const [f, setF] = useState({ courier_provider: o.courier_provider ?? '', courier_reference: o.courier_reference ?? '', tracking_url: o.tracking_url ?? '', expected_delivery: o.expected_delivery ?? '', internal_notes: o.internal_notes ?? '' });
  const [busy, setBusy] = useState(false); const [showAll, setShowAll] = useState(false);
  const [linkEdited, setLinkEdited] = useState(!!o.tracking_url);   // once someone types the link by hand, we stop overwriting it
  const [other, setOther] = useState(false);

  const serves = (c: Courier) => (zone === 'state' ? c.serves_state : zone === 'national' ? c.serves_national : c.serves_export);
  const suggested = couriers.filter(serves); const rest = couriers.filter((c) => !serves(c));
  const chosen = couriers.find((c) => c.name === f.courier_provider);
  const isOther = other || (!!f.courier_provider && !chosen);
  const selectValue = isOther ? OTHER : f.courier_provider;

  function setCourier(name: string) {
    if (name === OTHER) { setOther(true); setF({ ...f, courier_provider: '' }); return; }
    setOther(false);
    const c = couriers.find((x) => x.name === name); const link = buildLink(c?.tracking_url_template, f.courier_reference);
    setF({ ...f, courier_provider: name, ...(!linkEdited || !f.tracking_url ? { tracking_url: link } : {}) });
  }
  function setNumber(v: string) {
    const link = buildLink(chosen?.tracking_url_template, v);
    setF({ ...f, courier_reference: v, ...(!linkEdited && chosen?.tracking_url_template ? { tracking_url: link } : {}) });
  }
  async function save() { setBusy(true); try { await rpc('update_order_details', { p_order: o.id, p_patch: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null])) }); onSaved(); } catch (e) { onError(errMsg(e)); } finally { setBusy(false); } }
  const noTemplate = !!chosen && !chosen.tracking_url_template;

  return <Card title="Courier & internal notes"><div className="space-y-3">
    <div className="text-xs"><span className="muted">Delivery zone: </span><Badge tone={zone === 'export' ? 'green' : zone === 'state' ? 'gray' : 'blue'}>{ZONE_LABEL[zone]}</Badge></div>
    <Label>Courier / transporter
      <Select value={selectValue} onChange={(e) => setCourier(e.target.value)}>
        <option value="">Choose…</option>
        {suggested.length > 0 && <optgroup label={`Handles ${ZONE_LABEL[zone].toLowerCase()}`}>{suggested.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
        {(showAll || (suggested.length === 0 && rest.length > 0)) && rest.length > 0 && <optgroup label="Other couriers">{rest.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
        <option value={OTHER}>Other (type the name)…</option>
      </Select></Label>
    {!showAll && suggested.length > 0 && rest.length > 0 && <button type="button" className="text-xs underline" onClick={() => setShowAll(true)}>Show couriers for other zones</button>}
    {couriers.length === 0 && <p className="text-xs muted">No couriers saved yet. Add them under <Link href="/control-room/couriers" className="underline">Couriers</Link>, or type a name below.</p>}
    {isOther && <Label>Courier name<Input maxLength={60} value={f.courier_provider} onChange={(e) => setF({ ...f, courier_provider: e.target.value })} /></Label>}
    <Label>Tracking / LR number<Input maxLength={80} value={f.courier_reference} onChange={(e) => setNumber(e.target.value)} /></Label>
    <Label help={noTemplate ? 'No link format is saved for this courier. Paste its tracking link here, or save the format once under Couriers.' : chosen ? 'Filled in automatically from the tracking number. You can still edit it.' : undefined}>Tracking link
      <Input type="url" placeholder="https://" value={f.tracking_url} onChange={(e) => { setLinkEdited(true); setF({ ...f, tracking_url: e.target.value }); }} /></Label>
    {f.tracking_url && /^https:\/\//.test(f.tracking_url) && <a href={f.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">Test the link ↗</a>}
    <Label>Expected delivery<Input type="date" value={f.expected_delivery} onChange={(e) => setF({ ...f, expected_delivery: e.target.value })} /></Label>
    <Label help="Never shown to the customer">Internal notes<Textarea rows={3} maxLength={4000} value={f.internal_notes} onChange={(e) => setF({ ...f, internal_notes: e.target.value })} /></Label>
    <Btn size="sm" busy={busy} onClick={save}>Save</Btn></div></Card>;
}

function NoteCard({ id, onSaved, onError }: { id: string; onSaved: () => void; onError: (m: string) => void }) {
  const [m, setM] = useState(''); const [vis, setVis] = useState(false); const [busy, setBusy] = useState(false);
  async function add() { setBusy(true); try { await rpc('add_order_note', { p_order: id, p_message: m, p_visible: vis }); setM(''); onSaved(); } catch (e) { onError(errMsg(e)); } finally { setBusy(false); } }
  return <Card title="Add a note"><Textarea aria-label="Note" rows={2} maxLength={1000} value={m} onChange={(e) => setM(e.target.value)} className="!mt-0" />
    <label className="flex items-center gap-2 text-xs font-semibold mt-2"><input type="checkbox" className="accent-[#00994d]" checked={vis} onChange={(e) => setVis(e.target.checked)} />Visible to the customer</label>
    <Btn size="sm" className="mt-3" busy={busy} disabled={!m.trim()} onClick={add}>Add note</Btn></Card>;
}

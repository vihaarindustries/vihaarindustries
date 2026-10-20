'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Btn, Confirm, Input, Label, Modal, PageHeader, Select, Tabs, Textarea, useFlash } from '../ui';
import ResourceManager from '../ResourceManager';
import { useRefOptions } from '../FormFields';
import { useRole } from '../role';
import { rpc, errMsg } from '@/lib/admin/client';
import { fmtMoney } from '@/lib/format';

type Line = { product_id: string; quantity: string; cost: string; tax: string; batch: string; exp: string };
const blankLine = (): Line => ({ product_id: '', quantity: '', cost: '', tax: '5', batch: '', exp: '' });

export default function PurchasesView() {
  const role = useRole(); const canOps = ['owner', 'admin', 'operations'].includes(role); const canFin = ['owner', 'admin', 'finance'].includes(role);
  const [tab, setTab] = useState('po'); const [open, setOpen] = useState(false); const [pay, setPay] = useState<{ id: string; num: string; due: number } | null>(null); const [key, setKey] = useState(0);
  const { show, node } = useFlash(); const bump = () => setKey((k) => k + 1);
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); show('success', ok); bump(); } catch (e) { show('error', errMsg(e)); } };
  return <div>
    <PageHeader title="Purchases & suppliers" subtitle="Record what you buy. Receiving a purchase adds stock and books what you owe the supplier."
      actions={canOps && <Btn onClick={() => setOpen(true)}><Plus size={15} />New purchase</Btn>} />
    {node && <div className="mb-4">{node}</div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'po', label: 'Purchase orders' }, { key: 'suppliers', label: 'Suppliers' }]} />
    {tab === 'po' ? <ResourceManager resource="purchase_orders" refreshKey={key} rowActions={(r) => <>
      {canOps && r.status === 'ordered' && <><Confirm variant="primary" label="Receive stock" message={`Mark ${r.po_number} as received? Stock is added and the amount owed to the supplier is booked.`} onConfirm={() => run(() => rpc('receive_purchase', { p_po: r.id }), 'Stock received.')} />
        <Confirm label="Cancel" message={`Cancel ${r.po_number}?`} onConfirm={() => run(() => rpc('cancel_purchase', { p_po: r.id }), 'Purchase cancelled.')} /></>}
      {canFin && r.status === 'received' && r.payment_status !== 'paid' && <Btn size="sm" variant="outline" onClick={() => setPay({ id: r.id, num: String(r.po_number), due: Number(r.total_minor) - Number(r.amount_paid_minor) })}>Pay supplier</Btn>}</>} />
      : <ResourceManager resource="suppliers" />}
    {open && <NewPurchase onClose={() => setOpen(false)} onDone={() => { setOpen(false); show('success', 'Purchase recorded. Press Receive stock when the goods arrive.'); bump(); }} />}
    {pay && <PayModal po={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); show('success', 'Payment recorded.'); bump(); }} />}
  </div>;
}

function NewPurchase({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const suppliers = useRefOptions('suppliers', 'name'); const products = useRefOptions('products', 'name'); const locs = useRefOptions('inventory_locations', 'name');
  const [supplier, setSupplier] = useState(''); const [loc, setLoc] = useState(''); const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [f, setF] = useState({ invoice: '', shipping: '', expected: '', notes: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const sub = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.cost) || 0) * 100, 0);
  const tax = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.cost) || 0) * 100 * (Number(l.tax) || 0) / 100), 0);
  async function go() {
    setErr('');
    const items = lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_cost_minor: Math.round(Number(l.cost) * 100), tax_rate: Number(l.tax) || 0, ...(l.batch ? { batch_number: l.batch } : {}), ...(l.exp ? { expires_on: l.exp } : {}) }));
    if (!supplier) return setErr('Choose a supplier.'); if (!items.length || items.some((i) => !(i.quantity > 0) || Number.isNaN(i.unit_cost_minor))) return setErr('Fill quantity and cost for every item.');
    setBusy(true);
    try { await rpc('create_purchase', { p_supplier: supplier, p_items: items, ...(loc ? { p_location: loc } : {}), ...(f.expected ? { p_expected: f.expected } : {}), ...(f.invoice ? { p_invoice: f.invoice } : {}), ...(f.shipping ? { p_shipping_minor: Math.round(Number(f.shipping) * 100) } : {}), ...(f.notes ? { p_notes: f.notes } : {}) }); onDone(); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return <Modal wide title="New purchase" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={go}>Save purchase</Btn></>}>
    <div className="space-y-5">{err && <Alert tone="error">{err}</Alert>}
      {!suppliers.length && <Alert tone="warn">Add a supplier first (Suppliers tab).</Alert>}
      <div className="grid sm:grid-cols-2 gap-4"><Label>Supplier<Select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Choose…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Label>
        <Label help="Where the goods will be stored">Receive into<Select value={loc} onChange={(e) => setLoc(e.target.value)}><option value="">Default location</option>{locs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Label></div>
      <fieldset><legend className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Items</legend>
        <div className="space-y-3">{lines.map((l, i) => <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_80px_100px_64px_auto] gap-2 items-start border border-gray-200 rounded-lg p-2.5">
          <Select aria-label="Product" value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })} className="!mt-0 col-span-2 sm:col-span-1"><option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
          <Input aria-label="Quantity" placeholder="Qty" type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="!mt-0" />
          <Input aria-label="Cost per unit" placeholder="₹ / unit" inputMode="decimal" value={l.cost} onChange={(e) => setLine(i, { cost: e.target.value.replace(/[^0-9.]/g, '') })} className="!mt-0" />
          <Input aria-label="GST %" placeholder="GST%" inputMode="decimal" value={l.tax} onChange={(e) => setLine(i, { tax: e.target.value.replace(/[^0-9.]/g, '') })} className="!mt-0" />
          <button aria-label="Remove item" className="p-2 text-gray-400 hover:text-red-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}><Trash2 size={16} /></button>
          <Input aria-label="Batch number" placeholder="Batch no. (optional)" value={l.batch} maxLength={60} onChange={(e) => setLine(i, { batch: e.target.value })} className="!mt-0 col-span-1 sm:col-span-2" />
          <Input aria-label="Expiry" type="date" value={l.exp} onChange={(e) => setLine(i, { exp: e.target.value })} className="!mt-0 col-span-1 sm:col-span-2" title="Expiry date" /></div>)}</div>
        <Btn variant="outline" size="sm" className="mt-3" onClick={() => setLines((ls) => [...ls, blankLine()])}><Plus size={14} />Add item</Btn></fieldset>
      <div className="grid sm:grid-cols-3 gap-4"><Label>Supplier invoice no.<Input maxLength={60} value={f.invoice} onChange={(e) => setF({ ...f, invoice: e.target.value })} /></Label><Label>Freight / shipping (₹)<Input inputMode="decimal" value={f.shipping} onChange={(e) => setF({ ...f, shipping: e.target.value.replace(/[^0-9.]/g, '') })} /></Label><Label>Expected on<Input type="date" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Label></div>
      <Label>Notes<Textarea rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Label>
      <p className="text-sm text-right">Estimated total: <b>{fmtMoney(Math.round(sub + tax + (Number(f.shipping) || 0) * 100))}</b> <span className="muted">(items {fmtMoney(Math.round(sub))} + GST {fmtMoney(tax)})</span></p></div></Modal>;
}

export function PayModal({ po, onClose, onDone }: { po: { id: string; num: string; due: number }; onClose: () => void; onDone: () => void }) {
  const [amt, setAmt] = useState(String(po.due / 100)); const [method, setMethod] = useState('Bank transfer'); const [ref, setRef] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go() { setBusy(true); setErr(''); try { await rpc('record_purchase_payment', { p_po: po.id, p_amount_minor: Math.round(Number(amt) * 100), p_method: method, ...(ref ? { p_reference: ref } : {}) }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); } }
  return <Modal title={`Pay supplier · ${po.num}`} onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={go}>Record payment</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}<Label help={`Balance ${fmtMoney(po.due)}`}>Amount paid (₹)<Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} /></Label>
      <Label>Method<Select value={method} onChange={(e) => setMethod(e.target.value)}>{['UPI', 'Bank transfer', 'Cash', 'Cheque', 'Card', 'Other'].map((m) => <option key={m}>{m}</option>)}</Select></Label>
      <Label>Reference<Input maxLength={80} value={ref} onChange={(e) => setRef(e.target.value)} /></Label></div></Modal>;
}

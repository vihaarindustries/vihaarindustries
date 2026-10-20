'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Btn, Input, Label, Modal, PageHeader, Select, Textarea } from '../ui';
import ResourceManager from '../ResourceManager';
import { useRole } from '../role';
import { api, rpc, errMsg } from '@/lib/admin/client';
import { fmtMoney } from '@/lib/format';

type Cust = { id: string; name: string; company: string | null; customer_type: string; email: string | null };
type Prod = { id: string; name: string; sku: string | null; unit: string; retail_price_minor: number | null; wholesale_price_minor: number | null; min_order_quantity: number };
type Line = { product_id: string; quantity: string; price: string };

export default function OrdersView() {
  const router = useRouter(); const role = useRole(); const [open, setOpen] = useState(false);
  const canCreate = ['owner', 'admin', 'operations'].includes(role);
  return <div>
    <PageHeader title="Orders" subtitle="Track every order from first contact to delivery. Open an order to move it through the stages, record payments and add courier details."
      actions={canCreate && <Btn onClick={() => setOpen(true)}><Plus size={15} />New order</Btn>} />
    <ResourceManager resource="orders" onRowClick={(r) => router.push(`/control-room/orders/${r.id}`)} />
    {open && <NewOrder onClose={() => setOpen(false)} onCreated={(id) => router.push(`/control-room/orders/${id}`)} />}
  </div>;
}

function NewOrder({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [custs, setCusts] = useState<Cust[]>([]); const [prods, setProds] = useState<Prod[]>([]);
  const [cq, setCq] = useState(''); const [customer, setCustomer] = useState('');
  const [type, setType] = useState('retail'); const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '1', price: '' }]);
  const [f, setF] = useState({ coupon: '', referral: '', shipping: '', notes: '', incoterm: '', expected: '', status: 'confirmed', name: '', line1: '', city: '', state: '', pin: '', country: 'India' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => { api<Prod[]>('/api/admin/r/products?size=100&f_is_active=true').then(setProds).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(() => { const t = setTimeout(() => { api<Cust[]>(`/api/admin/r/customers?size=15&q=${encodeURIComponent(cq)}`).then(setCusts).catch(() => {}); }, 250); return () => clearTimeout(t); }, [cq]);
  const prodMap = useMemo(() => new Map(prods.map((p) => [p.id, p])), [prods]);
  const chosen = custs.find((c) => c.id === customer);
  useEffect(() => { if (chosen) setType(chosen.customer_type); }, [chosen]);

  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const basePrice = (l: Line) => { const p = prodMap.get(l.product_id); return p ? (type === 'retail' ? p.retail_price_minor : p.wholesale_price_minor ?? p.retail_price_minor) : null; };

  async function submit() {
    setErr('');
    if (!customer) return setErr('Choose a customer.');
    const items = lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), ...(l.price !== '' ? { unit_price_minor: Math.round(Number(l.price) * 100) } : {}) }));
    if (!items.length || items.some((i) => !(i.quantity > 0))) return setErr('Add at least one product with a quantity.');
    const addr = { name: f.name || chosen?.name || '', line1: f.line1, city: f.city, state: f.state, postal_code: f.pin, country: f.country };
    setBusy(true);
    try {
      const id = await rpc<string>('create_order', {
        p_customer_id: customer, p_order_type: type, p_items: items, ...(f.coupon ? { p_coupon_code: f.coupon.trim() } : {}), ...(f.referral ? { p_referral_code: f.referral.trim() } : {}),
        ...(f.shipping ? { p_shipping_minor: Math.round(Number(f.shipping) * 100) } : {}), p_shipping_address: addr, p_billing_address: addr,
        ...(f.notes ? { p_notes: f.notes } : {}), ...(f.expected ? { p_expected_delivery: f.expected } : {}), ...(f.incoterm ? { p_incoterm: f.incoterm } : {}), p_initial_status: f.status });
      onCreated(id);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }

  return <Modal wide title="New order" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={submit}>Create order</Btn></>}>
    <div className="space-y-5">
      {err && <Alert tone="error">{err}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Find customer<Input placeholder="Type a name, company, email or phone" value={cq} onChange={(e) => setCq(e.target.value)} /></Label>
          <select aria-label="Customer" size={4} value={customer} onChange={(e) => setCustomer(e.target.value)} className="field mt-2 !p-1">{custs.map((c) => <option key={c.id} value={c.id} className="p-2">{c.name}{c.company ? ` — ${c.company}` : ''} ({c.customer_type})</option>)}</select>
          <p className="text-xs muted mt-1">New buyer? Add them under Customers first.</p></div>
        <div className="space-y-4">
          <Label help="Decides which price list is used. Export orders are zero-rated for GST.">Order type<Select value={type} onChange={(e) => setType(e.target.value)}><option value="retail">Retail</option><option value="business">Business</option><option value="export">Export</option></Select></Label>
          <Label>Starting stage<Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="confirmed">Confirmed</option><option value="pending_payment">Waiting for payment</option><option value="draft">Draft</option></Select></Label>
        </div>
      </div>
      <fieldset><legend className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Items</legend>
        <div className="space-y-2">{lines.map((l, i) => { const p = prodMap.get(l.product_id); const bp = basePrice(l);
          return <div key={i} className="grid grid-cols-[1fr_90px_110px_auto] gap-2 items-start">
            <div><Select aria-label="Product" value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })} className="!mt-0"><option value="">Choose product…</option>{prods.map((x) => <option key={x.id} value={x.id}>{x.name}{x.sku ? ` (${x.sku})` : ''}</option>)}</Select>
              {p && <div className="text-[11px] muted mt-1">{bp != null ? `List price ${fmtMoney(bp)} / ${p.unit}` : 'No price set: enter one'} · min {p.min_order_quantity} {p.unit}</div>}</div>
            <Input aria-label="Quantity" type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="!mt-0" />
            <Input aria-label="Price override" placeholder="₹ price" inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value.replace(/[^0-9.]/g, '') })} className="!mt-0" />
            <button aria-label="Remove line" className="p-2 text-gray-400 hover:text-red-600" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)}><Trash2 size={16} /></button></div>; })}</div>
        <Btn variant="outline" size="sm" className="mt-3" onClick={() => setLines((ls) => [...ls, { product_id: '', quantity: '1', price: '' }])}><Plus size={14} />Add item</Btn>
        <p className="text-xs muted mt-2">Prices and tax are calculated by the system from the product list. Fill &ldquo;price&rdquo; only for a negotiated rate per unit.</p></fieldset>
      <div className="grid sm:grid-cols-3 gap-4">
        <Label>Coupon code<Input value={f.coupon} maxLength={30} onChange={(e) => setF({ ...f, coupon: e.target.value.toUpperCase() })} /></Label>
        <Label help="A customer&apos;s referral code (new customers only)">Referral code<Input value={f.referral} maxLength={20} onChange={(e) => setF({ ...f, referral: e.target.value.toUpperCase() })} /></Label>
        <Label>Shipping charge (₹)<Input inputMode="decimal" value={f.shipping} onChange={(e) => setF({ ...f, shipping: e.target.value.replace(/[^0-9.]/g, '') })} /></Label>
      </div>
      <fieldset><legend className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Delivery</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Label>Deliver to (name)<Input value={f.name} maxLength={120} placeholder={chosen?.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label>
          <Label>Address<Input value={f.line1} maxLength={200} onChange={(e) => setF({ ...f, line1: e.target.value })} /></Label>
          <Label>City<Input value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} /></Label>
          <Label>State<Input value={f.state} maxLength={80} onChange={(e) => setF({ ...f, state: e.target.value })} /></Label>
          <Label>PIN / postal code<Input value={f.pin} maxLength={12} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Label>
          <Label>Country<Input value={f.country} maxLength={60} onChange={(e) => setF({ ...f, country: e.target.value })} /></Label>
          <Label>Expected delivery<Input type="date" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Label>
          {type === 'export' && <Label help="e.g. FOB, CIF, EXW">Incoterm<Input value={f.incoterm} maxLength={12} onChange={(e) => setF({ ...f, incoterm: e.target.value.toUpperCase() })} /></Label>}
        </div></fieldset>
      <Label>Notes (visible to the customer on their invoice)<Textarea rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Label>
    </div></Modal>;
}

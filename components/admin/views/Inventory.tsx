'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert, Btn, Input, Label, Modal, PageHeader, Select, Tabs, Textarea, useFlash } from '../ui';
import ResourceManager from '../ResourceManager';
import { useRefOptions } from '../FormFields';
import { useRole } from '../role';
import { rpc, errMsg } from '@/lib/admin/client';

export default function InventoryView() {
  const role = useRole(); const canOps = ['owner', 'admin', 'operations'].includes(role);
  const [tab, setTab] = useState('stock'); const [open, setOpen] = useState(false); const [adj, setAdj] = useState<{ id: string; label: string } | null>(null); const [key, setKey] = useState(0);
  const { show, node } = useFlash(); const bump = () => setKey((k) => k + 1);
  return <div>
    <PageHeader title="Inventory" subtitle="Live stock by product and batch. Stock goes up when you receive a purchase and down when an order is packed. Cost and value are kept in step with Finance."
      actions={canOps && <Btn onClick={() => setOpen(true)}><Plus size={15} />Add opening stock</Btn>} />
    {node && <div className="mb-4">{node}</div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'stock', label: 'Stock levels' }, { key: 'batches', label: 'Batches' }, { key: 'movements', label: 'Movements' }, { key: 'locations', label: 'Locations' }]} />
    {tab === 'stock' && <ResourceManager resource="inventory_summary" refreshKey={key} />}
    {tab === 'batches' && <ResourceManager resource="inventory_batches" refreshKey={key} rowActions={(r) => canOps ? <Btn size="sm" variant="outline" onClick={() => setAdj({ id: r.id, label: `${(r.products as { name?: string } | null)?.name ?? ''} · batch ${r.batch_number}` })}>Adjust</Btn> : null} />}
    {tab === 'movements' && <ResourceManager resource="stock_movements" refreshKey={key} />}
    {tab === 'locations' && <ResourceManager resource="inventory_locations" />}
    {open && <OpeningStock onClose={() => setOpen(false)} onDone={() => { setOpen(false); show('success', 'Stock added and booked in Finance.'); bump(); }} />}
    {adj && <Adjust batch={adj} onClose={() => setAdj(null)} onDone={() => { setAdj(null); show('success', 'Stock adjusted.'); bump(); }} />}
  </div>;
}

function OpeningStock({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const products = useRefOptions('products', 'name'); const locs = useRefOptions('inventory_locations', 'name');
  const [f, setF] = useState({ product: '', batch: '', qty: '', cost: '', mfg: '', exp: '', loc: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    try { await rpc('add_opening_stock', { p_product: f.product, p_batch: f.batch, p_qty: Number(f.qty), p_unit_cost_minor: Math.round(Number(f.cost || '0') * 100), ...(f.mfg ? { p_mfg: f.mfg } : {}), ...(f.exp ? { p_exp: f.exp } : {}), ...(f.loc ? { p_location: f.loc } : {}) }); onDone(); }
    catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return <Modal title="Add opening stock" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} disabled={!f.product || !f.batch || !f.qty} onClick={go}>Add stock</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}
      <Alert tone="info">Use this for stock you already hold when you start using the system. For new buying, record a <b>purchase</b> instead so suppliers and payables stay correct.</Alert>
      <Label>Product<Select value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}><option value="">Choose…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Label>
      <div className="grid grid-cols-2 gap-4"><Label>Batch / lot number<Input maxLength={60} value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} /></Label><Label>Quantity<Input type="number" min="0" step="any" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Label>
        <Label help="What each unit cost you">Cost per unit (₹)<Input inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/[^0-9.]/g, '') })} /></Label>
        <Label>Location<Select value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })}><option value="">Default</option>{locs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Label>
        <Label>Manufactured on<Input type="date" value={f.mfg} onChange={(e) => setF({ ...f, mfg: e.target.value })} /></Label><Label help="Expired batches are never used for orders">Expiry date<Input type="date" value={f.exp} onChange={(e) => setF({ ...f, exp: e.target.value })} /></Label></div></div></Modal>;
}

function Adjust({ batch, onClose, onDone }: { batch: { id: string; label: string }; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('adjustment'); const [delta, setDelta] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr(''); const n = Number(delta);
    try { await rpc('adjust_stock', { p_batch: batch.id, p_delta: type === 'waste' ? -Math.abs(n) : type === 'return' ? Math.abs(n) : n, p_type: type, p_notes: note }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  return <Modal title="Adjust stock" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} disabled={!delta || note.trim().length < 3} onClick={go}>Save adjustment</Btn></>}>
    <div className="space-y-4"><p className="text-sm font-semibold">{batch.label}</p>{err && <Alert tone="error">{err}</Alert>}
      <Label>Reason<Select value={type} onChange={(e) => setType(e.target.value)}><option value="adjustment">Stock count correction (+ or −)</option><option value="waste">Damaged / expired / lost (reduces stock)</option><option value="return">Customer return (adds stock)</option></Select></Label>
      <Label help={type === 'adjustment' ? 'Use a minus sign to reduce, e.g. -5' : 'Enter a positive number'}>Quantity<Input type="number" step="any" value={delta} onChange={(e) => setDelta(e.target.value)} /></Label>
      <Label help="Required. Appears in the audit log.">Note<Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Label></div></Modal>;
}

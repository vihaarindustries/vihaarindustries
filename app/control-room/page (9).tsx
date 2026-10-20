'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Alert, Btn, Card, Input, PageHeader, Spinner, useFlash } from '@/components/admin/ui';
import { useSetting } from '@/components/admin/useSetting';
import { errMsg } from '@/lib/admin/client';
import { slugify } from '@/lib/format';

type Item = { key: string; label: string; href: string; visible: boolean };
type Nav = { items: Item[]; show_switch: boolean; show_signin: boolean };
const DEFAULT: Nav = { items: [], show_switch: true, show_signin: true };

export default function Page() {
  const { value, setValue, loading, error, save } = useSetting<Nav>('nav_visibility', DEFAULT);
  const [busy, setBusy] = useState(false); const { show, node } = useFlash();
  const set = (items: Item[]) => setValue({ ...value, items });
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.items.length) return; const n = [...value.items]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
  const upd = (i: number, p: Partial<Item>) => set(value.items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  async function submit() {
    setBusy(true);
    try { await save({ ...value, items: value.items.map((it) => ({ ...it, key: it.key || slugify(it.label) || 'item' })) }); show('success', 'Navigation saved. The website updates within a minute.'); } catch (e) { show('error', errMsg(e)); } finally { setBusy(false); }
  }
  if (loading) return <Spinner />;
  return <div><PageHeader title="Navigation menu" subtitle="Choose which links appear in the website header, rename them and change their order." actions={<Btn busy={busy} onClick={submit}>Save navigation</Btn>} />
    {error && <Alert tone="error">{error}</Alert>}{node && <div className="mb-4">{node}</div>}
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Menu links" className="lg:col-span-2">
        <ul className="space-y-3">{value.items.map((it, i) => <li key={i} className="border border-gray-200 rounded-lg p-3 grid sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-center">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="w-4 h-4 accent-[#00994d]" checked={it.visible} onChange={(e) => upd(i, { visible: e.target.checked })} />Show</label>
          <Input aria-label="Label" value={it.label} maxLength={40} onChange={(e) => upd(i, { label: e.target.value })} className="!mt-0" />
          <Input aria-label="Link" value={it.href} maxLength={120} onChange={(e) => upd(i, { href: e.target.value })} className="!mt-0" placeholder="/retail#products" />
          <div className="flex gap-1"><button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 disabled:opacity-30"><ArrowUp size={16} /></button><button aria-label="Move down" disabled={i === value.items.length - 1} onClick={() => move(i, 1)} className="p-1.5 disabled:opacity-30"><ArrowDown size={16} /></button><button aria-label="Remove" onClick={() => set(value.items.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button></div>
        </li>)}</ul>
        {value.items.length < 12 && <Btn variant="outline" size="sm" className="mt-4" onClick={() => set([...value.items, { key: '', label: 'New link', href: '/', visible: true }])}><Plus size={14} />Add link</Btn>}
        <p className="text-xs muted mt-3">Links must start with / or #, for example /enquiry or /retail#products.</p>
      </Card>
      <Card title="Header buttons">
        <label className="flex items-start gap-2.5 text-sm font-semibold mb-4"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={value.show_switch} onChange={(e) => setValue({ ...value, show_switch: e.target.checked })} /><span>Retail / Business switch<span className="block text-xs font-normal muted">The two small buttons next to Enquire.</span></span></label>
        <label className="flex items-start gap-2.5 text-sm font-semibold"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={value.show_signin} onChange={(e) => setValue({ ...value, show_signin: e.target.checked })} /><span>Sign-in link<span className="block text-xs font-normal muted">Hide it until customer accounts are in use.</span></span></label>
      </Card>
    </div></div>;
}

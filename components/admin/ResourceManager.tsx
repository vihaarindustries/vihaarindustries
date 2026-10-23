'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Download, GripVertical, Plus, Search } from 'lucide-react';
import { Alert, Badge, Btn, Confirm, Empty, Modal, Pager, Spinner, Table, Td, Th, Tabs, useFlash, cx } from './ui';
import { FieldInput, clearRefCache } from './FormFields';
import { useRole } from './role';
import { api, errMsg } from '@/lib/admin/client';
import { getResource, type ColumnDef } from '@/lib/admin/resources';
import { dig, toFormValues, toPayload, type FormValue, type FormValues } from '@/lib/admin/form';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, slugify } from '@/lib/format';
import { createBrowser } from '@/lib/supabase/browser';
import { publicMediaUrl } from '@/lib/media';

type Row = Record<string, unknown> & { id: string };
export type ResourceManagerProps = {
  resource: string; fixedFilter?: Record<string, string>; createDefaults?: Record<string, unknown>;
  title?: string; addLabel?: string; onRowClick?: (row: Row) => void; extraTab?: { label: string; render: (row: Row) => ReactNode };
  toolbar?: ReactNode; rowActions?: (row: Row, reload: () => void) => ReactNode; refreshKey?: number; pageSize?: number;
};

function Cell({ c, row }: { c: ColumnDef; row: Row }) {
  const v = dig(row, c.key);
  if (v === null || v === undefined || v === '') return <span className="text-gray-300">—</span>;
  switch (c.type) {
    case 'money': return <>{fmtMoney(Number(v), String(row.currency ?? 'INR'))}</>;
    case 'number': return <>{fmtNum(v as number)}</>;
    case 'bool': return v ? <Check size={16} className="text-[#008b47]" aria-label="Yes" /> : <span className="text-gray-300" aria-label="No">—</span>;
    case 'date': return <>{fmtDate(String(v))}</>;
    case 'datetime': return <>{fmtDateTime(String(v))}</>;
    case 'badge': return <Badge tone={c.badges?.[String(v)] ?? 'gray'}>{String(v).replace(/_/g, ' ')}</Badge>;
    case 'image': { const u = publicMediaUrl((c.bucket ?? 'product-media') as 'product-media' | 'site-media', String(v)); /* eslint-disable-next-line @next/next/no-img-element */ return u ? <img src={u} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" /> : null; }
    default: return <>{Array.isArray(v) ? v.join(', ') : String(v)}</>;
  }
}

export default function ResourceManager(p: ResourceManagerProps) {
  const def = getResource(p.resource)!;
  const role = useRole();
  const canWrite = def.write.includes(role) && def.creatable !== false;
  const canEdit = def.write.includes(role);
  const canDelete = def.remove.includes(role);
  const canExport = !!def.exportable && def.read.includes(role) && (!def.pii || ['owner', 'admin'].includes(role));
  const size = p.pageSize ?? (def.sortable ? 100 : 25);

  const [rows, setRows] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [reorder, setReorder] = useState(false);
  const { show, node: flashNode } = useFlash();

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), size: String(size) });
    if (dq) sp.set('q', dq);
    for (const [k, v] of Object.entries({ ...filters, ...(p.fixedFilter ?? {}) })) if (v) sp.set(`f_${k}`, v);
    return sp.toString();
  }, [page, size, dq, filters, p.fixedFilter]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/r/${p.resource}?${query}`, { cache: 'no-store' });
      if (res.status === 401) { window.location.reload(); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not load.');
      setRows(j.data); setTotal(j.total);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [p.resource, query]);
  useEffect(() => { load(); }, [load, p.refreshKey]);

  const hasFilter = !!dq || Object.values(filters).some(Boolean);
  const csvHref = `/api/admin/r/${p.resource}?format=csv&${new URLSearchParams({ ...(dq ? { q: dq } : {}), ...Object.fromEntries(Object.entries({ ...filters, ...(p.fixedFilter ?? {}) }).filter(([, v]) => v).map(([k, v]) => [`f_${k}`, v])) })}`;

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= rows.length) return;
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]; setRows(next);
    try { await api(`/api/admin/r/${p.resource}/reorder`, { body: { ids: next.map((r) => r.id) } }); show('success', 'Order saved.'); }
    catch (e) { show('error', errMsg(e)); load(); }
  }
  const dragId = useRef<string | null>(null);
  async function dropOn(targetId: string) {
    const from = rows.findIndex((r) => r.id === dragId.current); const to = rows.findIndex((r) => r.id === targetId);
    dragId.current = null; if (from < 0 || to < 0 || from === to) return;
    const next = [...rows]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setRows(next);
    try { await api(`/api/admin/r/${p.resource}/reorder`, { body: { ids: next.map((r) => r.id) } }); show('success', 'Order saved.'); }
    catch (e) { show('error', errMsg(e)); load(); }
  }
  async function remove(r: Row) {
    try { await api(`/api/admin/r/${p.resource}/${r.id}`, { method: 'DELETE' }); show('success', 'Deleted.'); clearRefCache(p.resource); await load(); }
    catch (e) { show('error', errMsg(e)); }
  }

  const cols = def.columns;
  const reorderOn = reorder && def.sortable && !hasFilter && total <= size;

  return <div>
    {p.title && <h2 className="text-lg font-black mb-3">{p.title}</h2>}
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {def.search.length > 0 && <div className="relative flex-1 min-w-[180px] max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field !pl-9 !py-2.5" /></div>}
      {def.filters?.map((f) => <select key={f.column} aria-label={f.label} value={filters[f.column] ?? ''} onChange={(e) => { setFilters((s) => ({ ...s, [f.column]: e.target.value })); setPage(1); }} className="field !w-auto !py-2.5 text-sm"><option value="">{f.label}: all</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
      <div className="flex-1" />
      {p.toolbar}
      {def.sortable && canEdit && total > 1 && !hasFilter && <Btn variant={reorder ? 'primary' : 'outline'} onClick={() => setReorder((r) => !r)}>{reorder ? 'Done reordering' : 'Reorder'}</Btn>}
      {canExport && <a href={csvHref} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold hover:bg-gray-50"><Download size={14} />Export CSV</a>}
      {canWrite && def.fields.length > 0 && <Btn onClick={() => setEditing('new')}><Plus size={15} />{p.addLabel ?? `Add ${def.singular}`}</Btn>}
    </div>
    {flashNode && <div className="mb-4">{flashNode}</div>}
    {reorderOn && <div className="mb-3"><Alert tone="info">Drag the handle, or use the arrows, to change the order. Changes are saved straight away and show on the website in this order.</Alert></div>}
    {error && <Alert tone="error">{error}</Alert>}
    <div className="bg-white border border-gray-200 rounded-xl p-2 md:p-3">
      {loading && !rows.length ? <Spinner /> : !rows.length ? <Empty>{hasFilter ? 'Nothing matches your search.' : def.emptyText ?? 'Nothing here yet.'}</Empty> :
        <Table><thead><tr>{reorderOn && <Th />}{cols.map((c) => <Th key={c.key} right={c.type === 'money' || c.type === 'number'}>{c.label}</Th>)}<Th /></tr></thead>
          <tbody className={cx(loading && 'opacity-50')}>{rows.map((r, i) => <tr key={r.id} draggable={reorderOn} onDragStart={() => { dragId.current = r.id; }} onDragOver={(e) => reorderOn && e.preventDefault()} onDrop={() => reorderOn && dropOn(r.id)}
            onClick={() => { if (reorderOn) return; if (p.onRowClick) p.onRowClick(r); else if (def.fields.length) setEditing(r); }}
            className={cx('hover:bg-gray-50', !reorderOn && (!!p.onRowClick || def.fields.length > 0) && 'cursor-pointer')}>
            {reorderOn && <Td className="w-24"><div className="flex items-center gap-1 text-gray-400"><GripVertical size={16} className="cursor-grab" aria-hidden /><button aria-label="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} className="p-1 hover:text-black disabled:opacity-30"><ArrowUp size={15} /></button><button aria-label="Move down" disabled={i === rows.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} className="p-1 hover:text-black disabled:opacity-30"><ArrowDown size={15} /></button></div></Td>}
            {cols.map((c) => <Td key={c.key} right={c.type === 'money' || c.type === 'number'}><Cell c={c} row={r} /></Td>)}
            <Td right><div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>{p.rowActions?.(r, load)}{canDelete && !reorderOn && <Confirm label="Delete" message={`Delete this ${def.singular}? This cannot be undone.`} onConfirm={() => remove(r)} />}</div></Td>
          </tr>)}</tbody></Table>}
      {!reorderOn && <Pager page={page} size={size} total={total} onPage={setPage} />}
    </div>
    {editing && <EditModal def={def} resource={p.resource} row={editing === 'new' ? null : editing} canEdit={canEdit} defaults={{ ...(p.createDefaults ?? {}), ...(p.fixedFilter ?? {}) }} extraTab={p.extraTab}
      onClose={() => setEditing(null)} onSaved={async (msg) => { setEditing(null); clearRefCache(p.resource); show('success', msg); await load(); }} />}
  </div>;
}

function EditModal({ def, resource, row, canEdit, defaults, extraTab, onClose, onSaved }: {
  def: NonNullable<ReturnType<typeof getResource>>; resource: string; row: Row | null; canEdit: boolean; defaults: Record<string, unknown>;
  extraTab?: ResourceManagerProps['extraTab']; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const initial = useMemo(() => toFormValues(def, row, defaults), [def, row, defaults]);
  const [values, setValues] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [tab, setTab] = useState('details');
  const uploaded = useRef<{ bucket: string; path: string }[]>([]); const saved = useRef(false);
  const slugTouched = useRef(!!row);

  const set = (name: string, v: FormValue) => setValues((s) => {
    const next = { ...s, [name]: v };
    const f = def.fields.find((x) => x.name === name);
    if (f?.type === 'slug') slugTouched.current = true;
    for (const sf of def.fields) if (sf.type === 'slug' && sf.slugFrom === name && !slugTouched.current) next[sf.name] = slugify(String(v));
    return next;
  });
  async function close() {   // remove files that were uploaded but never saved
    if (!saved.current && uploaded.current.length) { for (const u of uploaded.current) { if (u.path.startsWith('cld/') || u.path.startsWith('cldauth/')) await fetch('/api/cloudinary/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId: u.path }) }).catch(() => {}); else { const sb = createBrowser(); await sb.storage.from(u.bucket).remove([u.path]).catch(() => {}); } } }
    onClose();
  }
  async function save() {
    setBusy(true); setErr('');
    try {
      const payload = toPayload(def, values, row ? initial : null);
      if (!row) Object.assign(payload, Object.fromEntries(Object.entries(defaults).filter(([k]) => def.fields.some((f) => f.name === k))));
      if (row && !Object.keys(payload).length) { saved.current = true; return onSaved('No changes to save.'); }
      if (row) await api(`/api/admin/r/${resource}/${row.id}`, { method: 'PATCH', body: payload }); else await api(`/api/admin/r/${resource}`, { method: 'POST', body: payload });
      const keptRefs = new Set(Object.values(payload).filter((v): v is string => typeof v === 'string'));
      for (const u of uploaded.current) if (!keptRefs.has(u.path) && (u.path.startsWith('cld/') || u.path.startsWith('cldauth/'))) await fetch('/api/cloudinary/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId: u.path }) }).catch(() => {});
      saved.current = true; onSaved(row ? 'Changes saved.' : `${def.singular[0].toUpperCase() + def.singular.slice(1)} added.`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  const groups: { name: string; fields: typeof def.fields }[] = [];
  for (const f of def.fields) { if (f.hideInForm) continue; const g = f.group ?? ''; let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, fields: [] }; groups.push(grp); } grp.fields.push(f); }
  const readonlyView = !canEdit;

  return <Modal wide title={row ? (readonlyView ? `View ${def.singular}` : `Edit ${def.singular}`) : `Add ${def.singular}`} onClose={close}
    footer={tab === 'details' ? <><Btn variant="outline" onClick={close}>{readonlyView ? 'Close' : 'Cancel'}</Btn>{!readonlyView && <Btn busy={busy} onClick={save}>{row ? 'Save changes' : `Add ${def.singular}`}</Btn>}</> : <Btn variant="outline" onClick={close}>Close</Btn>}>
    {row && extraTab && <Tabs value={tab} onChange={setTab} tabs={[{ key: 'details', label: 'Details' }, { key: 'extra', label: extraTab.label }]} />}
    {tab === 'extra' && row && extraTab ? extraTab.render(row) : <div className="space-y-6">
      {err && <Alert tone="error">{err}</Alert>}
      {groups.map((g) => <fieldset key={g.name} disabled={readonlyView} className="space-y-4">
        {g.name && <legend className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{g.name}</legend>}
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">{g.fields.map((f) => <div key={f.name} className={cx(!f.half && 'sm:col-span-2')}>
          <FieldInput f={f} values={values} set={set} editing={!!row} track={(bucket, path) => uploaded.current.push({ bucket, path })} /></div>)}</div>
      </fieldset>)}
    </div>}
  </Modal>;
}

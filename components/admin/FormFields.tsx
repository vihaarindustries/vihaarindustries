'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload, FileText } from 'lucide-react';
import { Btn, Input, Label, Select, Textarea, cx } from './ui';
import { api } from '@/lib/admin/client';
import { createBrowser } from '@/lib/supabase/browser';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, publicMediaUrl } from '@/lib/media';
import { slugify } from '@/lib/format';
import type { FieldDef } from '@/lib/admin/resources';
import type { FormValue, FormValues, KvRow } from '@/lib/admin/form';

const refCache = new Map<string, { id: string; label: string }[]>();
export function useRefOptions(resource: string, labelKey: string) {
  const [opts, setOpts] = useState(refCache.get(resource) ?? []);
  useEffect(() => {
    if (refCache.has(resource)) return;
    api<{ id: string; [k: string]: unknown }[]>(`/api/admin/r/${resource}?size=100`).then((rows) => {
      const list = (rows as unknown as { id: string }[]).map((r) => ({ id: r.id, label: String((r as Record<string, unknown>)[labelKey] ?? r.id) }));
      refCache.set(resource, list); setOpts(list);
    }).catch(() => {});
  }, [resource, labelKey]);
  return opts;
}
export const clearRefCache = (resource?: string) => (resource ? refCache.delete(resource) : refCache.clear());

function Upload_({ f, value, onChange, track }: { f: FieldDef; value: string; onChange: (v: string) => void; track?: (bucket: string, path: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const isFile = f.type === 'file'; const bucket = f.bucket!;
  const accept = isFile ? 'application/pdf,image/jpeg,image/png' : ALLOWED_IMAGE_TYPES.join(',');
  async function pick(file: File | undefined) {
    if (!file) return; setErr('');
    const okTypes = isFile ? [...ALLOWED_IMAGE_TYPES, 'application/pdf'] : ALLOWED_IMAGE_TYPES;
    if (!okTypes.includes(file.type)) return setErr(isFile ? 'Use a PDF, JPG or PNG file.' : 'Use a JPG, PNG or WebP image.');
    if (file.size > (isFile ? 10 : 5) * 1024 * 1024 || (!isFile && file.size > MAX_IMAGE_BYTES)) return setErr(`File is too large (max ${isFile ? 10 : 5} MB).`);
    setBusy(true);
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[file.type] as string;
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createBrowser().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    setBusy(false);
    if (error) return setErr('Upload failed. Please try again.');
    track?.(bucket, path); onChange(path);
  }
  const preview = !isFile ? publicMediaUrl(bucket as 'product-media' | 'site-media', value) : null;
  async function openPrivate() {
    const { data } = await createBrowser().storage.from(bucket).createSignedUrl(value, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }
  return <div className="mt-1.5">
    <div className="flex items-center gap-3">
      {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" /> : value ? <FileText className="text-gray-500" /> : null}
      <label className={cx('inline-flex items-center gap-2 text-sm font-bold border border-gray-300 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50', busy && 'opacity-50 pointer-events-none')}>
        <Upload size={14} />{busy ? 'Uploading…' : value ? 'Replace' : 'Choose file'}
        <input type="file" accept={accept} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
      {value && isFile && <button type="button" onClick={openPrivate} className="text-sm font-bold text-vihaar-deep underline">View</button>}
      {value && !f.required && <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 underline">Remove</button>}
    </div>
    {err && <div className="text-xs text-red-600 mt-1.5" role="alert">{err}</div>}
  </div>;
}

export function FieldInput({ f, values, set, editing, track }: { f: FieldDef; values: FormValues; set: (name: string, v: FormValue) => void; editing: boolean; track?: (bucket: string, path: string) => void }) {
  const v = values[f.name];
  const disabled = f.readOnly || (editing && f.lockOnEdit);
  const refOpts = useRefOptions(f.ref?.resource ?? '__none', f.ref?.label ?? 'name');
  const common = { id: `f_${f.name}`, disabled, required: f.required };
  let control: React.ReactNode;
  switch (f.type) {
    case 'bool': return <label className="flex items-start gap-2.5 text-sm font-semibold cursor-pointer select-none py-2"><input type="checkbox" checked={!!v} disabled={disabled} onChange={(e) => set(f.name, e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#00994d]" /><span>{f.label}{f.help && <span className="block text-xs font-normal muted">{f.help}</span>}</span></label>;
    case 'textarea': control = <Textarea {...common} rows={4} maxLength={f.max} value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'select': control = <Select {...common} value={v as string} onChange={(e) => set(f.name, e.target.value)}>{!f.required && <option value="">—</option>}{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>; break;
    case 'money': control = <div className="relative"><span className="absolute left-3 top-[calc(50%+3px)] -translate-y-1/2 text-gray-500 text-sm">₹</span><Input {...common} inputMode="decimal" className="!pl-7" value={v as string} placeholder={f.placeholder ?? '0.00'} onChange={(e) => set(f.name, e.target.value.replace(/[^0-9.]/g, ''))} /></div>; break;
    case 'moneyOrPercent': { const pct = values[f.typeField ?? ''] !== 'fixed'; control = <div className="relative"><span className="absolute left-3 top-[calc(50%+3px)] -translate-y-1/2 text-gray-500 text-sm">{pct ? '%' : '₹'}</span><Input {...common} inputMode="decimal" className="!pl-7" value={v as string} placeholder={pct ? '0–100' : '0.00'} onChange={(e) => set(f.name, e.target.value.replace(/[^0-9.]/g, ''))} /></div>; break; }
    case 'number': control = <Input {...common} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.integer ? 1 : f.step ?? 'any'} value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'date': control = <Input {...common} type="date" value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'datetime': control = <Input {...common} type="datetime-local" value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'email': control = <Input {...common} type="email" maxLength={f.max} value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'phone': control = <Input {...common} type="tel" value={v as string} onChange={(e) => set(f.name, e.target.value)} />; break;
    case 'slug': control = <Input {...common} maxLength={f.max} value={v as string} onChange={(e) => set(f.name, slugify(e.target.value))} />; break;
    case 'ref': control = <Select {...common} value={v as string} onChange={(e) => set(f.name, e.target.value)}><option value="">{f.required ? 'Choose…' : '—'}</option>{refOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>; break;
    case 'multiref': {
      const sel = (v as string[]) ?? [];
      control = <div className="mt-1.5 border border-gray-300 rounded-md max-h-40 overflow-y-auto divide-y divide-gray-100">
        {!refOpts.length && <div className="p-3 text-xs muted">Nothing to choose from yet.</div>}
        {refOpts.map((o) => <label key={o.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"><input type="checkbox" className="accent-[#00994d]" checked={sel.includes(o.id)} onChange={(e) => set(f.name, e.target.checked ? [...sel, o.id] : sel.filter((x) => x !== o.id))} />{o.label}</label>)}</div>; break;
    }
    case 'kv': {
      const rows = (v as KvRow[]) ?? [];
      control = <div className="mt-1.5 space-y-2">{rows.map((r, i) => <div key={i} className="flex gap-2">
        <input aria-label="Name" className="field !py-2" placeholder="Name" value={r.k} maxLength={60} onChange={(e) => set(f.name, rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
        <input aria-label="Value" className="field !py-2" placeholder="Value" value={r.v} maxLength={400} onChange={(e) => set(f.name, rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
        <button type="button" aria-label="Remove row" className="p-2 text-gray-400 hover:text-red-600" onClick={() => set(f.name, rows.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>)}
        {rows.length < 30 && <Btn type="button" variant="outline" size="sm" onClick={() => set(f.name, [...rows, { k: '', v: '' }])}><Plus size={14} />Add row</Btn>}</div>; break;
    }
    case 'image': case 'file': control = <Upload_ f={f} value={v as string} onChange={(p) => set(f.name, p)} track={track} />; break;
    default: control = <Input {...common} maxLength={f.max} placeholder={f.placeholder} value={v as string} onChange={(e) => set(f.name, e.target.value)} />;
  }
  return <div><Label help={f.help}>{f.label}{f.required && <span className="text-red-600"> *</span>}{control}</Label></div>;
}

'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div><h1 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h1>{subtitle && <p className="muted text-sm mt-1 max-w-2xl">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export const Card = ({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) =>
  <section className={cx('bg-white border border-gray-200 rounded-xl', className)}>
    {title && <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1"><h2 className="font-bold text-sm">{title}</h2>{action}</div>}
    <div className="p-5">{children}</div>
  </section>;

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
    <div className={cx('text-2xl font-black mt-1.5 tabular-nums', tone === 'bad' && 'text-red-600', tone === 'good' && 'text-[#008b47]', tone === 'warn' && 'text-amber-600')}>{value}</div>
    {hint && <div className="text-xs muted mt-1">{hint}</div>}
  </div>;
}

const BADGE = { green: 'bg-[#e3f4e9] text-[#006b38]', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800', blue: 'bg-blue-50 text-blue-700', gray: 'bg-gray-100 text-gray-600' };
export const Badge = ({ tone = 'gray', children }: { tone?: keyof typeof BADGE; children: ReactNode }) =>
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', BADGE[tone])}>{children}</span>;

export function Btn({ variant = 'primary', size = 'md', busy, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'danger' | 'ghost'; size?: 'sm' | 'md'; busy?: boolean }) {
  const v = { primary: 'bg-vihaar-green text-white border-vihaar-green hover:bg-vihaar-deep', outline: 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50', danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700', ghost: 'bg-transparent border-transparent text-gray-600 hover:bg-gray-100' }[variant];
  return <button {...p} disabled={p.disabled || busy} className={cx('inline-flex items-center justify-center gap-2 rounded-md border font-bold transition disabled:opacity-50 disabled:cursor-not-allowed', size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm', v, className)}>
    {busy && <Loader2 size={14} className="animate-spin" />}{children}</button>;
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => <div className="flex items-center gap-2 text-sm muted py-10 justify-center"><Loader2 size={16} className="animate-spin" />{label}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="text-center text-sm muted py-12 px-4">{children}</div>;

export function Alert({ tone = 'info', children, onClose }: { tone?: 'info' | 'error' | 'success' | 'warn'; children: ReactNode; onClose?: () => void }) {
  const t = { info: ['bg-blue-50 text-blue-900 border-blue-200', Info], error: ['bg-red-50 text-red-800 border-red-200', AlertTriangle], success: ['bg-[#e3f4e9] text-[#006b38] border-[#bfe3cc]', CheckCircle2], warn: ['bg-amber-50 text-amber-900 border-amber-200', AlertTriangle] }[tone] as [string, typeof Info];
  const Icon = t[1];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 border rounded-lg px-3.5 py-3 text-sm', t[0])}><Icon size={16} className="mt-0.5 shrink-0" /><div className="flex-1">{children}</div>{onClose && <button onClick={onClose} aria-label="Dismiss"><X size={14} /></button>}</div>;
}

/** Message that clears itself. */
export function useFlash() {
  const [flash, set] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = (tone: 'success' | 'error', text: string) => { set({ tone, text }); clearTimeout(timer.current); timer.current = setTimeout(() => set(null), tone === 'error' ? 9000 : 4000); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { flash, show, node: flash ? <Alert tone={flash.tone} onClose={() => set(null)}>{flash.text}</Alert> : null };
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={title} className={cx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200"><h2 className="font-black text-lg">{title}</h2><button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X size={18} /></button></div>
      <div className="p-5 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">{footer}</div>}
    </div>
  </div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto" role="tablist">
    {tabs.map((t) => <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
      className={cx('px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px', value === t.key ? 'border-vihaar-green text-vihaar-deep' : 'border-transparent text-gray-500 hover:text-gray-800')}>{t.label}</button>)}
  </div>;
}

export const Label = ({ children, help, className }: { children: ReactNode; help?: string; className?: string }) =>
  <label className={cx('block text-sm font-semibold', className)}>{children}{help && <span className="block text-xs font-normal muted mt-0.5">{help}</span>}</label>;

export const inputCls = 'field block mt-1.5';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = ({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)}>{children}</select>;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return <div className="text-xs muted px-1 pt-3">{total} {total === 1 ? 'record' : 'records'}</div>;
  return <div className="flex items-center justify-between pt-3 text-xs muted"><span>{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
    <div className="flex gap-2"><Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn><Btn size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn></div></div>;
}

/** Two-step delete / dangerous action. */
export function Confirm({ label, message, onConfirm, variant = 'danger', size = 'sm' }: { label: string; message: string; onConfirm: () => Promise<void> | void; variant?: 'danger' | 'outline' | 'primary'; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  return <>
    <Btn variant={variant === 'danger' ? 'outline' : variant} size={size} className={variant === 'danger' ? '!text-red-700 !border-red-200 hover:!bg-red-50' : ''} onClick={() => setOpen(true)}>{label}</Btn>
    {open && <Modal title={label} onClose={() => setOpen(false)} footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn variant={variant === 'outline' ? 'primary' : variant} busy={busy} onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>{label}</Btn></>}><p className="text-sm">{message}</p></Modal>}
  </>;
}

export const Table = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>;
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => <th className={cx('text-[11px] uppercase tracking-wider text-gray-500 font-bold px-3 py-2.5 border-b border-gray-200 whitespace-nowrap', right ? 'text-right' : 'text-left')}>{children}</th>;
export const Td = ({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) => <td className={cx('px-3 py-3 border-b border-gray-100 align-middle', right && 'text-right tabular-nums', className)}>{children}</td>;

export function PeriodSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options?: { value: string; label: string }[] }) {
  const o = options ?? [{ value: '1', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }];
  return <select aria-label="Period" value={value} onChange={(e) => onChange(e.target.value)} className="field !w-auto !py-2 text-sm font-semibold">{o.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>;
}

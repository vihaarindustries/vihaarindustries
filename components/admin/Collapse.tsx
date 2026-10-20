'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './ui';

/** Drop-down section whose open/closed state is remembered for the browser session. */
export default function Collapse({ id, title, hint, defaultOpen = true, children }: { id: string; title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { try { const v = sessionStorage.getItem(`cr_${id}`); if (v) setOpen(v === '1'); } catch { /* ignore */ } }, [id]);
  const toggle = () => { setOpen((o) => { try { sessionStorage.setItem(`cr_${id}`, o ? '0' : '1'); } catch { /* ignore */ } return !o; }); };
  return <section className="mb-6">
    <button onClick={toggle} aria-expanded={open} className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 text-left hover:bg-gray-50">
      <span><span className="font-black">{title}</span>{hint && <span className="muted text-xs ml-3 hidden sm:inline">{hint}</span>}</span><ChevronDown size={18} className={cx('transition text-gray-500', open && 'rotate-180')} /></button>
    {open && <div className="pt-4">{children}</div>}
  </section>;
}

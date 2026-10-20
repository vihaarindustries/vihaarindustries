'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { cx } from './ui';
import { RoleContext } from './role';
import { NAV_GROUPS, ROLE_LABEL, canOpen, type NavItem, type StaffRole } from '@/lib/admin/permissions';

type Props = { nav: NavItem[]; role: StaffRole; name: string; email: string; idleMinutes: number; children: React.ReactNode };
const isActive = (pathname: string, href: string, all: string[]) => {
  if (pathname === href) return true;
  if (href === '/control-room') return false;
  // longest matching href wins so "Finance overview" is not also active on its sub-pages
  const longer = all.some((h) => h.length > href.length && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')));
  return !longer && pathname.startsWith(href + '/');
};

export default function Shell({ nav, role, name, email, idleMinutes, children }: Props) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const hrefs = nav.map((n) => n.href);
  const groups = NAV_GROUPS.map((g) => ({ g, items: nav.filter((n) => n.group === g) })).filter((x) => x.items.length);
  const activeGroup = groups.find((x) => x.items.some((i) => isActive(pathname, i.href, hrefs)))?.g;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => { setDrawer(false); if (activeGroup) setOpen((o) => ({ ...o, [activeGroup]: true })); }, [pathname, activeGroup]);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/badges', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.data) setBadges(j.data); }).catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  // sign out after a period without activity
  const last = useRef(Date.now());
  useEffect(() => {
    const touch = () => { last.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = setInterval(async () => {
      if (Date.now() - last.current > idleMinutes * 60_000) {
        clearInterval(t);
        await fetch('/auth/sign-out', { method: 'POST', headers: { Accept: 'application/json' } }).catch(() => {});
        window.location.href = '/auth/sign-in?idle=1';
      }
    }, 30_000);
    return () => { clearInterval(t); events.forEach((e) => window.removeEventListener(e, touch)); };
  }, [idleMinutes]);

  const sidebar = <div className="flex flex-col h-full">
    <div className="px-5 pt-5 pb-4 border-b border-white/10">
      <Link href="/control-room" className="font-black text-xl">Vihaar<span className="text-[#19b96a]">.</span> <span className="text-[10px] tracking-[.25em] text-gray-400 font-bold">CONTROL ROOM</span></Link>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label="Control room">
      {groups.map(({ g, items }) => {
        const single = g === 'Overview';
        const isOpen = single || open[g] || g === activeGroup;
        return <div key={g}>
          {!single && <button onClick={() => setOpen((o) => ({ ...o, [g]: !isOpen }))} aria-expanded={isOpen}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-white">
            {g}<ChevronDown size={14} className={cx('transition', isOpen && 'rotate-180')} /></button>}
          {isOpen && <div className="space-y-0.5">{items.map((i) => {
            const active = isActive(pathname, i.href, hrefs); const b = i.badge ? badges[i.badge] : 0;
            return <Link key={i.key} href={i.href} prefetch={false} aria-current={active ? 'page' : undefined}
              className={cx('flex items-center justify-between rounded-md px-3 py-2 text-[13px] transition', active ? 'bg-[#00994d] text-white font-bold' : 'text-[#c9d0c9] hover:bg-[#263027] hover:text-white')}>
              <span>{i.label}</span>{b ? <span className={cx('text-[10px] font-black rounded-full px-1.5 py-0.5', active ? 'bg-white text-[#006b38]' : 'bg-amber-400 text-black')}>{b}</span> : null}
            </Link>;
          })}</div>}
        </div>;
      })}
    </nav>
    <div className="px-4 py-4 border-t border-white/10 text-xs">
      <div className="font-bold truncate">{name || email}</div>
      <div className="flex items-center gap-1.5 text-gray-400 mt-0.5"><ShieldCheck size={12} />{ROLE_LABEL[role]}</div>
      <form action="/auth/sign-out" method="post" className="mt-3">
        <button type="submit" className="w-full flex items-center justify-center gap-2 rounded-md border border-white/20 py-2 font-bold hover:bg-white/10"><LogOut size={14} />Log out</button>
      </form>
      <Link href="/" target="_blank" className="block text-center mt-3 text-gray-400 hover:text-white">View website ↗</Link>
    </div>
  </div>;

  return <div className="admin-shell md:flex">
    <aside className="hidden md:block print:hidden w-[256px] shrink-0 bg-[#151915] text-white sticky top-0 h-screen">{sidebar}</aside>
    <div className="md:hidden print:hidden sticky top-0 z-40 bg-[#151915] text-white flex items-center justify-between px-4 py-3">
      <span className="font-black">Vihaar<span className="text-[#19b96a]">.</span> <span className="text-[9px] tracking-[.2em] text-gray-400">CONTROL ROOM</span></span>
      <button onClick={() => setDrawer(true)} aria-label="Open menu"><Menu /></button>
    </div>
    {drawer && <div className="md:hidden fixed inset-0 z-50 flex"><div className="w-[280px] bg-[#151915] text-white h-full">{sidebar}</div><button className="flex-1 bg-black/50" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="m-4 text-white" /></button></div>}
    <main className="flex-1 min-w-0 p-4 md:p-8 max-w-[1400px]">{canOpen(role, pathname) ? <RoleContext.Provider value={role}>{children}</RoleContext.Provider> : <div className="py-24 text-center"><h1 className="text-2xl font-black">No access</h1><p className="muted mt-2">Your role ({ROLE_LABEL[role]}) cannot open this section.</p></div>}</main>
  </div>;
}

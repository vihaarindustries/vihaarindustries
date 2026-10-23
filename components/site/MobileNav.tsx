'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

type Item = { key: string; label: string; href: string };

/** Menu button for phones and tablets, where the header links are hidden. Shows the same links the control room's Navigation menu sets. */
export default function MobileNav({ items, showSignin }: { items: Item[]; showSignin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  if (!items.length && !showSignin) return null;
  return <div className="md:hidden">
    <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="p-2 -mr-1 rounded hover:bg-gray-100">
      {open ? <X size={22} /> : <Menu size={22} />}
    </button>
    {open && <nav aria-label="Mobile" className="absolute left-0 right-0 top-full bg-white border-b border-black/10 shadow-lg">
      <div className="container py-3 flex flex-col">
        {items.map((i) => <Link key={i.key} href={i.href} onClick={() => setOpen(false)} className="py-3 text-sm font-bold border-b border-gray-100">{i.label}</Link>)}
        {showSignin && <Link href="/account" onClick={() => setOpen(false)} className="py-3 text-sm font-bold">Sign in</Link>}
      </div>
    </nav>}
  </div>;
}

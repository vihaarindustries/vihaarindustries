'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from './CartProvider';
import { fmtMoney } from '@/lib/format';
import Approx, { CurrencyNote } from '@/components/fx/Approx';

export default function CartView() {
  const { items, ready, setQty, remove, subtotal_minor } = useCart();
  if (!ready) return <p className="muted py-20 text-center">Loading your cart…</p>;
  if (!items.length) return <div className="text-center py-20"><h1 className="text-3xl font-black">Your cart is empty</h1><p className="muted mt-3">Add a few products and they will show up here.</p><Link href="/retail#products" className="btn mt-6">Browse products ↗</Link></div>;
  return <div><h1 className="text-3xl font-black">Your cart</h1>
    <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 mt-8 items-start">
      <ul className="space-y-3">{items.map((i) => { const step = i.min > 0 && i.min < 1 ? i.min : 1;
        return <li key={i.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-center">
          <div className="w-20 h-20 rounded-lg bg-[#f2eee1] overflow-hidden shrink-0 flex items-center justify-center text-3xl">{i.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="w-full h-full object-cover" /> : '🌿'}</div>
          <div className="flex-1 min-w-0"><div className="font-black truncate">{i.name}</div><div className="text-sm muted">{fmtMoney(i.price_minor)} / {i.unit}{i.mrp_minor > i.price_minor && <s className="ml-2">{fmtMoney(i.mrp_minor)}</s>}</div>
            <div className="mt-2 inline-flex items-center border border-gray-300 rounded-md"><button aria-label="Decrease quantity" className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30" disabled={i.qty - step < i.min} onClick={() => setQty(i.id, i.qty - step)}><Minus size={14} /></button><span className="px-3 text-sm font-bold min-w-[64px] text-center">{i.qty} {i.unit}</span><button aria-label="Increase quantity" className="px-2.5 py-1.5 hover:bg-gray-100" onClick={() => setQty(i.id, i.qty + step)}><Plus size={14} /></button></div></div>
          <div className="text-right"><div className="font-black">{fmtMoney(Math.round(i.qty * i.price_minor))}</div><Approx minor={Math.round(i.qty * i.price_minor)} className="block text-xs muted" /><button aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)} className="mt-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button></div></li>; })}</ul>
      <aside className="bg-white border border-gray-200 rounded-xl p-6 lg:sticky lg:top-24"><h2 className="font-black text-lg">Order summary</h2>
        <div className="flex justify-between text-sm mt-4"><span className="muted">Subtotal</span><b>{fmtMoney(subtotal_minor)}</b></div>
        <div className="text-right"><Approx minor={subtotal_minor} className="text-sm muted" /></div><CurrencyNote />
        <p className="text-xs muted mt-2">GST, coupons and any delivery charges are calculated at checkout.</p>
        <Link href="/checkout" className="btn w-full mt-5">Proceed to checkout ↗</Link><Link href="/retail#products" className="block text-center text-sm font-bold underline mt-4">Continue shopping</Link></aside>
    </div></div>;
}

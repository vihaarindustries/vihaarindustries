'use client';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';

export default function CartButton() {
  const { count, ready } = useCart();
  return <Link href="/cart" aria-label={`Cart${ready && count ? `, ${count} item${count === 1 ? '' : 's'}` : ''}`} className="relative inline-flex items-center gap-2 btn !px-3 !py-2 md:!px-4 md:!py-3">
    <ShoppingCart size={16} /><span className="hidden sm:inline">Cart</span>
    {ready && count > 0 && <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-[#171917] text-white text-[11px] font-black flex items-center justify-center">{count}</span>}
  </Link>;
}

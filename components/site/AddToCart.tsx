'use client';
import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { useCart, type CartItem } from '@/components/cart/CartProvider';

/** "Add to cart" that turns into a quantity stepper once the product is in the cart. */
export default function AddToCart({ product }: { product: Omit<CartItem, 'qty'> }) {
  const { items, add, setQty, remove, ready } = useCart();
  const line = items.find((i) => i.id === product.id);
  if (!ready) return <button className="btn w-full opacity-60" disabled>Add to cart</button>;
  if (!line) return <button type="button" className="btn w-full" onClick={() => add(product, product.min)}>Add to cart</button>;
  const step = line.min > 0 && line.min < 1 ? line.min : 1;
  return <div>
    <div className="flex items-center justify-between border border-[#00994d] rounded-[4px] overflow-hidden">
      <button type="button" aria-label="Decrease quantity" className="px-3.5 py-3 hover:bg-[#e3f4e9]" onClick={() => (line.qty - step < line.min ? remove(line.id) : setQty(line.id, line.qty - step))}><Minus size={14} /></button>
      <span className="text-sm font-black" aria-live="polite">{line.qty} {product.unit}</span>
      <button type="button" aria-label="Increase quantity" className="px-3.5 py-3 hover:bg-[#e3f4e9]" onClick={() => setQty(line.id, line.qty + step)}><Plus size={14} /></button>
    </div>
    <Link href="/cart" className="block text-center text-xs font-bold text-[#006b38] underline mt-2">View cart &amp; checkout →</Link>
  </div>;
}

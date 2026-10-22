'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** What the cart remembers about a product. Prices here are only for display: the server recalculates everything at checkout. */
export type CartItem = { id: string; slug: string; name: string; unit: string; price_minor: number; mrp_minor: number; tax_rate: number; image: string | null; qty: number; min: number };
type Ctx = {
  items: CartItem[]; count: number; subtotal_minor: number; ready: boolean;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void; setQty: (id: string, qty: number) => void; remove: (id: string) => void; clear: () => void;
};
const KEY = 'vi_cart_v1'; const MAX_QTY = 999;
const CartContext = createContext<Ctx | null>(null);
const clamp = (n: number, min: number) => Math.min(MAX_QTY, Math.max(min, Math.round(n * 1000) / 1000));

function read(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === 'string' && Number.isFinite(i.qty) && i.qty > 0 && Number.isFinite(i.price_minor)).slice(0, 50) : [];
  } catch { return []; }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]); const [ready, setReady] = useState(false);
  useEffect(() => { setItems(read()); setReady(true); const sync = (e: StorageEvent) => { if (e.key === KEY) setItems(read()); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  const persist = useCallback((next: CartItem[]) => { setItems(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: cart lasts for this visit only */ } }, []);
  const add = useCallback((item: Omit<CartItem, 'qty'>, qty = 1) => {
    const cur = read(); const found = cur.find((i) => i.id === item.id);
    persist(found ? cur.map((i) => (i.id === item.id ? { ...i, ...item, qty: clamp(i.qty + qty, item.min) } : i)) : [...cur, { ...item, qty: clamp(qty, item.min) }].slice(0, 50));
  }, [persist]);
  const setQty = useCallback((id: string, qty: number) => { const cur = read(); persist(cur.map((i) => (i.id === id ? { ...i, qty: clamp(qty, i.min) } : i))); }, [persist]);
  const remove = useCallback((id: string) => persist(read().filter((i) => i.id !== id)), [persist]);
  const clear = useCallback(() => persist([]), [persist]);
  const value = useMemo<Ctx>(() => ({
    items, ready, add, setQty, remove, clear,
    count: items.length, subtotal_minor: items.reduce((s, i) => s + Math.round(i.qty * i.price_minor), 0),
  }), [items, ready, add, setQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const c = useContext(CartContext); if (!c) throw new Error('useCart must be used inside CartProvider'); return c; }

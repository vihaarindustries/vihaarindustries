'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCart } from './CartProvider';
import { fmtMoney } from '@/lib/format';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

export default function CheckoutForm() {
  const { items, ready, subtotal_minor, clear } = useCart(); const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', phone: '', line1: '', line2: '', city: '', state: 'Gujarat', pincode: '', notes: '', payment: 'cod' });
  const [code, setCode] = useState(''); const [coupon, setCoupon] = useState<{ code: string; discount_minor: number } | null>(null); const [cMsg, setCMsg] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Estimate only. The server recalculates prices, discount and GST from the database when the order is placed.
  const est = useMemo(() => {
    const disc = coupon?.discount_minor ?? 0;
    const tax = items.reduce((t, i) => { const line = Math.round(i.qty * i.price_minor); const share = subtotal_minor ? Math.round(disc * line / subtotal_minor) : 0; return t + Math.round((line - share) * i.tax_rate / 100); }, 0);
    return { disc, tax, total: subtotal_minor - disc + tax };
  }, [items, subtotal_minor, coupon]);

  async function applyCoupon() {
    setCMsg(''); if (!code.trim()) return;
    try {
      const r = await fetch('/api/coupon/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim(), type: 'retail', subtotal_minor }) });
      const j = await r.json();
      if (j.valid) { setCoupon({ code: code.trim(), discount_minor: j.discount_minor }); setCMsg('Coupon applied.'); } else { setCoupon(null); setCMsg(j.message || 'This coupon cannot be used.'); }
    } catch { setCMsg('Could not check the coupon. Please try again.'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: f.name, email: f.email, phone: f.phone, notes: f.notes, payment: f.payment, coupon: coupon?.code ?? '',
        address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode, country: 'India' },
        items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
      }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'We could not place your order. Please try again.'); return; }
      clear(); router.push(`/checkout/success?order=${encodeURIComponent(j.order_number)}`);
    } catch { setErr('Connection problem. Please try again.'); } finally { setBusy(false); }
  }

  if (!ready) return <p className="muted py-20 text-center">Loading…</p>;
  if (!items.length) return <div className="text-center py-20"><h1 className="text-3xl font-black">Your cart is empty</h1><Link href="/retail#products" className="btn mt-6">Browse products ↗</Link></div>;
  const L = 'text-sm font-semibold';
  return <form onSubmit={submit}><h1 className="text-3xl font-black">Checkout</h1>
    <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 mt-8 items-start">
      <div className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-6 grid sm:grid-cols-2 gap-4"><h2 className="font-black text-lg sm:col-span-2">Your details</h2>
          <label className={L}>Full name<input className="field block mt-2" required maxLength={160} autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className={L}>Phone<input className="field block mt-2" required type="tel" inputMode="tel" minLength={6} maxLength={20} autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className={`${L} sm:col-span-2`}>Email (order updates are sent here)<input className="field block mt-2" required type="email" maxLength={254} autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label></section>
        <section className="bg-white border border-gray-200 rounded-xl p-6 grid sm:grid-cols-2 gap-4"><h2 className="font-black text-lg sm:col-span-2">Delivery address</h2>
          <label className={`${L} sm:col-span-2`}>Address line 1<input className="field block mt-2" required maxLength={200} autoComplete="address-line1" value={f.line1} onChange={(e) => set('line1', e.target.value)} /></label>
          <label className={`${L} sm:col-span-2`}>Address line 2 (optional)<input className="field block mt-2" maxLength={200} autoComplete="address-line2" value={f.line2} onChange={(e) => set('line2', e.target.value)} /></label>
          <label className={L}>City<input className="field block mt-2" required maxLength={80} autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label className={L}>PIN code<input className="field block mt-2" required inputMode="numeric" pattern="[0-9]{6}" title="6-digit PIN code" maxLength={6} autoComplete="postal-code" value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} /></label>
          <label className={`${L} sm:col-span-2`}>State<select className="field block mt-2" required value={f.state} onChange={(e) => set('state', e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <p className="text-xs muted sm:col-span-2">We currently deliver within India. For export orders please use the Business portal.</p></section>
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3"><h2 className="font-black text-lg">Payment</h2>
          {[['cod', 'Pay on delivery', 'Pay when your order arrives.'], ['bank_upi', 'UPI / bank transfer', 'We will send you the payment details after you place the order.']].map(([v, t, d]) => <label key={v} className={`flex gap-3 items-start border rounded-lg p-4 cursor-pointer ${f.payment === v ? 'border-[#00994d] bg-[#f1faf5]' : 'border-gray-200'}`}><input type="radio" name="payment" className="mt-1 accent-[#00994d]" checked={f.payment === v} onChange={() => set('payment', v)} /><span><b className="block text-sm">{t}</b><span className="text-xs muted">{d}</span></span></label>)}
          <label className={`${L} block pt-2`}>Order notes (optional)<textarea className="field block mt-2" rows={2} maxLength={500} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label></section>
      </div>
      <aside className="bg-white border border-gray-200 rounded-xl p-6 lg:sticky lg:top-24"><h2 className="font-black text-lg">Order summary</h2>
        <ul className="mt-4 space-y-2 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.name} <span className="muted">× {i.qty} {i.unit}</span></span><b>{fmtMoney(Math.round(i.qty * i.price_minor))}</b></li>)}</ul>
        <div className="flex gap-2 mt-5"><input className="field" placeholder="Coupon code" maxLength={30} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Coupon code" /><button type="button" className="btn btn-outline" onClick={applyCoupon}>Apply</button></div>
        {cMsg && <p className={`text-xs mt-2 ${coupon ? 'text-[#006b38]' : 'text-red-700'}`} role="status">{cMsg}</p>}
        <dl className="text-sm mt-5 space-y-2 border-t border-gray-100 pt-4">
          <div className="flex justify-between"><dt className="muted">Subtotal</dt><dd>{fmtMoney(subtotal_minor)}</dd></div>
          {est.disc > 0 && <div className="flex justify-between text-[#006b38]"><dt>Coupon discount</dt><dd>− {fmtMoney(est.disc)}</dd></div>}
          <div className="flex justify-between"><dt className="muted">GST (estimated)</dt><dd>{fmtMoney(est.tax)}</dd></div>
          <div className="flex justify-between text-base font-black pt-2 border-t border-gray-100"><dt>Total</dt><dd>{fmtMoney(est.total)}</dd></div></dl>
        <p className="text-xs muted mt-3">The final amount is confirmed when you place the order. Delivery charges, if any, are confirmed by our team.</p>
        {err && <p role="alert" className="text-sm text-red-700 mt-3">{err}</p>}
        <button className="btn w-full mt-5" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
        <Link href="/cart" className="block text-center text-sm font-bold underline mt-4">Back to cart</Link></aside>
    </div></form>;
}

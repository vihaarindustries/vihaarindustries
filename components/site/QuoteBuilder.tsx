'use client';
import { useMemo, useState } from 'react';

type P = { slug: string; name: string; unit: string; moq: number };
const INCOTERMS = ['EXW (collect from our facility)', 'FOB (we load on the ship)', 'CIF (we pay freight and insurance)', 'DAP (delivered to your door)', 'Not sure yet'];
const PACKS = ['25 kg bags', '20 kg cartons', 'Retail packs in cartons', 'Custom packaging', 'Not sure yet'];
const TIMES = ['As soon as possible', 'Within 30 days', '1–3 months', 'Just exploring prices'];

/** Step-by-step quotation builder for business buyers. It builds a clear request and posts it to the same /api/enquiry as the normal form,
 *  so it appears in the control room under Enquiries. No prices are shown: pricing is quoted by your team. */
export default function QuoteBuilder({ products, id = 'quote' }: { products: P[]; id?: string }) {
  const [slug, setSlug] = useState(products[0]?.slug ?? ''); const [qty, setQty] = useState(''); const [unit, setUnit] = useState('kg');
  const [dest, setDest] = useState(''); const [inco, setInco] = useState(INCOTERMS[1]); const [pack, setPack] = useState(PACKS[0]); const [time, setTime] = useState(TIMES[1]);
  const [kind, setKind] = useState<'Export quotation' | 'Bulk / wholesale'>('Export quotation'); const [notes, setNotes] = useState('');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [company, setCompany] = useState(''); const [phone, setPhone] = useState(''); const [copied, setCopied] = useState(false);
  const prod = products.find((p) => p.slug === slug);
  const moqWarn = prod && prod.moq > 0 && unit === 'kg' && Number(qty) > 0 && Number(qty) < prod.moq;
  const step = !prod ? 1 : !Number(qty) ? 2 : !dest ? 3 : !name || !email ? 4 : 5;

  const summary = useMemo(() => [
    `Request type: ${kind}`, `Product: ${prod?.name ?? '—'}`, `Quantity: ${qty || '—'} ${unit}`, `Destination: ${dest || '—'}`,
    kind === 'Export quotation' ? `Shipping terms: ${inco}` : null, `Packaging: ${pack}`, `Needed: ${time}`, phone ? `Phone / WhatsApp: ${phone}` : null, notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join('\n'), [kind, prod, qty, unit, dest, inco, pack, time, phone, notes]);

  async function copy() { try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } }
  if (!products.length) return null;
  return <section id={id} className="relative z-10 py-16 md:py-24 scroll-mt-20"><div className="container">
    <div className="max-w-2xl"><div className="eyebrow mb-3">QUOTATION BUILDER</div><h2 className="text-3xl md:text-5xl font-black tracking-tight">Build your quotation in a minute.</h2>
      <p className="muted leading-7 mt-4">Choose the product, quantity and destination. We check availability and reply by email with pricing and documentation.</p></div>
    <ol className="flex gap-2 mt-8 text-[11px] font-bold tracking-wider" aria-label="Progress">{['PRODUCT', 'QUANTITY', 'DESTINATION', 'YOUR DETAILS'].map((s, i) => <li key={s} className={`flex-1 rounded-full px-3 py-2 text-center border transition ${step > i + 1 ? 'bg-[#00994d] border-[#00994d] text-white' : step === i + 1 ? 'border-[#28c779] text-[#28c779]' : 'border-white/15 text-gray-500'}`}>{i + 1}. {s}</li>)}</ol>

    <form action="/api/enquiry" method="post" className="grid lg:grid-cols-[1.3fr_1fr] gap-6 mt-6 items-start">
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <input type="hidden" name="product_slug" value={slug} /><input type="hidden" name="type" value={kind} /><input type="hidden" name="details" value={summary} />
      <input type="hidden" name="quantity" value={`${qty} ${unit}`.trim()} /><input type="hidden" name="destination" value={dest} />
      <div className="bg-white border border-gray-200 rounded-xl p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex gap-2" role="radiogroup" aria-label="Request type">{(['Export quotation', 'Bulk / wholesale'] as const).map((k) => <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-lg border px-4 py-3 text-sm font-bold ${kind === k ? 'bg-[#00994d] border-[#00994d] text-white' : 'border-gray-300'}`}>{k === 'Export quotation' ? 'Export (outside India)' : 'Domestic bulk'}</button>)}</div>
        <label className="text-sm font-semibold sm:col-span-2">Product<select className="field block mt-2" value={slug} onChange={(e) => setSlug(e.target.value)}>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Quantity<div className="flex gap-2 mt-2"><input className="field" type="number" min="1" step="any" inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 500" /><select aria-label="Unit" className="field !w-28" value={unit} onChange={(e) => setUnit(e.target.value)}><option>kg</option><option>tonnes</option><option>cartons</option><option>containers</option></select></div></label>
        <label className="text-sm font-semibold">Destination country / city<input className="field block mt-2" required maxLength={100} value={dest} onChange={(e) => setDest(e.target.value)} placeholder="e.g. United Arab Emirates" /></label>
        {moqWarn && <p role="status" className="sm:col-span-2 text-xs rounded-lg bg-amber-50 text-amber-900 px-3 py-2">Our usual minimum for this product is {prod!.moq} {prod!.unit}. You can still send the request and we will advise.</p>}
        {kind === 'Export quotation' && <label className="text-sm font-semibold">Shipping terms<select className="field block mt-2" value={inco} onChange={(e) => setInco(e.target.value)}>{INCOTERMS.map((x) => <option key={x}>{x}</option>)}</select></label>}
        <label className="text-sm font-semibold">Packaging<select className="field block mt-2" value={pack} onChange={(e) => setPack(e.target.value)}>{PACKS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm font-semibold">When do you need it?<select className="field block mt-2" value={time} onChange={(e) => setTime(e.target.value)}>{TIMES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm font-semibold sm:col-span-2">Anything else? (mesh size, certificates, samples…)<textarea className="field block mt-2" rows={2} maxLength={800} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="text-sm font-semibold">Your name<input className="field block mt-2" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-sm font-semibold">Work email<input className="field block mt-2" name="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="text-sm font-semibold">Company<input className="field block mt-2" name="company" maxLength={180} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
        <label className="text-sm font-semibold">Phone / WhatsApp (optional)<input className="field block mt-2" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      </div>
      <aside className="bg-white border border-gray-200 rounded-xl p-6 lg:sticky lg:top-24" aria-live="polite">
        <div className="eyebrow !text-[10px]">YOUR REQUEST</div>
        <dl className="mt-4 space-y-3 text-sm">{[['Product', prod?.name], ['Quantity', qty ? `${qty} ${unit}` : ''], ['Destination', dest], ...(kind === 'Export quotation' ? [['Terms', inco]] : []), ['Packaging', pack], ['Needed', time]].map(([k, v]) => <div key={k as string} className="flex justify-between gap-4 border-b border-gray-100 pb-2"><dt className="muted">{k}</dt><dd className="font-semibold text-right">{v || <span className="text-gray-400">—</span>}</dd></div>)}</dl>
        <p className="text-xs muted mt-4 leading-5">Pricing is prepared by our team after checking availability, shipping terms and your destination.</p>
        <button className="btn w-full mt-5" type="submit">Send quotation request ↗</button>
        <button type="button" onClick={copy} className="btn btn-outline w-full mt-3">{copied ? 'Copied ✓' : 'Copy summary'}</button>
      </aside>
    </form>
  </div></section>;
}

'use client';
import { useEffect, useState } from 'react';
import { Alert, Input, Label, Select } from '../ui';
import { api, errMsg } from '@/lib/admin/client';
import { FX_CURRENCIES, digitsFor, formatMajor, type Ccy } from '@/lib/fx/currencies';

export type FxRate = { currency: string; source: string; rate_to_inr: number; rate_date: string; note: string | null };
export type FxSourceMeta = { key: string; label: string; short: string; configured: boolean };
export type FxData = { currencies: Ccy[]; rates: FxRate[]; sources: FxSourceMeta[] };
export type FxChoice = { currency: string; source: string; manualRate: string; note: string };

/** Loads the latest stored rates. If it fails (for example the database update has not been run) the picker says so and rupee orders keep working. */
export function useFxData() {
  const [data, setData] = useState<FxData | null>(null); const [error, setError] = useState('');
  useEffect(() => { let live = true; api<FxData>('/api/admin/fx').then((d) => live && setData(d)).catch((e) => live && setError(errMsg(e))); return () => { live = false; }; }, []);
  return { data, error };
}

type Locked = { record_currency?: string | null; fx_source?: string | null; fx_rate?: number | null };
export const initialChoice = (o: Locked): FxChoice => (o.record_currency
  ? { currency: o.record_currency, source: o.fx_source ?? 'ecb', manualRate: o.fx_source === 'manual' && o.fx_rate ? String(o.fx_rate) : '', note: '' }
  : { currency: 'INR', source: 'ecb', manualRate: '', note: '' });

export function chosenRate(c: FxChoice, d: FxData | null): number | null {
  if (c.currency === 'INR') return 1;
  if (c.source === 'manual') { const n = Number(c.manualRate); return Number.isFinite(n) && n > 0 ? n : null; }
  return d?.rates.find((r) => r.currency === c.currency && r.source === c.source)?.rate_to_inr ?? null;
}
export const fxReady = (c: FxChoice, d: FxData | null) => chosenRate(c, d) !== null;

/** Arguments for the lock_order_currency database function. */
export const lockArgs = (orderId: string, c: FxChoice): Record<string, unknown> => (c.currency === 'INR'
  ? { p_order: orderId, p_currency: 'INR' }
  : { p_order: orderId, p_currency: c.currency, p_source: c.source, ...(c.source === 'manual' ? { p_manual_rate: Number(c.manualRate), ...(c.note.trim() ? { p_note: c.note.trim() } : {}) } : {}) });

const daysOld = (d: string) => Math.round((Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86_400_000);
const niceDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MARKET = ['ecb', 'exchangerate_api', 'oxr'];

export function FxPicker({ totalMinor, data, error, value, onChange }: { totalMinor: number; data: FxData | null; error: string; value: FxChoice; onChange: (c: FxChoice) => void }) {
  const cur = value.currency;
  const rates = data?.rates.filter((r) => r.currency === cur) ?? [];
  const market = rates.filter((r) => MARKET.includes(r.source));
  const spread = market.length > 1 ? ((Math.max(...market.map((r) => r.rate_to_inr)) - Math.min(...market.map((r) => r.rate_to_inr))) / Math.min(...market.map((r) => r.rate_to_inr))) * 100 : null;
  const rate = chosenRate(value, data);
  const foreign = rate && cur !== 'INR' ? totalMinor / 100 / rate : null;
  const defaultSource = (code: string) => MARKET.find((s) => data?.rates.some((r) => r.currency === code && r.source === s)) ?? 'manual';

  return <div className="space-y-3">
    {error && <Alert tone="warn">Exchange rates could not be loaded ({error}). You can still accept the order in rupees.</Alert>}
    <Label help="The books always stay in rupees. This chooses the currency the customer is quoted and pays in, and locks the exchange rate used.">Record this order in
      <Select value={cur} onChange={(e) => onChange({ ...value, currency: e.target.value, source: e.target.value === 'INR' ? value.source : defaultSource(e.target.value) })}>
        <option value="INR">INR: Indian Rupee (no conversion)</option>
        {(data?.currencies ?? FX_CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.code}: {c.name}</option>)}
      </Select></Label>

    {cur !== 'INR' && <>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold mb-1.5">Exchange rate to lock (₹ for 1 {cur})</legend>
        {(data?.sources ?? []).filter((s) => s.key !== 'manual').map((s) => {
          const r = rates.find((x) => x.source === s.key); const old = r ? daysOld(r.rate_date) > 3 : false;
          return <label key={s.key} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${r ? 'border-gray-200 cursor-pointer' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
            <input type="radio" name="fxsrc" className="mt-1 accent-[#00994d]" disabled={!r} checked={value.source === s.key} onChange={() => onChange({ ...value, source: s.key })} />
            <span className="flex-1"><span className="font-semibold">{s.label}</span>
              {!r && <span className="block text-xs">{s.configured ? 'No recent rate. Refresh rates in Currency rates.' : 'Not set up'}</span>}
              {r?.note && <span className="block text-[11px] text-gray-500">{r.note}</span>}</span>
            {r && <span className="text-right"><b>₹{r.rate_to_inr.toFixed(4)}</b><span className={`block text-[11px] ${old ? 'text-amber-700 font-bold' : 'text-gray-500'}`}>{niceDate(r.rate_date)}{old ? ' (old)' : ''}</span></span>}
          </label>;
        })}
        <label className="flex items-start gap-2.5 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer">
          <input type="radio" name="fxsrc" className="mt-1 accent-[#00994d]" checked={value.source === 'manual'} onChange={() => onChange({ ...value, source: 'manual' })} />
          <span className="flex-1"><span className="font-semibold">Enter a rate myself</span><span className="block text-xs text-gray-500">For example the RBI / FBIL reference rate or your bank’s rate today.</span></span>
        </label>
        {value.source === 'manual' && <div className="grid sm:grid-cols-2 gap-3 pl-6">
          <Label>Rate (₹ for 1 {cur})<Input inputMode="decimal" value={value.manualRate} onChange={(e) => onChange({ ...value, manualRate: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="e.g. 84.50" /></Label>
          <Label>Where it is from (optional)<Input maxLength={200} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="e.g. RBI reference rate" /></Label></div>}
      </fieldset>
      {spread !== null && spread > 1 && <p className="text-xs text-amber-700">The sources differ by {spread.toFixed(1)}% for {cur}. Check which one your accountant wants.</p>}
      {foreign !== null && rate !== null && <div className="rounded-lg bg-[#e3f4e9] px-3 py-2.5 text-sm">
        Order total <b>₹{(totalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> becomes <b>{formatMajor(Number(foreign.toFixed(digitsFor(cur))), cur)}</b>
        <span className="block text-xs text-gray-600">at 1 {cur} = ₹{rate.toFixed(4)}. Payments are still recorded in rupees.</span></div>}
    </>}
  </div>;
}

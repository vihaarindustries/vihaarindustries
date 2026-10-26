'use client';

import { useCurrency } from './CurrencyProvider';

/** "≈ $14.79" next to a rupee price, in the currency the visitor chose. Renders nothing for rupees or when rates are unavailable. */
export default function Approx({ minor, className = 'text-xs muted ml-1.5' }: { minor: number | null | undefined; className?: string }) {
  const { code, rates } = useCurrency();
  const r = rates.find((x) => x.code === code);
  if (!r || code === 'INR' || minor == null || !Number.isFinite(minor)) return null;
  const v = minor / 100 / r.rate;
  let text: string;
  try { text = new Intl.NumberFormat('en-US', { style: 'currency', currency: r.code, minimumFractionDigits: r.digits, maximumFractionDigits: r.digits }).format(v); }
  catch { text = `${r.code} ${v.toFixed(r.digits)}`; }
  return <span className={className}>≈ {text}</span>;
}

/** One-line honesty note shown near totals when another currency is selected. */
export function CurrencyNote({ className = 'text-xs muted mt-2' }: { className?: string }) {
  const { code, rates, asOf, sourceLabel } = useCurrency();
  if (code === 'INR' || !rates.some((x) => x.code === code)) return null;
  const when = asOf ? new Date(`${asOf}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  return <p className={className}>Approximate amounts in {code}{sourceLabel ? `, using ${sourceLabel} rates` : ''}{when ? ` of ${when}` : ''}. You are charged in Indian rupees (INR).</p>;
}

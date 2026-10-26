'use client';

import { useCurrency } from './CurrencyProvider';

/** Small currency picker for the menu bar. Hidden until exchange rates are available. */
export default function CurrencySelect() {
  const { code, setCode, rates } = useCurrency();
  if (!rates.length) return null;
  return (
    <select
      aria-label="Show prices in" title="Approximate prices. You are always charged in INR."
      value={code} onChange={(e) => setCode(e.target.value)}
      className="text-xs font-bold rounded-md border border-gray-300 bg-white px-1.5 py-2 md:px-2 text-gray-700 cursor-pointer"
    >
      <option value="INR">₹ INR</option>
      {rates.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
    </select>
  );
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Lets a visitor see approximate prices in another currency. The visitor's choice is remembered in their browser.
 * Nothing is shown until fresh rates arrive, so if rates are unavailable the site simply looks as it always did.
 * Customers are always charged in rupees; these figures are indicative only.
 */
export type SiteRate = { code: string; symbol: string; name: string; digits: number; rate: number };
type Ctx = { code: string; setCode: (c: string) => void; rates: SiteRate[]; asOf: string; sourceLabel: string };
const Context = createContext<Ctx>({ code: 'INR', setCode: () => {}, rates: [], asOf: '', sourceLabel: '' });
export const useCurrency = () => useContext(Context);
const KEY = 'vi_ccy';

export default function CurrencyProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<SiteRate[]>([]); const [asOf, setAsOf] = useState(''); const [sourceLabel, setSourceLabel] = useState('');
  const [code, setCodeState] = useState('INR');

  useEffect(() => {
    let live = true;
    fetch('/api/fx/rates').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const d = j?.data as { rates?: SiteRate[]; asOf?: string; sourceLabel?: string } | null;
      if (!live || !d?.rates?.length) return;
      setRates(d.rates); setAsOf(d.asOf ?? ''); setSourceLabel(d.sourceLabel ?? '');
      try { const saved = localStorage.getItem(KEY); if (saved && d.rates.some((r) => r.code === saved)) setCodeState(saved); } catch { /* private browsing */ }
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const setCode = useCallback((c: string) => { setCodeState(c); try { localStorage.setItem(KEY, c); } catch { /* private browsing */ } }, []);
  const value = useMemo(() => ({ code, setCode, rates, asOf, sourceLabel }), [code, setCode, rates, asOf, sourceLabel]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

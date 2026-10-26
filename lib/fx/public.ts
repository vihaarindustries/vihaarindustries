import 'server-only';
import { createService } from '@/lib/supabase/service';
import { FX_CURRENCIES, SOURCE_FALLBACK, ccy, mergeFxConfig, sourceLabel, type FxConfig } from './currencies';

export async function loadFxConfig(): Promise<FxConfig> {
  const svc = createService();
  if (!svc) return mergeFxConfig(null);
  try { const { data } = await svc.from('site_settings').select('value').eq('key', 'fx_config').maybeSingle(); return mergeFxConfig(data?.value); } catch { return mergeFxConfig(null); }
}

export type PublicRates = { asOf: string; source: string; sourceLabel: string; rates: { code: string; symbol: string; name: string; digits: number; rate: number }[] };

/** Indicative rates for website visitors. Only fresh rates are shown; a currency with no fresh rate is simply left out. */
export async function getPublicRates(): Promise<PublicRates | null> {
  const svc = createService();
  if (!svc) return null;
  const cfg = await loadFxConfig();
  if (!cfg.display_enabled || !cfg.currencies.length) return null;
  const since = new Date(Date.now() - cfg.max_age_days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await svc.from('exchange_rates').select('currency, source, rate_to_inr, rate_date').in('currency', cfg.currencies).gte('rate_date', since).order('rate_date', { ascending: false });
  if (!data?.length) return null;
  const order = [cfg.display_source, ...SOURCE_FALLBACK.filter((s) => s !== cfg.display_source && s !== 'manual')];   // typed-in rates are for orders, not for the public site, unless chosen as the main source
  const rates: PublicRates['rates'] = []; let asOf = ''; const used = new Set<string>();
  for (const c of FX_CURRENCIES) {
    if (!cfg.currencies.includes(c.code)) continue;
    for (const s of order) {
      const row = data.find((d) => d.currency === c.code && d.source === s);   // rows are newest first
      if (row) { rates.push({ code: c.code, symbol: c.symbol, name: c.name, digits: ccy(c.code)?.digits ?? 2, rate: Number(row.rate_to_inr) }); used.add(s); if (row.rate_date > asOf) asOf = row.rate_date; break; }
    }
  }
  if (!rates.length) return null;
  const main = used.has(cfg.display_source) ? cfg.display_source : [...used][0];
  return { asOf, source: main, sourceLabel: sourceLabel(main), rates };
}

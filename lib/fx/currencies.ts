/**
 * Currencies and rate sources, shared by the website, the control room and the server.
 * No server-only imports here on purpose (the browser uses it too).
 * To add a currency: add it here, in supabase/migrations/018 (function _fx_supported) and, if a provider cannot supply it, enter it by hand.
 */
export type Ccy = { code: string; name: string; symbol: string; digits: number };
export const FX_CURRENCIES: Ccy[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', digits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', digits: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', digits: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', digits: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', digits: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', digits: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', digits: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', digits: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', digits: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', digits: 2 },
];
export const ccy = (code: string) => FX_CURRENCIES.find((c) => c.code === code);
/** Decimal places of the smallest unit: 2 for rupees, dollars ...; 0 for yen. */
export const digitsFor = (code: string) => (code === 'INR' ? 2 : ccy(code)?.digits ?? 2);
export const minorToMajor = (minor: number, code: string) => minor / 10 ** digitsFor(code);

export type FxSourceKey = 'ecb' | 'exchangerate_api' | 'oxr' | 'manual';
export type FxSourceInfo = { key: FxSourceKey; label: string; short: string; env?: string; about: string };
export const FX_SOURCES: FxSourceInfo[] = [
  { key: 'ecb', label: 'European Central Bank', short: 'ECB', about: 'Official daily reference rates published by the ECB. Free, no key. Covers USD, EUR, GBP, JPY, AUD, CAD, SGD, CHF. AED and SAR are derived from the ECB dollar rate and their official fixed dollar pegs.' },
  { key: 'exchangerate_api', label: 'ExchangeRate-API', short: 'ExchangeRate-API', env: 'EXCHANGERATE_API_KEY', about: 'Commercial rate provider (needs a free API key). Covers every currency here including AED and SAR.' },
  { key: 'oxr', label: 'Open Exchange Rates', short: 'Open Exch. Rates', env: 'OXR_APP_ID', about: 'Commercial rate provider (needs a free app ID). Covers every currency here including AED and SAR.' },
  { key: 'manual', label: 'Entered by our team', short: 'Manual', about: 'A rate typed in by your team, for example the RBI / FBIL reference rate or your bank’s rate on the day.' },
];
export const sourceLabel = (k: string) => FX_SOURCES.find((s) => s.key === k)?.label ?? k;
export const sourceShort = (k: string) => FX_SOURCES.find((s) => s.key === k)?.short ?? k;
/** Order in which sources are tried for website prices when the preferred one has no fresh rate. */
export const SOURCE_FALLBACK: FxSourceKey[] = ['ecb', 'exchangerate_api', 'oxr', 'manual'];

/** Website display settings, stored as the site setting "fx_config". */
export type FxConfig = { display_enabled: boolean; display_source: FxSourceKey; currencies: string[]; max_age_days: number };
export const DEFAULT_FX_CONFIG: FxConfig = { display_enabled: true, display_source: 'ecb', currencies: FX_CURRENCIES.map((c) => c.code), max_age_days: 5 };
export function mergeFxConfig(v: unknown): FxConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<FxConfig>;
  const known = new Set(FX_CURRENCIES.map((c) => c.code));
  return {
    display_enabled: typeof o.display_enabled === 'boolean' ? o.display_enabled : DEFAULT_FX_CONFIG.display_enabled,
    display_source: FX_SOURCES.some((s) => s.key === o.display_source) ? (o.display_source as FxSourceKey) : DEFAULT_FX_CONFIG.display_source,
    currencies: Array.isArray(o.currencies) ? o.currencies.filter((c) => known.has(c)) : DEFAULT_FX_CONFIG.currencies,
    max_age_days: Number.isFinite(o.max_age_days) ? Math.min(Math.max(Math.round(o.max_age_days as number), 1), 30) : DEFAULT_FX_CONFIG.max_age_days,
  };
}

/** "$ 1,479.28" / "¥ 12,345" for an amount already in whole units. */
export function formatMajor(amount: number, code: string) {
  const d = digitsFor(code);
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, minimumFractionDigits: d, maximumFractionDigits: d }).format(amount); }
  catch { return `${code} ${amount.toFixed(d)}`; }
}

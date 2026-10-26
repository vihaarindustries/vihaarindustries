import 'server-only';
import { FX_CURRENCIES, type FxSourceKey } from './currencies';

/**
 * Where exchange rates come from. Each provider returns "rupees for ONE unit of the currency".
 *   - ecb: the European Central Bank's own published daily file (no key). AED/SAR are derived from its USD rate and the
 *          official fixed pegs of those currencies to the US dollar.
 *   - exchangerate_api / oxr: commercial providers, only used when their key is set in the server settings.
 * A provider that fails is reported, never guessed: nothing is saved for it.
 */
export type RateRow = { currency: string; source: FxSourceKey; rate_to_inr: number; rate_date: string; note?: string };
export type ProviderResult = { source: FxSourceKey; configured: boolean; ok: boolean; rows: RateRow[]; error?: string };

const TARGETS = FX_CURRENCIES.map((c) => c.code);
const PEGS: Record<string, number> = { AED: 3.6725, SAR: 3.75 };   // units per 1 USD, fixed by the central banks of the UAE and Saudi Arabia
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const good = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

async function get(url: string, kind: 'text' | 'json') {
  // Errors never include the URL: some providers carry the API key in it.
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000), headers: { Accept: kind === 'json' ? 'application/json' : 'application/xml,text/xml' } });
  if (!res.ok) throw new Error(`The provider answered with status ${res.status}.`);
  return kind === 'json' ? res.json() : res.text();
}

/** Rates quoted per 1 USD (INR and every currency we need) -> rupees per 1 unit of each currency. */
function fromUsdTable(perUsd: Record<string, unknown>, date: string, source: FxSourceKey): RateRow[] {
  const inr = perUsd.INR;
  if (!good(inr)) throw new Error('The provider did not return an INR rate.');
  const rows: RateRow[] = [];
  for (const c of TARGETS) {
    const q = c === 'USD' ? 1 : perUsd[c];
    if (good(q)) rows.push({ currency: c, source, rate_to_inr: r6(inr / q), rate_date: date });
  }
  return rows;
}

async function ecb(): Promise<ProviderResult> {
  try {
    const xml = (await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', 'text')) as string;
    const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
    if (!date) throw new Error('The ECB file did not contain a date.');
    const perEur: Record<string, number> = { EUR: 1 };
    for (const m of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) perEur[m[1]] = Number(m[2]);
    if (!good(perEur.INR) || !good(perEur.USD)) throw new Error('The ECB file did not contain INR and USD.');
    const rows: RateRow[] = [];
    for (const c of TARGETS) {
      if (good(perEur[c])) rows.push({ currency: c, source: 'ecb', rate_to_inr: r6(perEur.INR / perEur[c]), rate_date: date });
    }
    const usdInr = perEur.INR / perEur.USD;
    for (const [c, peg] of Object.entries(PEGS)) {
      if (TARGETS.includes(c)) rows.push({ currency: c, source: 'ecb', rate_to_inr: r6(usdInr / peg), rate_date: date, note: `Derived from the ECB US dollar rate and the official peg of ${peg} ${c} per US dollar.` });
    }
    return { source: 'ecb', configured: true, ok: true, rows };
  } catch (e) { return { source: 'ecb', configured: true, ok: false, rows: [], error: e instanceof Error ? e.message : 'Failed.' }; }
}

async function exchangerateApi(): Promise<ProviderResult> {
  const key = process.env.EXCHANGERATE_API_KEY;
  if (!key) return { source: 'exchangerate_api', configured: false, ok: false, rows: [] };
  try {
    const j = (await get(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`, 'json')) as { result?: string; conversion_rates?: Record<string, unknown>; time_last_update_unix?: number; 'error-type'?: string };
    if (j.result !== 'success' || !j.conversion_rates) throw new Error(`ExchangeRate-API refused the request${j['error-type'] ? ` (${String(j['error-type']).slice(0, 40)})` : ''}.`);
    const date = new Date((j.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);
    return { source: 'exchangerate_api', configured: true, ok: true, rows: fromUsdTable(j.conversion_rates, date, 'exchangerate_api') };
  } catch (e) { return { source: 'exchangerate_api', configured: true, ok: false, rows: [], error: e instanceof Error ? e.message : 'Failed.' }; }
}

async function oxr(): Promise<ProviderResult> {
  const id = process.env.OXR_APP_ID;
  if (!id) return { source: 'oxr', configured: false, ok: false, rows: [] };
  try {
    const j = (await get(`https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(id)}&symbols=${['INR', ...TARGETS].join(',')}`, 'json')) as { rates?: Record<string, unknown>; timestamp?: number; base?: string; message?: string };
    if (!j.rates || (j.base && j.base !== 'USD')) throw new Error(`Open Exchange Rates refused the request${j.message ? ` (${String(j.message).slice(0, 40)})` : ''}.`);
    const date = new Date((j.timestamp ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);
    return { source: 'oxr', configured: true, ok: true, rows: fromUsdTable(j.rates, date, 'oxr') };
  } catch (e) { return { source: 'oxr', configured: true, ok: false, rows: [], error: e instanceof Error ? e.message : 'Failed.' }; }
}

export const fetchAllProviders = () => Promise.all([ecb(), exchangerateApi(), oxr()]);
export const providerConfigured = () => ({ ecb: true, exchangerate_api: !!process.env.EXCHANGERATE_API_KEY, oxr: !!process.env.OXR_APP_ID, manual: true } as Record<FxSourceKey, boolean>);

import 'server-only';
import { createService } from '@/lib/supabase/service';
import { fetchAllProviders } from './providers';
import { sourceShort } from './currencies';

export type RefreshReport = { source: string; label: string; configured: boolean; ok: boolean; saved: number; rate_date?: string; error?: string; warnings: string[] };

/** A day-to-day move bigger than this is treated as a bad feed, not a real market move (INR against majors rarely moves this much in a day). */
const MAX_JUMP = 0.08;

/**
 * Fetches every configured source and stores today's rates. A source that fails, or returns a rate that jumps suspiciously,
 * saves nothing for that rate and says so in the report. Used by the daily schedule and by "Refresh now" in the control room.
 */
export async function refreshRates(): Promise<RefreshReport[]> {
  const svc = createService();
  const results = await fetchAllProviders();
  if (!svc) return results.map((r) => ({ source: r.source, label: sourceShort(r.source), configured: r.configured, ok: false, saved: 0, error: 'The server is not connected to the database (SUPABASE_SERVICE_ROLE_KEY).', warnings: [] }));

  const out: RefreshReport[] = [];
  for (const r of results) {
    const rep: RefreshReport = { source: r.source, label: sourceShort(r.source), configured: r.configured, ok: r.ok, saved: 0, error: r.error, warnings: [] };
    if (r.ok && r.rows.length) {
      const prev = new Map<string, number>();
      const { data } = await svc.from('exchange_rates').select('currency, rate_to_inr, rate_date').eq('source', r.source).order('rate_date', { ascending: false }).limit(60);
      for (const p of data ?? []) if (!prev.has(p.currency)) prev.set(p.currency, Number(p.rate_to_inr));
      const keep = r.rows.filter((row) => {
        const before = prev.get(row.currency);
        if (before && Math.abs(row.rate_to_inr - before) / before > MAX_JUMP) { rep.warnings.push(`${row.currency}: ${row.rate_to_inr} is more than ${MAX_JUMP * 100}% away from the previous ${before}. Not saved.`); return false; }
        return true;
      });
      if (keep.length) {
        const { error } = await svc.from('exchange_rates').upsert(keep.map((k) => ({ ...k, note: k.note ?? null, fetched_at: new Date().toISOString() })), { onConflict: 'currency,source,rate_date' });
        if (error) { rep.ok = false; rep.error = 'Rates were fetched but could not be saved. Has migration 018 been run?'; }
        else { rep.saved = keep.length; rep.rate_date = keep[0].rate_date; }
      }
    } else if (r.ok) { rep.ok = false; rep.error = 'The provider returned no usable rates.'; }
    out.push(rep);
  }
  return out;
}

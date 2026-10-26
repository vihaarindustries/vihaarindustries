import { dbError, ok, requireStaff, audit, fail } from '@/lib/admin/http';
import { STAFF_ROLES } from '@/lib/admin/permissions';
import { FX_CURRENCIES, FX_SOURCES, mergeFxConfig } from '@/lib/fx/currencies';
import { providerConfigured } from '@/lib/fx/providers';
import { refreshRates } from '@/lib/fx/refresh';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Latest stored rate for every currency and source (last 10 days), plus the website display settings. Any staff role can read it (order screens need it). */
export async function GET(req: Request) {
  const g = await requireStaff(req, [...STAFF_ROLES]);
  if ('res' in g) return g.res;
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const [r, c] = await Promise.all([
    g.ctx.supabase.from('exchange_rates').select('currency, source, rate_to_inr, rate_date, note').gte('rate_date', since).order('rate_date', { ascending: false }),
    g.ctx.supabase.from('site_settings').select('value').eq('key', 'fx_config').maybeSingle(),
  ]);
  if (r.error) return dbError(r.error);
  const latest = new Map<string, { currency: string; source: string; rate_to_inr: number; rate_date: string; note: string | null }>();
  for (const row of r.data ?? []) { const k = `${row.currency}|${row.source}`; if (!latest.has(k)) latest.set(k, { ...row, rate_to_inr: Number(row.rate_to_inr) }); }
  const configured = providerConfigured();
  return ok({
    currencies: FX_CURRENCIES, rates: [...latest.values()], config: mergeFxConfig(c.data?.value),
    sources: FX_SOURCES.map((s) => ({ key: s.key, label: s.label, short: s.short, about: s.about, env: s.env ?? null, configured: configured[s.key] })),
    schedule: !!process.env.CRON_SECRET,
  });
}

/** "Refresh now": fetch every configured source immediately. */
export async function POST(req: Request) {
  const g = await requireStaff(req, ['owner', 'admin', 'finance'], true);
  if ('res' in g) return g.res;
  if (!rateLimit(`fxrefresh:${g.ctx.user.id}`, 6, 10 * 60_000).ok) return fail('Please wait a few minutes before refreshing again.', 429);
  const report = await refreshRates();
  await audit(g.ctx, req, 'refresh', 'exchange_rates', null, null, { saved: report.map((x) => ({ source: x.source, saved: x.saved, ok: x.ok })) });
  return ok({ report });
}

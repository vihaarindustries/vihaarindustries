import { NextResponse } from 'next/server';
import { getResource } from '@/lib/admin/resources';
import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, isUuid } from '@/lib/admin/validate';
import { refreshForResource } from '@/lib/admin/revalidate';
import { allowedFilters, buildPayload, cleanSearch, diff, parsePaging, toCsv } from '@/lib/admin/resource-api';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ resource: string }> | { resource: string } };

export async function GET(req: Request, { params }: Ctx) {
  const def = getResource((await params).resource);
  if (!def) return fail('Not found.', 404);
  const g = await requireStaff(req, def.read);
  if ('res' in g) return g.res;
  const { ctx } = g;
  const sp = new URL(req.url).searchParams;
  const csv = sp.get('format') === 'csv';
  if (csv && (!def.exportable || (def.pii && !['owner', 'admin'].includes(ctx.role)))) return fail('You do not have permission to export this.', 403);

  const { page, size, from, to } = parsePaging(sp, csv ? 5000 : 100);
  let q = ctx.supabase.from(def.table).select(def.select ?? '*', { count: 'exact' });
  if (def.fixed) for (const [c, v] of Object.entries(def.fixed)) q = q.eq(c, v);
  const filters = allowedFilters(def);
  for (const col of filters) {
    const v = sp.get(`f_${col}`);
    if (!v) continue;
    if (col.endsWith('_id')) { if (!isUuid(v)) return fail('Invalid filter.', 400); q = q.eq(col, v); }
    else if (v === 'true' || v === 'false') q = q.eq(col, v === 'true');
    else if (v.length <= 80) q = q.eq(col, v);
  }
  const term = cleanSearch(sp.get('q') ?? '');
  if (term && def.search.length) q = q.or(def.search.map((c) => `${c}.ilike.%${term}%`).join(','));
  q = q.order(def.orderBy.column, { ascending: def.orderBy.asc ?? false });
  if (def.orderBy.column !== 'created_at' && !def.sortable && !def.noTieBreak) q = q.order('created_at', { ascending: false });
  const { data, error, count } = csv ? await q.range(0, 4999) : await q.range(from, to);
  if (error) return dbError(error);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  if (csv) {
    await audit(ctx, req, 'export', 'export', def.key, null, { resource: def.key, rows: rows.length });
    return new NextResponse(toCsv(def, rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${def.key}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ data: rows, total: count ?? rows.length, page, size }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: Ctx) {
  const def = getResource((await params).resource);
  if (!def || def.creatable === false || !def.write.length) return fail('Not found.', 404);
  const g = await requireStaff(req, def.write, true);
  if ('res' in g) return g.res;
  const { ctx } = g;
  const body = await readJson(req);
  if (!body) return fail('Invalid request.');
  let row: Record<string, unknown>;
  try { row = buildPayload(def, body, 'create'); } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  if (def.sortable) {   // new items go to the end of the list
    const { data: last } = await ctx.supabase.from(def.table).select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    row.sort_order = ((last as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
  }
  const { data, error } = await ctx.supabase.from(def.table).insert(row).select().single();
  if (error) return dbError(error);
  await audit(ctx, req, 'create', def.key, (data as { id?: string }).id ?? null, null, diff(null, row).after);
  refreshForResource(def.key);   // the website shows the new item straight away
  return ok(data, 201);
}

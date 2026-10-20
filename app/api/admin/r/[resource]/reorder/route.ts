import { getResource } from '@/lib/admin/resources';
import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { isUuid } from '@/lib/admin/validate';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ resource: string }> | { resource: string } };

/** Saves a new order: body { ids: [first, second, ...] }. */
export async function POST(req: Request, { params }: Ctx) {
  const def = getResource((await params).resource);
  if (!def || !def.sortable || !def.write.length) return fail('Not found.', 404);
  const g = await requireStaff(req, def.write, true);
  if ('res' in g) return g.res;
  const body = await readJson(req);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 300 || !ids.every(isUuid) || new Set(ids).size !== ids.length) return fail('Invalid order.', 422);
  for (let i = 0; i < ids.length; i++) {
    const { error } = await g.ctx.supabase.from(def.table).update({ sort_order: i }).eq('id', ids[i] as string);
    if (error) return dbError(error);
  }
  await audit(g.ctx, req, 'reorder', def.key, null, null, { count: ids.length });
  return ok(null);
}

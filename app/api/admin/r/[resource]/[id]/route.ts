import { getResource } from '@/lib/admin/resources';
import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, isUuid } from '@/lib/admin/validate';
import { buildPayload, diff, storageRefs } from '@/lib/admin/resource-api';
import { destroyCloudinaryAsset } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ resource: string; id: string }> | { resource: string; id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const { resource, id } = await params;
  const def = getResource(resource);
  if (!def || !isUuid(id)) return fail('Not found.', 404);
  const g = await requireStaff(req, def.read);
  if ('res' in g) return g.res;
  const { data, error } = await g.ctx.supabase.from(def.table).select(def.select ?? '*').eq('id', id).maybeSingle();
  if (error) return dbError(error);
  return data ? ok(data) : fail('Not found.', 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { resource, id } = await params;
  const def = getResource(resource);
  if (!def || !isUuid(id) || !def.write.length) return fail('Not found.', 404);
  const g = await requireStaff(req, def.write, true);
  if ('res' in g) return g.res;
  const { ctx } = g;
  const body = await readJson(req);
  if (!body) return fail('Invalid request.');
  let patch: Record<string, unknown>;
  try { patch = buildPayload(def, body, 'update'); } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  // only keys the caller actually sent may change
  for (const k of Object.keys(patch)) if (!Object.prototype.hasOwnProperty.call(body, k)) delete patch[k];
  if (!Object.keys(patch).length) return fail('Nothing to change.', 422);

  const { data: before } = await ctx.supabase.from(def.table).select('*').eq('id', id).maybeSingle();
  if (!before) return fail('Not found.', 404);
  const { data, error } = await ctx.supabase.from(def.table).update(patch).eq('id', id).select().maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail('Not found.', 404);
  // remove files that were replaced
  const oldRefs = storageRefs(def, before as Record<string, unknown>); const newRefs = storageRefs(def, data as Record<string, unknown>);
  for (const r of oldRefs) if (!newRefs.some((n) => n.bucket === r.bucket && n.path === r.path)) { if (r.path.startsWith('cld/') || r.path.startsWith('cldauth/')) await destroyCloudinaryAsset(r.path).catch(() => {}); else await ctx.supabase.storage.from(r.bucket).remove([r.path]); }
  const d = diff(before as Record<string, unknown>, patch);
  await audit(ctx, req, 'update', def.key, id, d.before, d.after);
  return ok(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { resource, id } = await params;
  const def = getResource(resource);
  if (!def || !isUuid(id) || !def.remove.length) return fail('Not found.', 404);
  const g = await requireStaff(req, def.remove, true);
  if ('res' in g) return g.res;
  const { ctx } = g;
  const { data: before } = await ctx.supabase.from(def.table).select('*').eq('id', id).maybeSingle();
  if (!before) return fail('Not found.', 404);
  const { error } = await ctx.supabase.from(def.table).delete().eq('id', id);
  if (error) return dbError(error);
  for (const r of storageRefs(def, before as Record<string, unknown>)) { if (r.path.startsWith('cld/') || r.path.startsWith('cldauth/')) await destroyCloudinaryAsset(r.path).catch(() => {}); else await ctx.supabase.storage.from(r.bucket).remove([r.path]); }
  await audit(ctx, req, 'delete', def.key, id, before, null);
  return ok(null);
}

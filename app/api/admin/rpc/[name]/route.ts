import { RPC, hasRpc } from '@/lib/admin/rpc';
import { dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check } from '@/lib/admin/validate';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ name: string }> | { name: string } };

/** Single door for every business action (create order, receive stock, post journal ...). Inputs are validated
 *  against a fixed schema; the database function repeats the role check and writes the audit trail. */
export async function POST(req: Request, { params }: Ctx) {
  const name = (await params).name;
  if (!hasRpc(name)) return fail('Not found.', 404);
  const def = RPC[name];
  const g = await requireStaff(req, def.roles, def.mutating);
  if ('res' in g) return g.res;
  const body = await readJson(req, 300_000);
  if (!body) return fail('Invalid request.');
  const args: Record<string, unknown> = {};
  try {
    for (const k of Object.keys(body)) if (!(k in def.params)) throw new ValidationError('Unexpected field.');
    for (const [k, s] of Object.entries(def.params)) { const v = check(s, body[k], k.replace(/^p_/, '').replace(/_/g, ' ')); if (v !== null) args[k] = v; }
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  const { data, error } = await g.ctx.supabase.rpc(name, args);
  if (error) return dbError(error);
  return ok(data);
}

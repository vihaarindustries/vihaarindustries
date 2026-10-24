import { RPC, hasRpc } from '@/lib/admin/rpc';
import { dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check } from '@/lib/admin/validate';
import { notifyAfterAction, snapshotBefore } from '@/lib/order-notify';

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
  const before = await snapshotBefore(g.ctx.supabase, name, args);   // a refund zeroes "amount paid", so read it first
  const { data, error } = await g.ctx.supabase.rpc(name, args);
  if (error) return dbError(error);
  // Customer emails (accepted, shipped, delivered, payment received, refunded). Wording is edited in Control room -> Email templates.
  // Awaited on purpose: on Vercel, work left running after the response is sent can be cut off. A failure here never undoes the action.
  await notifyAfterAction(g.ctx.supabase, name, args, before);
  return ok(data);
}

import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check } from '@/lib/admin/validate';
import { STAFF_ROLES } from '@/lib/admin/permissions';
import { createService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
const ADMINS = ['owner', 'admin'] as const;

export async function GET(req: Request) {
  const g = await requireStaff(req, [...ADMINS]);
  if ('res' in g) return g.res;
  const { data, error } = await g.ctx.supabase.from('profiles').select('id, email, full_name, role, is_active, created_at').in('role', STAFF_ROLES).order('created_at');
  if (error) return dbError(error);
  return ok({ members: data, me: g.ctx.user.id, myRole: g.ctx.role });
}

/** Invite a new team member (service role is needed only to create the login). */
export async function POST(req: Request) {
  const g = await requireStaff(req, [...ADMINS], true);
  if ('res' in g) return g.res;
  const body = await readJson(req);
  let email: string, role: string, name: string;
  try {
    email = (check({ t: 'str', max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }, body?.email, 'email') as string).toLowerCase();
    role = check({ t: 'str', oneOf: [...STAFF_ROLES] }, body?.role, 'role') as string;
    name = (check({ t: 'str', max: 120, optional: true }, body?.full_name, 'name') as string | null) ?? '';
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  if ((role === 'owner') && g.ctx.role !== 'owner') return fail('Only an owner can invite another owner.', 403);
  const svc = createService();
  if (!svc) return fail('Inviting is not available: add SUPABASE_SERVICE_ROLE_KEY on the server.', 503);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${origin}/auth/sign-in` });
  if (error || !data.user) return fail('Could not send the invitation. The email may already have an account.', 422);
  // The profile row is created by the database trigger; set the role through the guarded path using the inviter's session.
  await svc.from('profiles').upsert({ id: data.user.id, email, full_name: name, role }, { onConflict: 'id' });
  await audit(g.ctx, req, 'team.invite', 'team', data.user.id, null, { email, role });
  return ok({ id: data.user.id }, 201);
}

/** Change a member's role or switch their access off/on. Database triggers block self-promotion and removing the last owner. */
export async function PATCH(req: Request) {
  const g = await requireStaff(req, [...ADMINS], true);
  if ('res' in g) return g.res;
  const body = await readJson(req);
  let id: string; let role: string | null; let active: boolean | null;
  try {
    id = check({ t: 'uuid' }, body?.id, 'member') as string;
    role = check({ t: 'str', oneOf: [...STAFF_ROLES, 'customer'], optional: true }, body?.role, 'role') as string | null;
    active = check({ t: 'bool', optional: true }, body?.is_active, 'status') as boolean | null;
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  const patch: Record<string, unknown> = {};
  if (role) patch.role = role; if (active !== null) patch.is_active = active;
  if (!Object.keys(patch).length) return fail('Nothing to change.', 422);
  const { data: before } = await g.ctx.supabase.from('profiles').select('role, is_active').eq('id', id).maybeSingle();
  const { data, error } = await g.ctx.supabase.from('profiles').update(patch).eq('id', id).select('id, role, is_active').maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail('Not found.', 404);
  await audit(g.ctx, req, 'team.update', 'team', id, before, patch);
  return ok(data);
}

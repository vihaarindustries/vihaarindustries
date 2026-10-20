import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { STAFF_ROLES, type StaffRole } from './permissions';

export type StaffContext = {
  supabase: SupabaseClient; user: User; role: StaffRole; fullName: string | null; email: string | null; aal: string;
};
export type StaffState =
  | { status: 'ok'; ctx: StaffContext }
  | { status: 'unconfigured' } | { status: 'anon' } | { status: 'forbidden' } | { status: 'expired' }
  | { status: 'needs_mfa'; enrolled: boolean };

export const MFA_REQUIRED = process.env.ADMIN_REQUIRE_MFA !== 'false';
const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS || 12);

function jwtClaim(token: string | undefined, claim: string): string | undefined {
  try { return JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString('utf8'))[claim]; } catch { return undefined; }
}

/**
 * Resolves who is calling and what they may do. Order matters:
 * validated user -> active staff profile -> maximum session age -> MFA level.
 * The database enforces the same rules again through row-level security.
 */
export async function getStaffState(): Promise<StaffState> {
  const supabase = await createClient();
  if (!supabase) return { status: 'unconfigured' };
  const { data: { user } } = await supabase.auth.getUser();   // validated with the auth server
  if (!user) return { status: 'anon' };

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email, is_active').eq('id', user.id).maybeSingle();
  if (!profile || !profile.is_active || !STAFF_ROLES.includes(profile.role)) return { status: 'forbidden' };

  if (user.last_sign_in_at && Date.now() - new Date(user.last_sign_in_at).getTime() > SESSION_HOURS * 3600_000) return { status: 'expired' };

  // The token was validated by getUser() above, so reading its aal claim here is safe.
  const { data: { session } } = await supabase.auth.getSession();
  const aal = jwtClaim(session?.access_token, 'aal') ?? 'aal1';
  if (MFA_REQUIRED && aal !== 'aal2') {
    return { status: 'needs_mfa', enrolled: !!user.factors?.some((f) => f.status === 'verified' && f.factor_type === 'totp') };
  }
  return { status: 'ok', ctx: { supabase, user, role: profile.role as StaffRole, fullName: profile.full_name, email: profile.email ?? user.email ?? null, aal } };
}

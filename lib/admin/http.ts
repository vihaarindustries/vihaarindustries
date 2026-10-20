import 'server-only';
import { NextResponse } from 'next/server';
import { getStaffState, type StaffContext } from './guard';
import type { StaffRole } from './permissions';
import { rateLimit } from '@/lib/rate-limit';
import { createHash } from 'crypto';

export const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
export const ok = (data: unknown = null, status = 200) =>
  NextResponse.json({ data }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Blocks cross-site form posts / fetches (CSRF). Browsers always send Origin on mutating requests. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}

export const ipHash = (req: Request) =>
  createHash('sha256').update((req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown') + (process.env.ADMIN_AUDIT_SALT || 'vihaar')).digest('hex').slice(0, 24);

type Guarded = { ctx: StaffContext } | { res: NextResponse };

/** Authenticates an admin API call. Pass the roles allowed; mutating calls also get origin + rate checks. */
export async function requireStaff(req: Request, roles?: StaffRole[], mutating = false): Promise<Guarded> {
  if (mutating && !sameOrigin(req)) return { res: fail('Request blocked.', 403) };
  const state = await getStaffState();
  if (state.status === 'unconfigured') return { res: fail('The server is not configured.', 503) };
  if (state.status === 'anon' || state.status === 'expired') return { res: fail('Your session has ended. Please sign in again.', 401) };
  if (state.status === 'needs_mfa') return { res: fail('Two-factor verification is required.', 401, { mfa: true }) };
  if (state.status !== 'ok') return { res: fail('You do not have access.', 403) };
  if (roles && !roles.includes(state.ctx.role)) return { res: fail('You do not have permission to do this.', 403) };
  const rl = rateLimit(`admin:${state.ctx.user.id}:${mutating ? 'w' : 'r'}`, mutating ? 120 : 600, 60_000);
  if (!rl.ok) return { res: fail('Too many requests. Please wait a moment.', 429) };
  return { ctx: state.ctx };
}

export async function readJson(req: Request, maxBytes = 200_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

/** Turns database errors into safe, plain messages. Messages raised by our own functions (P0001) are written for users. */
export function dbError(err: { code?: string; message?: string }, fallback = 'Something went wrong. Please try again.') {
  if (err.code === 'P0001' && err.message) return fail(err.message, 422);
  if (err.code === '42501' || /row-level security/i.test(err.message ?? '')) return fail('You do not have permission to do this.', 403);
  if (err.code === '23505') return fail('That value is already in use.', 409);
  if (err.code === '23503') return fail('This record is used elsewhere. Deactivate it instead of deleting it.', 409);
  if (err.code === '23514' || err.code === '22003' || err.code === '22P02') return fail('One of the values is outside the allowed range.', 422);
  if (err.code === '23502') return fail('A required value is missing.', 422);
  const ref = Math.random().toString(36).slice(2, 8);
  console.error(`[admin-error ${ref}]`, err.code, err.message);
  return fail(`${fallback} (ref ${ref})`, 500);
}

export async function audit(ctx: StaffContext, req: Request, action: string, entity: string, id: string | null, before: unknown, after: unknown) {
  await ctx.supabase.rpc('write_audit', { p_action: action, p_entity_type: entity, p_entity_id: id, p_before: before ?? null, p_after: after ?? null, p_ip_hash: ipHash(req) });
}

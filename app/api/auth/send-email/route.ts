import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { sendEventEmail } from '@/lib/email/send';
import { emailConfigured } from '@/lib/integrations/email';
import { safeNext } from '@/lib/safe-redirect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Supabase "Send Email" auth hook (Supabase Dashboard -> Authentication -> Hooks).
 * Supabase calls this URL instead of sending its own email, so the sign-up verification email (and the reset / invite
 * emails) are sent through Brevo using the wording saved in Control room -> Email templates.
 *
 * The request is signed by Supabase (Standard Webhooks). Anything without a valid signature is rejected.
 * Env: SEND_EMAIL_HOOK_SECRET = the secret Supabase shows when you create the hook (looks like  v1,whsec_xxxxxxxx).
 */
const bad = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

function signatureValid(raw: string, req: Request, secretEnv: string): boolean {
  const id = req.headers.get('webhook-id'); const ts = req.headers.get('webhook-timestamp'); const sigs = req.headers.get('webhook-signature');
  if (!id || !ts || !sigs) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;                        // reject replays older than 5 minutes
  const key = Buffer.from(secretEnv.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest();
  return sigs.split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

type Payload = {
  user?: { email?: string; user_metadata?: { full_name?: string; name?: string } };
  email_data?: { token_hash?: string; redirect_to?: string; email_action_type?: string; site_url?: string };
};
const EVENT_FOR: Record<string, { event: string; linkVar: string }> = {
  signup: { event: 'email_verification', linkVar: 'verify_link' },
  recovery: { event: 'password_reset', linkVar: 'reset_link' },
  invite: { event: 'staff_invite', linkVar: 'invite_link' },
};

export async function POST(req: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return bad(503, 'SEND_EMAIL_HOOK_SECRET is not set on the server.');
  const raw = await req.text();
  if (raw.length > 100_000 || !signatureValid(raw, req, secret)) return bad(401, 'Invalid signature.');
  let p: Payload;
  try { p = JSON.parse(raw); } catch { return bad(400, 'Invalid request.'); }

  const type = p.email_data?.email_action_type ?? ''; const hash = p.email_data?.token_hash ?? ''; const to = (p.user?.email ?? '').trim();
  const map = Object.prototype.hasOwnProperty.call(EVENT_FOR, type) ? EVENT_FOR[type] : undefined;
  // Only sign-up, password reset and staff invite are used by this site. Failing loudly beats silently dropping an email.
  if (!map) return bad(400, `The "${type}" email is not enabled on this website.`);
  if (!to || !hash) return bad(400, 'Missing recipient or token.');
  if (!emailConfigured()) return bad(500, 'Email is not configured on the server (EMAIL_PROVIDER_API_KEY / EMAIL_FROM).');

  // The link opens OUR confirm page (which verifies the token on the server and signs the person in).
  // "next" travels inside the redirect_to that the sign-up page already sends.
  let next = '/account';
  try { next = safeNext(new URL(p.email_data?.redirect_to ?? '').searchParams.get('next'), '/account'); } catch { /* keep default */ }
  const base = (process.env.NEXT_PUBLIC_SITE_URL || p.email_data?.site_url || '').replace(/\/$/, '');
  const link = `${base}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`;

  const meta = p.user?.user_metadata ?? {};
  const name = (meta.full_name || meta.name || '').trim();
  const out = await sendEventEmail(map.event, to, { [map.linkVar]: link, name }, { toName: name });
  if (!out.ok) return bad(500, 'We could not send the email right now. Please try again in a moment.');
  return NextResponse.json({}, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

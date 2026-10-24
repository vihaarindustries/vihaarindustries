import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';
import { escapeHtml } from '@/lib/email/render';

export const dynamic = 'force-dynamic';

/**
 * Landing page for the links in the verify-email / password-reset / invitation emails.
 *
 * Two steps on purpose: opening the link only shows a "Confirm" button; the token is used when the person presses it.
 * Many company mail systems "pre-open" every link to scan it for viruses, which would otherwise use up the one-time
 * token before the real person clicks it (they would then see "link expired").
 */
const TYPES = ['signup', 'invite', 'recovery'] as const;
type OtpType = (typeof TYPES)[number];
const COPY: Record<OtpType, { title: string; text: string; button: string }> = {
  signup: { title: 'Confirm your email', text: 'Press the button to verify your email address and activate your account.', button: 'Confirm my email' },
  invite: { title: 'Accept your invitation', text: 'Press the button to accept your invitation and continue.', button: 'Accept invitation' },
  recovery: { title: 'Continue to reset your password', text: 'Press the button to continue.', button: 'Continue' },
};
const html = (title: string, inner: string, status = 200) => new Response(
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>` +
  `<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><main style="max-width:440px;margin:64px auto;padding:0 16px">` +
  `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px"><h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(title)}</h1>${inner}</div></main></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const btn = 'display:block;width:100%;box-sizing:border-box;text-align:center;background:#00994d;color:#fff;font-weight:700;font-size:15px;border:0;border-radius:6px;padding:12px 16px;text-decoration:none;cursor:pointer';

function parse(get: (k: string) => string | null) {
  const hash = get('token_hash') ?? ''; const type = get('type') ?? '';
  const ok = /^[A-Za-z0-9_-]{10,200}$/.test(hash) && (TYPES as readonly string[]).includes(type);
  return { ok, hash, type: type as OtpType, next: safeNext(get('next'), '/account') };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const p = parse((k) => u.searchParams.get(k));
  if (!p.ok) return expired();
  const c = COPY[p.type];
  return html(c.title, `<p style="margin:0 0 20px;line-height:1.5">${escapeHtml(c.text)}</p>` +
    `<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${escapeHtml(p.hash)}"><input type="hidden" name="type" value="${p.type}"><input type="hidden" name="next" value="${escapeHtml(p.next)}">` +
    `<button type="submit" style="${btn}">${escapeHtml(c.button)}</button></form>`);
}

export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return expired(); }
  const p = parse((k) => { const v = form.get(k); return typeof v === 'string' ? v : null; });
  if (!p.ok) return expired();
  const supabase = await createClient();
  if (!supabase) return html('Setup required', '<p>The website is not connected to its database yet.</p>', 503);
  const { error } = await supabase.auth.verifyOtp({ type: p.type, token_hash: p.hash });
  if (error) return expired();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  return NextResponse.redirect(`${base}${p.next}`, 303);
}

function expired() {
  return html('This link is no longer valid',
    `<p style="margin:0 0 20px;line-height:1.5">It may have expired or already been used. If you just created your account, try signing in: if your email was already confirmed it will work. Otherwise create the account again and we will send a new link.</p>` +
    `<a href="/auth/sign-in" style="${btn}">Go to sign in</a>`, 400);
}

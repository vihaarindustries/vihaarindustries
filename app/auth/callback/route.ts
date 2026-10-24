import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';

export const dynamic = 'force-dynamic';

/**
 * Where Google sends the person back to. Supabase adds a one-time ?code=...; we swap it for a login session
 * (stored in the normal secure cookies) and send the person on to the page they were heading to.
 * If they cancel on Google's screen, or anything fails, they return to the sign-in page with a message.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || u.origin).replace(/\/$/, '');
  const next = safeNext(u.searchParams.get('next'), '/account');
  const fail = () => NextResponse.redirect(`${base}/auth/sign-in?oauth_error=1&next=${encodeURIComponent(next)}`, 303);

  const code = u.searchParams.get('code');
  if (u.searchParams.get('error') || !code || code.length > 500) return fail();
  const supabase = await createClient();
  if (!supabase) return fail();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail();
  return NextResponse.redirect(`${base}${next}`, 303);
}

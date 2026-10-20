import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST only (a link or image tag cannot log someone out). Ends the session on the server and clears the cookies. */
export async function POST(req: Request) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json');
  if (wantsJson) return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.redirect(new URL('/auth/sign-in?signed_out=1', req.url), 303);
}

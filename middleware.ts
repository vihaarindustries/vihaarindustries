import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const COOKIE = 'vi_gate';
const PROD = process.env.NODE_ENV === 'production';

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const notFound = (req: NextRequest) => NextResponse.rewrite(new URL('/404', req.url), { status: 404 });

/**
 * 1. Secret entry link: the control room does not exist (404) for anyone who has not opened
 *    /control-room?key=<ADMIN_GATE_KEY> once. In production a missing key means the control room stays closed.
 * 2. Keeps the Supabase login session fresh (Server Components cannot write cookies themselves).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const guarded = pathname.startsWith('/control-room') || pathname.startsWith('/api/admin');

  if (guarded) {
    const gate = process.env.ADMIN_GATE_KEY;
    if (!gate) { if (PROD) return notFound(req); }
    else {
      const expected = await sha256(`${gate}|vihaar-gate`);
      const ok = safeEqual(req.cookies.get(COOKIE)?.value ?? '', expected);
      if (!ok) {
        const given = req.nextUrl.searchParams.get('key');
        if (given && req.method === 'GET' && safeEqual(await sha256(`${given}|vihaar-gate`), expected)) {
          const clean = req.nextUrl.clone(); clean.searchParams.delete('key');
          const r = NextResponse.redirect(clean);
          r.cookies.set(COOKIE, expected, { httpOnly: true, secure: PROD, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 12 });
          return r;
        }
        return notFound(req);
      }
    }
  }

  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();   // validates the session and refreshes tokens when needed
    // Checkout needs a signed-in customer. Everyone else is sent to sign in and brought back afterwards.
    if (pathname.startsWith('/checkout') && !user) {
      const to = req.nextUrl.clone();
      to.pathname = '/auth/sign-in'; to.search = ''; to.searchParams.set('next', pathname);
      return NextResponse.redirect(to);
    }
  }
  if (guarded || pathname.startsWith('/auth') || pathname.startsWith('/account') || pathname.startsWith('/checkout')) res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = { matcher: ['/control-room/:path*', '/api/admin/:path*', '/auth/:path*', '/account/:path*', '/checkout/:path*', '/api/enquiry'] };

import { NextResponse } from 'next/server';
import { createService } from '@/lib/supabase/service';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python|axios|scrapy|facebookexternalhit/i;

/** Records one page view. No IP address or account id is stored; the browser supplies a random visitor id. */
export async function POST(req: Request) {
  const done = () => new NextResponse(null, { status: 204 });
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return done();
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return done();
  if (!rateLimit(`track:${clientIp(req)}`, 120, 60_000).ok) return done();
  let body: { v?: unknown; p?: unknown; r?: unknown; u?: unknown };
  try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch { return done(); }
  const visitor = typeof body.v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.v) ? body.v : null;
  const path = typeof body.p === 'string' && body.p.startsWith('/') && !body.p.startsWith('/control-room') && !body.p.startsWith('/api') ? body.p.split('?')[0].slice(0, 200) : null;
  if (!visitor || !path) return done();
  let refHost: string | null = null;
  if (typeof body.r === 'string' && body.r) { try { const h = new URL(body.r).host; if (h && h !== req.headers.get('host')) refHost = h.slice(0, 120); } catch { /* ignore */ } }
  const utm = typeof body.u === 'string' && /^[\w.\- ]{1,60}$/.test(body.u) ? body.u : null;
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null;
  const svc = createService();
  if (svc) await svc.rpc('track_visit', { p_visitor: visitor, p_path: path, p_referrer_host: refHost, p_utm: utm, p_device: device, p_country: country });
  return done();
}

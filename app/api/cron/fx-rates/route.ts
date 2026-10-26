import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { refreshRates } from '@/lib/fx/refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Daily rate refresh, called by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"
 * automatically when the CRON_SECRET environment variable is set. Anyone else is turned away.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  const got = Buffer.from(req.headers.get('authorization') ?? ''); const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const report = await refreshRates();
  return NextResponse.json({ ok: report.some((r) => r.ok), report }, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';
import { getPublicRates } from '@/lib/fx/public';

/** Indicative rates for the website's currency selector. Public on purpose: it contains no secrets, only rates. */
export async function GET() {
  const data = await getPublicRates().catch(() => null);
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
}

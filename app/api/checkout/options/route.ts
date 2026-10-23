import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { isUuid } from '@/lib/admin/validate';
import { sameOrigin } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';
const reply = (b: object, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

/** Tells the checkout page whether Cash on delivery can be offered for the products in the cart (set per product in Control room -> Products). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: 'Request blocked.' }, 403);
  let b: { ids?: unknown };
  try { b = JSON.parse((await req.text()).slice(0, 5000)); } catch { return reply({ error: 'Invalid request.' }, 400); }
  const ids = Array.isArray(b.ids) ? b.ids.filter(isUuid).slice(0, 50) as string[] : [];
  if (!ids.length) return reply({ cod_allowed: true, blocked: [] });
  const sb = createPublicClient();
  if (!sb) return reply({ cod_allowed: true, blocked: [] });
  const { data, error } = await sb.from('products').select('id, name, is_cod_available').in('id', ids);
  if (error) return reply({ cod_allowed: true, blocked: [] });   // the database re-checks when the order is placed
  const blocked = (data ?? []).filter((p) => p.is_cod_available === false).map((p) => p.name as string);
  return reply({ cod_allowed: blocked.length === 0, blocked });
}

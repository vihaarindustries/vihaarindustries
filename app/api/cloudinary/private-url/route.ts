import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin/http';
import { authenticatedRawUrl } from '@/lib/cloudinary';
import type { StaffRole } from '@/lib/admin/permissions';
export const dynamic = 'force-dynamic';
const CONTENT_ROLES: StaffRole[] = ['owner', 'admin', 'content_manager'];
export async function POST(req: Request) {
  const g = await requireStaff(req, CONTENT_ROLES);
  if ('res' in g) return g.res;
  let body: { publicId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (typeof body.publicId !== 'string' || !body.publicId.startsWith('cldauth/')) return NextResponse.json({ error: 'Invalid private document ID.' }, { status: 400 });
  try { return NextResponse.json({ url: authenticatedRawUrl(body.publicId) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Could not create a document link.' }, { status: 503 }); }
}

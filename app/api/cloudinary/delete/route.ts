import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin/http';
import { destroyCloudinaryAsset } from '@/lib/cloudinary';
import type { StaffRole } from '@/lib/admin/permissions';
export const dynamic = 'force-dynamic';
const CONTENT_ROLES: StaffRole[] = ['owner', 'admin', 'content_manager'];
export async function POST(req: Request) {
  const g = await requireStaff(req, CONTENT_ROLES, true);
  if ('res' in g) return g.res;
  let body: { publicId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (typeof body.publicId !== 'string' || !/^(cld|cldauth)\/[A-Za-z0-9_./-]{1,220}$/.test(body.publicId) || body.publicId.includes('..') || (body.publicId.startsWith('cld/') && !/^cld\/vihaar\/(products|site-media)\//.test(body.publicId)) || (body.publicId.startsWith('cldauth/') && !body.publicId.startsWith('cldauth/vihaar/private-documents/'))) return NextResponse.json({ error: 'Invalid asset ID.' }, { status: 400 });
  try { await destroyCloudinaryAsset(body.publicId); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'Could not delete the Cloudinary asset.' }, { status: 502 }); }
}

import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin/http';
import { signUploadParams, cloudinaryConfig } from '@/lib/cloudinary';
import type { StaffRole } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';
const CONTENT_ROLES: StaffRole[] = ['owner', 'admin', 'content_manager'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPE = 'application/pdf';

export async function POST(req: Request) {
  const g = await requireStaff(req, CONTENT_ROLES, true);
  if ('res' in g) return g.res;
  const config = cloudinaryConfig();
  if (!config) return NextResponse.json({ error: 'Cloudinary environment variables are not configured.' }, { status: 503 });
  let body: { kind?: unknown; contentType?: unknown; fileName?: unknown; bucket?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const kind = body.kind === 'document' ? 'document' : body.kind === 'image' ? 'image' : null;
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName : '';
  if (!kind || (kind === 'image' && !IMAGE_TYPES.includes(contentType)) || (kind === 'document' && contentType !== PDF_TYPE)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
  }
  if (fileName.length > 180 || /[\\/\u0000-\u001f]/.test(fileName)) return NextResponse.json({ error: 'Invalid file name.' }, { status: 400 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = kind === 'document' ? 'vihaar/private-documents' : body.bucket === 'site-media' ? 'vihaar/site-media' : 'vihaar/products';
  const extension = kind === 'document' ? '.pdf' : '';
  const baseName = fileName.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'file';
  const publicId = `${folder}/${Date.now()}-${crypto.randomUUID()}-${baseName}${extension}`;
  const type = kind === 'document' ? 'authenticated' : 'upload';
  const resourceType = kind === 'document' ? 'raw' : 'image';
  const params = { public_id: publicId, timestamp, type };
  const signature = signUploadParams(params, config.apiSecret);
  return NextResponse.json({ cloudName: config.cloudName, apiKey: config.apiKey, timestamp, public_id: publicId, type, resourceType, signature, prefix: kind === 'document' ? 'cldauth/' : 'cld/' }, { headers: { 'Cache-Control': 'no-store' } });
}

import 'server-only';
import { createHash } from 'node:crypto';

export type CloudinaryResourceType = 'image' | 'raw';
export type CloudinaryUploadType = 'upload' | 'authenticated';

export function cloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function sha1Hex(value: string) {
  return createHash('sha1').update(value, 'utf8').digest('hex');
}

export function signUploadParams(params: Record<string, string>, secret: string) {
  const serialized = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return sha1Hex(serialized + secret);
}

/** Cloudinary signed delivery URL for an authenticated raw asset (PDF/document). */
export function authenticatedRawUrl(publicId: string) {
  const config = cloudinaryConfig();
  if (!config) throw new Error('Cloudinary is not configured.');
  const clean = publicId.replace(/^cldauth\//, '').replace(/^\/+/, '');
  if (!/^[A-Za-z0-9_./-]{1,220}$/.test(clean) || clean.includes('..')) throw new Error('Invalid Cloudinary public ID.');
  // Raw public IDs include the file extension. Cloudinary's signed delivery URL signature
  // covers the path following the signature component, including the extension.
  const digest = createHash('sha1').update(clean + config.apiSecret, 'utf8').digest('base64url').slice(0, 8);
  return `https://res.cloudinary.com/${config.cloudName}/raw/authenticated/s--${digest}--/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

export async function destroyCloudinaryAsset(publicId: string) {
  const config = cloudinaryConfig();
  if (!config) throw new Error('Cloudinary is not configured.');
  const authenticated = publicId.startsWith('cldauth/');
  const clean = publicId.replace(/^(cld|cldauth)\//, '');
  if (!/^[A-Za-z0-9_./-]{1,220}$/.test(clean) || clean.includes('..')) throw new Error('Invalid Cloudinary public ID.');
  if (authenticated ? !clean.startsWith('vihaar/private-documents/') : !(clean.startsWith('vihaar/products/') || clean.startsWith('vihaar/site-media/'))) throw new Error('Cloudinary asset is outside the Vihaar media folders.');
  const resourceType: CloudinaryResourceType = authenticated ? 'raw' : 'image';
  const type: CloudinaryUploadType = authenticated ? 'authenticated' : 'upload';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signUploadParams({ public_id: clean, timestamp, type }, config.apiSecret);
  const body = new URLSearchParams({ public_id: clean, timestamp, type, api_key: config.apiKey, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`, { method: 'POST', body, cache: 'no-store' });
  const result = await response.json().catch(() => null) as { result?: string; error?: { message?: string } } | null;
  if (!response.ok || (result?.result && !['ok', 'not found'].includes(result.result))) {
    throw new Error(result?.error?.message || 'Cloudinary asset deletion failed.');
  }
}

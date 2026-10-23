/** Media references are stored in existing text columns so no database migration is needed.
 * New Cloudinary IDs use cld/ (public images) or cldauth/ (authenticated raw documents).
 * Legacy references continue to resolve to Supabase Storage until migrated.
 */
export function publicMediaUrl(bucket: 'product-media' | 'site-media', path?: string | null) {
  if (!path) return null;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (path.startsWith('cld/') && cloudName) {
    const publicId = path.slice(4).split('/').map(encodeURIComponent).join('/');
    return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

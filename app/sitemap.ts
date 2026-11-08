import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 3600;
const base = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Lists the public pages and every published product so Google can find them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const b = base(); const now = new Date();
  const pages: MetadataRoute.Sitemap = ['', '/retail', '/business', '/enquiry', '/track'].map((p) => ({ url: `${b}${p}`, lastModified: now, changeFrequency: 'weekly', priority: p === '' ? 1 : p === '/retail' || p === '/business' ? 0.9 : 0.5 }));
  try {
    const { data } = await createPublicClient()?.from('products').select('slug, updated_at').eq('is_active', true) ?? { data: null };
    for (const x of (data ?? []) as { slug: string; updated_at: string | null }[]) pages.push({ url: `${b}/products/${x.slug}`, lastModified: x.updated_at ? new Date(x.updated_at) : now, changeFrequency: 'weekly', priority: 0.8 });
  } catch { /* the static pages are still listed */ }
  return pages;
}

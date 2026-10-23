import { cache } from 'react';
import { cookies } from 'next/headers';
import { createPublicClient } from '@/lib/supabase/public';
import { DEFAULT_BUSINESS, type BusinessProfile } from '@/lib/business';
import { publicMediaUrl } from '@/lib/media';

import { DEFAULT_NAV, type NavItem, type NavSettings } from '@/lib/nav';
export { DEFAULT_NAV };
export type { NavItem, NavSettings };
export type Mode = 'retail' | 'business';
export const MODE_COOKIE = 'vi_mode';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const sb = createPublicClient();
    if (!sb) return fallback;
    const { data } = await sb.from('site_settings').select('value').eq('key', key).eq('is_public', true).maybeSingle();
    return data?.value && typeof data.value === 'object' ? ({ ...(fallback as object), ...(data.value as object) } as T) : fallback;
  } catch { return fallback; }
}
export const getNav = () => getSetting<NavSettings>('nav_visibility', DEFAULT_NAV);

/** Business details, logo and social / marketplace links saved in the control room. Cached per request. */
export const getBusiness = cache(async (): Promise<BusinessProfile & { logoUrl: string | null }> => {
  const b = await getSetting<BusinessProfile>('business_profile', DEFAULT_BUSINESS);
  return { ...b, name: b.name || DEFAULT_BUSINESS.name, logoUrl: publicMediaUrl('site-media', b.logo_path) };
});

/** Which part of the site the visitor chose on the first page. Remembered in a cookie so shared pages (cart, enquiry ...) keep the right menu. */
export async function getMode(): Promise<Mode> {
  try { const v = (await cookies()).get(MODE_COOKIE)?.value; return v === 'business' ? 'business' : 'retail'; } catch { return 'retail'; }
}

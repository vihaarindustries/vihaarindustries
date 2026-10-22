import { cache } from 'react';
import { cookies } from 'next/headers';
import { createPublicClient } from '@/lib/supabase/public';
import { DEFAULT_BUSINESS, type BusinessProfile } from '@/lib/business';
import { publicMediaUrl } from '@/lib/media';

export type NavItem = { key: string; label: string; href: string; visible: boolean };
export type NavSettings = { items: NavItem[]; show_switch: boolean; show_signin: boolean };
export type Mode = 'retail' | 'business';
export const MODE_COOKIE = 'vi_mode';

/** Used until the team saves their own menu, and whenever the database cannot be reached. */
export const DEFAULT_NAV: NavSettings = {
  items: [
    { key: 'products', label: 'Products', href: '/retail#products', visible: true },
    { key: 'capabilities', label: 'Capabilities', href: '/retail#capabilities', visible: true },
    { key: 'quality', label: 'Quality & Certifications', href: '/retail#quality', visible: true },
    { key: 'business', label: 'Business buyers', href: '/business', visible: true },
    { key: 'track', label: 'Track order', href: '/track', visible: true },
  ],
  show_switch: true, show_signin: true,
};

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

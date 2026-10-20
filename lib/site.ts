import { createPublicClient } from '@/lib/supabase/public';

export type NavItem = { key: string; label: string; href: string; visible: boolean };
export type NavSettings = { items: NavItem[]; show_switch: boolean; show_signin: boolean };

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

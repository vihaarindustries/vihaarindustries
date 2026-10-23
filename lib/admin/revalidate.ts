import { revalidatePath, revalidateTag } from 'next/cache';

/** Admin tables whose rows appear on the public website. */
const PUBLIC_RESOURCES = new Set(['products', 'categories', 'product_media', 'certificates', 'testimonials', 'site_sections']);
/** Site settings that appear on the public website. */
const PUBLIC_SETTINGS = new Set(['nav_visibility', 'business_profile', 'chatbot_config']);

/** Makes the public website show the latest data immediately instead of waiting for its one-minute cache. */
export function refreshSite() {
  try { revalidateTag('site'); revalidatePath('/', 'layout'); } catch { /* never block an admin save */ }
}
export const refreshForResource = (key: string) => { if (PUBLIC_RESOURCES.has(key)) refreshSite(); };
export const refreshForSetting = (key: string) => { if (PUBLIC_SETTINGS.has(key)) refreshSite(); };

import { createClient as create } from '@supabase/supabase-js';

/**
 * Cookie-less anonymous client for public pages (products, certificates, navigation).
 * Row-level security lets it read only what is published. Safe to use in cached pages.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return create(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (i, o) => fetch(i, { ...o, next: { revalidate: 60 } }) } });
}

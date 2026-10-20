import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses row-level security, so it is used in exactly four narrow places:
 *   1. inviting staff accounts          (app/api/admin/team)
 *   2. recording website visits         (app/api/track)
 *   3. previewing a coupon              (app/api/coupon/validate)
 *   4. customer order-status lookup     (app/api/order-status)
 * Never import this from a client component and never pass its results through unfiltered.
 */
export function createService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

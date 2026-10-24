import { dbError, ok, requireStaff } from '@/lib/admin/http';
import { emailConfigured } from '@/lib/integrations/email';

export const dynamic = 'force-dynamic';

/** Saved (customised) templates, recent send log and whether email is connected. Owners and admins only. */
export async function GET(req: Request) {
  const g = await requireStaff(req, ['owner', 'admin']);
  if ('res' in g) return g.res;
  const [t, l] = await Promise.all([
    g.ctx.supabase.from('email_templates').select('event_key, subject, body, button_label, enabled, updated_at'),
    g.ctx.supabase.from('email_log').select('id, event_key, to_email, subject, status, error, order_number, created_at').order('created_at', { ascending: false }).limit(30),
  ]);
  if (t.error) return dbError(t.error);
  if (l.error) return dbError(l.error);
  return ok({ overrides: t.data ?? [], log: l.data ?? [], configured: emailConfigured(), hookConfigured: !!process.env.SEND_EMAIL_HOOK_SECRET, from: process.env.EMAIL_FROM ? true : false });
}

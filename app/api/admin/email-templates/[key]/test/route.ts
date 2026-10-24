import { fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check } from '@/lib/admin/validate';
import { getEvent } from '@/lib/email/events';
import { sendTestEmail } from '@/lib/email/send';
import { emailConfigured } from '@/lib/integrations/email';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ key: string }> | { key: string } };

/** Sends the draft being edited (saved or not) to the signed-in staff member's own email, filled with sample data. */
export async function POST(req: Request, { params }: Ctx) {
  const key = (await params).key;
  if (!getEvent(key)) return fail('Not found.', 404);
  const g = await requireStaff(req, ['owner', 'admin'], true);
  if ('res' in g) return g.res;
  if (!g.ctx.email) return fail('Your account has no email address to send the test to.', 422);
  if (!emailConfigured()) return fail('Email is not connected yet. Ask your developer to add EMAIL_PROVIDER_API_KEY and EMAIL_FROM on the server.', 503);
  if (!rateLimit(`emailtest:${g.ctx.user.id}`, 10, 10 * 60_000).ok) return fail('Too many test emails. Please wait a few minutes.', 429);
  const b = await readJson(req, 30_000);
  if (!b) return fail('Invalid request.');
  let subject: string; let body: string; let button: string | null;
  try {
    subject = check({ t: 'str', min: 1, max: 200 }, b.subject, 'Subject') as string;
    body = check({ t: 'str', min: 1, max: 5000 }, b.body, 'Message') as string;
    button = check({ t: 'str', max: 40, optional: true }, b.button_label, 'Button text') as string | null;
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  const r = await sendTestEmail(key, g.ctx.email, { subject, body, button_label: button });
  if (!r.ok) return fail(`The test email could not be sent: ${r.error ?? 'unknown error'}`, 502);
  return ok({ sent_to: g.ctx.email });
}

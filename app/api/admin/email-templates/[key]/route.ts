import { audit, dbError, fail, ok, readJson, requireStaff } from '@/lib/admin/http';
import { ValidationError, check } from '@/lib/admin/validate';
import { allVarsFor, getEvent } from '@/lib/email/events';
import { hasBrokenBraces, unknownPlaceholders } from '@/lib/email/render';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ key: string }> | { key: string } };
const ADMINS = ['owner', 'admin'] as const;

/** Save (customise) one email. Placeholders are checked so a typo like {{ordr_number}} can never reach a customer. */
export async function PUT(req: Request, { params }: Ctx) {
  const key = (await params).key;
  const ev = getEvent(key);
  if (!ev) return fail('Not found.', 404);
  const g = await requireStaff(req, [...ADMINS], true);
  if ('res' in g) return g.res;
  const b = await readJson(req, 30_000);
  if (!b) return fail('Invalid request.');
  let subject: string; let body: string; let button: string | null; let enabled: boolean;
  try {
    subject = check({ t: 'str', min: 1, max: 200 }, b.subject, 'Subject') as string;
    body = check({ t: 'str', min: 1, max: 5000 }, b.body, 'Message') as string;
    button = check({ t: 'str', max: 40, optional: true }, b.button_label, 'Button text') as string | null;
    enabled = (check({ t: 'bool', optional: true }, b.enabled, 'On/off') as boolean | null) ?? true;
  } catch (e) { if (e instanceof ValidationError) return fail(e.message, 422); throw e; }
  if (ev.locked) enabled = true;                       // verification, reset and invitation emails cannot be switched off
  const allowed = allVarsFor(ev).map((v) => v.key);
  const bad = unknownPlaceholders(`${subject}\n${body}`, allowed);
  if (bad.length) return fail(`These placeholders do not exist for this email: ${bad.map((x) => `{{${x}}}`).join(', ')}. Use the buttons under the message box.`, 422);
  if (hasBrokenBraces(`${subject}\n${body}`)) return fail('A placeholder is not closed properly. It must look like {{name}}.', 422);
  // the button carries the link; a security email without it would leave the customer stuck
  if (ev.locked && ev.buttonVar && !button) return fail('This email needs its button, because the customer cannot continue without the link. Please fill in the button text.', 422);

  const { data: before } = await g.ctx.supabase.from('email_templates').select('subject, body, button_label, enabled').eq('event_key', key).maybeSingle();
  const row = { event_key: key, subject, body, button_label: button, enabled, updated_by: g.ctx.user.id };
  const { error } = await g.ctx.supabase.from('email_templates').upsert(row, { onConflict: 'event_key' });
  if (error) return dbError(error);
  await audit(g.ctx, req, 'update', 'email_template', null, before ?? null, { event: key, subject, enabled });
  return ok({ event_key: key, subject, body, button_label: button, enabled });
}

/** Go back to the built-in wording. */
export async function DELETE(req: Request, { params }: Ctx) {
  const key = (await params).key;
  if (!getEvent(key)) return fail('Not found.', 404);
  const g = await requireStaff(req, [...ADMINS], true);
  if ('res' in g) return g.res;
  const { error } = await g.ctx.supabase.from('email_templates').delete().eq('event_key', key);
  if (error) return dbError(error);
  await audit(g.ctx, req, 'reset', 'email_template', null, null, { event: key });
  return ok({ event_key: key });
}

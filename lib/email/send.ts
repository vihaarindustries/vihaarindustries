import 'server-only';
import { createService } from '@/lib/supabase/service';
import { sendEmailDetailed } from '@/lib/integrations/email';
import { getEvent, sampleVars, type EmailEvent } from './events';
import { renderEmail } from './render';

export type Template = { subject: string; body: string; button_label: string | null; enabled: boolean };
export type SendOutcome = { ok: boolean; skipped?: boolean; error?: string };

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

/** Business name and contact lines come from Control room -> Business information (a public setting). */
async function brand() {
  const svc = createService();
  let b: { name?: string; email?: string; phone?: string; address_line?: string; city?: string; state?: string; pincode?: string } = {};
  if (svc) {
    try { const { data } = await svc.from('site_settings').select('value').eq('key', 'business_profile').maybeSingle(); if (data?.value && typeof data.value === 'object') b = data.value as typeof b; } catch { /* use defaults */ }
  }
  const name = b.name?.trim() || 'Vihaar Industries';
  const address = [b.address_line, [b.city, b.state, b.pincode].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  return { name, email: b.email?.trim() || '', phone: b.phone?.trim() || '', footer: [address, b.email?.trim(), b.phone?.trim()].filter((x): x is string => !!x) };
}

async function loadTemplate(ev: EmailEvent): Promise<Template> {
  const fallback: Template = { subject: ev.defaults.subject, body: ev.defaults.body, button_label: ev.defaults.buttonLabel, enabled: true };
  const svc = createService();
  if (!svc) return fallback;
  try {
    const { data } = await svc.from('email_templates').select('subject, body, button_label, enabled').eq('event_key', ev.key).maybeSingle();
    return data ? { subject: data.subject, body: data.body, button_label: data.button_label, enabled: data.enabled !== false } : fallback;
  } catch { return fallback; }
}

async function log(row: { event_key: string; to_email: string; subject: string; status: 'sent' | 'failed' | 'skipped'; error?: string; id?: string; order_number?: string }) {
  try {
    const svc = createService();
    if (svc) await svc.from('email_log').insert({ event_key: row.event_key, to_email: row.to_email, subject: row.subject.slice(0, 200), status: row.status, error: row.error?.slice(0, 400) ?? null, provider_message_id: row.id ?? null, order_number: row.order_number ?? null });
  } catch { /* logging must never break a customer action */ }
}

/**
 * Sends one templated email. NEVER throws, so an email problem can never undo an order or a payment.
 * `vars` are the placeholder values for this event; the business details and customer name fallback are added here.
 */
export async function sendEventEmail(eventKey: string, to: string, vars: Record<string, string | null | undefined>, opts: { toName?: string; orderNumber?: string } = {}): Promise<SendOutcome> {
  try {
    const ev = getEvent(eventKey);
    if (!ev) return { ok: false, error: `Unknown email "${eventKey}".` };
    if (!to) return { ok: false, skipped: true };
    const tpl = await loadTemplate(ev);
    if (!tpl.enabled && !ev.locked) {
      await log({ event_key: ev.key, to_email: to, subject: tpl.subject, status: 'skipped', error: 'Switched off in Email templates.', order_number: opts.orderNumber });
      return { ok: false, skipped: true };
    }
    const b = await brand();
    const merged: Record<string, string> = {
      site_name: b.name, site_url: site(), support_email: b.email, support_phone: b.phone, name: opts.toName?.trim() || 'there',
    };
    for (const [k, v] of Object.entries(vars)) if (v !== undefined && v !== null) merged[k] = String(v);
    if (!merged.name) merged.name = 'there';
    const r = renderEmail({ subject: tpl.subject, body: tpl.body, buttonLabel: tpl.button_label, buttonUrl: ev.buttonVar ? merged[ev.buttonVar] : undefined, vars: merged, brandName: b.name, footerLines: b.footer });
    const res = await sendEmailDetailed({ to, toName: opts.toName, subject: r.subject, text: r.text, html: r.html, tags: [ev.key] });
    await log({ event_key: ev.key, to_email: to, subject: r.subject, status: res.ok ? 'sent' : 'failed', error: res.error, id: res.id, order_number: opts.orderNumber });
    if (!res.ok) console.error(`[email ${ev.key}] failed:`, res.error);
    return { ok: res.ok, error: res.error };
  } catch (e) {
    console.error(`[email ${eventKey}] unexpected error`, e);
    return { ok: false, error: 'Unexpected error while sending.' };
  }
}

/** Control room "Send test": renders the draft the admin is editing (even if unsaved) with sample data and mails it to them. */
export async function sendTestEmail(eventKey: string, to: string, draft: { subject: string; body: string; button_label: string | null }): Promise<SendOutcome> {
  const ev = getEvent(eventKey);
  if (!ev) return { ok: false, error: 'Unknown email.' };
  const b = await brand();
  const vars: Record<string, string> = { ...sampleVars(ev), site_name: b.name, support_email: b.email || sampleVars(ev).support_email, support_phone: b.phone || sampleVars(ev).support_phone };
  const r = renderEmail({ subject: `[TEST] ${draft.subject}`, body: draft.body, buttonLabel: draft.button_label, buttonUrl: ev.buttonVar ? vars[ev.buttonVar] : undefined, vars, brandName: b.name, footerLines: b.footer });
  const res = await sendEmailDetailed({ to, subject: r.subject, text: r.text, html: r.html, tags: [ev.key, 'test'] });
  await log({ event_key: ev.key, to_email: to, subject: r.subject, status: res.ok ? 'sent' : 'failed', error: res.error, id: res.id });
  return { ok: res.ok, error: res.error };
}

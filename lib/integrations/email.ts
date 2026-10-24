import 'server-only';

/**
 * Email transport: Brevo transactional email API (https://developers.brevo.com/reference/sendtransacemail).
 *
 * Environment variables (server only):
 *   EMAIL_PROVIDER_API_KEY  Brevo API key (starts with "xkeysib-"). NOT the SMTP key.
 *   EMAIL_FROM              Sender, e.g.  Vihaar Industries <orders@yourdomain.com>
 *                           The address must be a verified sender / authenticated domain in Brevo.
 *   EMAIL_REPLY_TO          (optional) where customer replies should go
 *   ENQUIRY_NOTIFY_TO       (optional) your team inbox for new website enquiries
 *
 * If the key or sender is missing nothing is sent and callers get { ok: false }, so orders and
 * enquiries keep working. To use another provider later, change only the fetch call in sendEmailDetailed().
 */
export type SendResult = { ok: boolean; id?: string; error?: string };
export type OutgoingEmail = { to: string; toName?: string; subject: string; text: string; html?: string; tags?: string[] };

export const emailConfigured = () => !!(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM);

/** "Vihaar Industries <orders@x.com>" -> { name, email } ; a bare address works too. */
function parseAddress(v: string): { name?: string; email: string } | null {
  const m = v.trim().match(/^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2] };
  return /^[^\s<>@]+@[^\s<>@]+$/.test(v.trim()) ? { email: v.trim() } : null;
}

export async function sendEmailDetailed(m: OutgoingEmail): Promise<SendResult> {
  const key = process.env.EMAIL_PROVIDER_API_KEY; const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: 'Email is not configured (EMAIL_PROVIDER_API_KEY / EMAIL_FROM).' };
  const sender = parseAddress(from);
  if (!sender) return { ok: false, error: 'EMAIL_FROM is not a valid address. Use: Name <address@yourdomain.com>' };
  if (!m.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.to)) return { ok: false, error: 'Recipient address is not valid.' };
  const replyTo = process.env.EMAIL_REPLY_TO ? parseAddress(process.env.EMAIL_REPLY_TO) : null;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender, to: [{ email: m.to, ...(m.toName ? { name: m.toName.slice(0, 100) } : {}) }],
        subject: m.subject.replace(/[\r\n]+/g, ' ').slice(0, 200), textContent: m.text, ...(m.html ? { htmlContent: m.html } : {}),
        ...(replyTo ? { replyTo } : {}), ...(m.tags?.length ? { tags: m.tags.slice(0, 5) } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
    if (r.ok) return { ok: true, id: j.messageId };
    return { ok: false, error: `Brevo ${r.status}${j.code ? ` ${j.code}` : ''}: ${(j.message ?? 'request failed').slice(0, 250)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'TimeoutError' ? 'Brevo did not respond in time.' : 'Could not reach Brevo.' };
  }
}

/** Plain-text email, true/false result. Used for internal notices (new enquiry). */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  return (await sendEmailDetailed({ to, subject, text })).ok;
}

export async function notifyNewEnquiry(e: { name: string; email: string; company: string; type: string; details: string }) {
  const to = process.env.ENQUIRY_NOTIFY_TO;
  if (!to) return;
  try { await sendEmail(to, `New ${e.type} enquiry from ${e.name}`, `${e.name} <${e.email}>${e.company ? ' — ' + e.company : ''}\n\n${e.details.slice(0, 1500)}`); } catch { /* never block the visitor */ }
}

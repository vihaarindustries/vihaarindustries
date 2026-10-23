import 'server-only';

/**
 * Sends one plain-text email through Resend (https://resend.com).
 * Needs EMAIL_PROVIDER_API_KEY and EMAIL_FROM (an address on a domain verified in Resend, e.g. "Vihaar Industries <orders@yourdomain.com>").
 * If either is missing this does nothing and returns false, so orders and enquiries still work. To use another provider
 * (Brevo, SES ...) only change the fetch call below.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.EMAIL_PROVIDER_API_KEY; const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: subject.slice(0, 200), text }),
    });
    return r.ok;
  } catch { return false; }
}

export async function notifyNewEnquiry(e: { name: string; email: string; company: string; type: string; details: string }) {
  const to = process.env.ENQUIRY_NOTIFY_TO;
  if (!to) return;
  try { await sendEmail(to, `New ${e.type} enquiry from ${e.name}`, `${e.name} <${e.email}>${e.company ? ' — ' + e.company : ''}\n\n${e.details.slice(0, 1500)}`); } catch { /* never block the visitor */ }
}

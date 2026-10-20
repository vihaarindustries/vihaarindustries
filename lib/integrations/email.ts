import 'server-only';

/**
 * PLACEHOLDER. Replace the body of sendEmail() with your provider's API call (Resend, Brevo, SES ...).
 * Until EMAIL_PROVIDER_API_KEY is set this does nothing, so enquiries are still saved safely in the database.
 */
export async function sendEmail(_to: string, _subject: string, _text: string): Promise<boolean> {
  void _to; void _subject; void _text;
  if (!process.env.EMAIL_PROVIDER_API_KEY) return false;
  // TODO: await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: _to, subject: _subject, text: _text }) });
  return false;
}

export async function notifyNewEnquiry(e: { name: string; email: string; company: string; type: string; details: string }) {
  const to = process.env.ENQUIRY_NOTIFY_TO;
  if (!to) return;
  try { await sendEmail(to, `New ${e.type} enquiry from ${e.name}`, `${e.name} <${e.email}>${e.company ? ' — ' + e.company : ''}\n\n${e.details.slice(0, 1500)}`); } catch { /* never block the visitor */ }
}

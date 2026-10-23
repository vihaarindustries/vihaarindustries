import 'server-only';
import { sendEmail } from '@/lib/integrations/email';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const rupees = (minor: unknown) => (typeof minor === 'number' ? `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '');

/** Emails below never block or fail the order action: if email is not configured they are skipped and the customer still sees every update on the Track order page and in their account. */

export async function notifyOrderPlaced(o: { to: string; name: string; orderNumber?: string; totalMinor?: number }) {
  if (!o.to || !o.orderNumber) return;
  try {
    await sendEmail(o.to, `Order placed: ${o.orderNumber}`,
      `Hello ${o.name || 'there'},\n\nThank you! Your order ${o.orderNumber}${o.totalMinor ? ` (${rupees(o.totalMinor)})` : ''} has been placed.\n` +
      `We will email you again as soon as it is accepted and when it ships.\n\nTrack your order any time: ${site()}/account\n`);
  } catch { /* never block the customer */ }
}

export async function notifyOrderAccepted(o: { to: string; name: string; orderNumber: string }) {
  if (!o.to) return;
  try {
    await sendEmail(o.to, `Order accepted: ${o.orderNumber}`,
      `Hello ${o.name || 'there'},\n\nGood news: your order ${o.orderNumber} has been accepted and is being prepared.\n` +
      `We will email you the courier and tracking details as soon as it ships.\n\nTrack your order: ${site()}/account\n`);
  } catch { /* ignore */ }
}

export async function notifyOrderShipped(o: { to: string; name: string; orderNumber: string; courier?: string | null; trackingId?: string | null; trackingUrl?: string | null; expected?: string | null }) {
  if (!o.to) return;
  try {
    await sendEmail(o.to, `Your order ${o.orderNumber} has shipped`,
      `Hello ${o.name || 'there'},\n\nYour order ${o.orderNumber} has been shipped.\n\n` +
      `Courier: ${o.courier || '-'}\nTracking ID: ${o.trackingId || '-'}\n` +
      (o.expected ? `Expected delivery: ${o.expected}\n` : '') +
      (o.trackingUrl ? `Track your parcel: ${o.trackingUrl}\n` : '') +
      `\nYou can also see all updates here: ${site()}/account\n`);
  } catch { /* ignore */ }
}

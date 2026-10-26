import 'server-only';

/**
 * Every outside service the site can use, in one place. Nothing here is switched on until its
 * environment variables are present. The control room's Integrations page reads this list and shows
 * only "connected / not connected" (never the secret values).
 */
export type Integration = { key: string; name: string; purpose: string; env: string[]; docs?: string; status?: 'live' | 'placeholder' };

export const INTEGRATIONS: Integration[] = [
  { key: 'gemini', name: 'Google Gemini (AI chatbot)', purpose: 'Answers visitor questions on the website chat.', env: ['GEMINI_API_KEY', 'GEMINI_MODEL'], docs: 'https://ai.google.dev/gemini-api/docs', status: 'live' },
  { key: 'supabase_service', name: 'Supabase service role', purpose: 'Staff invitations, visit tracking, coupon preview and order lookup (server only).', env: ['SUPABASE_SERVICE_ROLE_KEY'], status: 'live' },
  { key: 'email', name: 'Email (Brevo)', purpose: 'Sends every customer email (order, shipping, payment, delivery) and the new-enquiry notice to your team. Optional: ENQUIRY_NOTIFY_TO (team inbox) and EMAIL_REPLY_TO. Wording is edited in Email templates.', env: ['EMAIL_PROVIDER_API_KEY', 'EMAIL_FROM'], docs: 'https://developers.brevo.com/reference/sendtransacemail', status: 'live' },
  { key: 'auth_email_hook', name: 'Verification email hook (Supabase)', purpose: 'Makes the sign-up verification email use your Brevo template. Create the "Send Email" hook in Supabase (Authentication -> Hooks) and paste its secret here.', env: ['SEND_EMAIL_HOOK_SECRET'], docs: 'https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook', status: 'live' },
  { key: 'payments', name: 'Payment gateway (Razorpay / Stripe)', purpose: 'Online card and UPI payments at checkout.', env: ['PAYMENT_KEY_ID', 'PAYMENT_KEY_SECRET', 'PAYMENT_WEBHOOK_SECRET'], status: 'placeholder' },
  { key: 'shipping', name: 'Courier live tracking (optional)', purpose: 'Not needed for tracking links, which work for every courier from Control room → Couriers. Add only if you want live status events from a courier that offers an API.', env: ['SHIPPING_API_KEY', 'SHIPPING_API_SECRET'], status: 'placeholder' },
  { key: 'whatsapp', name: 'WhatsApp Business / SMS', purpose: 'Send order and shipment updates to customers.', env: ['MESSAGING_API_KEY', 'MESSAGING_SENDER_ID'], status: 'placeholder' },
  { key: 'gst', name: 'GST e-invoicing / e-way bill', purpose: 'Generate IRN and e-way bills for taxable shipments.', env: ['GST_API_USER', 'GST_API_PASSWORD', 'GST_GSTIN'], status: 'placeholder' },
  { key: 'fx_ecb', name: 'Exchange rates: European Central Bank', purpose: 'Official daily reference rates (no key needed). Covers USD, EUR, GBP, JPY, AUD, CAD, SGD, CHF; AED and SAR are derived from the dollar peg. Manage in Currency rates.', env: [], docs: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html', status: 'live' },
  { key: 'fx_exchangerate', name: 'Exchange rates: ExchangeRate-API (optional)', purpose: 'A second rate source that also covers AED and SAR directly.', env: ['EXCHANGERATE_API_KEY'], docs: 'https://www.exchangerate-api.com/docs/overview', status: 'live' },
  { key: 'fx_oxr', name: 'Exchange rates: Open Exchange Rates (optional)', purpose: 'A third rate source that also covers AED and SAR directly.', env: ['OXR_APP_ID'], docs: 'https://docs.openexchangerates.org/', status: 'live' },
  { key: 'fx_cron', name: 'Daily rate refresh (schedule)', purpose: 'Lets the daily Vercel schedule refresh the rates. Set CRON_SECRET to any long random text.', env: ['CRON_SECRET'], docs: 'https://vercel.com/docs/cron-jobs', status: 'live' },
  { key: 'ratelimit', name: 'Upstash Redis (rate limiting)', purpose: 'Shared rate limits across all server instances.', env: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], status: 'placeholder' },
  { key: 'analytics', name: 'Search Console / Analytics (optional)', purpose: 'Search performance and ads attribution alongside built-in traffic stats.', env: ['NEXT_PUBLIC_ANALYTICS_ID'], status: 'placeholder' },
];

export const integrationStatus = () => INTEGRATIONS.map((i) => ({ ...i, connected: i.env.every((e) => e === 'GEMINI_MODEL' || !!process.env[e]) }));

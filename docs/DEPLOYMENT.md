# Vihaar Industries — deployment guide

## 1. Prerequisites
- Node.js 20 LTS or newer and npm
- GitHub account, Vercel account, Supabase project
- Verified company details, product specifications, approved product photography and current certificates

## 2. Local setup
1. Extract this ZIP and open the project folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase project settings.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Run `npm run build` before deploying.

## 3. Database setup
Apply migrations in numeric order from `supabase/migrations/` to a fresh Supabase project. Use Supabase CLI (`supabase db push`) or SQL Editor. Review policies against your final requirements before production. Never expose the service-role key in a browser variable or commit it to Git.

## 4. Bootstrap the first owner safely
New signups are always created with the `customer` role. Do not provide public role selection. After creating your own verified auth user, use the Supabase SQL Editor as project owner to promote that exact user ID:

```sql
update public.profiles set role='owner' where id='YOUR_AUTH_USER_UUID';
```

Only the database/project owner should do this. Invite additional staff through an admin-controlled workflow, grant the minimum required role, and test each role with separate accounts. Do not share project-owner credentials.

## 5. Vercel deployment
1. Push the source to a private GitHub repository.
2. Import the repository into Vercel.
3. Add the two public Supabase environment variables in Vercel project settings.
4. Deploy a preview and test authentication, RLS and responsive pages.
5. Add a custom domain after purchasing it and configure DNS as instructed by Vercel.

## 6. Before taking live orders
This repository is a substantial starter implementation, not a production-certified commerce/ERP system. The current UI includes a designed storefront, enquiry page, sign-in page and role-protected admin entry. Complete the following before launch:
- Implement and test server-side order creation, price/tax calculations, inventory reservations and atomic order/ledger posting.
- Implement enquiry POST handler with server validation, rate limiting, spam protection and email notifications.
- Implement account registration, email confirmation, password reset, business verification and staff invitations.
- Implement cart, checkout, payment webhooks, refunds and idempotency before enabling any payment gateway.
- Implement courier label purchase, tracking webhooks, international shipping restrictions and failure handling.
- Add journal posting/reversal RPC with balance checks inside a database transaction; restrict execute permissions and test immutability. Never post journals directly from a browser.
- Add GST configuration and professional review of tax, export, invoicing, foreign currency and statutory requirements.
- Add stock receipt, batch allocation, expiry controls, inventory valuation, returns and stocktake workflows.
- Add rate limiting, CSRF/origin protections where applicable, security headers, dependency scanning, monitoring, backups and restore tests.
- Replace all placeholder imagery, copy and contact details with approved genuine company assets.
- Run automated tests and an independent security review.

## 7. Secrets and privacy
- `.env.local` is ignored by Git. Do not commit API keys, service-role keys, payment secrets or customer exports.
- Use the anon/publishable key on the client only with RLS correctly enabled.
- Use service-role access only in server-side trusted code and only when necessary.
- Keep certificates intended for public display separate from private GST documents, identity files and contracts.

## 8. Accounting notes
Amounts are stored as integer minor units (for INR, paise) to avoid floating-point rounding. The chart of accounts is a starting template and must be adapted by an accountant. GST tax rates, tax codes, exports, FX and inventory cost accounting need reviewed configuration. Use reversal journals rather than editing posted entries.

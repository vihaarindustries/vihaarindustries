[DEPLOYMENT.md](https://github.com/user-attachments/files/33708029/DEPLOYMENT.md)
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


## Control room setup (new)

1. **Run the migrations in order** in the Supabase SQL editor: `001` … `009` (files in `supabase/migrations`). Run each once.
2. **Create the first owner.** Supabase → Authentication → Add user (email + password). Then in the SQL editor:
   `update public.profiles set role = 'owner' where email = 'you@yourcompany.com';`
3. **Set environment variables** (see `.env.example`): `ADMIN_GATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and later `GEMINI_API_KEY`. The service-role key is server-only. Never expose it.
4. **First sign-in:** open `/control-room?key=YOUR_KEY`, sign in, scan the QR code with an authenticator app. The database refuses all staff data until that code is verified.
5. **Supabase Auth settings:** set Site URL and redirect URLs to your domain, turn on email confirmation, enable MFA (TOTP), and set a strong password policy.
6. **Before launch:** add certificates, products and photos; set coupons and referral rules; switch the chatbot on once `GEMINI_API_KEY` is set.

### Locked out of MFA?
In the SQL editor: `update public.security_settings set value = 'false' where key = 'require_staff_mfa';` — sign in, re-enrol, then set it back to `'true'`.

### Security model in one paragraph
Every table has Row Level Security; staff access is per role and requires MFA at the database level, so even a leaked password or stolen token cannot read data through the public API. All writes to orders, stock, money and settings go through audited database functions. Coupon codes, customer data and chatbot facts are private. The audit log is append-only. The control room path is hidden behind a secret entry link, responses are never cached, security headers/CSP are set, public forms are rate-limited and origin-checked, and idle sessions sign out.

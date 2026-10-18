# Vihaar Industries

A Next.js + TypeScript + Tailwind + Supabase foundation for Vihaar Industries' B2B/B2C spice business.

## Included
- Premium green/charcoal responsive landing page and brand styling
- Product catalogue preview, business buyer page and enquiry form UI
- Supabase password sign-in screen and role-protected admin entry point
- SQL schema for profiles, addresses, products, content sections, certificates, testimonials, enquiries, orders, inventory batches/movements, coupons/referrals, payments, chart of accounts, journals and audit logs
- Baseline RLS policies, private/public storage buckets, starter chart of accounts and reporting views
- Accounting journal validation helper and deployment guide

## Important scope boundary
The scaffold is not yet a launch-ready store. Payment processing, courier APIs, atomic order creation, production enquiry handling, checkout, returns, journal posting RPC, stock costing, tax configuration and several admin CRUD pages remain integration work. Do not accept real orders or rely on financial reports until these are implemented and tested. The guide documents the required steps.

## Start
```bash
npm install
cp .env.example .env.local
# Fill in Supabase URL and anon key
npm run dev
```
Read `docs/DEPLOYMENT.md` before deployment. No credentials or real customer data are included.

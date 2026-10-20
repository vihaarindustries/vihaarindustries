-- 004: Admin panel schema extensions.
-- Adds customers, order tracking, purchasing, site settings, traffic analytics and
-- the extra columns the admin panel needs. Amounts remain integer minor units (paise).
-- Row-level security for everything here is defined in 005_security_policies.sql.

-- ── Security settings (read only by SECURITY DEFINER helpers; no RLS policies on purpose)
create table if not exists public.security_settings (key text primary key, value text not null);
insert into public.security_settings(key,value) values ('require_staff_mfa','true') on conflict (key) do nothing;
alter table public.security_settings enable row level security;

-- ── Generic updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ── Profiles: staff can be deactivated without deleting their auth user
alter table public.profiles add column if not exists is_active boolean not null default true;

-- ── Customers: one identity for retail, business and export buyers (with or without a login)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  customer_type text not null default 'retail' check (customer_type in ('retail','business','export')),
  name text not null check (char_length(name) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  company text check (company is null or char_length(company) <= 180),
  gstin text check (gstin is null or char_length(gstin) <= 20),
  country_code char(2) default 'IN',
  address jsonb not null default '{}',
  notes text check (notes is null or char_length(notes) <= 4000),
  tags text[] not null default '{}',
  is_blocked boolean not null default false,
  referral_code text unique,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_type_idx on public.customers (customer_type, created_at desc);
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

create or replace function public.customers_set_code() returns trigger language plpgsql as $$
declare c text; tries int := 0;
begin
  if new.referral_code is null then
    loop
      c := 'VI' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.customers where referral_code = c);
      tries := tries + 1; exit when tries > 10;
    end loop;
    new.referral_code := c;
  end if;
  return new;
end; $$;
create trigger customers_code before insert on public.customers for each row execute function public.customers_set_code();

-- ── Orders: link to customers, payment state, tracking and dates
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists customer_id uuid references public.customers(id);
alter table public.orders add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded'));
alter table public.orders add column if not exists amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0);
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists expected_delivery date;
alter table public.orders add column if not exists incoterm text check (incoterm is null or char_length(incoterm) <= 12);
alter table public.orders add column if not exists notes text check (notes is null or char_length(notes) <= 4000);
alter table public.orders add column if not exists internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000);
alter table public.orders add column if not exists referral_code text;
create index if not exists orders_customer_idx on public.orders (customer_id, placed_at desc);
create index if not exists orders_placed_idx on public.orders (placed_at desc);
alter table public.order_items add column if not exists discount_minor bigint not null default 0 check (discount_minor >= 0);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('created','status','payment','tracking','stock','note')),
  from_status text, to_status text,
  message text check (message is null or char_length(message) <= 1000),
  is_customer_visible boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- ── Products: discounts, stock thresholds and export fields
alter table public.products add column if not exists discount_type text not null default 'none' check (discount_type in ('none','percentage','fixed'));
alter table public.products add column if not exists discount_value numeric(14,3) not null default 0 check (discount_value >= 0);
alter table public.products add column if not exists discount_starts_at timestamptz;
alter table public.products add column if not exists discount_ends_at timestamptz;
alter table public.products add column if not exists reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0);
alter table public.products add column if not exists shelf_life_days int check (shelf_life_days is null or shelf_life_days > 0);
alter table public.products add column if not exists origin text check (origin is null or char_length(origin) <= 80);
alter table public.products add column if not exists hs_code text check (hs_code is null or char_length(hs_code) <= 16);
alter table public.products add column if not exists is_export_available boolean not null default true;
alter table public.products add column if not exists is_retail_available boolean not null default true;
alter table public.products add column if not exists sort_order int not null default 0;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ── Certificates, achievements and testimonials: kind, ordering, display image
alter table public.certificates add column if not exists kind text not null default 'certificate' check (kind in ('certificate','achievement','award'));
alter table public.certificates add column if not exists description text check (description is null or char_length(description) <= 1500);
alter table public.certificates add column if not exists image_path text;
alter table public.certificates add column if not exists year int check (year is null or year between 1900 and 2100);
alter table public.certificates add column if not exists sort_order int not null default 0;
alter table public.testimonials add column if not exists sort_order int not null default 0;

-- ── Promotions: segments beyond retail/business, product scope, first-order rule
alter table public.promotions drop constraint if exists promotions_applies_to_check;
alter table public.promotions add constraint promotions_applies_to_check check (applies_to in ('all','retail','business','export'));
alter table public.promotions add column if not exists description text check (description is null or char_length(description) <= 500);
alter table public.promotions add column if not exists first_order_only boolean not null default false;
alter table public.promotions add column if not exists product_ids uuid[] not null default '{}';
alter table public.promotions add column if not exists category_ids uuid[] not null default '{}';

-- ── Referrals: customer based (a code belongs to a customer; one row per referred customer)
alter table public.referrals alter column referrer_user_id drop not null;
alter table public.referrals add column if not exists referrer_customer_id uuid references public.customers(id);
alter table public.referrals add column if not exists referred_customer_id uuid references public.customers(id);
alter table public.referrals add column if not exists rewarded_at timestamptz;
alter table public.referrals drop constraint if exists referrals_referral_code_key;
alter table public.referrals drop constraint if exists referrals_referrer_user_id_referred_user_id_key;
create unique index if not exists referrals_pair_idx on public.referrals (referrer_customer_id, referred_customer_id);
create unique index if not exists referrals_referred_once_idx on public.referrals (referred_customer_id) where referred_customer_id is not null;

alter table public.promotion_redemptions alter column user_id drop not null;
alter table public.promotion_redemptions add column if not exists customer_id uuid references public.customers(id);

-- ── Enquiries
alter table public.enquiries add column if not exists internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000);
alter table public.enquiries add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.enquiries add constraint enquiries_length_chk check (
  char_length(name) <= 160 and char_length(email) <= 254 and char_length(details) <= 5000
  and (company is null or char_length(company) <= 180) and (quantity_text is null or char_length(quantity_text) <= 120)
  and (destination_country is null or char_length(destination_country) <= 100)) not valid;

-- ── Site settings (navigation, chatbot, referral programme, ...)
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]{1,60}$'),
  value jsonb not null default '{}',
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
insert into public.site_settings(key, value, is_public) values
 ('nav_visibility', '{"items":[{"key":"products","label":"Products","href":"/retail#products","visible":true},{"key":"capabilities","label":"Capabilities","href":"/retail#capabilities","visible":true},{"key":"quality","label":"Quality & Certifications","href":"/retail#quality","visible":true},{"key":"business","label":"Business buyers","href":"/business","visible":true}],"show_switch":true,"show_signin":true}', true),
 ('referral_program', '{"enabled":false,"referrer_reward_minor":0,"referee_discount_type":"fixed","referee_discount_value":0,"min_order_minor":0}', false),
 ('chatbot_config', '{"enabled":false,"name":"Vihaar Assistant","greeting":"Hello! Ask me about our spices, pack sizes or how to request an export quotation.","suggestions":["What products do you sell?","How do I request a bulk quote?","Do you export?"],"knowledge":""}', true)
 on conflict (key) do nothing;

-- ── Suppliers and purchasing
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 180),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  gstin text check (gstin is null or char_length(gstin) <= 20),
  address text check (address is null or char_length(address) <= 600),
  country_code char(2) default 'IN',
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create sequence if not exists public.po_number_seq;
create sequence if not exists public.order_number_seq;
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'ordered' check (status in ('draft','ordered','received','cancelled')),
  order_date date not null default current_date,
  expected_date date,
  received_at timestamptz,
  location_id uuid references public.inventory_locations(id),
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 60),
  currency char(3) not null default 'INR',
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost_minor bigint not null check (unit_cost_minor >= 0),
  tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  batch_number text check (batch_number is null or char_length(batch_number) <= 60),
  manufactured_on date,
  expires_on date,
  line_total_minor bigint not null check (line_total_minor >= 0)
);
create index if not exists po_status_idx on public.purchase_orders (status, order_date desc);

-- ── Website traffic (written only by the server through track_visit)
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  path text not null check (char_length(path) <= 200),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  utm_source text check (utm_source is null or char_length(utm_source) <= 60),
  device text check (device in ('desktop','mobile','tablet')),
  country char(2)
);
create index if not exists site_visits_created_idx on public.site_visits (created_at desc);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor_id, created_at desc);

-- ── More accounts for day-to-day bookkeeping (chart of accounts must still be reviewed by an accountant)
insert into public.chart_of_accounts(code,name,account_type,is_control_account) values
 ('3200','Owner Drawings','equity',false),('4200','Other Income','revenue',false),
 ('6300','Salaries and Wages','expense',false),('6400','Rent and Utilities','expense',false),
 ('6500','Software, Hosting and Tools','expense',false),('6600','Bank Charges','expense',false),
 ('6700','Inventory Write-offs','expense',false)
on conflict (code) do nothing;

-- ── Storage: public bucket for certificate / achievement images
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('site-media','site-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;

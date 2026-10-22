-- 011_couriers.sql
-- A directory of the shipping companies you use. Each courier says which zones it serves
-- (within your state / rest of India / export) and, optionally, the format of its tracking link.
-- Run once in the Supabase SQL editor, after 010_invoice_import_metadata.sql.

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  serves_state boolean not null default false,
  serves_national boolean not null default false,
  serves_export boolean not null default false,
  -- e.g. https://www.fedex.com/fedextrack/?trknbr={tracking}   ({tracking} is replaced by the tracking number)
  tracking_url_template text check (
    tracking_url_template is null
    or (tracking_url_template ~* '^https://[^\s]+$' and char_length(tracking_url_template) between 12 and 300 and position('{tracking}' in tracking_url_template) > 0)
  ),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.couriers enable row level security;
drop policy if exists "couriers read" on public.couriers;
drop policy if exists "couriers write" on public.couriers;
create policy "couriers read" on public.couriers for select using (public.is_ops_or_fin());
create policy "couriers write" on public.couriers for all using (public.is_ops()) with check (public.is_ops());

-- Starter list. Edit, add or switch off couriers later in Control room → Couriers.
-- Only links that follow a stable public format are pre-filled; for the others, paste the
-- link format once from the courier's own "track" page (replace the number with {tracking}).
insert into public.couriers (name, serves_state, serves_national, serves_export, tracking_url_template) values
  ('Local transporter / own vehicle', true,  false, false, null),
  ('Delhivery',                       true,  true,  false, null),
  ('Blue Dart',                       true,  true,  false, null),
  ('DTDC',                            true,  true,  false, null),
  ('India Post / Speed Post',         true,  true,  false, null),
  ('DHL Express',                     false, false, true,  'https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id={tracking}'),
  ('FedEx',                           false, false, true,  'https://www.fedex.com/fedextrack/?trknbr={tracking}'),
  ('UPS',                             false, false, true,  'https://www.ups.com/track?tracknum={tracking}'),
  ('Aramex',                          false, false, true,  'https://www.aramex.com/track/results?ShipmentNumber={tracking}')
on conflict (name) do nothing;

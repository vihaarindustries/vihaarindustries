-- 018_currency_rates.sql
-- Exchange rates + "record this order in another currency". Run once in the Supabase SQL editor, after 017. Safe to run again.
--
-- The books stay in INR (every invoice entry, payment and report is unchanged). What this adds:
--   1. exchange_rates : daily rates from each source (ECB, ExchangeRate-API, Open Exchange Rates) and rates typed in by your team.
--   2. orders.record_currency / fx_rate / ... : when an order is accepted, staff choose the currency it is recorded in and
--      which source's rate is locked for it. The INR total is untouched; the foreign amount is derived from it.
--   3. two functions the control room calls: add_manual_rate() and lock_order_currency().

create table if not exists public.exchange_rates (
  id           uuid primary key default gen_random_uuid(),
  currency     char(3) not null check (currency ~ '^[A-Z]{3}$' and currency <> 'INR'),
  source       text not null check (source in ('ecb', 'exchangerate_api', 'oxr', 'manual')),
  rate_to_inr  numeric(18, 8) not null check (rate_to_inr > 0),     -- rupees for ONE unit of the currency (USD 1 = INR 84.50)
  rate_date    date not null,
  note         text check (note is null or char_length(note) <= 200),
  created_by   uuid references public.profiles(id) on delete set null,
  fetched_at   timestamptz not null default now(),
  unique (currency, source, rate_date)
);
create index if not exists exchange_rates_lookup_idx on public.exchange_rates (currency, source, rate_date desc);
alter table public.exchange_rates enable row level security;
drop policy if exists "exchange rates staff read" on public.exchange_rates;
create policy "exchange rates staff read" on public.exchange_rates for select using (public.is_staff());
-- no insert/update policies on purpose: rates are written only by the server (service role) and by add_manual_rate() below

alter table public.orders
  add column if not exists record_currency   char(3),
  add column if not exists fx_rate           numeric(18, 8),
  add column if not exists fx_source         text,
  add column if not exists fx_rate_date      date,
  add column if not exists fx_note           text,
  add column if not exists record_total_minor bigint,
  add column if not exists fx_locked_at      timestamptz,
  add column if not exists fx_locked_by      uuid references public.profiles(id) on delete set null;

-- Currencies the control room supports. To add one later, add it here AND in lib/fx/currencies.ts.
create or replace function public._fx_supported(p_cur text) returns boolean language sql immutable as $$
  select p_cur in ('USD', 'EUR', 'GBP', 'AED', 'SAR', 'AUD', 'CAD', 'SGD', 'JPY', 'CHF')
$$;

-- A typed-in rate (for example the RBI / FBIL reference rate or your bank's rate that your accountant asked for).
create or replace function public.add_manual_rate(p_currency text, p_rate numeric, p_date date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cur text := upper(trim(p_currency)); v_last numeric; v_date date := coalesce(p_date, current_date);
begin
  perform public._need(array['owner', 'admin', 'finance']::public.app_role[]);
  if not public._fx_supported(v_cur) then raise exception 'Choose one of the supported currencies.'; end if;
  if p_rate is null or p_rate <= 0 or p_rate > 100000 then raise exception 'Enter the rate as rupees for 1 unit of the currency, for example 84.50.'; end if;
  if v_date > current_date then raise exception 'The rate date cannot be in the future.'; end if;
  if v_date < current_date - 30 then raise exception 'The rate date is too old. Use a date from the last 30 days.'; end if;
  select rate_to_inr into v_last from exchange_rates where currency = v_cur and source <> 'manual' order by rate_date desc, fetched_at desc limit 1;
  if v_last is not null and abs(p_rate - v_last) / v_last > 0.25 then
    raise exception 'This rate is more than 25%% away from the latest market rate (%). Please check the decimal point.', round(v_last, 4);
  end if;
  insert into exchange_rates(currency, source, rate_to_inr, rate_date, note, created_by)
  values (v_cur, 'manual', round(p_rate, 8), v_date, left(nullif(trim(p_note), ''), 200), auth.uid())
  on conflict (currency, source, rate_date) do update set rate_to_inr = excluded.rate_to_inr, note = excluded.note, created_by = excluded.created_by, fetched_at = now();
  perform public.write_audit('fx.manual_rate', 'exchange_rate', v_cur, null, jsonb_build_object('rate', p_rate, 'date', v_date, 'note', p_note), null);
end; $$;

-- Choose the currency an order is recorded in, and lock the rate. Choosing INR removes the lock.
-- The rate is read from the stored rates (or typed in for source 'manual'), never trusted from the browser.
create or replace function public.lock_order_currency(p_order uuid, p_currency text, p_source text default null, p_manual_rate numeric default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_cur text := upper(trim(p_currency)); v_rate numeric; v_date date; v_note text; v_last numeric; v_total bigint; v_digits int;
begin
  perform public._need(array['owner', 'admin', 'operations', 'finance']::public.app_role[]);
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status in ('shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'The currency cannot be changed once an order is shipped, delivered, cancelled or refunded.';
  end if;

  if v_cur = 'INR' then
    update orders set record_currency = null, fx_rate = null, fx_source = null, fx_rate_date = null, fx_note = null, record_total_minor = null, fx_locked_at = null, fx_locked_by = null where id = p_order;
    perform public._order_event(p_order, 'note', null, null, 'Recording currency set to INR.', false);
    return;
  end if;
  if not public._fx_supported(v_cur) then raise exception 'Choose one of the supported currencies.'; end if;
  if p_source is null or p_source not in ('ecb', 'exchangerate_api', 'oxr', 'manual') then raise exception 'Choose where the exchange rate comes from.'; end if;

  if p_source = 'manual' then
    if p_manual_rate is null or p_manual_rate <= 0 or p_manual_rate > 100000 then raise exception 'Enter the rate as rupees for 1 unit of the currency, for example 84.50.'; end if;
    select rate_to_inr into v_last from exchange_rates where currency = v_cur and source <> 'manual' order by rate_date desc, fetched_at desc limit 1;
    if v_last is not null and abs(p_manual_rate - v_last) / v_last > 0.25 then
      raise exception 'This rate is more than 25%% away from the latest market rate (%). Please check the decimal point.', round(v_last, 4);
    end if;
    v_rate := round(p_manual_rate, 8); v_date := current_date; v_note := left(nullif(trim(p_note), ''), 200);
  else
    select rate_to_inr, rate_date, note into v_rate, v_date, v_note from exchange_rates
     where currency = v_cur and source = p_source and rate_date >= current_date - 7
     order by rate_date desc, fetched_at desc limit 1;
    if v_rate is null then raise exception 'There is no recent % rate from that source. Refresh the rates, pick another source, or enter a rate manually.', v_cur; end if;
  end if;

  v_digits := case when v_cur = 'JPY' then 0 else 2 end;                          -- JPY has no minor unit
  v_total := round(o.total_minor::numeric * power(10, v_digits - 2) / v_rate)::bigint;
  update orders set record_currency = v_cur, fx_rate = v_rate, fx_source = p_source, fx_rate_date = v_date, fx_note = v_note,
         record_total_minor = v_total, fx_locked_at = now(), fx_locked_by = auth.uid() where id = p_order;
  perform public._order_event(p_order, 'note', null, null,
    format('Recorded in %s: 1 %s = INR %s (%s, %s).', v_cur, v_cur, trim(to_char(v_rate, 'FM999990.0000')), p_source, v_date), false);
  perform public.write_audit('order.currency', 'order', p_order::text, null,
    jsonb_build_object('currency', v_cur, 'rate', v_rate, 'source', p_source, 'rate_date', v_date, 'total_minor', v_total), null);
end; $$;

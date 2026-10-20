-- 007: Website traffic capture and the dashboard / traffic summaries used by the admin overview.

-- Called only by the server (service role) from /api/track. Visitors are identified by a random
-- id kept in the browser; no IP address or user id is stored.
create or replace function public.track_visit(p_visitor text, p_path text, p_referrer_host text, p_utm text, p_device text, p_country text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 or p_path is null or left(p_path, 1) <> '/' then return; end if;
  insert into site_visits(visitor_id, path, referrer_host, utm_source, device, country)
  values (p_visitor, left(p_path, 200), left(nullif(p_referrer_host, ''), 120), left(nullif(p_utm, ''), 60),
          case when p_device in ('desktop','mobile','tablet') then p_device else 'desktop' end,
          case when p_country ~ '^[A-Za-z]{2}$' then upper(p_country) else null end);
end; $$;
revoke all on function public.track_visit(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.track_visit(text,text,text,text,text,text) to service_role;

create or replace function public.traffic_summary(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v jsonb; v_funnel jsonb := null;
begin
  perform public._need(array['owner','admin','finance','operations','content_manager']::public.app_role[]);
  if p_to - p_from > interval '400 days' then raise exception 'Choose a period of 400 days or less.'; end if;
  if public.has_staff_role(array['owner','admin','finance','operations']::public.app_role[]) then
    v_funnel := jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from site_visits where created_at between p_from and p_to),
      'enquiries', (select count(*) from enquiries where created_at between p_from and p_to),
      'new_customers', (select count(*) from customers where created_at between p_from and p_to),
      'orders', (select count(*) from orders where placed_at between p_from and p_to and status not in ('draft','cancelled')),
      'paid_orders', (select count(*) from orders where placed_at between p_from and p_to and status not in ('draft','cancelled') and payment_status = 'paid'));
  end if;
  select jsonb_build_object(
    'views', (select count(*) from site_visits where created_at between p_from and p_to),
    'visitors', (select count(distinct visitor_id) from site_visits where created_at between p_from and p_to),
    'returning_visitors', (select count(*) from (select visitor_id from site_visits where created_at between p_from and p_to
                              group by visitor_id having count(distinct created_at::date) > 1) r),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'views', views, 'visitors', visitors) order by d) from (
                select created_at::date d, count(*) views, count(distinct visitor_id) visitors from site_visits
                 where created_at between p_from and p_to group by 1) x), '[]'),
    'top_pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', c)) from (
                select path, count(*) c from site_visits where created_at between p_from and p_to group by path order by c desc limit 10) x), '[]'),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(referrer_host, 'Direct'), 'count', c)) from (
                select referrer_host, count(*) c from site_visits where created_at between p_from and p_to group by referrer_host order by c desc limit 8) x), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(device, 'desktop'), 'count', c)) from (
                select device, count(*) c from site_visits where created_at between p_from and p_to group by device order by c desc) x), '[]'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(country, '??'), 'count', c)) from (
                select country, count(*) c from site_visits where created_at between p_from and p_to group by country order by c desc limit 8) x), '[]'),
    'funnel', v_funnel
  ) into v;
  return v;
end; $$;

create or replace function public.dashboard_metrics(p_from timestamptz, p_to timestamptz, p_segment text default 'all') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v jsonb;
begin
  perform public._need(array['owner','admin','finance','operations']::public.app_role[]);
  if p_segment not in ('all','retail','business','export') then raise exception 'Invalid segment.'; end if;
  if p_to - p_from > interval '400 days' then raise exception 'Choose a period of 400 days or less.'; end if;
  with o as (
    select * from orders where placed_at between p_from and p_to and (p_segment = 'all' or order_type = p_segment)
  )
  select jsonb_build_object(
    'revenue_minor', coalesce((select sum(total_minor) from o where status not in ('draft','cancelled','refunded')), 0),
    'orders', (select count(*) from o where status not in ('draft','cancelled')),
    'avg_order_minor', coalesce((select round(avg(total_minor)) from o where status not in ('draft','cancelled','refunded')), 0),
    'collected_minor', coalesce((select sum(p.amount_minor) from payments p join orders x on x.id = p.order_id
                                  where p.status = 'captured' and p.received_at between p_from and p_to and (p_segment = 'all' or x.order_type = p_segment)), 0),
    'by_status', coalesce((select jsonb_object_agg(status, c) from (select status::text, count(*) c from o group by status) s), '{}'),
    'by_segment', coalesce((select jsonb_agg(jsonb_build_object('name', order_type, 'revenue_minor', r, 'orders', c)) from (
                    select order_type, sum(total_minor) r, count(*) c from o where status not in ('draft','cancelled','refunded') group by order_type) s), '[]'),
    'in_progress', (select count(*) from orders where status in ('confirmed','processing','packed','shipped') and (p_segment = 'all' or order_type = p_segment)),
    'awaiting_payment', (select count(*) from orders where status not in ('draft','cancelled','refunded') and payment_status in ('unpaid','partial') and (p_segment = 'all' or order_type = p_segment)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'orders', c, 'revenue_minor', r) order by d) from (
                select placed_at::date d, count(*) c, sum(total_minor) r from o where status not in ('draft','cancelled','refunded') group by 1) s), '[]'),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('name', n, 'quantity', q, 'revenue_minor', r)) from (
                select oi.product_name_snapshot n, sum(oi.quantity) q, sum(oi.line_total_minor) r from order_items oi join o on o.id = oi.order_id
                 where o.status not in ('draft','cancelled','refunded') group by oi.product_name_snapshot order by r desc limit 5) s), '[]'),
    'low_stock', (select count(*) from inventory_summary where is_low and is_active),
    'expiring_soon', (select count(*) from inventory_batches where quantity_on_hand > 0 and expires_on is not null and expires_on <= current_date + 30),
    'receivables_minor', coalesce((select sum(total_minor - amount_paid_minor) from orders where status in ('shipped','delivered') and amount_paid_minor < total_minor), 0),
    'payables_minor', coalesce((select sum(total_minor - amount_paid_minor) from purchase_orders where status = 'received' and amount_paid_minor < total_minor), 0),
    'new_enquiries', (select count(*) from enquiries where created_at between p_from and p_to),
    'open_enquiries', (select count(*) from enquiries where status in ('new','in_progress')),
    'new_customers', (select count(*) from customers where created_at between p_from and p_to and (p_segment = 'all' or customer_type = p_segment))
  ) into v;
  return v;
end; $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('traffic_summary','dashboard_metrics') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

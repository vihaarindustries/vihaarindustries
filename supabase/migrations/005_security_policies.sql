-- 005: Role helpers, MFA enforcement and least-privilege row-level security.
--
-- Principles
--  * The API layer is a convenience; these policies are the real access control, because staff
--    hold a database session and could call the REST API directly.
--  * Staff access requires an ACTIVE profile and (by default) an MFA-verified session (aal2).
--    To relax MFA temporarily (e.g. before the first owner enrols), run in the SQL editor:
--      update public.security_settings set value='false' where key='require_staff_mfa';
--  * Money- and stock-changing tables have NO direct write policies. They change only through the
--    SECURITY DEFINER functions in 006, which validate input, check the caller's role and post journals.

create or replace function public.staff_mfa_ok() returns boolean language sql stable security definer set search_path=public as $$
  select case
    when coalesce((select value from public.security_settings where key='require_staff_mfa'),'true') = 'false' then true
    else coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
  end;
$$;

create or replace function public.has_staff_role(allowed public.app_role[]) returns boolean language sql stable security definer set search_path=public as $$
  select public.staff_mfa_ok() and exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = any(allowed)
  );
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin','finance','operations','content_manager']::public.app_role[]);
$$;
create or replace function public.is_admin_role() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin']::public.app_role[]);
$$;
create or replace function public.is_content() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin','content_manager']::public.app_role[]);
$$;
create or replace function public.is_ops() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin','operations']::public.app_role[]);
$$;
create or replace function public.is_fin() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin','finance']::public.app_role[]);
$$;
create or replace function public.is_ops_or_fin() returns boolean language sql stable security definer set search_path=public as $$
  select public.has_staff_role(array['owner','admin','operations','finance']::public.app_role[]);
$$;

-- ── Profiles: role, active flag and business verification can only be changed by owner/admin.
create or replace function public.guard_profile_changes() returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role public.app_role;
begin
  if auth.uid() is null then return new; end if;  -- SQL editor / service role (trusted)
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active
     or new.business_verified_at is distinct from old.business_verified_at then
    select role into actor_role from public.profiles where id = auth.uid() and is_active;
    if actor_role is null or actor_role not in ('owner','admin') then
      raise exception 'Only an owner or admin can change a role, status or verification.';
    end if;
    if (new.role = 'owner' or old.role = 'owner') and actor_role <> 'owner' then
      raise exception 'Only an owner can grant or change the owner role.';
    end if;
    if new.id = auth.uid() and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'You cannot change your own role or status.';
    end if;
  end if;
  if old.role = 'owner' and old.is_active and (new.role <> 'owner' or not new.is_active)
     and not exists (select 1 from public.profiles where role = 'owner' and is_active and id <> old.id) then
    raise exception 'At least one active owner is required.';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_changes();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ── Journal guard: allow the single legitimate change posted -> reversed, nothing else.
create or replace function public.guard_posted_journal() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'reversed'
     and (new.entry_date, new.description, new.currency, new.source_type, new.source_id, new.created_by, new.posted_by, new.posted_at, new.reversal_of)
         is not distinct from
         (old.entry_date, old.description, old.currency, old.source_type, old.source_id, old.created_by, old.posted_by, old.posted_at, old.reversal_of) then
    return new;
  end if;
  raise exception 'Posted or reversed journal entries are immutable; create a reversal instead.';
end; $$;

-- A reversed entry plus its reversal entry must both count so they net to zero.
create or replace view public.trial_balance with (security_invoker=true) as
  select a.code, a.name, a.account_type,
         coalesce(sum(l.debit_minor),0) as debit_minor, coalesce(sum(l.credit_minor),0) as credit_minor
  from public.chart_of_accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries j on j.id = l.journal_entry_id and j.status in ('posted','reversed')
  where l.id is null or j.id is not null
  group by a.id, a.code, a.name, a.account_type;

-- ── Replace the original policies --------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.customers enable row level security;
alter table public.order_events enable row level security;
alter table public.site_settings enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.site_visits enable row level security;

-- profiles
create policy "profiles select" on public.profiles for select using (id = auth.uid() or public.is_admin_role());
create policy "profiles update" on public.profiles for update using (id = auth.uid() or public.is_admin_role()) with check (id = auth.uid() or public.is_admin_role());
-- addresses
create policy "addresses own" on public.addresses for all using (user_id = auth.uid() or public.is_ops()) with check (user_id = auth.uid() or public.is_ops());
-- catalogue (public reads visible rows; content managers write; any staff can read everything)
create policy "categories read" on public.product_categories for select using (is_visible or public.is_staff());
create policy "categories write" on public.product_categories for all using (public.is_content()) with check (public.is_content());
create policy "products read" on public.products for select using (is_active or public.is_staff());
create policy "products write" on public.products for all using (public.is_content()) with check (public.is_content());
create policy "media read" on public.product_media for select using (public.is_staff() or exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "media write" on public.product_media for all using (public.is_content()) with check (public.is_content());
create policy "sections read" on public.site_sections for select using (is_visible or public.is_staff());
create policy "sections write" on public.site_sections for all using (public.is_content()) with check (public.is_content());
create policy "certificates read" on public.certificates for select using (is_public or public.is_staff());
create policy "certificates write" on public.certificates for all using (public.is_content()) with check (public.is_content());
create policy "testimonials read" on public.testimonials for select using ((approved and is_visible) or public.is_staff());
create policy "testimonials write" on public.testimonials for all using (public.is_content()) with check (public.is_content());
-- settings
create policy "settings read" on public.site_settings for select using (is_public or public.is_staff());
create policy "settings insert" on public.site_settings for insert with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config') and public.is_content()));
create policy "settings update" on public.site_settings for update using (public.is_admin_role() or (key in ('nav_visibility','chatbot_config') and public.is_content()))
  with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config') and public.is_content()));
-- enquiries (anyone may submit; the API adds rate limits and spam checks)
create policy "enquiries insert" on public.enquiries for insert with check (user_id is null or user_id = auth.uid());
create policy "enquiries read" on public.enquiries for select using (user_id = auth.uid() or public.is_ops());
create policy "enquiries update" on public.enquiries for update using (public.is_ops()) with check (public.is_ops());
create policy "enquiries delete" on public.enquiries for delete using (public.is_admin_role());
-- customers (PII): operations and finance read; operations write; only owner/admin delete
create policy "customers read" on public.customers for select using (user_id = auth.uid() or public.is_ops_or_fin());
create policy "customers insert" on public.customers for insert with check (public.is_ops());
create policy "customers update" on public.customers for update using (public.is_ops()) with check (public.is_ops());
create policy "customers delete" on public.customers for delete using (public.is_admin_role());
-- orders: read only (own, or operations/finance); all changes go through functions
create policy "orders read" on public.orders for select using (user_id = auth.uid() or public.is_ops_or_fin());
create policy "order items read" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_ops_or_fin())));
create policy "order events read" on public.order_events for select using (
  public.is_ops_or_fin() or (is_customer_visible and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));
-- inventory and purchasing
create policy "locations read" on public.inventory_locations for select using (public.is_ops_or_fin());
create policy "locations write" on public.inventory_locations for all using (public.is_ops()) with check (public.is_ops());
create policy "batches read" on public.inventory_batches for select using (public.is_ops_or_fin());
create policy "movements read" on public.stock_movements for select using (public.is_ops_or_fin());
create policy "suppliers read" on public.suppliers for select using (public.is_ops_or_fin());
create policy "suppliers write" on public.suppliers for all using (public.is_ops()) with check (public.is_ops());
create policy "po read" on public.purchase_orders for select using (public.is_ops_or_fin());
create policy "po items read" on public.purchase_order_items for select using (public.is_ops_or_fin());
-- promotions: coupon codes are NOT public. Checks go through the server (check_coupon).
create policy "promotions read" on public.promotions for select using (public.is_staff());
create policy "promotions write" on public.promotions for all using (public.is_content()) with check (public.is_content());
create policy "referrals read" on public.referrals for select using (public.is_staff());
create policy "redemptions read" on public.promotion_redemptions for select using (public.is_staff());
-- finance
create policy "accounts read" on public.chart_of_accounts for select using (public.is_fin() or public.is_ops());
create policy "accounts write" on public.chart_of_accounts for all using (public.is_admin_role()) with check (public.is_admin_role());
create policy "journals read" on public.journal_entries for select using (public.is_fin());
create policy "journal lines read" on public.journal_lines for select using (public.is_fin());
create policy "payments read" on public.payments for select using (public.is_ops_or_fin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
-- audit log: append-only (no update/delete policies), read by owner/admin/finance
create policy "audit read" on public.audit_logs for select using (public.is_fin());
-- traffic
create policy "visits read" on public.site_visits for select using (public.is_staff());

-- ── Storage ----------------------------------------------------------------------------------------
create policy "public read product media" on storage.objects for select using (bucket_id in ('product-media','site-media'));
create policy "content write product media" on storage.objects for insert to authenticated with check (bucket_id in ('product-media','site-media') and public.is_content());
create policy "content update product media" on storage.objects for update to authenticated using (bucket_id in ('product-media','site-media') and public.is_content()) with check (bucket_id in ('product-media','site-media') and public.is_content());
create policy "content delete product media" on storage.objects for delete to authenticated using (bucket_id in ('product-media','site-media') and public.is_content());
create policy "staff private docs" on storage.objects for all to authenticated
  using (bucket_id = 'private-documents' and public.is_ops_or_fin()) with check (bucket_id = 'private-documents' and public.is_ops_or_fin());

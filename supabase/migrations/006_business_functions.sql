-- 006: Business functions. Orders, stock, purchasing, payments and accounting are changed ONLY here.
-- Every function re-checks the caller's role, validates input, and runs inside one transaction so
-- stock, orders and journals can never drift apart. Amounts are integer paise.

-- ── Internals (not callable by API users) ─────────────────────────────────────────────────────────
create or replace function public._need(p_allowed public.app_role[]) returns void language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_staff_role(p_allowed) then raise exception 'You do not have permission to do this.' using errcode = '42501'; end if;
end; $$;

create or replace function public._post_journal(p_date date, p_desc text, p_source_type text, p_source_id uuid, p_lines jsonb, p_reversal_of uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; l jsonb; v_acc uuid; d bigint; c bigint; td bigint := 0; tc bigint := 0; n int := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Journal lines must be an array.'; end if;
  insert into journal_entries(entry_date, description, source_type, source_id, status, created_by, reversal_of)
  values (coalesce(p_date, current_date), left(p_desc, 300), p_source_type, p_source_id, 'draft', auth.uid(), p_reversal_of) returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    d := coalesce((l->>'debit')::bigint, 0); c := coalesce((l->>'credit')::bigint, 0);
    if d < 0 or c < 0 or (d > 0 and c > 0) then raise exception 'Invalid journal line.'; end if;
    if d = 0 and c = 0 then continue; end if;
    select id into v_acc from chart_of_accounts where code = l->>'account' and is_active;
    if v_acc is null then raise exception 'Unknown or inactive account %.', l->>'account'; end if;
    insert into journal_lines(journal_entry_id, account_id, description, debit_minor, credit_minor)
    values (v_id, v_acc, left(l->>'memo', 200), d, c);
    td := td + d; tc := tc + c; n := n + 1;
  end loop;
  if n < 2 or td <> tc or td = 0 then raise exception 'Journal is not balanced (debits %, credits %).', td, tc; end if;
  update journal_entries set status = 'posted', posted_by = auth.uid(), posted_at = now() where id = v_id;
  return v_id;
end; $$;

create or replace function public._reverse_journal(p_id uuid, p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare je journal_entries; v_new uuid; v_lines jsonb;
begin
  select * into je from journal_entries where id = p_id for update;
  if not found then raise exception 'Journal entry not found.'; end if;
  if je.status <> 'posted' then raise exception 'Only posted entries can be reversed.'; end if;
  if je.reversal_of is not null then raise exception 'A reversal entry cannot itself be reversed.'; end if;
  select jsonb_agg(jsonb_build_object('account', a.code, 'debit', l.credit_minor, 'credit', l.debit_minor, 'memo', l.description))
    into v_lines from journal_lines l join chart_of_accounts a on a.id = l.account_id where l.journal_entry_id = p_id;
  v_new := public._post_journal(current_date, 'Reversal of #' || je.entry_number || coalesce(': ' || p_reason, ''), 'reversal', p_id, v_lines, p_id);
  update journal_entries set status = 'reversed' where id = p_id;
  return v_new;
end; $$;

create or replace function public.effective_price_minor(p_price bigint, p_dtype text, p_dvalue numeric, p_start timestamptz, p_end timestamptz)
returns bigint language sql stable as $$
  select case
    when p_price is null then null
    when p_dtype = 'none' or p_dvalue <= 0 then p_price
    when p_start is not null and now() < p_start then p_price
    when p_end is not null and now() > p_end then p_price
    when p_dtype = 'percentage' then greatest(0, p_price - round(p_price * least(p_dvalue, 100) / 100)::bigint)
    when p_dtype = 'fixed' then greatest(0, p_price - round(p_dvalue)::bigint)
    else p_price end;
$$;

create or replace function public._order_event(p_order uuid, p_type text, p_from text, p_to text, p_msg text, p_visible boolean) returns void
language sql security definer set search_path=public as $$
  insert into order_events(order_id, event_type, from_status, to_status, message, is_customer_visible, created_by)
  values (p_order, p_type, p_from, p_to, left(p_msg, 1000), p_visible, auth.uid());
$$;

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_before jsonb, p_after jsonb, p_ip_hash text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','finance','operations','content_manager']::public.app_role[]);
  insert into audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data, ip_hash)
  values (auth.uid(), left(p_action, 80), left(p_entity_type, 80), left(p_entity_id, 80), p_before, p_after, left(p_ip_hash, 64));
end; $$;

-- ── Coupons ────────────────────────────────────────────────────────────────────────────────────────
-- Evaluates a coupon for an order that already has its items. Raises a plain-language error if it
-- cannot be used. Segment rules replace the "gender" rule used elsewhere: a coupon can be limited to
-- retail, business or export orders, to specific products/categories, to a first order, and so on.
create or replace function public._eval_coupon(p_code text, p_customer uuid, p_order uuid, p_order_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pr promotions; v_all bigint; v_eligible bigint; v_disc bigint; v_used int;
begin
  select * into pr from promotions where upper(code) = upper(trim(p_code)) and promotion_type = 'coupon' for update;
  if not found or not pr.is_active then raise exception 'This coupon code is not valid.'; end if;
  if pr.starts_at is not null and now() < pr.starts_at then raise exception 'This coupon is not active yet.'; end if;
  if pr.expires_at is not null and now() > pr.expires_at then raise exception 'This coupon has expired.'; end if;
  if pr.total_uses_limit is not null and pr.uses_count >= pr.total_uses_limit then raise exception 'This coupon has reached its usage limit.'; end if;
  if pr.applies_to <> 'all' and pr.applies_to <> p_order_type then raise exception 'This coupon is only valid for % orders.', pr.applies_to; end if;
  if p_customer is not null then
    select count(*) into v_used from promotion_redemptions where promotion_id = pr.id and customer_id = p_customer;
    if v_used >= pr.per_user_limit then raise exception 'This customer has already used this coupon.'; end if;
    if pr.first_order_only and exists (select 1 from orders where customer_id = p_customer and id <> p_order and status not in ('draft','cancelled')) then
      raise exception 'This coupon is only valid on a first order.'; end if;
  end if;
  select coalesce(sum(round(oi.quantity * oi.unit_price_minor)), 0) into v_all from order_items oi where oi.order_id = p_order;
  if v_all < pr.minimum_order_minor then raise exception 'Minimum order value for this coupon is not met.'; end if;
  select coalesce(sum(round(oi.quantity * oi.unit_price_minor)), 0) into v_eligible
    from order_items oi left join products p on p.id = oi.product_id
   where oi.order_id = p_order and (
     (cardinality(pr.product_ids) = 0 and cardinality(pr.category_ids) = 0)
     or oi.product_id = any(pr.product_ids) or p.category_id = any(pr.category_ids));
  if v_eligible = 0 then raise exception 'This coupon does not apply to the products in this order.'; end if;
  if pr.discount_type = 'percentage' then v_disc := round(v_eligible * least(pr.discount_value, 100) / 100);
  else v_disc := least(round(pr.discount_value)::bigint, v_eligible); end if;
  if pr.max_discount_minor is not null then v_disc := least(v_disc, pr.max_discount_minor); end if;
  return jsonb_build_object('promotion_id', pr.id, 'discount_minor', v_disc, 'product_ids', to_jsonb(pr.product_ids), 'category_ids', to_jsonb(pr.category_ids));
end; $$;

-- Spreads a discount across eligible order lines in proportion to their value (remainder to the last line).
create or replace function public._allocate_discount(p_order uuid, p_total bigint, p_product_ids uuid[], p_category_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare r record; v_base bigint; v_left bigint := p_total; v_share bigint; v_n int; v_i int := 0;
begin
  if p_total <= 0 then return; end if;
  select coalesce(sum(round(oi.quantity * oi.unit_price_minor)), 0), count(*) into v_base, v_n
    from order_items oi left join products p on p.id = oi.product_id
   where oi.order_id = p_order and ((cardinality(p_product_ids) = 0 and cardinality(p_category_ids) = 0) or oi.product_id = any(p_product_ids) or p.category_id = any(p_category_ids));
  if v_base = 0 then return; end if;
  for r in select oi.id, round(oi.quantity * oi.unit_price_minor)::bigint as gross
             from order_items oi left join products p on p.id = oi.product_id
            where oi.order_id = p_order and ((cardinality(p_product_ids) = 0 and cardinality(p_category_ids) = 0) or oi.product_id = any(p_product_ids) or p.category_id = any(p_category_ids))
            order by oi.id loop
    v_i := v_i + 1;
    v_share := case when v_i = v_n then v_left else least(v_left, round(p_total::numeric * r.gross / v_base)::bigint) end;
    update order_items set discount_minor = v_share where id = r.id;
    v_left := v_left - v_share;
  end loop;
end; $$;

-- Storefront preview of a coupon (called only by the server with the service role).
create or replace function public.check_coupon(p_code text, p_customer_type text, p_subtotal_minor bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pr promotions; v_disc bigint;
begin
  select * into pr from promotions where upper(code) = upper(trim(p_code)) and promotion_type = 'coupon' and is_active;
  if not found then return jsonb_build_object('valid', false, 'message', 'This coupon code is not valid.'); end if;
  if (pr.starts_at is not null and now() < pr.starts_at) or (pr.expires_at is not null and now() > pr.expires_at)
     or (pr.total_uses_limit is not null and pr.uses_count >= pr.total_uses_limit)
     or (pr.applies_to <> 'all' and pr.applies_to <> p_customer_type) or p_subtotal_minor < pr.minimum_order_minor then
    return jsonb_build_object('valid', false, 'message', 'This coupon cannot be used on this order.');
  end if;
  if pr.discount_type = 'percentage' then v_disc := round(p_subtotal_minor * least(pr.discount_value, 100) / 100);
  else v_disc := least(round(pr.discount_value)::bigint, p_subtotal_minor); end if;
  if pr.max_discount_minor is not null then v_disc := least(v_disc, pr.max_discount_minor); end if;
  return jsonb_build_object('valid', true, 'discount_minor', v_disc, 'description', pr.description);
end; $$;

-- ── Orders ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.create_order(
  p_customer_id uuid, p_order_type text, p_items jsonb,
  p_coupon_code text default null, p_referral_code text default null, p_shipping_minor bigint default 0,
  p_shipping_address jsonb default '{}', p_billing_address jsonb default '{}', p_notes text default null,
  p_expected_delivery date default null, p_incoterm text default null, p_initial_status text default 'confirmed')
returns uuid language plpgsql security definer set search_path=public as $$
declare
  c customers; v_order uuid; v_num text; it jsonb; p products; v_base bigint; v_price bigint; v_qty numeric; v_rate numeric;
  v_coupon jsonb; v_disc bigint := 0; v_prog jsonb; v_ref customers; v_promo uuid; v_ref_disc bigint; v_user uuid;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if p_order_type not in ('retail','business','export') then raise exception 'Invalid order type.'; end if;
  if p_initial_status not in ('draft','pending_payment','confirmed') then raise exception 'Invalid starting status.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'An order needs between 1 and 100 items.'; end if;
  if p_shipping_minor < 0 then raise exception 'Shipping cannot be negative.'; end if;
  select * into c from customers where id = p_customer_id;
  if not found then raise exception 'Customer not found.'; end if;
  if c.is_blocked then raise exception 'This customer is blocked.'; end if;
  if jsonb_typeof(p_shipping_address) <> 'object' or jsonb_typeof(p_billing_address) <> 'object'
     or length(p_shipping_address::text) > 2000 or length(p_billing_address::text) > 2000 then raise exception 'Invalid address.'; end if;

  v_num := 'VI-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  select user_id into v_user from customers where id = c.id;
  insert into orders(order_number, user_id, customer_id, order_type, status, shipping_address, billing_address, shipping_minor, notes, expected_delivery, incoterm)
  values (v_num, v_user, c.id, p_order_type, p_initial_status::order_status, p_shipping_address, p_billing_address, p_shipping_minor, left(p_notes, 4000), p_expected_delivery, left(p_incoterm, 12))
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid;
    if not found then raise exception 'A product in this order no longer exists.'; end if;
    v_qty := (it->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 10000000 then raise exception 'Invalid quantity for %.', p.name; end if;
    if p_order_type = 'retail' then v_base := p.retail_price_minor; else v_base := coalesce(p.wholesale_price_minor, p.retail_price_minor); end if;
    if it ? 'unit_price_minor' and (it->>'unit_price_minor') is not null then
      v_price := (it->>'unit_price_minor')::bigint;     -- negotiated price (staff only)
      if v_price < 0 then raise exception 'Invalid price for %.', p.name; end if;
    else
      v_price := public.effective_price_minor(v_base, p.discount_type, p.discount_value, p.discount_starts_at, p.discount_ends_at);
    end if;
    if v_price is null then raise exception 'No price is set for %. Set a price or enter a negotiated price.', p.name; end if;
    v_rate := case when p_order_type = 'export' then 0 else p.tax_rate end;   -- export assumed zero-rated; confirm with your accountant
    insert into order_items(order_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price_minor, tax_rate, tax_minor, line_total_minor, discount_minor)
    values (v_order, p.id, p.name, p.sku, v_qty, v_price, v_rate, 0, 0, 0);
  end loop;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    v_coupon := public._eval_coupon(p_coupon_code, c.id, v_order, p_order_type);
    v_disc := (v_coupon->>'discount_minor')::bigint;
    perform public._allocate_discount(v_order, v_disc,
      array(select jsonb_array_elements_text(v_coupon->'product_ids'))::uuid[], array(select jsonb_array_elements_text(v_coupon->'category_ids'))::uuid[]);
    v_promo := (v_coupon->>'promotion_id')::uuid;
    insert into promotion_redemptions(promotion_id, user_id, customer_id, order_id, discount_minor) values (v_promo, v_user, c.id, v_order, v_disc);
    update promotions set uses_count = uses_count + 1 where id = v_promo;
  elsif p_referral_code is not null and length(trim(p_referral_code)) > 0 then
    select value into v_prog from site_settings where key = 'referral_program';
    if v_prog is null or coalesce((v_prog->>'enabled')::boolean, false) is false then raise exception 'The referral programme is not active.'; end if;
    select * into v_ref from customers where upper(referral_code) = upper(trim(p_referral_code));
    if not found then raise exception 'This referral code is not valid.'; end if;
    if v_ref.id = c.id then raise exception 'A customer cannot use their own referral code.'; end if;
    if exists (select 1 from referrals where referred_customer_id = c.id) then raise exception 'This customer has already used a referral code.'; end if;
    if exists (select 1 from orders where customer_id = c.id and id <> v_order and status not in ('draft','cancelled')) then raise exception 'Referral codes only apply to a first order.'; end if;
    select coalesce(sum(round(quantity * unit_price_minor)), 0) into v_base from order_items where order_id = v_order;
    if v_base < coalesce((v_prog->>'min_order_minor')::bigint, 0) then raise exception 'Minimum order value for the referral offer is not met.'; end if;
    if v_prog->>'referee_discount_type' = 'percentage' then v_ref_disc := round(v_base * least((v_prog->>'referee_discount_value')::numeric, 100) / 100);
    else v_ref_disc := least(round((v_prog->>'referee_discount_value')::numeric)::bigint, v_base); end if;
    perform public._allocate_discount(v_order, v_ref_disc, '{}', '{}');
    v_disc := v_ref_disc;
    insert into referrals(referrer_user_id, referred_user_id, referrer_customer_id, referred_customer_id, referral_code, reward_minor, status)
    values (v_ref.user_id, v_user, v_ref.id, c.id, v_ref.referral_code, coalesce((v_prog->>'referrer_reward_minor')::bigint, 0), 'pending');
    update orders set referral_code = v_ref.referral_code where id = v_order;
  end if;

  update order_items set
    tax_minor = round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100),
    line_total_minor = (round(quantity * unit_price_minor) - discount_minor) + round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100)
  where order_id = v_order;
  update orders o set
    subtotal_minor = s.sub, discount_minor = s.disc, tax_minor = s.tax,
    total_minor = s.sub - s.disc + s.tax + o.shipping_minor
  from (select coalesce(sum(round(quantity * unit_price_minor)), 0)::bigint sub, coalesce(sum(discount_minor), 0)::bigint disc, coalesce(sum(tax_minor), 0)::bigint tax
          from order_items where order_id = v_order) s
  where o.id = v_order;
  update orders set coupon_id = v_promo where id = v_order and v_promo is not null;
  perform public._order_event(v_order, 'created', null, p_initial_status, 'Order created.', true);
  perform public.write_audit('order.create', 'order', v_order::text, null, jsonb_build_object('order_number', v_num, 'customer_id', c.id), null);
  return v_order;
end; $$;

create or replace function public._deduct_stock(p_order uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare it record; b record; need numeric; take numeric; avail numeric; v_cogs bigint := 0; v_num text;
begin
  select order_number into v_num from orders where id = p_order;
  for it in select oi.product_id, sum(oi.quantity) qty, max(oi.product_name_snapshot) pname from order_items oi where oi.order_id = p_order and oi.product_id is not null group by oi.product_id loop
    need := it.qty;
    select coalesce(sum(quantity_on_hand - quantity_reserved), 0) into avail from inventory_batches
     where product_id = it.product_id and (expires_on is null or expires_on >= current_date);
    if avail < need then raise exception 'Insufficient stock for %: need %, available %.', it.pname, need, avail; end if;
    for b in select * from inventory_batches where product_id = it.product_id and (expires_on is null or expires_on >= current_date)
              and quantity_on_hand - quantity_reserved > 0 order by expires_on nulls last, created_at for update loop
      exit when need <= 0;
      take := least(need, b.quantity_on_hand - b.quantity_reserved);
      update inventory_batches set quantity_on_hand = quantity_on_hand - take where id = b.id;
      insert into stock_movements(product_id, batch_id, order_id, movement_type, quantity_delta, unit_cost_minor, reference, created_by)
      values (it.product_id, b.id, p_order, 'sale', -take, b.unit_cost_minor, v_num, auth.uid());
      v_cogs := v_cogs + round(take * coalesce(b.unit_cost_minor, 0))::bigint;
      need := need - take;
    end loop;
  end loop;
  return v_cogs;
end; $$;

create or replace function public._restore_stock(p_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare m record; v_num text;
begin
  if exists (select 1 from stock_movements where order_id = p_order and movement_type = 'return') then return; end if;
  select order_number into v_num from orders where id = p_order;
  for m in select * from stock_movements where order_id = p_order and movement_type = 'sale' loop
    update inventory_batches set quantity_on_hand = quantity_on_hand + abs(m.quantity_delta) where id = m.batch_id;
    insert into stock_movements(product_id, batch_id, order_id, movement_type, quantity_delta, unit_cost_minor, reference, notes, created_by)
    values (m.product_id, m.batch_id, p_order, 'return', abs(m.quantity_delta), m.unit_cost_minor, v_num, 'Order cancelled after packing', auth.uid());
  end loop;
end; $$;

create or replace function public.set_order_status(p_order uuid, p_new text, p_note text default null, p_visible boolean default true)
returns void language plpgsql security definer set search_path=public as $$
declare o orders; v_ok boolean; v_cogs bigint; v_sales bigint; v_je uuid; v_msg text;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  v_ok := case o.status::text
    when 'draft' then p_new in ('pending_payment','confirmed','cancelled')
    when 'pending_payment' then p_new in ('confirmed','cancelled')
    when 'confirmed' then p_new in ('processing','cancelled')
    when 'processing' then p_new in ('packed','cancelled')
    when 'packed' then p_new in ('shipped','cancelled')
    when 'shipped' then p_new in ('delivered','refunded')
    when 'delivered' then p_new = 'refunded'
    else false end;
  if not v_ok then raise exception 'An order that is % cannot move to %.', o.status, p_new; end if;

  if p_new = 'packed' then
    v_cogs := public._deduct_stock(p_order);
    if v_cogs > 0 then
      perform public._post_journal(current_date, 'Cost of goods sold for ' || o.order_number, 'order_cogs', p_order,
        jsonb_build_array(jsonb_build_object('account','5000','debit',v_cogs), jsonb_build_object('account','1200','credit',v_cogs)));
    end if;
  elsif p_new = 'shipped' then
    if o.total_minor > 0 then
      v_sales := o.subtotal_minor - o.discount_minor + o.shipping_minor;
      perform public._post_journal(current_date, 'Sales invoice ' || o.order_number, 'order_invoice', p_order,
        jsonb_build_array(jsonb_build_object('account','1100','debit',o.total_minor), jsonb_build_object('account','4000','credit',v_sales), jsonb_build_object('account','2100','credit',o.tax_minor)));
      if o.amount_paid_minor > 0 then   -- move advances received before invoicing against the invoice
        perform public._post_journal(current_date, 'Advance applied to ' || o.order_number, 'order_advance', p_order,
          jsonb_build_array(jsonb_build_object('account','2200','debit',o.amount_paid_minor), jsonb_build_object('account','1100','credit',o.amount_paid_minor)));
      end if;
    end if;
    update orders set shipped_at = now() where id = p_order;
  elsif p_new = 'delivered' then
    update orders set delivered_at = now() where id = p_order;
    update referrals set status = 'qualified', qualified_order_id = p_order where referred_customer_id = o.customer_id and status = 'pending';
  elsif p_new = 'cancelled' then
    if o.status = 'packed' then
      perform public._restore_stock(p_order);
      for v_je in select id from journal_entries where source_type = 'order_cogs' and source_id = p_order and status = 'posted' loop
        perform public._reverse_journal(v_je, 'order cancelled');
      end loop;
    end if;
    if o.coupon_id is not null then
      delete from promotion_redemptions where order_id = p_order;
      update promotions set uses_count = greatest(uses_count - 1, 0) where id = o.coupon_id;
    end if;
    update referrals set status = 'rejected' where referred_customer_id = o.customer_id and status = 'pending' and not exists (select 1 from orders x where x.customer_id = o.customer_id and x.id <> p_order and x.status not in ('draft','cancelled'));
    update orders set cancelled_at = now() where id = p_order;
  elsif p_new = 'refunded' then
    for v_je in select id from journal_entries where source_type = 'order_invoice' and source_id = p_order and status = 'posted' loop
      perform public._reverse_journal(v_je, 'order refunded');
    end loop;
    if o.amount_paid_minor > 0 then   -- cash goes back to the customer; clears the credit left on receivables
      perform public._post_journal(current_date, 'Refund paid for ' || o.order_number, 'order_refund', p_order,
        jsonb_build_array(jsonb_build_object('account','1100','debit',o.amount_paid_minor), jsonb_build_object('account','1000','credit',o.amount_paid_minor)));
      update orders set amount_paid_minor = 0, payment_status = 'refunded' where id = p_order;
    else
      update orders set payment_status = 'refunded' where id = p_order;
    end if;
    update referrals set status = 'rejected' where qualified_order_id = p_order and status in ('qualified','pending');
    v_msg := 'Refunded. If goods came back, add them to stock under Inventory > Adjust stock.';
  end if;

  update orders set status = p_new::order_status where id = p_order;
  perform public._order_event(p_order, 'status', o.status::text, p_new, coalesce(nullif(trim(p_note), ''), v_msg, 'Status changed to ' || p_new || '.'), p_visible);
  perform public.write_audit('order.status', 'order', p_order::text, jsonb_build_object('status', o.status), jsonb_build_object('status', p_new), null);
end; $$;

create or replace function public.record_payment(p_order uuid, p_amount_minor bigint, p_method text, p_reference text default null, p_received_on date default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders; v_credit text; v_paid bigint;
begin
  perform public._need(array['owner','admin','finance','operations']::public.app_role[]);
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Enter an amount greater than zero.'; end if;
  if p_method is null or p_method not in ('UPI','Bank transfer','Cash','Cheque','Card','Online gateway','Other') then raise exception 'Choose a payment method.'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status in ('cancelled','refunded') then raise exception 'Payments cannot be recorded on a % order.', o.status; end if;
  if o.amount_paid_minor + p_amount_minor > o.total_minor then raise exception 'This payment is more than the balance due.'; end if;
  v_credit := case when o.status in ('shipped','delivered') then '1100' else '2200' end;
  insert into payments(order_id, amount_minor, payment_method, provider, provider_reference, status, received_at)
  values (p_order, p_amount_minor, p_method, 'manual', left(p_reference, 80), 'captured', coalesce(p_received_on::timestamptz, now()));
  perform public._post_journal(coalesce(p_received_on, current_date), 'Payment received for ' || o.order_number, 'order_payment', p_order,
    jsonb_build_array(jsonb_build_object('account','1000','debit',p_amount_minor), jsonb_build_object('account',v_credit,'credit',p_amount_minor)));
  v_paid := o.amount_paid_minor + p_amount_minor;
  update orders set amount_paid_minor = v_paid, payment_status = case when v_paid >= total_minor then 'paid' else 'partial' end where id = p_order;
  perform public._order_event(p_order, 'payment', null, null, 'Payment recorded (' || p_method || ').', false);
  perform public.write_audit('order.payment', 'order', p_order::text, null, jsonb_build_object('amount_minor', p_amount_minor, 'method', p_method), null);
end; $$;

create or replace function public.update_order_details(p_order uuid, p_patch jsonb) returns void language plpgsql security definer set search_path=public as $$
declare o orders; k text; v_changed_tracking boolean := false; v_url text;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'Invalid update.'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k not in ('courier_provider','courier_reference','tracking_url','internal_notes','notes','expected_delivery','incoterm','shipping_address','billing_address') then
      raise exception 'Field % cannot be changed here.', k; end if;
  end loop;
  v_url := nullif(trim(p_patch->>'tracking_url'), '');
  if v_url is not null and (v_url !~* '^https://[^\s]{4,290}$') then raise exception 'Tracking link must start with https://'; end if;
  update orders set
    courier_provider = case when p_patch ? 'courier_provider' then left(nullif(trim(p_patch->>'courier_provider'), ''), 60) else courier_provider end,
    courier_reference = case when p_patch ? 'courier_reference' then left(nullif(trim(p_patch->>'courier_reference'), ''), 80) else courier_reference end,
    tracking_url = case when p_patch ? 'tracking_url' then v_url else tracking_url end,
    internal_notes = case when p_patch ? 'internal_notes' then left(p_patch->>'internal_notes', 4000) else internal_notes end,
    notes = case when p_patch ? 'notes' then left(p_patch->>'notes', 4000) else notes end,
    expected_delivery = case when p_patch ? 'expected_delivery' then nullif(p_patch->>'expected_delivery', '')::date else expected_delivery end,
    incoterm = case when p_patch ? 'incoterm' then left(nullif(trim(p_patch->>'incoterm'), ''), 12) else incoterm end,
    shipping_address = case when p_patch ? 'shipping_address' and jsonb_typeof(p_patch->'shipping_address') = 'object' and length((p_patch->'shipping_address')::text) <= 2000 then p_patch->'shipping_address' else shipping_address end,
    billing_address = case when p_patch ? 'billing_address' and jsonb_typeof(p_patch->'billing_address') = 'object' and length((p_patch->'billing_address')::text) <= 2000 then p_patch->'billing_address' else billing_address end
  where id = p_order;
  if p_patch ? 'courier_provider' or p_patch ? 'courier_reference' or p_patch ? 'tracking_url' then
    perform public._order_event(p_order, 'tracking', null, null, 'Shipping details updated' || coalesce(' — ' || nullif(trim(p_patch->>'courier_provider'), '') || ' ' || nullif(trim(p_patch->>'courier_reference'), ''), '') || '.', true);
  end if;
  perform public.write_audit('order.update', 'order', p_order::text, null, p_patch - 'shipping_address' - 'billing_address', null);
end; $$;

create or replace function public.add_order_note(p_order uuid, p_message text, p_visible boolean default false) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if p_message is null or length(trim(p_message)) < 2 then raise exception 'Write a note first.'; end if;
  if not exists (select 1 from orders where id = p_order) then raise exception 'Order not found.'; end if;
  perform public._order_event(p_order, 'note', null, null, p_message, coalesce(p_visible, false));
end; $$;

-- ── Customers and enquiries ──────────────────────────────────────────────────────────────────────
create or replace function public.convert_enquiry_to_customer(p_enquiry uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare e enquiries; v_id uuid; v_type text;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  select * into e from enquiries where id = p_enquiry for update;
  if not found then raise exception 'Enquiry not found.'; end if;
  if e.customer_id is not null then return e.customer_id; end if;
  v_type := case when e.enquiry_type ilike '%export%' or e.destination_country is not null and upper(left(e.destination_country, 5)) not in ('INDIA','IN') then 'export'
                 when e.enquiry_type ilike '%bulk%' or e.company is not null then 'business' else 'retail' end;
  select id into v_id from customers where lower(email) = lower(e.email) limit 1;
  if v_id is null then
    insert into customers(name, email, company, customer_type, source, notes) values (e.name, e.email, e.company, v_type, 'enquiry', 'Created from enquiry.') returning id into v_id;
  end if;
  update enquiries set customer_id = v_id where id = p_enquiry;
  perform public.write_audit('customer.from_enquiry', 'enquiry', p_enquiry::text, null, jsonb_build_object('customer_id', v_id), null);
  return v_id;
end; $$;

create or replace function public.mark_referral_rewarded(p_referral uuid) returns void language plpgsql security definer set search_path=public as $$
declare r referrals;
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  select * into r from referrals where id = p_referral for update;
  if not found then raise exception 'Referral not found.'; end if;
  if r.status <> 'qualified' then raise exception 'Only a qualified referral can be rewarded.'; end if;
  if r.reward_minor > 0 then
    perform public._post_journal(current_date, 'Referral reward paid', 'referral_reward', p_referral,
      jsonb_build_array(jsonb_build_object('account','6100','debit',r.reward_minor), jsonb_build_object('account','1000','credit',r.reward_minor)));
  end if;
  update referrals set status = 'rewarded', rewarded_at = now() where id = p_referral;
  perform public.write_audit('referral.reward', 'referral', p_referral::text, null, jsonb_build_object('reward_minor', r.reward_minor), null);
end; $$;

create or replace function public.reject_referral(p_referral uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  update referrals set status = 'rejected' where id = p_referral and status in ('pending','qualified');
  if not found then raise exception 'This referral cannot be rejected.'; end if;
  perform public.write_audit('referral.reject', 'referral', p_referral::text, null, null, null);
end; $$;

-- ── Purchasing and stock ─────────────────────────────────────────────────────────────────────────
create or replace function public.create_purchase(p_supplier uuid, p_items jsonb, p_location uuid default null, p_expected date default null,
  p_invoice text default null, p_shipping_minor bigint default 0, p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_po uuid; v_num text; it jsonb; v_qty numeric; v_cost bigint; v_rate numeric; v_line bigint; v_sub bigint := 0; v_tax bigint := 0;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if not exists (select 1 from suppliers where id = p_supplier and is_active) then raise exception 'Choose an active supplier.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'A purchase needs between 1 and 100 items.'; end if;
  if p_shipping_minor < 0 then raise exception 'Shipping cannot be negative.'; end if;
  v_num := 'PO-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.po_number_seq')::text, 5, '0');
  insert into purchase_orders(po_number, supplier_id, status, location_id, expected_date, invoice_number, shipping_minor, notes, created_by)
  values (v_num, p_supplier, 'ordered', p_location, p_expected, left(p_invoice, 60), p_shipping_minor, left(p_notes, 2000), auth.uid()) returning id into v_po;
  for it in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from products where id = (it->>'product_id')::uuid) then raise exception 'A product in this purchase no longer exists.'; end if;
    v_qty := (it->>'quantity')::numeric; v_cost := (it->>'unit_cost_minor')::bigint; v_rate := coalesce((it->>'tax_rate')::numeric, 0);
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 or v_rate < 0 or v_rate > 100 then raise exception 'Check quantity, cost and tax rate on each line.'; end if;
    v_line := round(v_qty * v_cost);
    insert into purchase_order_items(purchase_order_id, product_id, quantity, unit_cost_minor, tax_rate, batch_number, manufactured_on, expires_on, line_total_minor)
    values (v_po, (it->>'product_id')::uuid, v_qty, v_cost, v_rate, left(nullif(trim(it->>'batch_number'), ''), 60), nullif(it->>'manufactured_on', '')::date, nullif(it->>'expires_on', '')::date, v_line);
    v_sub := v_sub + v_line; v_tax := v_tax + round(v_line * v_rate / 100);
  end loop;
  update purchase_orders set subtotal_minor = v_sub, tax_minor = v_tax, total_minor = v_sub + v_tax + p_shipping_minor where id = v_po;
  perform public.write_audit('purchase.create', 'purchase_order', v_po::text, null, jsonb_build_object('po_number', v_num), null);
  return v_po;
end; $$;

create or replace function public.receive_purchase(p_po uuid) returns void language plpgsql security definer set search_path=public as $$
declare po purchase_orders; it record; v_loc uuid; v_batch text; v_n int := 0; v_ship numeric; v_unit bigint; v_batch_id uuid; v_inv bigint;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  select * into po from purchase_orders where id = p_po for update;
  if not found then raise exception 'Purchase order not found.'; end if;
  if po.status <> 'ordered' then raise exception 'Only an ordered purchase can be received.'; end if;
  v_loc := coalesce(po.location_id, (select id from inventory_locations where is_active order by name limit 1));
  for it in select * from purchase_order_items where purchase_order_id = p_po order by id loop
    v_n := v_n + 1;
    v_batch := coalesce(it.batch_number, po.po_number || '-' || v_n);
    if exists (select 1 from inventory_batches where product_id = it.product_id and batch_number = v_batch) then v_batch := v_batch || '-' || v_n; end if;
    v_ship := case when po.subtotal_minor > 0 then po.shipping_minor * it.line_total_minor::numeric / po.subtotal_minor else 0 end;
    v_unit := round((it.line_total_minor + v_ship) / it.quantity);
    insert into inventory_batches(product_id, location_id, batch_number, manufactured_on, expires_on, quantity_on_hand, unit_cost_minor, supplier_name)
    values (it.product_id, v_loc, v_batch, it.manufactured_on, it.expires_on, it.quantity, v_unit, (select name from suppliers where id = po.supplier_id)) returning id into v_batch_id;
    insert into stock_movements(product_id, batch_id, movement_type, quantity_delta, unit_cost_minor, reference, created_by)
    values (it.product_id, v_batch_id, 'receipt', it.quantity, v_unit, po.po_number, auth.uid());
  end loop;
  v_inv := po.subtotal_minor + po.shipping_minor;
  perform public._post_journal(current_date, 'Goods received ' || po.po_number, 'purchase', p_po,
    jsonb_build_array(jsonb_build_object('account','1200','debit',v_inv), jsonb_build_object('account','1300','debit',po.tax_minor), jsonb_build_object('account','2000','credit',po.total_minor)));
  update purchase_orders set status = 'received', received_at = now() where id = p_po;
  perform public.write_audit('purchase.receive', 'purchase_order', p_po::text, null, jsonb_build_object('po_number', po.po_number), null);
end; $$;

create or replace function public.cancel_purchase(p_po uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  update purchase_orders set status = 'cancelled' where id = p_po and status in ('draft','ordered');
  if not found then raise exception 'Only a purchase that has not been received can be cancelled.'; end if;
  perform public.write_audit('purchase.cancel', 'purchase_order', p_po::text, null, null, null);
end; $$;

create or replace function public.record_purchase_payment(p_po uuid, p_amount_minor bigint, p_method text, p_reference text default null)
returns void language plpgsql security definer set search_path=public as $$
declare po purchase_orders; v_paid bigint;
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Enter an amount greater than zero.'; end if;
  select * into po from purchase_orders where id = p_po for update;
  if not found then raise exception 'Purchase order not found.'; end if;
  if po.status <> 'received' then raise exception 'Pay a purchase after the goods are received.'; end if;
  if po.amount_paid_minor + p_amount_minor > po.total_minor then raise exception 'This payment is more than the balance due.'; end if;
  perform public._post_journal(current_date, 'Supplier payment ' || po.po_number || coalesce(' (' || left(p_reference, 40) || ')', ''), 'purchase_payment', p_po,
    jsonb_build_array(jsonb_build_object('account','2000','debit',p_amount_minor), jsonb_build_object('account','1000','credit',p_amount_minor)));
  v_paid := po.amount_paid_minor + p_amount_minor;
  update purchase_orders set amount_paid_minor = v_paid, payment_status = case when v_paid >= total_minor then 'paid' else 'partial' end where id = p_po;
  perform public.write_audit('purchase.payment', 'purchase_order', p_po::text, null, jsonb_build_object('amount_minor', p_amount_minor, 'method', p_method), null);
end; $$;

create or replace function public.add_opening_stock(p_product uuid, p_batch text, p_qty numeric, p_unit_cost_minor bigint, p_mfg date default null, p_exp date default null, p_location uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_val bigint;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  if p_unit_cost_minor is null or p_unit_cost_minor < 0 then raise exception 'Enter the cost per unit.'; end if;
  if p_batch is null or length(trim(p_batch)) = 0 then raise exception 'Enter a batch number.'; end if;
  if not exists (select 1 from products where id = p_product) then raise exception 'Product not found.'; end if;
  insert into inventory_batches(product_id, location_id, batch_number, manufactured_on, expires_on, quantity_on_hand, unit_cost_minor)
  values (p_product, coalesce(p_location, (select id from inventory_locations where is_active order by name limit 1)), left(trim(p_batch), 60), p_mfg, p_exp, p_qty, p_unit_cost_minor) returning id into v_id;
  insert into stock_movements(product_id, batch_id, movement_type, quantity_delta, unit_cost_minor, reference, notes, created_by)
  values (p_product, v_id, 'adjustment', p_qty, p_unit_cost_minor, 'Opening stock', 'Opening stock entered', auth.uid());
  v_val := round(p_qty * p_unit_cost_minor);
  perform public._post_journal(current_date, 'Opening stock ' || left(trim(p_batch), 60), 'stock_opening', v_id,
    jsonb_build_array(jsonb_build_object('account','1200','debit',v_val), jsonb_build_object('account','3000','credit',v_val)));
  perform public.write_audit('stock.opening', 'inventory_batch', v_id::text, null, jsonb_build_object('qty', p_qty), null);
  return v_id;
end; $$;

create or replace function public.adjust_stock(p_batch uuid, p_delta numeric, p_type text, p_notes text)
returns void language plpgsql security definer set search_path=public as $$
declare b inventory_batches; v_delta numeric; v_val bigint;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if p_type not in ('adjustment','waste','return') then raise exception 'Invalid adjustment type.'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Enter a quantity.'; end if;
  if p_notes is null or length(trim(p_notes)) < 3 then raise exception 'Give a reason for the adjustment.'; end if;
  v_delta := case when p_type = 'waste' then -abs(p_delta) when p_type = 'return' then abs(p_delta) else p_delta end;
  select * into b from inventory_batches where id = p_batch for update;
  if not found then raise exception 'Batch not found.'; end if;
  if b.quantity_on_hand + v_delta < b.quantity_reserved or b.quantity_on_hand + v_delta < 0 then raise exception 'That would take stock below zero.'; end if;
  update inventory_batches set quantity_on_hand = quantity_on_hand + v_delta where id = p_batch;
  insert into stock_movements(product_id, batch_id, movement_type, quantity_delta, unit_cost_minor, reference, notes, created_by)
  values (b.product_id, p_batch, p_type, v_delta, b.unit_cost_minor, b.batch_number, left(trim(p_notes), 500), auth.uid());
  v_val := round(abs(v_delta) * coalesce(b.unit_cost_minor, 0));
  if v_delta < 0 then
    perform public._post_journal(current_date, 'Stock reduced: ' || b.batch_number, 'stock_adjustment', p_batch,
      jsonb_build_array(jsonb_build_object('account','6700','debit',v_val), jsonb_build_object('account','1200','credit',v_val)));
  else
    perform public._post_journal(current_date, 'Stock added: ' || b.batch_number, 'stock_adjustment', p_batch,
      jsonb_build_array(jsonb_build_object('account','1200','debit',v_val), jsonb_build_object('account', case when p_type = 'return' then '5000' else '6700' end,'credit',v_val)));
  end if;
  perform public.write_audit('stock.adjust', 'inventory_batch', p_batch::text, null, jsonb_build_object('delta', v_delta, 'type', p_type), null);
end; $$;

-- ── Accounting ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.post_manual_journal(p_date date, p_description text, p_lines jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  if p_description is null or length(trim(p_description)) < 3 then raise exception 'Add a description.'; end if;
  if p_date is null or p_date > current_date + 1 then raise exception 'Choose a valid date (not in the future).'; end if;
  v_id := public._post_journal(p_date, trim(p_description), 'manual', null, p_lines);
  perform public.write_audit('journal.post', 'journal_entry', v_id::text, null, jsonb_build_object('description', p_description), null);
  return v_id;
end; $$;

create or replace function public.reverse_journal(p_id uuid, p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_new uuid; v_src text;
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  select source_type into v_src from journal_entries where id = p_id;
  if v_src is distinct from 'manual' then raise exception 'Only manual entries can be reversed here. System entries are reversed by changing the order or purchase.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Give a reason for the reversal.'; end if;
  v_new := public._reverse_journal(p_id, trim(p_reason));
  perform public.write_audit('journal.reverse', 'journal_entry', p_id::text, null, jsonb_build_object('reason', p_reason), null);
  return v_new;
end; $$;

create or replace function public.account_balances(p_from date default null, p_to date default null)
returns table(code text, name text, account_type public.account_type, debit_minor bigint, credit_minor bigint)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  return query
    select a.code, a.name, a.account_type, coalesce(sum(l.debit_minor), 0)::bigint, coalesce(sum(l.credit_minor), 0)::bigint
      from chart_of_accounts a
      left join journal_lines l on l.account_id = a.id
        and exists (select 1 from journal_entries j where j.id = l.journal_entry_id and j.status in ('posted','reversed')
                    and (p_from is null or j.entry_date >= p_from) and (p_to is null or j.entry_date <= p_to))
     where a.is_active group by a.id, a.code, a.name, a.account_type order by a.code;
end; $$;

create or replace function public.finance_summary(p_from date, p_to date) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_rev bigint; v_cogs bigint; v_exp bigint; v_cash bigint; v_ar bigint; v_ap bigint; v_inv bigint; v_gst bigint; v_months jsonb;
begin
  perform public._need(array['owner','admin','finance']::public.app_role[]);
  select coalesce(sum(l.credit_minor - l.debit_minor) filter (where a.account_type = 'revenue'), 0),
         coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.code = '5000'), 0),
         coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.account_type = 'expense' and a.code <> '5000'), 0)
    into v_rev, v_cogs, v_exp
    from journal_lines l join journal_entries j on j.id = l.journal_entry_id and j.status in ('posted','reversed') and j.entry_date between p_from and p_to
    join chart_of_accounts a on a.id = l.account_id;
  select coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.code = '1000'), 0),
         coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.code = '1100'), 0),
         coalesce(sum(l.credit_minor - l.debit_minor) filter (where a.code = '2000'), 0),
         coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.code = '1200'), 0),
         coalesce(sum(l.credit_minor - l.debit_minor) filter (where a.code = '2100'), 0) - coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.code = '1300'), 0)
    into v_cash, v_ar, v_ap, v_inv, v_gst
    from journal_lines l join journal_entries j on j.id = l.journal_entry_id and j.status in ('posted','reversed') and j.entry_date <= p_to
    join chart_of_accounts a on a.id = l.account_id;
  select coalesce(jsonb_agg(m order by m->>'month'), '[]'::jsonb) into v_months from (
    select jsonb_build_object('month', to_char(date_trunc('month', j.entry_date), 'YYYY-MM'),
      'revenue', coalesce(sum(l.credit_minor - l.debit_minor) filter (where a.account_type = 'revenue'), 0),
      'expenses', coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.account_type = 'expense'), 0)) m
    from journal_lines l join journal_entries j on j.id = l.journal_entry_id and j.status in ('posted','reversed') and j.entry_date between p_from and p_to
    join chart_of_accounts a on a.id = l.account_id group by date_trunc('month', j.entry_date)) s;
  return jsonb_build_object('revenue_minor', v_rev, 'cogs_minor', v_cogs, 'gross_profit_minor', v_rev - v_cogs, 'expenses_minor', v_exp,
    'net_profit_minor', v_rev - v_cogs - v_exp, 'cash_minor', v_cash, 'receivables_minor', v_ar, 'payables_minor', v_ap,
    'inventory_minor', v_inv, 'gst_payable_minor', v_gst, 'months', v_months);
end; $$;

create or replace function public.receivables() returns table(order_id uuid, order_number text, customer_name text, total_minor bigint, paid_minor bigint, outstanding_minor bigint, invoiced_on date, age_days int)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','finance','operations']::public.app_role[]);
  return query select o.id, o.order_number, coalesce(c.name, '—'), o.total_minor, o.amount_paid_minor, o.total_minor - o.amount_paid_minor,
                      o.shipped_at::date, (current_date - o.shipped_at::date)::int
                 from orders o left join customers c on c.id = o.customer_id
                where o.status in ('shipped','delivered') and o.amount_paid_minor < o.total_minor order by o.shipped_at;
end; $$;

create or replace function public.payables() returns table(po_id uuid, po_number text, supplier_name text, total_minor bigint, paid_minor bigint, outstanding_minor bigint, received_on date, age_days int)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._need(array['owner','admin','finance','operations']::public.app_role[]);
  return query select p.id, p.po_number, s.name, p.total_minor, p.amount_paid_minor, p.total_minor - p.amount_paid_minor,
                      p.received_at::date, (current_date - p.received_at::date)::int
                 from purchase_orders p join suppliers s on s.id = p.supplier_id
                where p.status = 'received' and p.amount_paid_minor < p.total_minor order by p.received_at;
end; $$;

-- ── Inventory overview ───────────────────────────────────────────────────────────────────────────
create or replace view public.inventory_summary with (security_invoker = true) as
select p.id as product_id, p.name, p.sku, p.unit, p.is_active, p.reorder_level,
       coalesce(sum(b.quantity_on_hand), 0) as on_hand, coalesce(sum(b.quantity_reserved), 0) as reserved,
       coalesce(sum(b.quantity_on_hand - b.quantity_reserved), 0) as available,
       min(b.expires_on) filter (where b.quantity_on_hand > 0) as nearest_expiry,
       coalesce(sum(b.quantity_on_hand * coalesce(b.unit_cost_minor, 0)), 0)::bigint as stock_value_minor,
       (coalesce(sum(b.quantity_on_hand - b.quantity_reserved), 0) <= p.reorder_level and p.reorder_level > 0) as is_low
  from public.products p left join public.inventory_batches b on b.product_id = p.id
 group by p.id;

-- ── Permissions: no API access to internals; service-only functions are for the server ───────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (
              '_need','_post_journal','_reverse_journal','_order_event','_eval_coupon','_allocate_discount','_deduct_stock','_restore_stock','check_coupon') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  execute 'grant execute on function public.check_coupon(text,text,bigint) to service_role';
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (
              'write_audit','create_order','set_order_status','record_payment','update_order_details','add_order_note','convert_enquiry_to_customer',
              'mark_referral_rewarded','reject_referral','create_purchase','receive_purchase','cancel_purchase','record_purchase_payment',
              'add_opening_stock','adjust_stock','post_manual_journal','reverse_journal','account_balances','finance_summary','receivables','payables') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

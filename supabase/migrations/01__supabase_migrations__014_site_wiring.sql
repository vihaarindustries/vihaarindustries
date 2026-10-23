-- 014: connects the website to the control room.
--  1. place_retail_order(): the function the website checkout calls. It was missing, so website orders never reached Orders.
--  2. Content managers may save Business information (the control room already allowed it, the database refused it).
--  3. Repairs saved settings: makes sure the menu / business details are public, and the menu has "Track order".
-- Safe to run more than once.

-- ── 1. Website checkout ───────────────────────────────────────────────────────────────────────────
create or replace function public.place_retail_order(
  p_name text, p_email text, p_phone text, p_address jsonb, p_items jsonb,
  p_coupon_code text default null, p_notes text default null, p_payment_method text default 'cod')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c customers; v_email text := lower(trim(coalesce(p_email, ''))); v_order uuid; v_num text;
  it jsonb; p products; v_qty numeric; v_price bigint; v_coupon jsonb; v_disc bigint := 0; v_promo uuid; v_min numeric;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 160 then raise exception 'Please enter your name.' using errcode = 'VI001'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254 then raise exception 'Please enter a valid email address.' using errcode = 'VI001'; end if;
  if char_length(trim(coalesce(p_phone, ''))) < 7 then raise exception 'Please enter a phone number we can reach you on.' using errcode = 'VI001'; end if;
  if char_length(trim(coalesce(p_address->>'line1', ''))) < 3 or char_length(trim(coalesce(p_address->>'city', ''))) < 2 then
    raise exception 'Please enter your delivery address and city.' using errcode = 'VI001'; end if;
  if p_payment_method not in ('cod', 'bank_upi') then raise exception 'Please choose a payment method.' using errcode = 'VI001'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Your cart is empty.' using errcode = 'VI001'; end if;

  -- the same email always maps to the same customer record, so repeat buyers and tracking work
  select * into c from customers where lower(email) = v_email order by created_at limit 1;
  if not found then
    insert into customers(customer_type, name, email, phone, address, source)
    values ('retail', left(trim(p_name), 160), v_email, left(trim(p_phone), 40), p_address, 'website') returning * into c;
  else
    if c.is_blocked then raise exception 'We are unable to take orders from this account. Please contact us.' using errcode = 'VI001'; end if;
    update customers set phone = coalesce(nullif(left(trim(p_phone), 40), ''), phone), address = p_address where id = c.id;
  end if;

  v_num := 'VI-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  insert into orders(order_number, user_id, customer_id, order_type, status, shipping_address, billing_address, shipping_minor, notes, payment_provider)
  values (v_num, c.user_id, c.id, 'retail', 'pending_payment', p_address, p_address, 0, left(p_notes, 4000), p_payment_method)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid;
    if not found or not p.is_active or not p.is_retail_available then
      raise exception 'One of the products in your cart is no longer available. Please review your cart.' using errcode = 'VI001'; end if;
    v_qty := (it->>'quantity')::numeric;
    v_min := greatest(coalesce(p.min_order_quantity, 0), 0);
    if v_qty is null or v_qty <= 0 or v_qty > 9999 then raise exception 'Invalid quantity for %.', p.name using errcode = 'VI001'; end if;
    if v_qty < v_min then raise exception 'The minimum order for % is % %.', p.name, v_min, p.unit using errcode = 'VI001'; end if;
    -- the price is always read from the database, never trusted from the browser
    v_price := public.effective_price_minor(p.retail_price_minor, p.discount_type, p.discount_value, p.discount_starts_at, p.discount_ends_at);
    if v_price is null then raise exception '% cannot be ordered online yet. Please send us an enquiry.', p.name using errcode = 'VI001'; end if;
    insert into order_items(order_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price_minor, tax_rate, tax_minor, line_total_minor, discount_minor)
    values (v_order, p.id, p.name, p.sku, v_qty, v_price, p.tax_rate, 0, 0, 0);
  end loop;

  if p_coupon_code is not null and char_length(trim(p_coupon_code)) > 0 then
    v_coupon := public._eval_coupon(p_coupon_code, c.id, v_order, 'retail');
    v_disc := (v_coupon->>'discount_minor')::bigint;
    perform public._allocate_discount(v_order, v_disc,
      array(select jsonb_array_elements_text(v_coupon->'product_ids'))::uuid[], array(select jsonb_array_elements_text(v_coupon->'category_ids'))::uuid[]);
    v_promo := (v_coupon->>'promotion_id')::uuid;
    insert into promotion_redemptions(promotion_id, user_id, customer_id, order_id, discount_minor) values (v_promo, c.user_id, c.id, v_order, v_disc);
    update promotions set uses_count = uses_count + 1 where id = v_promo;
    update orders set coupon_id = v_promo where id = v_order;
  end if;

  update order_items set
    tax_minor = round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100),
    line_total_minor = (round(quantity * unit_price_minor) - discount_minor) + round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100)
  where order_id = v_order;
  update orders o set subtotal_minor = s.sub, discount_minor = s.disc, tax_minor = s.tax, total_minor = s.sub - s.disc + s.tax + o.shipping_minor
    from (select coalesce(sum(round(quantity * unit_price_minor)), 0)::bigint sub, coalesce(sum(discount_minor), 0)::bigint disc, coalesce(sum(tax_minor), 0)::bigint tax
            from order_items where order_id = v_order) s
   where o.id = v_order;

  perform public._order_event(v_order, 'created', null, 'pending_payment',
    case p_payment_method when 'cod' then 'Order received. Pay on delivery.' else 'Order received. We will send UPI / bank payment details.' end, true);
  return (select jsonb_build_object('order_number', order_number, 'total_minor', total_minor) from orders where id = v_order);
end; $$;

revoke all on function public.place_retail_order(text, text, text, jsonb, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.place_retail_order(text, text, text, jsonb, jsonb, text, text, text) to service_role;

-- ── 2. Content managers can save Business information ────────────────────────────────────────────
drop policy if exists "settings insert" on public.site_settings;
drop policy if exists "settings update" on public.site_settings;
create policy "settings insert" on public.site_settings for insert
  with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge','business_profile') and public.is_content()));
create policy "settings update" on public.site_settings for update
  using (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge','business_profile') and public.is_content()))
  with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge','business_profile') and public.is_content()));

-- ── 3. Repair saved settings ─────────────────────────────────────────────────────────────────────
update public.site_settings set is_public = true where key in ('nav_visibility', 'business_profile', 'chatbot_config') and is_public is distinct from true;

update public.site_settings
   set value = jsonb_set(value, '{items}', coalesce(value->'items', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('key','track','label','Track order','href','/track','visible',true)))
 where key = 'nav_visibility'
   and not exists (select 1 from jsonb_array_elements(coalesce(value->'items', '[]'::jsonb)) e where e->>'key' = 'track' or e->>'href' like '/track%');

-- the old seed heading described the former combined home page; the Retail page now uses this heading
update public.site_sections set title = 'From our kitchen shelf to yours.'
 where section_key = 'capabilities' and title = 'One ingredient partner. Two ways to work.';

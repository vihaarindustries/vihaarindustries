-- 015_signin_cod_shipping.sql
-- 1. Orders can only be placed by a signed-in customer (the order is linked to their account).
-- 2. Cash on delivery can be switched on / off per product (Control room -> Products).
-- 3. Order flow: Placed -> Accepted -> Shipped (courier + tracking ID) -> Delivered.
--    ship_order() ships an accepted order and saves the courier, tracking ID and link in one step.
-- Run once in the Supabase SQL editor, after 014. Safe to run more than once.

-- ── 1. Per-product Cash on delivery switch ───────────────────────────────────────────────────────
-- Existing products stay COD-enabled (that is how checkout behaved before). Switch it off per product in the control room.
alter table public.products add column if not exists is_cod_available boolean not null default true;

-- ── 2. Website checkout: needs a signed-in user, enforces COD per product ────────────────────────
drop function if exists public.place_retail_order(text, text, text, jsonb, jsonb, text, text, text);

create or replace function public.place_retail_order(
  p_user_id uuid,
  p_name text, p_email text, p_phone text, p_address jsonb, p_items jsonb,
  p_coupon_code text default null, p_notes text default null, p_payment_method text default 'cod')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c customers; v_email text := lower(trim(coalesce(p_email, ''))); v_order uuid; v_num text;
  it jsonb; p products; v_qty numeric; v_price bigint; v_coupon jsonb; v_disc bigint := 0; v_promo uuid; v_min numeric;
begin
  if p_user_id is null or not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Please sign in to place your order.' using errcode = 'VI001'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 160 then raise exception 'Please enter your name.' using errcode = 'VI001'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254 then raise exception 'Please enter a valid email address.' using errcode = 'VI001'; end if;
  if char_length(trim(coalesce(p_phone, ''))) < 7 then raise exception 'Please enter a phone number we can reach you on.' using errcode = 'VI001'; end if;
  if char_length(trim(coalesce(p_address->>'line1', ''))) < 3 or char_length(trim(coalesce(p_address->>'city', ''))) < 2 then
    raise exception 'Please enter your delivery address and city.' using errcode = 'VI001'; end if;
  if p_payment_method not in ('cod', 'bank_upi') then raise exception 'Please choose a payment method.' using errcode = 'VI001'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Your cart is empty.' using errcode = 'VI001'; end if;

  -- one customer record per account: first the account's own record, then an older guest record with the same email
  select * into c from customers where user_id = p_user_id;
  if not found then
    select * into c from customers where lower(email) = v_email and user_id is null order by created_at limit 1;
    if found then update customers set user_id = p_user_id where id = c.id returning * into c; end if;
  end if;
  if not found then
    insert into customers(user_id, customer_type, name, email, phone, address, source)
    values (p_user_id, 'retail', left(trim(p_name), 160), v_email, left(trim(p_phone), 40), p_address, 'website') returning * into c;
  else
    if c.is_blocked then raise exception 'We are unable to take orders from this account. Please contact us.' using errcode = 'VI001'; end if;
    update customers set phone = coalesce(nullif(left(trim(p_phone), 40), ''), phone), address = p_address where id = c.id;
  end if;

  v_num := 'VI-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  insert into orders(order_number, user_id, customer_id, order_type, status, shipping_address, billing_address, shipping_minor, notes, payment_provider)
  values (v_num, p_user_id, c.id, 'retail', 'pending_payment', p_address, p_address, 0, left(p_notes, 4000), p_payment_method)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid;
    if not found or not p.is_active or not p.is_retail_available then
      raise exception 'One of the products in your cart is no longer available. Please review your cart.' using errcode = 'VI001'; end if;
    -- Cash on delivery is decided per product by the admin
    if p_payment_method = 'cod' and not p.is_cod_available then
      raise exception 'Cash on delivery is not available for %. Please choose UPI / bank transfer.', p.name using errcode = 'VI001'; end if;
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
    insert into promotion_redemptions(promotion_id, user_id, customer_id, order_id, discount_minor) values (v_promo, p_user_id, c.id, v_order, v_disc);
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

  -- "pending_payment" is the database name for the first stage; customers and staff see it as "Placed"
  perform public._order_event(v_order, 'created', null, 'pending_payment',
    case p_payment_method when 'cod' then 'Order placed. Pay on delivery. We will let you know once it is accepted.' else 'Order placed. We will send UPI / bank payment details once it is accepted.' end, true);
  return (select jsonb_build_object('order_number', order_number, 'total_minor', total_minor) from orders where id = v_order);
end; $$;

revoke all on function public.place_retail_order(uuid, text, text, text, jsonb, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.place_retail_order(uuid, text, text, text, jsonb, jsonb, text, text, text) to service_role;

-- ── 3. Ship an accepted order with courier + tracking ID ─────────────────────────────────────────
-- Moves the order Accepted -> Shipped in one step (stock is taken from the oldest-expiry batches and the sales entry is
-- booked exactly as before), and stores the courier, tracking ID and tracking link. The customer sees a "Shipped" update.
create or replace function public.ship_order(
  p_order uuid, p_courier text, p_tracking text, p_tracking_url text default null,
  p_expected date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_courier text := left(nullif(trim(coalesce(p_courier, '')), ''), 60); v_track text := left(nullif(trim(coalesce(p_tracking, '')), ''), 80);
        v_url text := nullif(trim(coalesce(p_tracking_url, '')), ''); v_msg text;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if v_courier is null then raise exception 'Enter the courier company name.'; end if;
  if v_track is null then raise exception 'Enter the tracking ID.'; end if;
  if v_url is not null and (v_url !~* '^https://[^\s]+$' or char_length(v_url) > 300 or char_length(v_url) < 12) then raise exception 'Tracking link must start with https://'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status::text not in ('confirmed','processing','packed') then
    raise exception 'Only an accepted order can be shipped. This order is %.', o.status; end if;

  update orders set courier_provider = v_courier, courier_reference = v_track, tracking_url = v_url,
         expected_delivery = coalesce(p_expected, expected_delivery) where id = p_order;

  -- the in-between steps happen silently; the customer only sees "Shipped"
  if o.status::text = 'confirmed' then perform public.set_order_status(p_order, 'processing', 'Preparing your order.', false); end if;
  if o.status::text in ('confirmed','processing') then perform public.set_order_status(p_order, 'packed', 'Order packed.', false); end if;

  v_msg := coalesce(nullif(trim(p_note), ''), 'Your order has been shipped.') || ' Courier: ' || v_courier || '. Tracking ID: ' || v_track || '.';
  perform public.set_order_status(p_order, 'shipped', v_msg, true);
  perform public.write_audit('order.ship', 'order', p_order::text, null, jsonb_build_object('courier', v_courier, 'tracking', v_track), null);
end; $$;

revoke all on function public.ship_order(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.ship_order(uuid, text, text, text, date, text) to authenticated, service_role;

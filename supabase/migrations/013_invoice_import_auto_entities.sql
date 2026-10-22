-- Resolve new suppliers/products and create the approved purchase in one database transaction.
-- This function is called only after the user has reviewed the original invoice and explicitly approved it.
create or replace function public.create_purchase_from_invoice(
  p_items jsonb,
  p_supplier uuid default null,
  p_supplier_name text default null,
  p_location uuid default null,
  p_expected date default null,
  p_invoice text default null,
  p_shipping_minor bigint default 0,
  p_notes text default null,
  p_invoice_date date default null,
  p_source_file_name text default null,
  p_source_file_sha256 text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_supplier uuid;
  v_supplier_name text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_product uuid;
  v_product_name text;
  v_slug text;
  v_base_slug text;
  v_result uuid;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'A purchase needs between 1 and 100 invoice lines.';
  end if;

  if p_supplier is not null then
    select id into v_supplier from public.suppliers where id = p_supplier and is_active;
    if v_supplier is null then raise exception 'The selected supplier is no longer active. Review the supplier and retry.'; end if;
  else
    v_supplier_name := nullif(trim(p_supplier_name), '');
    if v_supplier_name is null or char_length(v_supplier_name) > 180 then
      raise exception 'Enter or select a valid supplier name before approving.';
    end if;
    select id into v_supplier from public.suppliers where lower(trim(name)) = lower(v_supplier_name) and is_active order by created_at limit 1;
    if v_supplier is null then
      insert into public.suppliers(name, country_code, is_active) values (v_supplier_name, 'IN', true) returning id into v_supplier;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product := nullif(v_item->>'product_id', '')::uuid;
    v_product_name := nullif(trim(v_item->>'product_name'), '');
    if v_product is null then
      if v_product_name is null or char_length(v_product_name) > 120 then
        raise exception 'Each new product needs a reviewed name of 1 to 120 characters.';
      end if;
      select id into v_product from public.products where lower(trim(name)) = lower(v_product_name) order by created_at limit 1;
      if v_product is null then
        v_base_slug := trim(both '-' from regexp_replace(lower(v_product_name), '[^a-z0-9]+', '-', 'g'));
        if v_base_slug = '' then v_base_slug := 'invoice-item'; end if;
        v_slug := left(v_base_slug, 70);
        if exists (select 1 from public.products where slug = v_slug) then
          v_slug := left(v_base_slug, 60) || '-' || substr(md5(v_product_name || clock_timestamp()::text), 1, 8);
        end if;
        insert into public.products(name, slug, unit, tax_rate, is_active, is_featured)
        values (v_product_name, v_slug, 'kg', coalesce((v_item->>'tax_rate')::numeric, 0), false, false)
        returning id into v_product;
      end if;
    elsif not exists (select 1 from public.products where id = v_product) then
      raise exception 'A selected product no longer exists. Review the invoice line and retry.';
    end if;
    v_items := v_items || jsonb_build_array(
      (v_item - 'product_name') || jsonb_build_object('product_id', v_product)
    );
  end loop;

  v_result := public.create_purchase(
    p_supplier := v_supplier,
    p_items := v_items,
    p_location := p_location,
    p_expected := p_expected,
    p_invoice := p_invoice,
    p_shipping_minor := coalesce(p_shipping_minor, 0),
    p_notes := p_notes,
    p_invoice_date := p_invoice_date,
    p_source_file_name := p_source_file_name,
    p_source_file_sha256 := p_source_file_sha256
  );
  return v_result;
end;
$$;

revoke all on function public.create_purchase_from_invoice(jsonb, uuid, text, uuid, date, text, bigint, text, date, text, text) from public, anon;
grant execute on function public.create_purchase_from_invoice(jsonb, uuid, text, uuid, date, text, bigint, text, date, text, text) to authenticated;

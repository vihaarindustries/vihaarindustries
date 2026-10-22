-- Invoice import metadata. Original invoice files and OCR drafts remain browser-local.
alter table public.purchase_orders
  add column if not exists supplier_invoice_date date,
  add column if not exists source_file_name text,
  add column if not exists source_file_sha256 text;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_source_file_name_length_check;
alter table public.purchase_orders
  add constraint purchase_orders_source_file_name_length_check
  check (source_file_name is null or char_length(source_file_name) between 1 and 255);

alter table public.purchase_orders
  drop constraint if exists purchase_orders_source_file_sha256_format_check;
alter table public.purchase_orders
  add constraint purchase_orders_source_file_sha256_format_check
  check (source_file_sha256 is null or source_file_sha256 ~ '^[a-f0-9]{64}$');

-- One file fingerprint can only be accepted once. This is a safety net, not a substitute
-- for checking supplier + invoice number + date + amount when duplicate bills have different files.
create unique index if not exists purchase_orders_source_file_sha256_uidx
  on public.purchase_orders (source_file_sha256)
  where source_file_sha256 is not null;

-- Replace the old function signature so PostgREST has one unambiguous create_purchase RPC.
drop function if exists public.create_purchase(uuid, jsonb, uuid, date, text, bigint, text);
drop function if exists public.create_purchase(uuid, jsonb, uuid, date, text, bigint, text, date, text, text);

create function public.create_purchase(
  p_supplier uuid,
  p_items jsonb,
  p_location uuid default null,
  p_expected date default null,
  p_invoice text default null,
  p_shipping_minor bigint default 0,
  p_notes text default null,
  p_invoice_date date default null,
  p_source_file_name text default null,
  p_source_file_sha256 text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_po uuid; v_num text; it jsonb; v_qty numeric; v_cost bigint; v_rate numeric;
  v_line bigint; v_sub bigint := 0; v_tax bigint := 0;
begin
  perform public._need(array['owner','admin','operations']::public.app_role[]);
  if not exists (select 1 from suppliers where id = p_supplier and is_active) then
    raise exception 'Choose an active supplier.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'A purchase needs between 1 and 100 items.';
  end if;
  if p_shipping_minor < 0 then raise exception 'Shipping cannot be negative.'; end if;
  if p_source_file_name is not null and char_length(p_source_file_name) not between 1 and 255 then
    raise exception 'The source filename is invalid.';
  end if;
  if p_source_file_sha256 is not null and p_source_file_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'The source file fingerprint is invalid.';
  end if;
  if p_source_file_sha256 is not null and exists (
    select 1 from purchase_orders where source_file_sha256 = p_source_file_sha256
  ) then
    raise exception 'This exact invoice file has already been imported. Check the existing purchase before retrying.';
  end if;

  v_num := 'PO-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.po_number_seq')::text, 5, '0');
  insert into purchase_orders(
    po_number, supplier_id, status, location_id, expected_date, invoice_number,
    supplier_invoice_date, shipping_minor, notes, created_by, source_file_name, source_file_sha256
  ) values (
    v_num, p_supplier, 'ordered', p_location, p_expected, left(p_invoice, 60),
    p_invoice_date, p_shipping_minor, left(p_notes, 2000), auth.uid(),
    left(p_source_file_name, 255), p_source_file_sha256
  ) returning id into v_po;

  for it in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from products where id = (it->>'product_id')::uuid) then
      raise exception 'A product in this purchase no longer exists.';
    end if;
    v_qty := (it->>'quantity')::numeric;
    v_cost := (it->>'unit_cost_minor')::bigint;
    v_rate := coalesce((it->>'tax_rate')::numeric, 0);
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 or v_rate < 0 or v_rate > 100 then
      raise exception 'Check quantity, cost and tax rate on each line.';
    end if;
    v_line := round(v_qty * v_cost);
    insert into purchase_order_items(
      purchase_order_id, product_id, quantity, unit_cost_minor, tax_rate,
      batch_number, manufactured_on, expires_on, line_total_minor
    ) values (
      v_po, (it->>'product_id')::uuid, v_qty, v_cost, v_rate,
      left(nullif(trim(it->>'batch_number'), ''), 60),
      nullif(it->>'manufactured_on', '')::date,
      nullif(it->>'expires_on', '')::date, v_line
    );
    v_sub := v_sub + v_line;
    v_tax := v_tax + round(v_line * v_rate / 100);
  end loop;
  update purchase_orders set subtotal_minor = v_sub, tax_minor = v_tax,
    total_minor = v_sub + v_tax + p_shipping_minor where id = v_po;
  perform public.write_audit(
    'purchase.create', 'purchase_order', v_po::text, null,
    jsonb_build_object('po_number', v_num, 'source_file_name', left(p_source_file_name, 255), 'invoice_number', left(p_invoice, 60)), null
  );
  return v_po;
end; $$;

revoke all on function public.create_purchase(uuid, jsonb, uuid, date, text, bigint, text, date, text, text) from public, anon;
grant execute on function public.create_purchase(uuid, jsonb, uuid, date, text, bigint, text, date, text, text) to authenticated;

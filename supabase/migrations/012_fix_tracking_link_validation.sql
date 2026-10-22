-- 012_fix_tracking_link_validation.sql
-- Fixes: saving a tracking link failed with "invalid regular expression: invalid repetition count(s)"
-- because Postgres allows at most 255 repeats in a pattern. Same function as migration 006, with the
-- link check rewritten as a pattern plus a length check. Run once in the Supabase SQL editor.

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
  if v_url is not null and (v_url !~* '^https://[^\s]+$' or char_length(v_url) > 300 or char_length(v_url) < 12) then raise exception 'Tracking link must start with https://'; end if;
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

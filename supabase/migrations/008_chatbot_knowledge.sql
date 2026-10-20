-- 008: chatbot knowledge text is private (staff only). The chat server route reads it with the service role,
-- so it can inform answers without ever being readable through the public API.
drop policy if exists "settings insert" on public.site_settings;
drop policy if exists "settings update" on public.site_settings;
create policy "settings insert" on public.site_settings for insert
  with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge') and public.is_content()));
create policy "settings update" on public.site_settings for update
  using (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge') and public.is_content()))
  with check (public.is_admin_role() or (key in ('nav_visibility','chatbot_config','chatbot_knowledge') and public.is_content()));
-- move any text already saved in the public config into the private key, then remove it from the public one
insert into public.site_settings(key, value, is_public)
select 'chatbot_knowledge', jsonb_build_object('text', coalesce(value->>'knowledge', '')), false from public.site_settings where key = 'chatbot_config'
on conflict (key) do nothing;
update public.site_settings set value = value - 'knowledge' where key = 'chatbot_config';

-- 017_google_profile_name.sql
-- Google sign-in supplies the person's name as "name" / "full_name". Save whichever is present on the new profile,
-- and fill in the name for any existing profile that was left blank. Safe to run more than once.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, role)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), ''), 'customer')
  on conflict (id) do nothing;
  return new;
end; $$;

update public.profiles p
   set full_name = coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''))
  from auth.users u
 where u.id = p.id and coalesce(p.full_name, '') = '' and coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', '')) is not null;

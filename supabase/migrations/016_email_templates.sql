-- 016_email_templates.sql
-- Editable customer emails (Control room -> Email templates) and a log of what was sent.
-- Run once in the Supabase SQL editor, after 015. Safe to run more than once.
--
-- Only emails you have CHANGED are stored here. Anything not stored uses the built-in wording from the code
-- (lib/email/events.ts), so the site works the moment this is deployed. "Reset to default" simply deletes the row.

create table if not exists public.email_templates (
  event_key    text primary key check (event_key ~ '^[a-z_]{3,40}$'),
  subject      text not null check (char_length(subject) between 1 and 200),
  body         text not null check (char_length(body) between 1 and 5000),
  button_label text check (button_label is null or char_length(button_label) <= 40),
  enabled      boolean not null default true,
  updated_by   uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);
drop trigger if exists email_templates_touch on public.email_templates;
create trigger email_templates_touch before update on public.email_templates for each row execute function public.touch_updated_at();

create table if not exists public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  event_key           text not null,
  to_email            text not null,
  subject             text,
  status              text not null check (status in ('sent', 'failed', 'skipped')),
  error               text,
  provider_message_id text,
  order_number        text,
  created_at          timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_templates enable row level security;
alter table public.email_log enable row level security;

-- Owners and admins (with two-step verification) can read and edit templates and read the log.
-- The website server writes the log with the service-role key, which bypasses these rules.
drop policy if exists "email templates admin" on public.email_templates;
create policy "email templates admin" on public.email_templates for all using (public.is_admin_role()) with check (public.is_admin_role());
drop policy if exists "email log admin read" on public.email_log;
create policy "email log admin read" on public.email_log for select using (public.is_admin_role());

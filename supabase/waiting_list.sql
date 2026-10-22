-- Waiting list for the Waiting List page.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.waiting_list (
  id             text primary key,
  name           text not null,
  phone          text,
  unit_type      text not null check (unit_type in ('Shop', 'Space')),
  trade          text,
  requested_date date not null default current_date,
  notes          text,
  status         text not null default 'Waiting' check (status in ('Waiting', 'Leased', 'Removed')),
  leased_unit    text,
  created_at     timestamptz not null default now()
);

-- Same access as the app's other tables (the app signs in with the anon key).
alter table public.waiting_list enable row level security;

drop policy if exists "waiting_list app access" on public.waiting_list;
create policy "waiting_list app access" on public.waiting_list
  for all to anon, authenticated
  using (true)
  with check (true);

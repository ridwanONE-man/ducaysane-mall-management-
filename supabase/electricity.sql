-- Electricity charges for the Daily Electricity Report page (its own table).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.electricity (
  id               text primary key,
  reference_number text not null,
  date             date not null default current_date,
  unit_number      text not null,
  unit_type        text not null default 'Shop' check (unit_type in ('Shop', 'Space')),
  tenant_name      text,
  amount           numeric(14, 2) not null default 0 check (amount >= 0),
  currency         text not null default 'USD' check (currency in ('USD', 'SSP')),
  kwh              numeric(12, 2),
  notes            text,
  recorded_by      text,
  created_at       timestamptz not null default now()
);

create index if not exists electricity_date_idx on public.electricity (date);

-- Same access as the app's other tables (the app signs in with the anon key).
alter table public.electricity enable row level security;

drop policy if exists "electricity app access" on public.electricity;
create policy "electricity app access" on public.electricity
  for all to anon, authenticated
  using (true)
  with check (true);

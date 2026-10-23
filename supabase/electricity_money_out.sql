-- Adds Money Out to the electricity table (run once, after electricity.sql).
-- Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Existing rows stay as money in.

alter table public.electricity
  add column if not exists direction text not null default 'In';

alter table public.electricity
  drop constraint if exists electricity_direction_check;

alter table public.electricity
  add constraint electricity_direction_check check (direction in ('In', 'Out'));

-- Accounts and security for Nyakuron Business Centre.
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run,
-- AFTER creating the admin login (ducaysane@gmail.com) under Authentication → Users.
--
-- What it does:
--  * app_users: every login with its name and role (admin or viewer).
--  * Only the admin can change data. Viewers can read (and print) only.
--  * Nobody can use the data without logging in.
--  * The old admin_credentials table (password readable by anyone) is locked.

-- ---------------------------------------------------------------------------
-- 1. Accounts
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null default '',
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- The main admin
insert into public.app_users (id, email, name, role)
select id, lower(email), 'Mohamed Mohamoud', 'admin'
from auth.users
where lower(email) = 'ducaysane@gmail.com'
on conflict (id) do update set role = 'admin', active = true;

-- ---------------------------------------------------------------------------
-- 2. Who is who
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'ducaysane@gmail.com'
      or exists (select 1 from public.app_users where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or exists (select 1 from public.app_users where id = auth.uid() and active);
$$;

-- ---------------------------------------------------------------------------
-- 3. Admin tools (only the admin can call them)
-- ---------------------------------------------------------------------------
-- A new account can log in straight away (no email confirmation needed)
create or replace function public.admin_confirm_user(uid uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = uid;
end;
$$;

-- Set a new password for an account (e.g. when someone forgot theirs)
create or replace function public.admin_set_password(uid uuid, new_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this'; end if;
  if length(coalesce(new_password, '')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = uid;
end;
$$;

-- Delete an account (never the main admin)
create or replace function public.admin_delete_user(uid uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this'; end if;
  if exists (select 1 from auth.users where id = uid and lower(email) = 'ducaysane@gmail.com') then
    raise exception 'The main admin account cannot be deleted';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.admin_confirm_user(uuid) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_confirm_user(uuid) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. app_users access: you see yourself; the admin sees and manages everyone
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;
drop policy if exists "app_users read" on public.app_users;
drop policy if exists "app_users admin write" on public.app_users;
create policy "app_users read" on public.app_users
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "app_users admin write" on public.app_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Business data: logged-in accounts read, only the admin writes
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['units', 'tenants', 'payments', 'deposits', 'cashflow_transactions', 'waiting_list', 'electricity'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "read when logged in" on public.%I for select to authenticated using (public.is_active_user())', t);
    execute format('create policy "admin writes" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Lock the old password table (the app no longer uses it)
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  if to_regclass('public.admin_credentials') is not null then
    alter table public.admin_credentials enable row level security;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'admin_credentials' loop
      execute format('drop policy %I on public.admin_credentials', p.policyname);
    end loop;
    revoke all on public.admin_credentials from anon, authenticated;
  end if;
end $$;

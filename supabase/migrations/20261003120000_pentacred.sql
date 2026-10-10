-- Migration: 20261003120000_pentacred.sql
-- Description: Five-credential identity layer (IMAIL, PASSWORD, UUID, UKEY, UMAIL)
-- Canonical schema for roles, profiles, UKEY sequence, trigger on auth.users, and RLS policies.

-- 1. Create Roles Table
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  level int not null,
  permissions text[] not null default '{}'
);

-- Seed canonical roles
insert into public.roles (name, level, permissions) values
  ('Member', 1, '{}'),
  ('Staff', 3, '{}'),
  ('Officer', 7, '{}'),
  ('Adviser', 8, '{}'),
  ('Principal', 9, '{}'),
  ('Admin', 10, '{}')
on conflict (name) do nothing;

-- 2. Create UKEY Sequence
create sequence if not exists public.ukey_seq start 1;

-- 3. Create Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ukey text unique not null,
  imail text unique not null,
  umail text unique,
  role_id uuid references public.roles(id) not null,
  status text not null default 'pending'
    check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  setup_completed_at timestamptz
);

-- Indexes for efficient lookup
create index if not exists idx_profiles_role_id on public.profiles(role_id);
create index if not exists idx_profiles_status on public.profiles(status);

-- 4. Officer Check Function (Security Definer to prevent RLS recursion)
create or replace function public.is_officer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.level >= 7
  );
$$;

-- 5. Trigger to populate profiles on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
  generated_ukey text;
begin
  -- Resolve default 'Member' role
  select id into default_role_id from public.roles where name = 'Member' limit 1;
  if default_role_id is null then
    insert into public.roles (name, level, permissions)
    values ('Member', 1, '{}')
    returning id into default_role_id;
  end if;

  -- Generate UKEY: GMS + zero-padded 3-digit sequence (GMS001, GMS042, etc.)
  generated_ukey := 'GMS' || lpad(nextval('public.ukey_seq')::text, 3, '0');

  -- Insert profile row
  insert into public.profiles (
    id,
    ukey,
    imail,
    umail,
    role_id,
    status,
    created_at,
    setup_completed_at
  ) values (
    new.id,
    generated_ukey,
    new.email,
    null,
    default_role_id,
    'pending',
    now(),
    null
  );

  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Trigger to prevent tampering with immutable/privileged profile columns
create or replace function public.check_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If not an officer/admin, enforce strict immutability
  if not public.is_officer() then
    if new.id <> old.id then
      raise exception 'Profile ID is immutable.';
    end if;
    if new.ukey <> old.ukey then
      raise exception 'UKEY is immutable.';
    end if;
    if new.imail <> old.imail then
      raise exception 'IMAIL cannot be altered by user.';
    end if;
    if new.role_id <> old.role_id then
      raise exception 'Role cannot be altered by user.';
    end if;
    if old.status = 'active' and new.status <> 'active' then
      raise exception 'Status cannot be reverted once active.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_check_profile_update on public.profiles;
create trigger tr_check_profile_update
  before update on public.profiles
  for each row execute function public.check_profile_update();

-- 7. Enable Row Level Security (RLS)
alter table public.roles enable row level security;
alter table public.profiles enable row level security;

-- RLS Policies on roles
drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
  on public.roles
  for select
  to authenticated
  using (true);

-- RLS Policies on profiles:
-- select: user can read their own row; officers (level >= 7) can read all; public cannot read any.
drop policy if exists "profiles_select_own_or_officer" on public.profiles;
create policy "profiles_select_own_or_officer"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_officer()
  );

-- update: user can update only their own umail and setup_completed_at,
-- while status = 'pending' or when changing umail post-setup.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (
    auth.uid() = id
    and (status = 'pending' or status = 'active')
  )
  with check (
    auth.uid() = id
    and (status in ('pending', 'active'))
  );

-- No insert or delete policy for clients: inserts happen via trigger or admin function only.

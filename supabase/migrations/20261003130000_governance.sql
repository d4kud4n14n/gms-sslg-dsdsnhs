-- Migration: 20261003130000_governance.sql
-- Description: Core governance schema for workspaces, meetings, attendance, resolutions, and backwards-compatible users view.
-- Adheres strictly to the Pentacred framework: Foreign keys reference profiles.ukey (the Universal Foreign Key).

-- ============================================================================
-- 1. Workspaces Table
-- ============================================================================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null default '',
  chair_ukey text references public.profiles(ukey) on update cascade on delete set null,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspaces_code on public.workspaces(code);
create index if not exists idx_workspaces_chair on public.workspaces(chair_ukey);

-- ============================================================================
-- 2. Workspace Members Table
-- ============================================================================
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_ukey text not null references public.profiles(ukey) on update cascade on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  constraint uq_workspace_member unique (workspace_id, user_ukey)
);

create index if not exists idx_workspace_members_ws on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_ukey);

-- ============================================================================
-- 3. Meetings Table
-- ============================================================================
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agenda text not null default '',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  minutes text not null default '',
  quorum_required int not null default 1,
  created_by text references public.profiles(ukey) on update cascade on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meetings_scheduled_at on public.meetings(scheduled_at);
create index if not exists idx_meetings_status on public.meetings(status);

-- ============================================================================
-- 4. Meeting Attendance Table
-- ============================================================================
create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_ukey text not null references public.profiles(ukey) on update cascade on delete cascade,
  status text not null default 'present'
    check (status in ('present', 'absent', 'excused')),
  signed_at timestamptz not null default now(),
  constraint uq_meeting_attendance unique (meeting_id, user_ukey)
);

create index if not exists idx_attendance_meeting on public.meeting_attendance(meeting_id);
create index if not exists idx_attendance_user on public.meeting_attendance(user_ukey);

-- ============================================================================
-- 5. Resolutions Table
-- ============================================================================
create table if not exists public.resolutions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'tabled')),
  author_ukey text references public.profiles(ukey) on update cascade on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_resolutions_status on public.resolutions(status);
create index if not exists idx_resolutions_created_at on public.resolutions(created_at);

-- ============================================================================
-- 6. Backwards-Compatible Public Users View
-- ============================================================================
-- Bridges legacy prototype queries (.from('users')) to canonical Pentacred profiles + roles.
create or replace view public.users as
select 
  p.id,
  p.ukey,
  p.imail as email,
  p.umail,
  p.status,
  r.name as role_code,
  coalesce(u.raw_user_meta_data->>'full_name', p.ukey) as full_name,
  coalesce(u.raw_user_meta_data->>'position', 'Staff Member') as position,
  u.raw_user_meta_data->>'designation' as designation,
  p.created_at,
  p.setup_completed_at
from public.profiles p
left join public.roles r on r.id = p.role_id
left join auth.users u on u.id = p.id;

-- Updatable view handler for role modifications via UserManagement
create or replace function public.handle_users_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role_id uuid;
begin
  if not public.is_officer() then
    raise exception 'Unauthorized to modify user roles.';
  end if;

  if new.role_code is distinct from old.role_code then
    select id into new_role_id from public.roles where upper(name) = upper(new.role_code) limit 1;
    if new_role_id is not null then
      update public.profiles set role_id = new_role_id where ukey = old.ukey;
    else
      raise exception 'Invalid role specified: %', new.role_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_users_view_update on public.users;
create trigger tr_users_view_update
  instead of update on public.users
  for each row execute function public.handle_users_view_update();

-- ============================================================================
-- 7. Row Level Security (RLS)
-- ============================================================================
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.resolutions enable row level security;

-- 7.1 Workspaces Policies
drop policy if exists "workspaces_select_authenticated" on public.workspaces;
create policy "workspaces_select_authenticated"
  on public.workspaces for select to authenticated
  using (true);

drop policy if exists "workspaces_write_officer" on public.workspaces;
create policy "workspaces_write_officer"
  on public.workspaces for all to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- 7.2 Workspace Members Policies
drop policy if exists "workspace_members_select_authenticated" on public.workspace_members;
create policy "workspace_members_select_authenticated"
  on public.workspace_members for select to authenticated
  using (true);

drop policy if exists "workspace_members_write_officer" on public.workspace_members;
create policy "workspace_members_write_officer"
  on public.workspace_members for all to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- 7.3 Meetings Policies
drop policy if exists "meetings_select_authenticated" on public.meetings;
create policy "meetings_select_authenticated"
  on public.meetings for select to authenticated
  using (true);

drop policy if exists "meetings_write_officer" on public.meetings;
create policy "meetings_write_officer"
  on public.meetings for all to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- 7.4 Meeting Attendance Policies
drop policy if exists "meeting_attendance_select_authenticated" on public.meeting_attendance;
create policy "meeting_attendance_select_authenticated"
  on public.meeting_attendance for select to authenticated
  using (true);

drop policy if exists "meeting_attendance_insert_self_or_officer" on public.meeting_attendance;
create policy "meeting_attendance_insert_self_or_officer"
  on public.meeting_attendance for insert to authenticated
  with check (
    public.is_officer()
    or user_ukey = (select ukey from public.profiles where id = auth.uid())
  );

drop policy if exists "meeting_attendance_update_officer" on public.meeting_attendance;
create policy "meeting_attendance_update_officer"
  on public.meeting_attendance for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- 7.5 Resolutions Policies
drop policy if exists "resolutions_select_authenticated" on public.resolutions;
create policy "resolutions_select_authenticated"
  on public.resolutions for select to authenticated
  using (true);

drop policy if exists "resolutions_insert_authenticated" on public.resolutions;
create policy "resolutions_insert_authenticated"
  on public.resolutions for insert to authenticated
  with check (
    author_ukey = (select ukey from public.profiles where id = auth.uid())
    or public.is_officer()
  );

drop policy if exists "resolutions_update_officer" on public.resolutions;
create policy "resolutions_update_officer"
  on public.resolutions for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

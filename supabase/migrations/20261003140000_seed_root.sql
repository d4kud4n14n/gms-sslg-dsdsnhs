-- Migration: 20261003140000_seed_root.sql
-- Description: Provision root@gms.internal sovereign development administrator account
-- Credentials for development:
--   IMAIL: root@gms.internal
--   UKEY: GMS000
--   Temporary (Default) Password: RootDev2026!
--   Role: Root (Level 11)
--   Status: pending (requires first-time password setup)

-- 1. Ensure Root role exists with highest privilege level
insert into public.roles (name, level, permissions) values
  ('Root', 11, '{"*"}')
on conflict (name) do update set level = 11, permissions = '{"*"}';

-- 2. Provision root user in auth.users and public.profiles
do $$
declare
  root_user_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  root_role_id uuid;
begin
  select id into root_role_id from public.roles where name = 'Root' limit 1;

  -- Upsert auth.users record with temporary password
  if not exists (select 1 from auth.users where email = 'root@gms.internal') then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      root_user_id,
      'authenticated',
      'authenticated',
      'root@gms.internal',
      crypt('RootDev2026!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"System Root Administrator","position":"System Root","designation":"Lead Technical Administrator","ukey":"GMS000"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  else
    select id into root_user_id from auth.users where email = 'root@gms.internal';
    update auth.users
    set encrypted_password = crypt('RootDev2026!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"full_name":"System Root Administrator","position":"System Root","designation":"Lead Technical Administrator","ukey":"GMS000"}'::jsonb
    where id = root_user_id;
  end if;

  -- Upsert public.profiles record with status 'pending' (enforcing first-login setup)
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
    root_user_id,
    'GMS000',
    'root@gms.internal',
    null,
    root_role_id,
    'pending',
    now(),
    null
  )
  on conflict (id) do update set
    ukey = 'GMS000',
    imail = 'root@gms.internal',
    role_id = root_role_id,
    status = 'pending',
    setup_completed_at = null;
end $$;

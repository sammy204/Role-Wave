-- Keep admin-facing identity separate from candidate/employer profile data.
-- Founder status and all existing is_founder_user() authorization remain on
-- public.profiles; this table only owns the name and lifecycle of the admin
-- workspace.

create table if not exists public.admin_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null,
  last_name text,
  welcome_email_sent_at timestamptz,
  access_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_first_name_not_blank check (length(trim(first_name)) > 0)
);

alter table public.admin_profiles enable row level security;

create policy admin_profiles_self_select
  on public.admin_profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy admin_profiles_self_update
  on public.admin_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Preserve all current admins by giving them an independent admin identity.
-- Candidate/employer profile names are copied once only; later admin edits
-- stay in this table and do not alter the other workspace's profile.
insert into public.admin_profiles (id, first_name, last_name, welcome_email_sent_at)
select
  p.id,
  coalesce(
    nullif(split_part(trim(coalesce(p.full_name, u.email::text)), ' ', 1), ''),
    'Admin'
  ),
  nullif(trim(regexp_replace(trim(coalesce(p.full_name, '')), '^\\S+\\s*', '')), ''),
  p.admin_welcome_email_sent_at
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true
on conflict (id) do nothing;

alter table public.admin_invites
  add column if not exists first_name text,
  add column if not exists last_name text;

-- New invite API. The old one-argument function is intentionally retained
-- for a safe rollout; new application code calls this named version.
create or replace function public.create_admin_invite(
  p_email text,
  p_first_name text,
  p_last_name text default null
)
returns admin_invites
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_first_name text := trim(p_first_name);
  v_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
  v_invite public.admin_invites;
begin
  if not public.is_founder_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  if v_first_name = '' then
    raise exception 'First name is required' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles pr
    join auth.users u on u.id = pr.id
    where lower(u.email) = v_email and pr.is_admin = true
  ) then
    raise exception 'That email already belongs to an admin' using errcode = '23505';
  end if;

  update public.admin_invites
  set revoked_at = now()
  where lower(email) = v_email
    and accepted_at is null
    and revoked_at is null;

  insert into public.admin_invites (email, first_name, last_name, invited_by)
  values (v_email, v_first_name, v_last_name, auth.uid())
  returning * into v_invite;

  return v_invite;
end;
$$;

-- Extend acceptance so the admin's display identity is created from the
-- founder-supplied invite name without changing their candidate/employer data.
create or replace function public.accept_admin_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invite public.admin_invites;
  v_caller_email text;
  v_existing_full_name text;
  v_first_name text;
  v_last_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.admin_invites
  where token = p_token
  for update;

  if not found or v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    return false;
  end if;

  select u.email, p.full_name into v_caller_email, v_existing_full_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  if v_caller_email is null or lower(v_caller_email) <> lower(v_invite.email) then
    return false;
  end if;

  v_first_name := coalesce(
    nullif(trim(v_invite.first_name), ''),
    nullif(split_part(trim(coalesce(v_existing_full_name, '')), ' ', 1), ''),
    nullif(split_part(v_caller_email, '@', 1), ''),
    'Admin'
  );
  v_last_name := nullif(trim(v_invite.last_name), '');

  perform set_config('rolewave.admin_grant_bypass', 'on', true);

  update public.profiles
  set is_admin = true
  where id = auth.uid();

  insert into public.admin_profiles (id, first_name, last_name, access_revoked_at, welcome_email_sent_at, updated_at)
  values (auth.uid(), v_first_name, v_last_name, null, null, now())
  on conflict (id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      access_revoked_at = null,
      welcome_email_sent_at = null,
      updated_at = now();

  update public.admin_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return true;
end;
$$;

-- Founder-only offboarding for accepted admins. A founder cannot remove a
-- founder, so the original founder controls and recovery path stay intact.
create or replace function public.revoke_admin_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_founder_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and is_founder = true) then
    raise exception 'Founder access cannot be revoked here' using errcode = '42501';
  end if;

  update public.profiles
  set is_admin = false
  where id = p_user_id
    and is_admin = true;

  if not found then
    raise exception 'Admin account not found' using errcode = 'P0002';
  end if;

  update public.admin_profiles
  set access_revoked_at = now(), updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.admin_list_team_members()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  is_founder boolean,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select
    p.id,
    u.email::text,
    coalesce(ap.first_name, nullif(split_part(trim(coalesce(p.full_name, u.email::text)), ' ', 1), ''), 'Admin'),
    ap.last_name,
    p.is_founder,
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.admin_profiles ap on ap.id = p.id
  where p.is_admin = true
    and public.is_founder_user()
  order by u.created_at asc;
$$;

grant execute on function public.create_admin_invite(text, text, text) to authenticated;
grant execute on function public.revoke_admin_access(uuid) to authenticated;
grant execute on function public.admin_list_team_members() to authenticated;
grant select on public.admin_profiles to authenticated;
grant update (first_name, last_name, updated_at) on public.admin_profiles to authenticated;

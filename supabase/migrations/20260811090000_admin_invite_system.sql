-- Admin invite system.
-- Locks down how the admin space is joined: founders invite by email from
-- the admin dashboard, and only the exact invited email can accept. There is
-- no self-serve path to is_admin outside this flow.

alter table public.profiles
  add column if not exists is_founder boolean not null default false;

-- Seed the two existing admins as founders. Founders are the only accounts
-- that can issue or revoke admin invites.
update public.profiles p
set is_founder = true
from auth.users u
where u.id = p.id
  and lower(u.email) in ('ogabisamuel99@gmail.com', 'leebola9@gmail.com');

create table if not exists public.admin_invites (
  id bigint generated always as identity primary key,
  email text not null,
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz
);

create unique index if not exists admin_invites_token_key on public.admin_invites (token);

alter table public.admin_invites enable row level security;

create policy admin_invites_founder_select
  on public.admin_invites
  for select
  using (public.is_founder_user());

-- is_founder_user(): true if the calling user is a founder. Used by RLS and
-- by the invite RPCs below to gate founder-only actions.
create or replace function public.is_founder_user()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_founder = true
  );
$$;

-- create_admin_invite(): founder-only. Issues (or re-issues) a 7-day invite
-- for an email that isn't already an admin. Silently revokes any prior
-- pending invite for the same email so there's never more than one live.
create or replace function public.create_admin_invite(p_email text)
returns admin_invites
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_invite public.admin_invites;
begin
  if not public.is_founder_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
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

  insert into public.admin_invites (email, invited_by)
  values (v_email, auth.uid())
  returning * into v_invite;

  return v_invite;
end;
$$;

-- get_admin_invite_preview(): public-safe lookup so the accept screen can
-- show which email an invite link belongs to and whether it's still valid,
-- without exposing anything else in admin_invites.
create or replace function public.get_admin_invite_preview(p_token uuid)
returns table(email text, valid boolean)
language sql
security definer
set search_path to 'public'
as $$
  select ai.email,
    (ai.accepted_at is null and ai.revoked_at is null and ai.expires_at > now())
  from public.admin_invites ai
  where ai.token = p_token;
$$;

-- accept_admin_invite(): flips is_admin to true only when the currently
-- signed-in user's own auth email exactly matches the invite's email, and
-- the invite is unused, unrevoked, and unexpired. Never grants is_founder.
create or replace function public.accept_admin_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invite public.admin_invites;
  v_caller_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.admin_invites
  where token = p_token
  for update;

  if not found then
    return false;
  end if;

  if v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    return false;
  end if;

  select email into v_caller_email from auth.users where id = auth.uid();

  if v_caller_email is null or lower(v_caller_email) <> lower(v_invite.email) then
    return false;
  end if;

  perform set_config('rolewave.admin_grant_bypass', 'on', true);

  update public.profiles
  set is_admin = true
  where id = auth.uid();

  update public.admin_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return true;
end;
$$;

-- revoke_admin_invite(): founder-only, lets a founder cancel a pending
-- invite before it's accepted.
create or replace function public.revoke_admin_invite(p_invite_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_founder_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.admin_invites
  set revoked_at = now()
  where id = p_invite_id
    and accepted_at is null
    and revoked_at is null;
end;
$$;

grant execute on function public.is_founder_user() to authenticated;
grant execute on function public.create_admin_invite(text) to authenticated;
grant execute on function public.get_admin_invite_preview(uuid) to authenticated, anon;
grant execute on function public.accept_admin_invite(uuid) to authenticated;
grant execute on function public.revoke_admin_invite(bigint) to authenticated;
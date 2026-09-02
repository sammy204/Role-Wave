-- Monthly usage limits for Role Pilot.

create table if not exists public.role_pilot_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_month date not null,
  action_type text not null check (action_type in ('chat', 'find_jobs', 'cover_letter', 'resume_tweak', 'match_check')),
  created_at timestamptz not null default now()
);

-- Repair a table created by an earlier draft of Role Pilot, if one exists.
alter table public.role_pilot_usage
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists usage_month date,
  add column if not exists action_type text,
  add column if not exists created_at timestamptz default now();

update public.role_pilot_usage
set usage_month = date_trunc('month', coalesce(created_at, now()))::date
where usage_month is null;

alter table public.role_pilot_usage
  alter column usage_month set default date_trunc('month', now())::date,
  alter column action_type set default 'chat',
  alter column created_at set default now();

-- The original table tracked a candidate/job pair for each use. Monthly
-- Role Pilot usage is account-level, so preserve those legacy columns/data
-- but allow new usage rows to omit them.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'role_pilot_usage' and column_name = 'candidate_id'
  ) then
    alter table public.role_pilot_usage alter column candidate_id drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'role_pilot_usage' and column_name = 'job_id'
  ) then
    alter table public.role_pilot_usage alter column job_id drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'role_pilot_usage' and column_name = 'used_at'
  ) then
    alter table public.role_pilot_usage alter column used_at drop not null;
    alter table public.role_pilot_usage alter column used_at set default now();
  end if;
end;
$$;

create index if not exists role_pilot_usage_user_month_idx
  on public.role_pilot_usage (user_id, usage_month, created_at desc);

-- Internal allowlist for development/QA accounts. This table has no client
-- insert/update policies; add test users from the Supabase SQL editor only.
create table if not exists public.role_pilot_test_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

alter table public.role_pilot_test_accounts enable row level security;

alter table public.role_pilot_usage enable row level security;

drop policy if exists "role_pilot_usage_self_select" on public.role_pilot_usage;
create policy "role_pilot_usage_self_select"
on public.role_pilot_usage for select to authenticated
using (user_id = auth.uid());

create or replace function public.consume_role_pilot_use(p_action_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_month date := date_trunc('month', now())::date;
  v_is_pro boolean := false;
  v_is_test boolean := false;
  v_used integer := 0;
  v_limit constant integer := 5;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_action_type not in ('chat', 'find_jobs', 'cover_letter', 'resume_tweak', 'match_check') then
    raise exception 'Invalid Role Pilot action' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select public.has_active_ai_entitlement(v_user_id) into v_is_pro;
  select exists (
    select 1 from public.role_pilot_test_accounts
    where user_id = v_user_id and enabled = true
  ) into v_is_test;
  select count(*)::integer into v_used
  from public.role_pilot_usage
  where user_id = v_user_id and usage_month = v_month;

  if not v_is_pro and not v_is_test and v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'is_pro', false, 'is_test', false, 'used', v_used, 'limit', v_limit, 'remaining', 0);
  end if;

  insert into public.role_pilot_usage (user_id, usage_month, action_type)
  values (v_user_id, v_month, p_action_type);

  return jsonb_build_object(
    'allowed', true,
    'is_pro', v_is_pro,
    'is_test', v_is_test,
    'used', v_used + 1,
    'limit', case when v_is_pro or v_is_test then null else v_limit end,
    'remaining', case when v_is_pro or v_is_test then null else greatest(v_limit - v_used - 1, 0) end
  );
end;
$$;

revoke all on function public.consume_role_pilot_use(text) from public;
grant execute on function public.consume_role_pilot_use(text) to authenticated;

notify pgrst, 'reload schema';

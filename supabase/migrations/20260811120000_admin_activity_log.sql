-- Append-only audit trail for administrator actions.
-- The existing founder flag and authorization functions remain the source of
-- truth for access; this migration only records what authenticated admins do.

create table if not exists public.admin_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);
create index if not exists admin_activity_log_actor_id_idx
  on public.admin_activity_log (actor_id, created_at desc);

alter table public.admin_activity_log enable row level security;

create policy admin_activity_log_select
  on public.admin_activity_log
  for select
  to authenticated
  using (public.is_founder_user() or actor_id = auth.uid());

revoke all on public.admin_activity_log from public;
grant select on public.admin_activity_log to authenticated;

-- Only database triggers and trusted server-side RPCs can write activity.
create or replace function public.record_admin_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    return;
  end if;

  insert into public.admin_activity_log (actor_id, action, entity_type, entity_id, summary, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.record_admin_activity(text, text, text, text, jsonb) from public, authenticated;

create or replace function public.log_admin_invite_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_admin_activity(
      'admin.invite_created', 'admin_invite', new.id::text,
      format('Invited %s to join the admin team.', coalesce(new.first_name || ' ', '') || new.email),
      jsonb_build_object('email', new.email, 'first_name', new.first_name, 'last_name', new.last_name)
    );
  elsif tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    perform public.record_admin_activity(
      'admin.invite_revoked', 'admin_invite', new.id::text,
      format('Revoked the pending invite for %s.', new.email),
      jsonb_build_object('email', new.email)
    );
  elsif tg_op = 'UPDATE' and old.accepted_at is null and new.accepted_at is not null then
    perform public.record_admin_activity(
      'admin.invite_accepted', 'admin_invite', new.id::text,
      format('%s accepted the admin invitation.', coalesce(new.first_name, new.email)),
      jsonb_build_object('email', new.email, 'accepted_by', new.accepted_by)
    );
  elsif tg_op = 'DELETE' then
    perform public.record_admin_activity(
      'admin.invite_deleted', 'admin_invite', old.id::text,
      format('Deleted the revoked invite for %s.', old.email),
      jsonb_build_object('email', old.email)
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_invites_activity_trigger on public.admin_invites;
create trigger admin_invites_activity_trigger
after insert or update or delete on public.admin_invites
for each row execute function public.log_admin_invite_activity();

create or replace function public.log_admin_access_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_email text;
begin
  if new.is_admin is distinct from old.is_admin then
    select email::text into v_email from auth.users where id = new.id;

    if new.is_admin then
      perform public.record_admin_activity(
        'admin.access_granted', 'admin_user', new.id::text,
        format('Granted admin access to %s.', coalesce(v_email, new.id::text)),
        jsonb_build_object('email', v_email)
      );
    else
      perform public.record_admin_activity(
        'admin.access_revoked', 'admin_user', new.id::text,
        format('Removed admin access from %s.', coalesce(v_email, new.id::text)),
        jsonb_build_object('email', v_email)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_admin_access_activity_trigger on public.profiles;
create trigger profiles_admin_access_activity_trigger
after update of is_admin on public.profiles
for each row execute function public.log_admin_access_activity();

create or replace function public.log_admin_record_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_action text;
  v_summary text;
  v_id text;
begin
  if not public.is_admin_user() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_id := coalesce(new.id, old.id)::text;

  if tg_table_name = 'jobs' then
    if tg_op = 'INSERT' then
      v_action := 'job.created';
      v_summary := format('Created job "%s".', new.title);
    elsif tg_op = 'DELETE' then
      v_action := 'job.deleted';
      v_summary := format('Deleted job "%s".', old.title);
    elsif old.status is distinct from new.status then
      v_action := 'job.status_changed';
      v_summary := format('Changed "%s" to %s.', new.title, new.status);
    else
      v_action := 'job.updated';
      v_summary := format('Updated job "%s".', new.title);
    end if;
  elsif tg_table_name = 'job_submissions' then
    if tg_op = 'DELETE' then
      v_action := 'submission.deleted';
      v_summary := format('Removed reviewed submission "%s".', old.job_title);
    elsif old.status is distinct from new.status then
      v_action := 'submission.status_changed';
      v_summary := format('Changed submission "%s" to %s.', new.job_title, new.status);
    else
      return new;
    end if;
  elsif tg_table_name = 'companies' then
    if tg_op = 'INSERT' then
      v_action := 'company.created';
      v_summary := format('Created company "%s".', new.name);
    elsif old.verified is distinct from new.verified then
      v_action := 'company.verification_changed';
      v_summary := format('%s company "%s".', case when new.verified then 'Verified' else 'Unverified' end, new.name);
    elsif old.name is distinct from new.name
       or old.website is distinct from new.website
       or old.description is distinct from new.description
       or old.location is distinct from new.location then
      v_action := 'company.updated';
      v_summary := format('Updated company "%s".', new.name);
    else
      return new;
    end if;
  elsif tg_table_name = 'admin_profiles' then
    v_action := 'admin.profile_updated';
    v_summary := format('Updated the admin profile for %s.', new.first_name);
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform public.record_admin_activity(v_action, tg_table_name, v_id, v_summary, '{}'::jsonb);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_admin_activity_trigger on public.jobs;
create trigger jobs_admin_activity_trigger
after insert or update or delete on public.jobs
for each row execute function public.log_admin_record_activity();

drop trigger if exists job_submissions_admin_activity_trigger on public.job_submissions;
create trigger job_submissions_admin_activity_trigger
after update or delete on public.job_submissions
for each row execute function public.log_admin_record_activity();

drop trigger if exists companies_admin_activity_trigger on public.companies;
create trigger companies_admin_activity_trigger
after insert or update on public.companies
for each row execute function public.log_admin_record_activity();

drop trigger if exists admin_profiles_activity_trigger on public.admin_profiles;
create trigger admin_profiles_activity_trigger
after update of first_name, last_name on public.admin_profiles
for each row execute function public.log_admin_record_activity();

-- Founder-facing query for the dashboard. Regular admins can still see their
-- own entries through RLS, but only founders can read the complete stream.
create or replace function public.admin_list_activity(p_limit integer default 100)
returns table (
  id bigint,
  actor_id uuid,
  actor_email text,
  actor_first_name text,
  action text,
  entity_type text,
  entity_id text,
  summary text,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select
    l.id,
    l.actor_id,
    u.email::text,
    ap.first_name,
    l.action,
    l.entity_type,
    l.entity_id,
    l.summary,
    l.metadata,
    l.created_at
  from public.admin_activity_log l
  left join auth.users u on u.id = l.actor_id
  left join public.admin_profiles ap on ap.id = l.actor_id
  where public.is_founder_user()
     or l.actor_id = auth.uid()
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.admin_list_activity(integer) from public;
grant execute on function public.admin_list_activity(integer) to authenticated;


create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'message_received',
    'application_submitted',
    'application_status_changed',
    'employer_verification_approved',
    'employer_verification_rejected',
    'job_post_approved'
  )),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

-- ============================================================
-- RLS policies (read + mark-read only; inserts happen via
-- create_notification, which runs as SECURITY DEFINER)
-- ============================================================

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
  for select
  using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_admin_select on public.notifications;
create policy notifications_admin_select on public.notifications
  for select
  using (public.is_admin_user());

-- ============================================================
-- Internal creation helper (not granted to `authenticated`)
-- ============================================================

create or replace function public.create_notification(p_user_id uuid, p_type text, p_payload jsonb default '{}'::jsonb)
returns public.notifications
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_notification public.notifications;
begin
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb))
  returning * into v_notification;

  return v_notification;
end;
$function$;

revoke all on function public.create_notification(uuid, text, jsonb) from public;
revoke all on function public.create_notification(uuid, text, jsonb) from authenticated;

-- ============================================================
-- Client-facing RPCs
-- ============================================================

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = auth.uid()
    and read_at is null;
end;
$function$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$function$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================
-- Trigger: new message -> notify the other participant
-- ============================================================

create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conversation public.conversations;
  v_recipient_id uuid;
  v_employer_id uuid;
begin
  select * into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if not found then
    return new;
  end if;

  select c.owner_profile_id into v_employer_id
  from public.companies c
  where c.id = v_conversation.company_id;

  if new.sender_profile_id = v_conversation.candidate_profile_id then
    v_recipient_id := v_employer_id;
  else
    v_recipient_id := v_conversation.candidate_profile_id;
  end if;

  if v_recipient_id is not null and v_recipient_id <> new.sender_profile_id then
    perform public.create_notification(
      v_recipient_id,
      'message_received',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'sender_profile_id', new.sender_profile_id,
        'preview', left(new.body, 140)
      )
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
  after insert on public.messages
  for each row execute function public.notify_on_new_message();

-- ============================================================
-- Trigger: new application -> notify the employer
-- ============================================================

create or replace function public.notify_on_new_application()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_employer_id uuid;
begin
  select c.owner_profile_id into v_employer_id
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.id = new.job_id;

  if v_employer_id is not null then
    perform public.create_notification(
      v_employer_id,
      'application_submitted',
      jsonb_build_object(
        'application_id', new.id,
        'job_id', new.job_id,
        'applicant_name', new.applicant_name
      )
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists job_applications_notify_employer on public.job_applications;
create trigger job_applications_notify_employer
  after insert on public.job_applications
  for each row execute function public.notify_on_new_application();

-- ============================================================
-- Trigger: application status changed -> notify the candidate
-- ============================================================

create or replace function public.notify_on_application_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.candidate_profile_id is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.create_notification(
      new.candidate_profile_id,
      'application_status_changed',
      jsonb_build_object(
        'application_id', new.id,
        'job_id', new.job_id,
        'old_status', old.status,
        'new_status', new.status,
        'rejection_reason', new.rejection_reason
      )
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists job_applications_notify_status_change on public.job_applications;
create trigger job_applications_notify_status_change
  after update on public.job_applications
  for each row execute function public.notify_on_application_status_change();

-- ============================================================
-- Realtime publication enrollment (idempotent)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
-- Interview scheduling: employer proposals, candidate selection, and cancellation.

alter table public.candidate_profiles add column if not exists timezone text;

create table if not exists public.interview_schedules (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications(id) on delete cascade,
  meeting_link text not null,
  employer_timezone text not null,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled')),
  selected_slot_id uuid,
  proposed_at timestamptz not null default now(),
  selected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.interview_schedules(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 45 check (duration_minutes between 15 and 240),
  slot_order integer not null check (slot_order between 1 and 5),
  created_at timestamptz not null default now(),
  unique (schedule_id, slot_order),
  unique (schedule_id, starts_at)
);

alter table public.interview_slots add column if not exists schedule_id uuid;

-- Repair a partially-created table if an earlier SQL Editor run stopped after
-- creating the relation but before all columns were present.
alter table public.interview_slots add column if not exists id uuid default gen_random_uuid();
alter table public.interview_slots add column if not exists starts_at timestamptz;
alter table public.interview_slots add column if not exists duration_minutes integer default 45;
alter table public.interview_slots add column if not exists slot_order integer;

do $$
begin
  -- Older partial attempts used interview_id. Keep any existing data, but do
  -- not let that legacy column block inserts using the current schedule_id.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'interview_slots'
      and column_name = 'interview_id'
  ) then
    alter table public.interview_slots alter column interview_id drop not null;
  end if;
end;
$$;

update public.interview_slots
set id = gen_random_uuid()
where id is null;

alter table public.interview_slots alter column id set not null;
alter table public.interview_slots alter column starts_at set not null;
alter table public.interview_slots alter column duration_minutes set default 45;
alter table public.interview_slots alter column duration_minutes set not null;
alter table public.interview_slots alter column slot_order set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'interview_slots_pkey'
      and conrelid = 'public.interview_slots'::regclass
  ) then
    alter table public.interview_slots add constraint interview_slots_pkey primary key (id);
  end if;
end;
$$;

create table if not exists public.interview_email_sends (
  id bigint generated always as identity primary key,
  schedule_id uuid not null references public.interview_schedules(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  email_type text not null check (email_type in ('proposal', 'confirmation', 'cancellation')),
  sent_at timestamptz not null default now(),
  unique (schedule_id, recipient_profile_id, email_type)
);

alter table public.interview_email_sends enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'interview_schedules_selected_slot_fk'
      and conrelid = 'public.interview_schedules'::regclass
  ) then
    alter table public.interview_schedules
      add constraint interview_schedules_selected_slot_fk
      foreign key (selected_slot_id) references public.interview_slots(id) on delete set null;
  end if;
end;
$$;

alter table public.interview_schedules enable row level security;
alter table public.interview_slots enable row level security;

drop policy if exists interview_schedules_participant_select on public.interview_schedules;
create policy interview_schedules_participant_select on public.interview_schedules
for select to authenticated
using (
  exists (
    select 1
    from public.job_applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.id = interview_schedules.application_id
      and (a.candidate_profile_id = auth.uid() or c.owner_profile_id = auth.uid())
  )
);

drop policy if exists interview_slots_participant_select on public.interview_slots;
create policy interview_slots_participant_select on public.interview_slots
for select to authenticated
using (
  exists (
    select 1
    from public.interview_schedules s
    join public.job_applications a on a.id = s.application_id
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where s.id = interview_slots.schedule_id
      and (a.candidate_profile_id = auth.uid() or c.owner_profile_id = auth.uid())
  )
);

drop function if exists public.create_interview_schedule(uuid, text, text, jsonb);

create or replace function public.create_interview_schedule(
  p_application_id uuid,
  p_meeting_link text,
  p_employer_timezone text,
  p_slots jsonb
)
returns public.interview_schedules
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_schedule public.interview_schedules;
  v_slot jsonb;
  v_index integer := 0;
  v_start timestamptz;
begin
  if nullif(trim(p_meeting_link), '') is null then
    raise exception 'A meeting link is required.' using errcode = '22023';
  end if;
  if nullif(trim(p_employer_timezone), '') is null then
    raise exception 'A timezone is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 5 then
    raise exception 'Choose between 1 and 5 interview slots.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.job_applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.id = p_application_id
      and c.owner_profile_id = auth.uid()
      and a.candidate_profile_id is not null
      and a.status not in ('rejected', 'withdrawn', 'offer', 'hired')
  ) then
    raise exception 'You cannot schedule an interview for this application.' using errcode = '42501';
  end if;

  insert into public.interview_schedules (application_id, meeting_link, employer_timezone)
  values (p_application_id, trim(p_meeting_link), trim(p_employer_timezone))
  on conflict (application_id) do update set
    meeting_link = excluded.meeting_link,
    employer_timezone = excluded.employer_timezone,
    status = 'proposed',
    selected_slot_id = null,
    selected_at = null,
    cancelled_at = null,
    proposed_at = now(),
    updated_at = now()
  returning * into v_schedule;

  delete from public.interview_slots where schedule_id = v_schedule.id;

  for v_slot in select value from jsonb_array_elements(p_slots) loop
    v_index := v_index + 1;
    begin
      v_start := (v_slot ->> 'starts_at')::timestamptz;
    exception when others then
      raise exception 'Each slot must have a valid starts_at value.' using errcode = '22023';
    end;
    if v_start <= now() then
      raise exception 'Interview slots must be in the future.' using errcode = '22023';
    end if;
    insert into public.interview_slots (schedule_id, starts_at, duration_minutes, slot_order)
    values (v_schedule.id, v_start, greatest(15, least(240, coalesce((v_slot ->> 'duration_minutes')::integer, 45))), v_index);
  end loop;

  update public.job_applications
  set status = 'interview', updated_at = now()
  where id = p_application_id;

  select * into v_schedule from public.interview_schedules where id = v_schedule.id;
  return v_schedule;
end;
$$;

drop function if exists public.select_interview_slot(uuid);

create or replace function public.select_interview_slot(p_slot_id uuid)
returns public.interview_schedules
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_schedule public.interview_schedules;
  v_slot public.interview_slots;
begin
  select s.* into v_schedule
  from public.interview_schedules s
  join public.job_applications a on a.id = s.application_id
  where s.id = (select slot.schedule_id from public.interview_slots slot where slot.id = p_slot_id)
    and a.candidate_profile_id = auth.uid()
  for update;

  if not found or v_schedule.status <> 'proposed' then
    raise exception 'This interview is no longer accepting selections.' using errcode = 'P0001';
  end if;

  select * into v_slot from public.interview_slots slot where slot.id = p_slot_id and slot.schedule_id = v_schedule.id;
  if not found or v_slot.starts_at <= now() then
    raise exception 'That interview slot is no longer available.' using errcode = '22023';
  end if;

  update public.interview_schedules
  set status = 'confirmed', selected_slot_id = v_slot.id, selected_at = now(), updated_at = now()
  where id = v_schedule.id
  returning * into v_schedule;

  return v_schedule;
end;
$$;

drop function if exists public.cancel_interview(uuid);

create or replace function public.cancel_interview(p_application_id uuid)
returns public.interview_schedules
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_schedule public.interview_schedules;
begin
  select s.* into v_schedule
  from public.interview_schedules s
  join public.job_applications a on a.id = s.application_id
  join public.jobs j on j.id = a.job_id
  join public.companies c on c.id = j.company_id
  where s.application_id = p_application_id
    and c.owner_profile_id = auth.uid()
  for update;

  if not found or v_schedule.status = 'cancelled' then
    raise exception 'No active interview was found.' using errcode = '22023';
  end if;

  update public.interview_schedules
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_schedule.id
  returning * into v_schedule;

  update public.job_applications
  set status = 'shortlisted', updated_at = now()
  where id = p_application_id;

  return v_schedule;
end;
$$;

-- Interview scheduling has its own proposal email; do not send the generic
-- status email when the application enters the interview stage.
create or replace function public.handle_application_status_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_webhook_secret text;
  v_project_url text := 'https://nabaanirclmqzyrfuznf.supabase.co';
  v_target_statuses text[] := array['reviewed', 'shortlisted', 'offer', 'hired', 'rejected'];
begin
  if new.candidate_profile_id is null then return new; end if;
  if new.status is distinct from old.status and new.status = any(v_target_statuses) then
    if new.status = 'shortlisted' and exists (
      select 1 from public.interview_schedules s
      where s.application_id = new.id and s.status = 'cancelled'
    ) then
      return new;
    end if;
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'application_status_email_webhook_secret'
    limit 1;
    if v_webhook_secret is not null then
      perform net.http_post(
        url := v_project_url || '/functions/v1/send-application-status-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
        body := jsonb_build_object('application_id', new.id, 'status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
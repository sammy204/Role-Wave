-- Interview lifecycle and idempotent reminders.

alter table public.interview_schedules
  drop constraint if exists interview_schedules_status_check;
alter table public.interview_schedules
  add constraint interview_schedules_status_check
  check (status in ('proposed', 'confirmed', 'cancelled', 'completed', 'expired'));

alter table public.interview_schedules
  add column if not exists completed_at timestamptz;

create table if not exists public.interview_reminder_sends (
  id bigint generated always as identity primary key,
  schedule_id uuid not null references public.interview_schedules(id) on delete cascade,
  slot_id uuid not null references public.interview_slots(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24_hours', '1_hour', '15_minutes')),
  sent_at timestamptz not null default now(),
  unique (schedule_id, slot_id, recipient_profile_id, reminder_type)
);

create index if not exists interview_reminder_sends_schedule_idx
  on public.interview_reminder_sends (schedule_id, sent_at desc);

alter table public.interview_reminder_sends enable row level security;

-- Reminder rows are created by the scheduled service worker only.
revoke all on public.interview_reminder_sends from anon, authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'message_received',
  'application_submitted',
  'application_status_changed',
  'employer_verification_approved',
  'employer_verification_rejected',
  'job_post_approved',
  'interview_reminder',
  'interview_completed'
));

-- Run the worker every five minutes. Before deploying, store the same value
-- in Vault as `interview_reminder_cron_secret` and as the Edge Function secret
-- `INTERVIEW_REMINDER_CRON_SECRET`.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rolewave-interview-reminders') then
    perform cron.unschedule('rolewave-interview-reminders');
  end if;
  perform cron.schedule(
    'rolewave-interview-reminders',
    '*/5 * * * *',
    $job$select net.http_post(
      url := 'https://nabaanirclmqzyrfuznf.supabase.co/functions/v1/interview-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-interview-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'interview_reminder_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );$job$
  );
end;
$$;

notify pgrst, 'reload schema';

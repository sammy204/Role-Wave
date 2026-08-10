-- Application status-change email.
--
-- Sends a candidate-facing email when their application moves to one of
-- six statuses: reviewed, shortlisted, interview, offer, hired, rejected.
-- Skips 'submitted' and 'withdrawn' since the candidate caused those
-- themselves and doesn't need to be told about it.
--
-- Dedup table: unlike the welcome email (which fires once per account),
-- an application moves through several of these statuses over its
-- lifecycle, so we track (application_id, status) pairs that have
-- already been emailed. This also protects against duplicate sends if
-- pg_net retries the webhook call.

create table if not exists public.application_status_emails_sent (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  status text not null,
  sent_at timestamptz not null default now(),
  unique (application_id, status)
);

alter table public.application_status_emails_sent enable row level security;
-- No policies on purpose, same as webhook_call_log — only service_role
-- (used by edge functions) can read/write this table.

-- Generate a fresh random secret directly into Vault. This is never
-- selected back out or printed anywhere — copy the plaintext from the
-- Vault UI in the dashboard into the edge function's secrets.
-- Kept separate from welcome_email_webhook_secret so a leak of one
-- doesn't affect the other.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'application_status_email_webhook_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'application_status_email_webhook_secret',
      'Shared secret for the job_applications status-change trigger to authenticate to the send-application-status-email edge function.'
    );
  end if;
end $$;

-- Sibling trigger function to notify_on_application_status_change().
-- That one writes an in-app notification; this one fires the outbound
-- email webhook. Kept as two separate functions so either can be
-- changed/disabled independently.
create or replace function public.handle_application_status_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_webhook_secret text;
  v_project_url text := 'https://nabaanirclmqzyrfuznf.supabase.co';
  v_target_statuses text[] := array['reviewed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];
begin
  -- No account, no email address to send to.
  if new.candidate_profile_id is null then
    return new;
  end if;

  if new.status is distinct from old.status and new.status = any(v_target_statuses) then
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'application_status_email_webhook_secret'
    limit 1;

    if v_webhook_secret is null then
      raise warning 'application_status_email_webhook_secret not set in Vault; skipping status email for application %', new.id;
      return new;
    end if;

    perform net.http_post(
      url := v_project_url || '/functions/v1/send-application-status-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'application_id', new.id,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;

create trigger job_applications_status_email
  after update on public.job_applications
  for each row
  execute function public.handle_application_status_email();

NOTIFY pgrst, 'reload schema';
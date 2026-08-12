-- New-message email.
--
-- Sends a candidate-facing email when an employer sends them a message and
-- the candidate isn't currently active in the app. One-directional on
-- purpose: only fires when the employer is the sender. A candidate
-- messaging an employer never triggers this (employers rely on in-app +
-- push only for now).
--
-- Presence and preference checks both happen server-side in the edge
-- function, not here, so the trigger stays a dumb dispatcher — same split
-- used by handle_application_status_email().

alter table public.profiles
  add column if not exists email_new_messages boolean not null default true;

grant update (email_new_messages) on public.profiles to authenticated;

create table if not exists public.message_emails_sent (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.messages(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (message_id)
);

alter table public.message_emails_sent enable row level security;
-- No policies on purpose, same as application_status_emails_sent /
-- webhook_call_log — only service_role (used by edge functions) touches
-- this table.

-- Generate a fresh random secret directly into Vault. This is never
-- selected back out or printed anywhere — copy the plaintext from the
-- Vault UI in the dashboard into the edge function's secrets.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'new_message_email_webhook_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'new_message_email_webhook_secret',
      'Shared secret for the messages insert trigger to authenticate to the send-message-email edge function.'
    );
  end if;
end $$;

create or replace function public.handle_new_message_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_webhook_secret text;
  v_project_url text := 'https://nabaanirclmqzyrfuznf.supabase.co';
  v_employer_id uuid;
begin
  select c.owner_profile_id into v_employer_id
  from public.conversations conv
  join public.companies c on c.id = conv.company_id
  where conv.id = new.conversation_id;

  -- Only email the candidate when the employer is the one sending. A
  -- message from the candidate side never triggers this email.
  if v_employer_id is null or new.sender_profile_id is distinct from v_employer_id then
    return new;
  end if;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'new_message_email_webhook_secret'
  limit 1;

  if v_webhook_secret is null then
    raise warning 'new_message_email_webhook_secret not set in Vault; skipping message email for message %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/send-message-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object('message_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists messages_new_message_email on public.messages;
create trigger messages_new_message_email
  after insert on public.messages
  for each row
  execute function public.handle_new_message_email();

NOTIFY pgrst, 'reload schema';
-- Send document-based offer emails once per offer, not once per application.

create table if not exists public.offer_document_emails_sent (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.offers(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (offer_id)
);

alter table public.offer_document_emails_sent enable row level security;

create or replace function public.handle_offer_document_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_webhook_secret text;
  v_project_url text := 'https://nabaanirclmqzyrfuznf.supabase.co';
begin
  if new.status = 'sent'
     and new.status is distinct from old.status
     and exists (select 1 from public.offer_documents d where d.offer_id = new.id) then
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'application_status_email_webhook_secret'
    limit 1;

    if v_webhook_secret is not null then
      perform net.http_post(
        url := v_project_url || '/functions/v1/send-application-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_webhook_secret
        ),
        body := jsonb_build_object(
          'application_id', new.application_id,
          'status', 'offer',
          'offer_id', new.id
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_document_email on public.offers;
create trigger offers_document_email
  after update on public.offers
  for each row
  execute function public.handle_offer_document_email();

-- The normal application-status trigger should not send a duplicate generic
-- email when a document offer is being sent. The offer-specific trigger above
-- sends the version with attachments instead.
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
  if new.candidate_profile_id is null then return new; end if;

  if new.status is distinct from old.status and new.status = any(v_target_statuses) then
    if new.status = 'offer' and exists (
      select 1
      from public.offers o
      join public.offer_documents d on d.offer_id = o.id
      where o.application_id = new.id and o.status = 'sent'
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
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_webhook_secret
        ),
        body := jsonb_build_object('application_id', new.id, 'status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;

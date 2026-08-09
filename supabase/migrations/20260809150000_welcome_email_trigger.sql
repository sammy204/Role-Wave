-- Welcome email send trigger
--
-- Fires once, when a user's auth.users.email_confirmed_at flips from null to
-- a timestamp (i.e. right after they confirm their email). Calls the
-- send-welcome-email Edge Function via pg_net, which looks up the profile,
-- picks the candidate/employer template, and sends via Resend.
--
-- SECURITY NOTE — one-time manual setup required after this migration runs:
-- The trigger authenticates its call to the Edge Function with a shared
-- secret. That secret must NOT be hardcoded here (this file is committed to
-- git). Instead it's stored in Supabase Vault, out of band. Run this once in
-- the Supabase SQL editor (NOT as a migration file), using a long random
-- value of your choosing:
--
--   select vault.create_secret('<same-random-value-as-WEBHOOK_SECRET-below>', 'welcome_email_webhook_secret');
--
-- Then set the same value as an Edge Function secret:
--
--   supabase secrets set WEBHOOK_SECRET=<same-random-value>
--
-- The two values must match exactly, or the Edge Function will reject the
-- trigger's calls with 401.

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

create extension if not exists pg_net with schema extensions;

create or replace function public.handle_auth_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_webhook_secret text;
  v_project_url text := 'https://nabaanirclmqzyrfuznf.supabase.co';
begin
  if (old.email_confirmed_at is null and new.email_confirmed_at is not null) then
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'welcome_email_webhook_secret'
    limit 1;

    if v_webhook_secret is null then
      raise warning 'welcome_email_webhook_secret not set in Vault; skipping welcome email for %', new.id;
      return new;
    end if;

    perform net.http_post(
      url := v_project_url || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object('user_id', new.id, 'email', new.email)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row
  execute function public.handle_auth_user_email_confirmed();
-- Track admin-specific welcome emails separately from candidate onboarding
-- welcome emails.

alter table public.profiles
  add column if not exists admin_welcome_email_sent_at timestamptz;

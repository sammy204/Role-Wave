-- Required candidate contact details collected during onboarding.

alter table public.candidate_profiles
  add column if not exists phone text,
  add column if not exists country text;

notify pgrst, 'reload schema';

-- Keep hosted candidate profiles aligned with the resume-first onboarding flow.

alter table public.candidate_profiles
  add column if not exists job_type text,
  add column if not exists preferred_job_titles text[] not null default '{}',
  add column if not exists resume_name text,
  add column if not exists phone text,
  add column if not exists country text;

notify pgrst, 'reload schema';

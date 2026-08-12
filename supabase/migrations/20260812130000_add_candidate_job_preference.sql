alter table public.candidate_profiles
  add column if not exists preferred_job_titles text[] not null default '{}';

comment on column public.candidate_profiles.preferred_job_titles is
  'Candidate preferred job titles, such as Frontend Engineer or Full-stack Developer.';

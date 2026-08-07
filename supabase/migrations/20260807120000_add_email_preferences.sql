ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_application_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_job_recommendations boolean NOT NULL DEFAULT true;

GRANT UPDATE (email_application_updates, email_job_recommendations)
ON public.profiles
TO authenticated;

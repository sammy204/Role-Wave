-- Internal applications must be submitted through the Turnstile-protected edge function.
DROP POLICY IF EXISTS "job_applications_public_insert" ON public.job_applications;
DROP POLICY IF EXISTS job_applications_guest_insert ON public.job_applications;
DROP POLICY IF EXISTS job_applications_candidate_insert ON public.job_applications;

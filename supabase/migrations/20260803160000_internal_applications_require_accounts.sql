/* Only signed-in candidates may submit internal RoleWave applications. */

DROP POLICY IF EXISTS job_applications_guest_insert ON public.job_applications;

DROP POLICY IF EXISTS job_applications_candidate_insert ON public.job_applications;
CREATE POLICY job_applications_candidate_insert ON public.job_applications
FOR INSERT TO authenticated
WITH CHECK (
  candidate_profile_id = auth.uid()
  AND source = 'registered'
  AND status = 'submitted'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = job_id
      AND j.status = 'active'
      AND j.apply_method = 'internal'
  )
);

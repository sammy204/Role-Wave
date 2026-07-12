DROP POLICY IF EXISTS "job_applications_candidate_select" ON public.job_applications;
CREATE POLICY "job_applications_candidate_select"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  (
    candidate_profile_id IS NOT NULL
    AND candidate_profile_id = auth.uid()
  )
  OR (
    candidate_profile_id IS NULL
    AND applicant_email = (auth.jwt() ->> 'email')
  )
);

/*
Fix candidate application lifecycle policies.

- Allow a candidate to withdraw their own application.
- Allow a candidate to hide a withdrawn application afterward.
- Keep withdrawn rows hidden from dashboards once deleted.
*/

DROP POLICY IF EXISTS "job_applications_candidate_update" ON public.job_applications;
DROP POLICY IF EXISTS "job_applications_candidate_delete" ON public.job_applications;

CREATE POLICY "job_applications_candidate_withdraw"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
  candidate_profile_id = auth.uid()
  AND candidate_deleted_at IS NULL
)
WITH CHECK (
  candidate_profile_id = auth.uid()
  AND status = 'withdrawn'
  AND candidate_deleted_at IS NULL
);

CREATE POLICY "job_applications_candidate_delete"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
  candidate_profile_id = auth.uid()
  AND status = 'withdrawn'
  AND candidate_deleted_at IS NULL
)
WITH CHECK (
  candidate_profile_id = auth.uid()
  AND status = 'withdrawn'
  AND candidate_deleted_at IS NOT NULL
);

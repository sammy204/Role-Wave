DROP POLICY IF EXISTS "job_applications_candidate_update" ON public.job_applications;

CREATE POLICY "job_applications_candidate_withdraw"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
  candidate_profile_id = auth.uid()
  AND status <> 'withdrawn'
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
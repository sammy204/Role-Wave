/* Employers may permanently remove applications only after rejecting them. */

DROP POLICY IF EXISTS "job_applications_employer_delete" ON public.job_applications;

CREATE POLICY "job_applications_employer_delete"
ON public.job_applications
FOR DELETE
TO authenticated
USING (
  status = 'rejected'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
);

/*
# Enforce candidate visibility in employer profile reads

Employer access is still limited to candidates connected to one of the
employer's applications, but that policy must also respect the candidate's
visibility_to_employers setting. Otherwise a candidate who chooses "Hidden"
could still be returned by the employer dashboard or a direct REST query.
*/

DROP POLICY IF EXISTS "candidate_profiles_employer_select" ON public.candidate_profiles;

CREATE POLICY "candidate_profiles_employer_select"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (
  visibility_to_employers IS DISTINCT FROM 'hidden'
  AND EXISTS (
    SELECT 1
    FROM public.job_applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.companies c ON c.id = j.company_id
    WHERE a.candidate_profile_id = candidate_profiles.id
      AND a.status <> 'withdrawn'
      AND a.candidate_deleted_at IS NULL
      AND c.owner_profile_id = auth.uid()
  )
);


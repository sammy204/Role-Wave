/*
Application workflow hardening.

- Keep one application per candidate per job.
- Add a withdrawn state.
- Hide withdrawn applications from employers.
- Allow candidates to hide withdrawn applications from their dashboard.
- Let employers view candidate profiles for their own applicants.
*/

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS candidate_deleted_at timestamptz;

DELETE FROM public.job_applications a
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY job_id, candidate_profile_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.job_applications
    WHERE candidate_profile_id IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
) dup
WHERE a.id = dup.id;

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('submitted', 'withdrawn', 'reviewed', 'shortlisted', 'rejected', 'hired'));

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_one_per_candidate_job
  ON public.job_applications (job_id, candidate_profile_id)
  WHERE candidate_profile_id IS NOT NULL;

DROP POLICY IF EXISTS "job_applications_employer_select" ON public.job_applications;
CREATE POLICY "job_applications_employer_select"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  status <> 'withdrawn'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "job_applications_employer_update" ON public.job_applications;
CREATE POLICY "job_applications_employer_update"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (
  status <> 'withdrawn'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  status <> 'withdrawn'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "job_applications_candidate_delete" ON public.job_applications;
CREATE POLICY "job_applications_candidate_update"
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

DROP POLICY IF EXISTS "job_applications_candidate_select" ON public.job_applications;
CREATE POLICY "job_applications_candidate_select"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  candidate_deleted_at IS NULL
  AND (
    (
      candidate_profile_id IS NOT NULL
      AND candidate_profile_id = auth.uid()
    )
    OR (
      candidate_profile_id IS NULL
      AND applicant_email = (auth.jwt() ->> 'email')
    )
  )
);

DROP POLICY IF EXISTS "candidate_profiles_employer_select" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_employer_select"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
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

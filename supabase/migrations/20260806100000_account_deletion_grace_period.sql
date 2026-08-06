/* Add a reversible account-deletion state for the 10-day grace period. */

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'deletion_scheduled'));

ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS visibility_before_deletion text;

CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled
  ON public.profiles (deletion_scheduled_for)
  WHERE account_status = 'deletion_scheduled';

DROP POLICY IF EXISTS "candidate_profiles_employer_select" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_employer_select"
ON public.candidate_profiles FOR SELECT TO authenticated
USING (
  visibility_to_employers IS DISTINCT FROM 'hidden'
  AND EXISTS (
    SELECT 1 FROM public.profiles candidate_owner
    WHERE candidate_owner.id = candidate_profiles.id
      AND candidate_owner.account_status = 'active'
  )
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

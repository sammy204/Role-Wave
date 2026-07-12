/*
Marketplace foundation for RoleWave.

This adds the core data shape for:
- candidate profiles
- employer/company ownership
- job applications
- application methods on jobs

It also updates the existing auth profile trigger so new users can declare a role.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('candidate', 'employer'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, is_admin, account_type, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    false,
    COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'candidate'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_owner_profile ON public.companies(owner_profile_id);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS apply_method text NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS apply_url text,
  ADD COLUMN IF NOT EXISTS application_email text;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_apply_method_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_apply_method_check
  CHECK (apply_method IN ('external', 'email', 'internal'));

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  bio text,
  location text,
  years_experience integer,
  skills text[] NOT NULL DEFAULT '{}',
  preferred_locations text[] NOT NULL DEFAULT '{}',
  preferred_salary text,
  work_preference text,
  availability text,
  resume_url text,
  portfolio_url text,
  github_url text,
  linkedin_url text,
  education text,
  experience text,
  projects text,
  open_to_work boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  company_website text,
  company_size text,
  role_title text,
  phone text,
  office_location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text,
  cover_letter text,
  resume_url text,
  portfolio_url text,
  source text NOT NULL DEFAULT 'guest',
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_profiles_self_select" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_self_select"
ON public.candidate_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "candidate_profiles_self_insert" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_self_insert"
ON public.candidate_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "candidate_profiles_self_update" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_self_update"
ON public.candidate_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "employer_profiles_self_select" ON public.employer_profiles;
CREATE POLICY "employer_profiles_self_select"
ON public.employer_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "employer_profiles_self_insert" ON public.employer_profiles;
CREATE POLICY "employer_profiles_self_insert"
ON public.employer_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "employer_profiles_self_update" ON public.employer_profiles;
CREATE POLICY "employer_profiles_self_update"
ON public.employer_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "jobs_employer_select" ON public.jobs;
CREATE POLICY "jobs_employer_select"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "jobs_employer_insert" ON public.jobs;
CREATE POLICY "jobs_employer_insert"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "jobs_employer_update" ON public.jobs;
CREATE POLICY "jobs_employer_update"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "jobs_employer_delete" ON public.jobs;
CREATE POLICY "jobs_employer_delete"
ON public.jobs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.owner_profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "companies_employer_insert" ON public.companies;
CREATE POLICY "companies_employer_insert"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "companies_employer_update" ON public.companies;
CREATE POLICY "companies_employer_update"
ON public.companies
FOR UPDATE
TO authenticated
USING (owner_profile_id = auth.uid())
WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "companies_employer_delete" ON public.companies;
CREATE POLICY "companies_employer_delete"
ON public.companies
FOR DELETE
TO authenticated
USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "job_applications_public_insert" ON public.job_applications;
CREATE POLICY "job_applications_public_insert"
ON public.job_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "job_applications_employer_select" ON public.job_applications;
CREATE POLICY "job_applications_employer_select"
ON public.job_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = job_id
      AND c.owner_profile_id = auth.uid()
  )
);

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('submitted', 'reviewed', 'shortlisted', 'rejected', 'hired'));

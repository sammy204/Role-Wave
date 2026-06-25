/*
# Admin access and submission review

This migration adds:
- `profiles` for user roles
- admin-only access policies for reviewing submissions
- admin-only write access for publishing jobs

Admins can be created by adding a row to `profiles` for an authenticated Supabase user.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE is_admin = true;

  IF admin_count > 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'Admin'),
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET is_admin = true;

  UPDATE public.profiles
  SET is_admin = true
  WHERE id = auth.uid();

  RETURN FOUND;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
CREATE POLICY "profiles_self_select" ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_admin_select" ON profiles
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "job_submissions_public_select" ON job_submissions;
DROP POLICY IF EXISTS "submissions_public_select" ON job_submissions;

DROP POLICY IF EXISTS "job_submissions_admin_select" ON job_submissions;
CREATE POLICY "job_submissions_admin_select" ON job_submissions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "job_submissions_admin_update" ON job_submissions;
CREATE POLICY "job_submissions_admin_update" ON job_submissions
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "jobs_admin_insert" ON jobs;
CREATE POLICY "jobs_admin_insert" ON jobs
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "jobs_admin_update" ON jobs;
CREATE POLICY "jobs_admin_update" ON jobs
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "jobs_admin_delete" ON jobs;
CREATE POLICY "jobs_admin_delete" ON jobs
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "companies_admin_insert" ON companies;
CREATE POLICY "companies_admin_insert" ON companies
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "companies_admin_update" ON companies;
CREATE POLICY "companies_admin_update" ON companies
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

DROP POLICY IF EXISTS "companies_admin_delete" ON companies;
CREATE POLICY "companies_admin_delete" ON companies
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.id = auth.uid()
    AND p.is_admin = true
));

ALTER TABLE job_submissions
  DROP CONSTRAINT IF EXISTS job_submissions_status_check;

ALTER TABLE job_submissions
  ADD CONSTRAINT job_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

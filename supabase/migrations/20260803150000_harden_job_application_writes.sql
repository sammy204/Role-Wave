/* Prevent application impersonation and protect employer-controlled fields. */

-- Replace the unrestricted insert policy with identity-aware policies.
DROP POLICY IF EXISTS "job_applications_public_insert" ON public.job_applications;
DROP POLICY IF EXISTS job_applications_guest_insert ON public.job_applications;
DROP POLICY IF EXISTS job_applications_candidate_insert ON public.job_applications;

CREATE POLICY job_applications_guest_insert ON public.job_applications
FOR INSERT TO anon
WITH CHECK (
  candidate_profile_id IS NULL
  AND source = 'guest'
  AND status = 'submitted'
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id AND j.status = 'active'
  )
);

CREATE POLICY job_applications_candidate_insert ON public.job_applications
FOR INSERT TO authenticated
WITH CHECK (
  candidate_profile_id = auth.uid()
  AND source = 'registered'
  AND status = 'submitted'
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id AND j.status = 'active'
  )
);

-- RLS still controls which rows can be updated; this trigger controls which
-- columns may change on those rows. It prevents a candidate or employer from
-- rewriting the identity, job, contact, or ownership fields of an application.
CREATE OR REPLACE FUNCTION public.protect_job_application_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_employer boolean;
  v_is_candidate boolean;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  v_is_candidate := OLD.candidate_profile_id = auth.uid();
  v_is_employer := EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = OLD.job_id
      AND c.owner_profile_id = auth.uid()
  );

  IF v_is_candidate THEN
    NEW.id := OLD.id;
    NEW.job_id := OLD.job_id;
    NEW.candidate_profile_id := OLD.candidate_profile_id;
    NEW.applicant_name := OLD.applicant_name;
    NEW.applicant_email := OLD.applicant_email;
    NEW.applicant_phone := OLD.applicant_phone;
    NEW.cover_letter := OLD.cover_letter;
    NEW.resume_url := OLD.resume_url;
    NEW.portfolio_url := OLD.portfolio_url;
    NEW.source := OLD.source;
    NEW.rejection_reason := OLD.rejection_reason;
    IF NEW.status <> 'withdrawn' OR NEW.candidate_deleted_at IS DISTINCT FROM OLD.candidate_deleted_at THEN
      IF NEW.status <> 'withdrawn' AND NEW.candidate_deleted_at IS NOT DISTINCT FROM OLD.candidate_deleted_at THEN
        NEW.status := OLD.status;
      END IF;
    END IF;
  ELSIF v_is_employer THEN
    NEW.id := OLD.id;
    NEW.job_id := OLD.job_id;
    NEW.candidate_profile_id := OLD.candidate_profile_id;
    NEW.applicant_name := OLD.applicant_name;
    NEW.applicant_email := OLD.applicant_email;
    NEW.applicant_phone := OLD.applicant_phone;
    NEW.cover_letter := OLD.cover_letter;
    NEW.resume_url := OLD.resume_url;
    NEW.portfolio_url := OLD.portfolio_url;
    NEW.source := OLD.source;
    NEW.candidate_deleted_at := OLD.candidate_deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_job_application_fields ON public.job_applications;
CREATE TRIGGER protect_job_application_fields
BEFORE UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.protect_job_application_fields();

REVOKE ALL ON FUNCTION public.protect_job_application_fields() FROM PUBLIC;

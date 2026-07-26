/* Normalized job fields for reliable discovery filters. */

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS salary_min integer,
  ADD COLUMN IF NOT EXISTS salary_max integer,
  ADD COLUMN IF NOT EXISTS salary_currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS salary_period text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS work_authorization text NOT NULL DEFAULT 'anywhere';

UPDATE public.jobs
SET work_authorization = 'anywhere'
WHERE work_authorization IS NULL;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_experience_level_check,
  DROP CONSTRAINT IF EXISTS jobs_salary_range_check,
  DROP CONSTRAINT IF EXISTS jobs_salary_period_check,
  DROP CONSTRAINT IF EXISTS jobs_work_authorization_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_experience_level_check
    CHECK (experience_level IS NULL OR experience_level IN ('entry', 'junior', 'mid', 'senior', 'lead')),
  ADD CONSTRAINT jobs_salary_range_check
    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min),
  ADD CONSTRAINT jobs_salary_period_check
    CHECK (salary_period IN ('hour', 'month', 'year')),
  ADD CONSTRAINT jobs_work_authorization_check
    CHECK (work_authorization IN ('anywhere', 'authorized_only', 'sponsorship_available'));

CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON public.jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_min ON public.jobs(salary_min);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_max ON public.jobs(salary_max);
CREATE INDEX IF NOT EXISTS idx_jobs_work_authorization ON public.jobs(work_authorization);

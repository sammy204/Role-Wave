/*
# NaijaJobs Database Schema

1. New Tables
- `companies` — verified companies posting jobs
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `slug` (text, unique, not null)
  - `logo_initials` (text, not null) — 2-letter initials for avatar
  - `avatar_color` (text, not null) — teal/blue/amber/purple/coral
  - `location` (text)
  - `website` (text)
  - `description` (text)
  - `verified` (boolean, default true)
  - `job_count` (integer, default 0)
  - `created_at` (timestamp)

- `jobs` — individual job listings
  - `id` (uuid, primary key)
  - `title` (text, not null)
  - `slug` (text, unique, not null)
  - `company_id` (uuid, references companies)
  - `description` (text, not null)
  - `requirements` (text, not null)
  - `what_youll_do` (text)
  - `location` (text, not null)
  - `work_type` (text, not null) — Remote / Hybrid / On-site
  - `job_type` (text, not null) — Full-time / Part-time / Contract / Internship
  - `salary` (text)
  - `tags` (text array)
  - `featured` (boolean, default false)
  - `status` (text, default 'active') — active / pending / closed
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

- `job_submissions` — unverified job submissions from employers
  - `id` (uuid, primary key)
  - `job_title` (text, not null)
  - `company_name` (text, not null)
  - `city` (text, not null)
  - `work_type` (text, not null)
  - `job_type` (text, not null)
  - `salary` (text)
  - `description` (text, not null)
  - `requirements` (text, not null)
  - `how_to_apply` (text, not null)
  - `contact_email` (text, not null)
  - `status` (text, default 'pending')
  - `created_at` (timestamp)

2. Security
- Enable RLS on all tables.
- Allow public read access to companies and active jobs.
- Allow public insert to job_submissions.
- No auth required for this job board.
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_initials text NOT NULL,
  avatar_color text NOT NULL DEFAULT 'teal',
  location text,
  website text,
  description text,
  verified boolean NOT NULL DEFAULT true,
  job_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  requirements text NOT NULL,
  what_youll_do text,
  location text NOT NULL,
  work_type text NOT NULL,
  job_type text NOT NULL,
  salary text,
  tags text[] DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title text NOT NULL,
  company_name text NOT NULL,
  city text NOT NULL,
  work_type text NOT NULL,
  job_type text NOT NULL,
  salary text,
  description text NOT NULL,
  requirements text NOT NULL,
  how_to_apply text NOT NULL,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_submissions ENABLE ROW LEVEL SECURITY;

-- Companies: public read
DROP POLICY IF EXISTS "companies_public_select" ON companies;
CREATE POLICY "companies_public_select" ON companies FOR SELECT
TO anon, authenticated USING (true);

-- Jobs: public read only active jobs
DROP POLICY IF EXISTS "jobs_public_select" ON jobs;
CREATE POLICY "jobs_public_select" ON jobs FOR SELECT
TO anon, authenticated USING (status = 'active');

-- Job submissions: public insert
DROP POLICY IF EXISTS "submissions_public_insert" ON job_submissions;
CREATE POLICY "submissions_public_insert" ON job_submissions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "submissions_public_select" ON job_submissions;
CREATE POLICY "submissions_public_select" ON job_submissions FOR SELECT
TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_featured ON jobs(featured);
CREATE INDEX IF NOT EXISTS idx_jobs_work_type ON jobs(work_type);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

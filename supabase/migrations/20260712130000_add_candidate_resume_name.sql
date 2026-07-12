ALTER TABLE public.candidate_profiles
ADD COLUMN IF NOT EXISTS resume_name text;

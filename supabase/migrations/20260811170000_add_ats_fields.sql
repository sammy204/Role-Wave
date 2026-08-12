ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rolewave';

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS application_url TEXT;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_external_id_unique
ON public.jobs (source, external_id)
WHERE external_id IS NOT NULL;

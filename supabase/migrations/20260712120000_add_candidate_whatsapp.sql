ALTER TABLE public.candidate_profiles
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS visibility_to_employers text NOT NULL DEFAULT 'open';

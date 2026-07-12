/*
Candidate profile media and recruiter-facing details.
*/

ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS work_authorization text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-assets', 'candidate-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "candidate_assets_public_read" ON storage.objects;
CREATE POLICY "candidate_assets_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'candidate-assets');

DROP POLICY IF EXISTS "candidate_assets_self_insert" ON storage.objects;
CREATE POLICY "candidate_assets_self_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'candidate-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "candidate_assets_self_update" ON storage.objects;
CREATE POLICY "candidate_assets_self_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'candidate-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'candidate-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "candidate_assets_self_delete" ON storage.objects;
CREATE POLICY "candidate_assets_self_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'candidate-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

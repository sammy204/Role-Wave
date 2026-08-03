/* Make candidate resumes and avatars private and authorize signed URLs. */

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'candidate-assets';

DROP POLICY IF EXISTS candidate_assets_public_read ON storage.objects;
DROP POLICY IF EXISTS "candidate_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS candidate_assets_authorized_read ON storage.objects;

CREATE POLICY candidate_assets_authorized_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'candidate-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.job_applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.companies c ON c.id = j.company_id
      JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
      WHERE (storage.foldername(storage.objects.name))[1] = cp.id::text
        AND a.status <> 'withdrawn'
        AND a.candidate_deleted_at IS NULL
        AND cp.visibility_to_employers <> 'hidden'
        AND c.owner_profile_id = auth.uid()
    )
  )
);

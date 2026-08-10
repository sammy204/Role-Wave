/* Allow admins to remove stale, reviewed submission records. */

DROP POLICY IF EXISTS "job_submissions_admin_delete" ON public.job_submissions;
CREATE POLICY "job_submissions_admin_delete" ON public.job_submissions
FOR DELETE
TO authenticated
USING (
  status <> 'pending'
  AND public.is_admin_user()
);

/*
Application tracking pipeline.

- Add 'interview' and 'offer' stages between shortlisted and hired.
- Add an optional rejection reason employers can leave when rejecting.
- Existing values ('submitted', 'reviewed', 'shortlisted', 'rejected',
  'hired', 'withdrawn') are unchanged; this only widens the allowed set.

Canonical pipeline (see src/lib/applicationPipeline.ts for the ordered
stage list + display labels used by both dashboards):
  submitted -> reviewed -> shortlisted -> interview -> offer -> hired
  rejected is a side-exit available from any stage.
  withdrawn is a candidate-only side-exit, hidden from employers.
*/

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN (
    'submitted',
    'reviewed',
    'shortlisted',
    'interview',
    'offer',
    'rejected',
    'hired',
    'withdrawn'
  ));

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text;
/*
# Fix: public read access to job_submissions (contact_email leak)

Issue: "submissions_public_select" (USING (true), TO anon, authenticated) was
correctly dropped in 20260622123000_admin_auth_and_review.sql, replaced with
an admin-only policy. It was then unintentionally recreated in
20260622160000_repair_missing_job_board_tables.sql (a same-day migration
meant to repair missing tables, apparently copy-pasted from the original
schema without noticing it reintroduced this). Postgres RLS SELECT policies
OR together, so the permissive public policy has been live ever since,
completely overriding the admin-only one stacked next to it.

Effect: anyone, unauthenticated, can currently read every row of
job_submissions directly via the REST API with just the anon key --
including job_title, company_name, description, and contact_email for every
submission ever made (pending, approved, and rejected).

Confirmed via client-code search: job_submissions is only referenced in
AdminDashboard.tsx (read + status update). There is no insert path anywhere
in src/ -- the public submission form was retired when the employer-account
posting flow (jobs table, verified employer / admin-gated) replaced it.
This table now holds only legacy data with no active write feature
depending on public insert either.
*/

-- 1. Close the read leak: drop the permissive public SELECT policy.
--    job_submissions_admin_select (is_admin_user()-gated) remains, which is
--    the only thing AdminDashboard.tsx needs.
DROP POLICY IF EXISTS "submissions_public_select" ON public.job_submissions;
DROP POLICY IF EXISTS "job_submissions_public_select" ON public.job_submissions;

-- 2. Also drop the public INSERT policy. Confirmed dead: no client code
--    inserts into job_submissions anymore, so this only ever served as an
--    open door for spam/junk rows against a table nobody writes to
--    legitimately. If a public "submit a job for review" form is ever
--    reintroduced, re-add a scoped insert policy (and ideally a
--    SECURITY DEFINER RPC with basic validation/rate limiting instead of a
--    raw table-level policy) at that point.
DROP POLICY IF EXISTS "submissions_public_insert" ON public.job_submissions;

-- Sanity: confirm exactly one SELECT policy remains (admin-only) and no
-- INSERT policy remains for anon/authenticated. Run after applying:
--
-- select polname, polcmd, polroles::regrole[]
-- from pg_policy
-- where polrelid = 'public.job_submissions'::regclass;
--
-- Expect: job_submissions_admin_select (SELECT), job_submissions_admin_update (UPDATE).
-- No INSERT or public SELECT policy should remain.
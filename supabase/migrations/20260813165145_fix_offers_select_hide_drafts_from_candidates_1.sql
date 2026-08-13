-- Fix: candidates could see draft offers (salary/terms) before employer sent them.
-- offers_select previously had no status filter for candidates:
--   (candidate_profile_id = auth.uid()) OR (employer_profile_id = auth.uid())
-- Now candidates only see offers once status has moved off 'draft'.
-- Employers are unaffected — they still see their own offers including drafts.

drop policy if exists offers_select on public.offers;

create policy offers_select on public.offers
for select
using (
  (employer_profile_id = auth.uid())
  or (candidate_profile_id = auth.uid() and status <> 'draft')
);

/*
Backfill company ownership so employer dashboards can read job applications
for companies that were created before owner_profile_id was always written.
*/

update public.companies c
set owner_profile_id = ep.id
from public.employer_profiles ep
where ep.company_id = c.id
  and c.owner_profile_id is null;

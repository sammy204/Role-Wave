-- Allow an authenticated employer to create jobs only for their own company.
-- Some existing projects have the jobs table and RLS enabled but are missing
-- the marketplace employer policies.

alter table public.companies
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null;

-- Repair companies created before owner_profile_id was populated by onboarding.
update public.companies c
set owner_profile_id = ep.id
from public.employer_profiles ep
where ep.company_id = c.id
  and c.owner_profile_id is distinct from ep.id;

alter table public.jobs enable row level security;

drop policy if exists "jobs_employer_insert" on public.jobs;
create policy "jobs_employer_insert"
on public.jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies c
    where c.id = company_id
      and c.owner_profile_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

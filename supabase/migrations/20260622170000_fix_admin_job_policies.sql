/*
Make admin permissions explicit for job management.

This helper avoids relying on nested RLS lookups during update/delete checks.
*/

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

alter table public.jobs enable row level security;
alter table public.companies enable row level security;
alter table public.job_submissions enable row level security;

drop policy if exists "jobs_admin_insert" on public.jobs;
create policy "jobs_admin_insert"
on public.jobs
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "jobs_admin_update" on public.jobs;
create policy "jobs_admin_update"
on public.jobs
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "jobs_admin_delete" on public.jobs;
create policy "jobs_admin_delete"
on public.jobs
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "companies_admin_insert" on public.companies;
create policy "companies_admin_insert"
on public.companies
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "companies_admin_update" on public.companies;
create policy "companies_admin_update"
on public.companies
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "companies_admin_delete" on public.companies;
create policy "companies_admin_delete"
on public.companies
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "job_submissions_admin_select" on public.job_submissions;
create policy "job_submissions_admin_select"
on public.job_submissions
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "job_submissions_admin_update" on public.job_submissions;
create policy "job_submissions_admin_update"
on public.job_submissions
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

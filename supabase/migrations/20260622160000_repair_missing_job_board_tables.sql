/*
Repair migration for a Supabase project that only has `profiles` applied.

This creates the public job board tables expected by the app:
- companies
- jobs
- job_submissions

It also enables the minimum RLS policies needed for the site to load and for
admins to manage submissions and publish jobs.
*/

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_initials text not null,
  avatar_color text not null default 'teal',
  location text,
  website text,
  description text,
  verified boolean not null default true,
  job_count integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  requirements text not null,
  what_youll_do text,
  location text not null,
  work_type text not null,
  job_type text not null,
  salary text,
  tags text[] default '{}',
  featured boolean not null default false,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  company_name text not null,
  city text not null,
  work_type text not null,
  job_type text not null,
  salary text,
  description text not null,
  requirements text not null,
  how_to_apply text not null,
  contact_email text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.job_submissions enable row level security;

drop policy if exists "companies_public_select" on public.companies;
create policy "companies_public_select"
on public.companies
for select
to anon, authenticated
using (true);

drop policy if exists "jobs_public_select" on public.jobs;
create policy "jobs_public_select"
on public.jobs
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "submissions_public_insert" on public.job_submissions;
create policy "submissions_public_insert"
on public.job_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "submissions_public_select" on public.job_submissions;
create policy "submissions_public_select"
on public.job_submissions
for select
to anon, authenticated
using (true);

drop policy if exists "job_submissions_admin_select" on public.job_submissions;
create policy "job_submissions_admin_select"
on public.job_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "job_submissions_admin_update" on public.job_submissions;
create policy "job_submissions_admin_update"
on public.job_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "jobs_admin_insert" on public.jobs;
create policy "jobs_admin_insert"
on public.jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "jobs_admin_update" on public.jobs;
create policy "jobs_admin_update"
on public.jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "jobs_admin_delete" on public.jobs;
create policy "jobs_admin_delete"
on public.jobs
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "companies_admin_insert" on public.companies;
create policy "companies_admin_insert"
on public.companies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "companies_admin_update" on public.companies;
create policy "companies_admin_update"
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "companies_admin_delete" on public.companies;
create policy "companies_admin_delete"
on public.companies
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

create index if not exists idx_jobs_company on public.jobs(company_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_featured on public.jobs(featured);
create index if not exists idx_jobs_work_type on public.jobs(work_type);
create index if not exists idx_jobs_job_type on public.jobs(job_type);
create index if not exists idx_jobs_location on public.jobs(location);
create index if not exists idx_jobs_created on public.jobs(created_at desc);

 create table if not exists public.ats_source_companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  ats_platform text not null,
  display_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ats_source_companies_platform_check check (
    ats_platform in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable')
  ),
  constraint ats_source_companies_platform_slug_key unique (ats_platform, slug)
);
alter table public.ats_source_companies
  drop constraint if exists ats_source_companies_platform_check;
alter table public.ats_source_companies
  drop constraint if exists ats_source_companies_ats_platform_check;

alter table public.ats_source_companies
  add constraint ats_source_companies_platform_check check (
    ats_platform in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable')
  );

create index if not exists idx_ats_source_companies_enabled
  on public.ats_source_companies (enabled);

alter table public.ats_source_companies enable row level security;

drop policy if exists "jobs_admin_select" on public.jobs;
create policy "jobs_admin_select"
on public.jobs for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "ats_sources_admin_select" on public.ats_source_companies;
create policy "ats_sources_admin_select"
on public.ats_source_companies for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "ats_sources_admin_write" on public.ats_source_companies;
create policy "ats_sources_admin_write"
on public.ats_source_companies for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'rolewave-ats-import') then
    perform cron.unschedule('rolewave-ats-import');
  end if;

  perform cron.schedule(
    'rolewave-ats-import',
    '0 */6 * * *',
    $job$select net.http_post(
      url := 'https://nabaanirclmqzyrfuznf.supabase.co/functions/v1/import-jobs-ats',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ats_ingest_webhook_secret' limit 1)
      ),
      body := '{}'::jsonb
    );$job$
  );
end;
$$;

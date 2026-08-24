/* Privacy-aware first-party product analytics. No message, resume, or form contents are stored. */
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'page_view', 'job_search', 'job_view', 'job_saved',
    'application_started', 'application_submitted', 'signup_completed',
    'pwa_installed', 'passkey_enabled', 'job_posted', 'report_submitted'
  )),
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  path text,
  platform text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_properties_object check (jsonb_typeof(properties) = 'object')
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_created_at_idx on public.analytics_events (event_name, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert on public.analytics_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists analytics_events_admin_select on public.analytics_events;
create policy analytics_events_admin_select on public.analytics_events
  for select to authenticated
  using (public.is_admin_user());

revoke update, delete on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

notify pgrst, 'reload schema';

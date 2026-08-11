-- Rate-limit log for webhook-secret-authenticated edge functions.
--
-- send-welcome-email currently has no cap on how many times it can be
-- called if the webhook secret leaks (as it did during manual testing on
-- 2026-08-09). This table lets the function self-throttle: it inserts a
-- row per call, then checks how many calls have landed for the same
-- endpoint in the last rolling window before doing any real work.
--
-- No RLS policies are defined on purpose — only the service_role key
-- (used by edge functions) can read/write this table. anon and
-- authenticated get nothing, so it can't be read or tampered with from
-- the client.

create table if not exists public.webhook_call_log (
  id bigint generated always as identity primary key,
  endpoint text not null,
  called_at timestamptz not null default now()
);

create index if not exists idx_webhook_call_log_endpoint_called_at
  on public.webhook_call_log (endpoint, called_at desc);

alter table public.webhook_call_log enable row level security;

-- Opportunistic cleanup so this table doesn't grow forever. Cheap to run
-- since it's indexed on (endpoint, called_at) and only runs once per call.
create or replace function public.prune_webhook_call_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webhook_call_log
  where called_at < now() - interval '1 hour';
$$;
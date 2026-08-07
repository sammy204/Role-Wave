-- Lightweight presence tracking so server-side code (the message push
-- edge function) can tell whether a user's app is currently open and
-- visible, without needing a websocket/presence-channel roundtrip.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;
-- Intentionally no policies: this table is only ever written via the
-- touch_presence() SECURITY DEFINER RPC below (scoped to auth.uid()) and
-- only ever read by the service role inside edge functions. No direct
-- client access is needed or granted, mirroring the notifications table
-- pattern (insert-only-via-RPC).

create or replace function public.touch_presence(p_online boolean default true)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.user_presence (user_id, is_online, last_seen_at)
  values (auth.uid(), p_online, now())
  on conflict (user_id) do update
    set is_online = excluded.is_online,
        last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.touch_presence(boolean) from public;
grant execute on function public.touch_presence(boolean) to authenticated;

notify pgrst, 'reload schema';

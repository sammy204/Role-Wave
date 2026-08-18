create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists idx_device_push_tokens_user_enabled
  on public.device_push_tokens (user_id, enabled);

alter table public.device_push_tokens enable row level security;

drop policy if exists device_push_tokens_owner_select on public.device_push_tokens;
create policy device_push_tokens_owner_select on public.device_push_tokens
  for select using (user_id = auth.uid());

drop policy if exists device_push_tokens_owner_insert on public.device_push_tokens;
create policy device_push_tokens_owner_insert on public.device_push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists device_push_tokens_owner_update on public.device_push_tokens;
create policy device_push_tokens_owner_update on public.device_push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists device_push_tokens_owner_delete on public.device_push_tokens;
create policy device_push_tokens_owner_delete on public.device_push_tokens
  for delete using (user_id = auth.uid());

create or replace function public.touch_device_push_token_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists device_push_tokens_touch_updated_at on public.device_push_tokens;
create trigger device_push_tokens_touch_updated_at
  before update on public.device_push_tokens
  for each row execute function public.touch_device_push_token_updated_at();

notify pgrst, 'reload schema';

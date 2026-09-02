-- Paid access for RoleWave AI features.
-- Payment providers should create/update these rows from a trusted webhook.

create table if not exists public.ai_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  product text not null default 'ai_features',
  status text not null default 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_entitlements_product_check check (product = 'ai_features'),
  constraint ai_entitlements_status_check check (status in ('active', 'past_due', 'cancelled', 'expired'))
);

alter table public.ai_entitlements enable row level security;

drop policy if exists "ai_entitlements_self_select" on public.ai_entitlements;
create policy "ai_entitlements_self_select"
on public.ai_entitlements for select to authenticated
using (user_id = auth.uid());

create or replace function public.has_active_ai_entitlement(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_user_id = auth.uid()
    and exists (
      select 1
      from public.ai_entitlements
      where user_id = p_user_id
        and product = 'ai_features'
        and status = 'active'
        and (current_period_end is null or current_period_end > now())
    );
$$;

revoke all on function public.has_active_ai_entitlement(uuid) from public;
grant execute on function public.has_active_ai_entitlement(uuid) to authenticated;

notify pgrst, 'reload schema';

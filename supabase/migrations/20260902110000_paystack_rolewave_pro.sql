create table if not exists public.rolewave_pro_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference text not null unique,
  plan text not null check (plan in ('monthly', 'three_months')),
  amount integer not null check (amount > 0),
  currency text not null default 'NGN',
  status text not null default 'initialized' check (status in ('initialized', 'success', 'failed', 'abandoned')),
  paystack_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rolewave_pro_payments_user on public.rolewave_pro_payments(user_id);
alter table public.rolewave_pro_payments enable row level security;

drop policy if exists "rolewave_pro_payments_self_select" on public.rolewave_pro_payments;
create policy "rolewave_pro_payments_self_select"
on public.rolewave_pro_payments for select to authenticated
using (user_id = auth.uid());

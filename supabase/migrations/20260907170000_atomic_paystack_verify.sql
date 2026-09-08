-- Make browser-driven Paystack verification idempotent and race-safe.
-- The payment row and entitlement are updated in one transaction while the
-- payment row is locked, so concurrent verification requests cannot extend
-- the same purchase more than once.

create or replace function public.complete_rolewave_pro_payment(
  p_reference text,
  p_user_id uuid,
  p_paystack_transaction_id text,
  p_customer_code text,
  p_paid_at timestamptz
)
returns table (
  success boolean,
  already_processed boolean,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.rolewave_pro_payments%rowtype;
  v_current_period_end timestamptz;
  v_base timestamptz;
  v_next_period_end timestamptz;
  v_months integer;
begin
  select *
  into v_payment
  from public.rolewave_pro_payments
  where reference = p_reference
    and user_id = p_user_id
  for update;

  if not found then
    return query select false, false, null::timestamptz;
    return;
  end if;

  if v_payment.status = 'success' then
    select current_period_end
    into v_current_period_end
    from public.ai_entitlements
    where user_id = p_user_id
      and product = 'ai_features';

    return query select true, true, v_current_period_end;
    return;
  end if;

  if v_payment.status <> 'initialized' then
    return query select false, false, null::timestamptz;
    return;
  end if;

  v_months := case when v_payment.plan = 'monthly' then 1 else 3 end;

  select current_period_end
  into v_current_period_end
  from public.ai_entitlements
  where user_id = p_user_id
    and product = 'ai_features'
  for update;

  v_base := case
    when v_current_period_end is not null and v_current_period_end > now()
      then v_current_period_end
    else now()
  end;
  v_next_period_end := v_base + make_interval(months => v_months);

  insert into public.ai_entitlements (
    user_id,
    product,
    status,
    provider,
    provider_customer_id,
    provider_subscription_id,
    current_period_end,
    updated_at
  ) values (
    p_user_id,
    'ai_features',
    'active',
    'paystack',
    p_customer_code,
    null,
    v_next_period_end,
    p_paid_at
  )
  on conflict (user_id) do update set
    status = 'active',
    provider = 'paystack',
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = null,
    current_period_end = excluded.current_period_end,
    updated_at = excluded.updated_at;

  update public.rolewave_pro_payments
  set status = 'success',
      paystack_transaction_id = p_paystack_transaction_id,
      paid_at = p_paid_at,
      updated_at = p_paid_at
  where id = v_payment.id;

  return query select true, false, v_next_period_end;
end;
$$;

revoke all on function public.complete_rolewave_pro_payment(text, uuid, text, text, timestamptz) from public;
grant execute on function public.complete_rolewave_pro_payment(text, uuid, text, text, timestamptz) to service_role;

notify pgrst, 'reload schema';

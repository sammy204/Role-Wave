-- Expose aggregate Pro entitlement metrics to the admin dashboard without
-- allowing admins or regular users to read the entitlement rows directly.

create or replace function public.admin_get_pro_metrics()
returns table (active_pro_users bigint)
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.ai_entitlements
  where public.is_admin_user()
    and product = 'ai_features'
    and status = 'active'
    and (current_period_end is null or current_period_end > now());
$$;

revoke all on function public.admin_get_pro_metrics() from public;
grant execute on function public.admin_get_pro_metrics() to authenticated;

notify pgrst, 'reload schema';

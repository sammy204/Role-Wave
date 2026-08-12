-- Record company removals in the append-only admin activity log.

create or replace function public.log_company_delete_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.record_admin_activity(
    'company.deleted', 'companies', old.id::text,
    format('Deleted company "%s" and its linked jobs.', old.name),
    jsonb_build_object('company_name', old.name, 'job_count', old.job_count)
  );
  return old;
end;
$$;

drop trigger if exists companies_delete_activity_trigger on public.companies;
create trigger companies_delete_activity_trigger
after delete on public.companies
for each row execute function public.log_company_delete_activity();

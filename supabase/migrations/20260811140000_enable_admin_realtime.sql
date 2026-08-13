-- Enable live dashboard updates for the admin workspace.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'jobs',
    'companies',
    'job_submissions',
    'admin_invites',
    'admin_profiles',
    'admin_tasks',
    'admin_activity_log',
    'profiles'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- The task list is still protected by RLS; this policy only lets an admin
-- receive live events for tasks they are allowed to see.
drop policy if exists admin_tasks_select on public.admin_tasks;
create policy admin_tasks_select
  on public.admin_tasks
  for select
  to authenticated
  using (public.is_founder_user() or assigned_to = auth.uid());

grant select on public.admin_tasks to authenticated;

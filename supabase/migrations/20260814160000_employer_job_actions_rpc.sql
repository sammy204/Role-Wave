-- Employer job actions used by the employer dashboard.
-- Keep status changes in a security-definer function so ownership is checked
-- consistently and company.job_count stays in sync with the job status.

create or replace function public.employer_update_job_status(p_job_id uuid, p_status text)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs;
  v_target_status text := lower(trim(p_status));
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_target_status not in ('active', 'filled', 'closed', 'archived') then
    raise exception 'Invalid job status: %', p_status using errcode = '22023';
  end if;

  select j.*
  into v_job
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.id = p_job_id
    and c.owner_profile_id = auth.uid()
  for update of j;

  if not found then
    raise exception 'Job not found or not owned by current employer' using errcode = '42501';
  end if;

  if v_job.status = 'active' and v_target_status <> 'active' then
    update public.companies
    set job_count = greatest(job_count - 1, 0)
    where id = v_job.company_id;
  elsif v_job.status <> 'active' and v_target_status = 'active' then
    update public.companies
    set job_count = job_count + 1
    where id = v_job.company_id;
  end if;

  update public.jobs
  set status = v_target_status,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.employer_update_job_status(uuid, text) from public;
grant execute on function public.employer_update_job_status(uuid, text) to authenticated;

create or replace function public.employer_delete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select j.*
  into v_job
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.id = p_job_id
    and c.owner_profile_id = auth.uid()
  for update of j;

  if not found then
    raise exception 'Job not found or not owned by current employer' using errcode = '42501';
  end if;

  if v_job.status = 'active' then
    update public.companies
    set job_count = greatest(job_count - 1, 0)
    where id = v_job.company_id;
  end if;

  delete from public.jobs where id = p_job_id;
end;
$$;

revoke all on function public.employer_delete_job(uuid) from public;
grant execute on function public.employer_delete_job(uuid) to authenticated;

notify pgrst, 'reload schema';

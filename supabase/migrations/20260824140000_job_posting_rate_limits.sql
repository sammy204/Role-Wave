/* Limit employer job creation over a rolling 24-hour window.
   Unverified companies: 5 posts. Verified companies: 10 posts.
   Admins are not subject to the limit. */

create or replace function public.enforce_job_posting_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_id uuid;
  company_is_verified boolean;
  posts_last_24_hours integer;
  posting_limit integer;
begin
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    return new;
  end if;

  select c.owner_profile_id, c.verified
  into owner_id, company_is_verified
  from public.companies c
  where c.id = new.company_id;

  if owner_id is null or owner_id <> auth.uid() then
    return new;
  end if;

  posting_limit := case when company_is_verified then 10 else 5 end;
  perform pg_advisory_xact_lock(hashtext(owner_id::text));

  select count(*)::integer into posts_last_24_hours
  from public.jobs j
  where j.company_id in (select c.id from public.companies c where c.owner_profile_id = owner_id)
    and j.created_at >= now() - interval '24 hours';

  if posts_last_24_hours >= posting_limit then
    raise exception 'POSTING_RATE_LIMIT_REACHED: You can post up to % jobs every 24 hours.', posting_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enforce_posting_rate_limit on public.jobs;
create trigger jobs_enforce_posting_rate_limit
before insert on public.jobs
for each row execute function public.enforce_job_posting_rate_limit();

notify pgrst, 'reload schema';

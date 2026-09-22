drop function if exists public.employer_discover_candidates(text);
create or replace function public.employer_discover_candidates(p_search text default null)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  location text,
  years_experience integer,
  skills text[],
  preferred_locations text[],
  preferred_job_titles text[],
  preferred_salary text,
  job_type text,
  work_preference text,
  availability text,
  resume_url text,
  resume_name text,
  work_authorization text,
  portfolio_url text,
  github_url text,
  linkedin_url text,
  education text,
  experience text,
  projects text,
  open_to_work boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  search_term text := nullif(trim(p_search), '');
begin
  if not exists (
    select 1
    from public.profiles p
    join public.employer_profiles ep on ep.id = p.id
    join public.companies c on c.id = ep.company_id
    where p.id = auth.uid()
      and p.account_type = 'employer'
      and c.owner_profile_id = auth.uid()
      and c.verified = true
  ) then
    raise exception 'Only verified employer accounts can discover candidates.';
  end if;

  return query
  select
    cp.id,
    candidate_account.full_name,
    cp.avatar_url,
    cp.headline,
    cp.bio,
    cp.location,
    cp.years_experience,
    cp.skills,
    cp.preferred_locations,
    cp.preferred_job_titles,
    cp.preferred_salary,
    cp.job_type,
    cp.work_preference,
    cp.availability,
    cp.resume_url,
    cp.resume_name,
    cp.work_authorization,
    cp.portfolio_url,
    cp.github_url,
    cp.linkedin_url,
    cp.education,
    cp.experience,
    cp.projects,
    cp.open_to_work,
    cp.updated_at
  from public.candidate_profiles cp
  join public.profiles candidate_account on candidate_account.id = cp.id
  join public.ai_entitlements entitlement on entitlement.user_id = cp.id
  where cp.visibility_to_employers in ('open', 'not_open')
    and candidate_account.account_type = 'candidate'
    and entitlement.product = 'ai_features'
    and entitlement.status = 'active'
    and (entitlement.current_period_end is null or entitlement.current_period_end > now())
    and (
      search_term is null
      or cp.headline ilike '%' || search_term || '%'
      or cp.bio ilike '%' || search_term || '%'
      or cp.location ilike '%' || search_term || '%'
      or exists (select 1 from unnest(cp.skills) skill where skill ilike '%' || search_term || '%')
      or exists (select 1 from unnest(cp.preferred_job_titles) title where title ilike '%' || search_term || '%')
    )
  order by cp.updated_at desc nulls last;
end;
$$;

revoke all on function public.employer_discover_candidates(text) from public;
grant execute on function public.employer_discover_candidates(text) to authenticated;

drop policy if exists candidate_assets_discoverable_read on storage.objects;
create policy candidate_assets_discoverable_read on storage.objects
for select to authenticated
using (
  bucket_id = 'candidate-assets'
  and (storage.foldername(name))[2] in ('avatars', 'resumes')
  and exists (
    select 1
    from public.candidate_profiles cp
    join public.ai_entitlements entitlement on entitlement.user_id = cp.id
    where (storage.foldername(name))[1] = cp.id::text
      and cp.visibility_to_employers in ('open', 'not_open')
      and entitlement.product = 'ai_features'
      and entitlement.status = 'active'
      and (entitlement.current_period_end is null or entitlement.current_period_end > now())
      and exists (
        select 1
        from public.employer_profiles ep
        join public.companies c on c.id = ep.company_id
        where ep.id = auth.uid()
          and c.owner_profile_id = auth.uid()
          and c.verified = true
      )
  )
);

notify pgrst, 'reload schema';

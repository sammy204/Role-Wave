/* Fix ambiguous full_name resolution in the job-scoped candidate matcher. */

create or replace function public.employer_discover_candidates(p_job_id uuid, p_search text default null)
returns table (
  id uuid, full_name text, avatar_url text, headline text, bio text, location text,
  years_experience integer, skills text[], preferred_locations text[], preferred_job_titles text[],
  preferred_salary text, job_type text, work_preference text, availability text,
  resume_url text, resume_name text, work_authorization text, portfolio_url text,
  github_url text, linkedin_url text, education text, experience text, projects text,
  open_to_work boolean, match_score integer, match_reasons text[], updated_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare
  search_term text := nullif(trim(p_search), '');
begin
  if not exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    join public.employer_profiles ep on ep.company_id = c.id
    join public.profiles employer_account on employer_account.id = ep.id
    where j.id = p_job_id and c.owner_profile_id = auth.uid()
      and c.verified = true and employer_account.account_type = 'employer'
  ) then
    raise exception 'Only verified employers can discover candidates for their own jobs.';
  end if;

  return query
  with job_context as (
    select j.*, lower(concat_ws(' ', j.title, j.description, j.requirements, j.tags::text)) as job_text
    from public.jobs j where j.id = p_job_id and j.status = 'active'
  ), scored as (
    select cp.id as candidate_id, candidate_account.full_name as candidate_name, cp.avatar_url as candidate_avatar_url,
      cp.headline, cp.bio, cp.location, cp.years_experience, cp.skills, cp.preferred_locations,
      cp.preferred_job_titles, cp.preferred_salary, cp.job_type, cp.work_preference, cp.availability,
      cp.resume_url, cp.resume_name, cp.work_authorization, cp.portfolio_url, cp.github_url,
      cp.linkedin_url, cp.education, cp.experience, cp.projects, cp.open_to_work, cp.updated_at,
      (
        (case when exists (select 1 from public.job_applications a where a.job_id = p_job_id and a.candidate_profile_id = cp.id) then 10 else 0 end)
        + (case when exists (select 1 from unnest(cp.skills) skill, unnest(j.tags) tag where lower(skill) = lower(tag)) then 5 else 0 end)
        + (case when lower(j.title) like '%' || lower(cp.headline) || '%' or lower(cp.headline) like '%' || lower(j.title) || '%' then 4 else 0 end)
        + (case when exists (select 1 from unnest(cp.preferred_job_titles) title where j.job_text like '%' || lower(title) || '%') then 4 else 0 end)
        + (case when cp.location is not null and (lower(j.location) like '%' || lower(cp.location) || '%' or lower(cp.location) like '%' || lower(j.location) || '%') then 2 else 0 end)
        + (case when cp.work_preference is not null and lower(j.work_type) like '%' || lower(cp.work_preference) || '%' then 1 else 0 end)
      )::integer as calculated_score,
      array_remove(array[
        case when exists (select 1 from public.job_applications a where a.job_id = p_job_id and a.candidate_profile_id = cp.id) then 'Applied to this job' end,
        case when exists (select 1 from unnest(cp.skills) skill, unnest(j.tags) tag where lower(skill) = lower(tag)) then 'Matching skills' end,
        case when lower(j.title) like '%' || lower(cp.headline) || '%' or lower(cp.headline) like '%' || lower(j.title) || '%' then 'Related role' end,
        case when exists (select 1 from unnest(cp.preferred_job_titles) title where j.job_text like '%' || lower(title) || '%') then 'Role preference match' end,
        case when cp.location is not null and (lower(j.location) like '%' || lower(cp.location) || '%' or lower(cp.location) like '%' || lower(j.location) || '%') then 'Location match' end
      ], null)::text[] as calculated_reasons
    from public.candidate_profiles cp
    join public.profiles candidate_account on candidate_account.id = cp.id
    cross join job_context j
    where (
      exists (select 1 from public.job_applications a where a.job_id = p_job_id and a.candidate_profile_id = cp.id)
      or (
        cp.visibility_to_employers in ('open', 'not_open')
        and exists (select 1 from public.ai_entitlements e where e.user_id = cp.id and e.product = 'ai_features' and e.status = 'active' and (e.current_period_end is null or e.current_period_end > now()))
        and (exists (select 1 from unnest(cp.skills) skill, unnest(j.tags) tag where lower(skill) = lower(tag))
          or lower(j.title) like '%' || lower(cp.headline) || '%'
          or lower(cp.headline) like '%' || lower(j.title) || '%'
          or exists (select 1 from unnest(cp.preferred_job_titles) title where j.job_text like '%' || lower(title) || '%'))
      )
    ) and candidate_account.account_type = 'candidate'
  )
  select s.candidate_id, s.candidate_name, s.candidate_avatar_url, s.headline, s.bio, s.location,
    s.years_experience, s.skills, s.preferred_locations, s.preferred_job_titles, s.preferred_salary,
    s.job_type, s.work_preference, s.availability, s.resume_url, s.resume_name, s.work_authorization,
    s.portfolio_url, s.github_url, s.linkedin_url, s.education, s.experience, s.projects,
    s.open_to_work, s.calculated_score, s.calculated_reasons, s.updated_at
  from scored s
  where search_term is null or s.candidate_name ilike '%' || search_term || '%'
    or s.headline ilike '%' || search_term || '%' or s.location ilike '%' || search_term || '%'
    or exists (select 1 from unnest(s.skills) skill where skill ilike '%' || search_term || '%')
  order by s.calculated_score desc, s.updated_at desc nulls last;
end;
$$;

notify pgrst, 'reload schema';

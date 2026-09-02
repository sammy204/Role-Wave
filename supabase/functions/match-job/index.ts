import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Candidate = {
  headline: string | null;
  bio: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[];
  preferred_locations: string[];
  preferred_job_titles: string[];
  work_preference: string | null;
  work_authorization: string | null;
};

type Job = {
  title: string;
  description: string;
  requirements: string;
  location: string;
  work_type: string;
  tags: string[];
  experience_level: string | null;
  work_authorization: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401);

  const { data: entitled, error: entitlementError } = await userClient.rpc('has_active_ai_entitlement', { p_user_id: userData.user.id });
  if (entitlementError) return json({ error: 'AI access could not be verified.' }, 500);
  if (!entitled) return json({ error: 'AI match checks require an active RoleWave Pro plan.' }, 402);

  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.job_id === 'string' ? body.job_id : '';
  if (!jobId) return json({ error: 'A job is required.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const [{ data: candidate, error: candidateError }, { data: job, error: jobError }] = await Promise.all([
    admin.from('candidate_profiles').select('headline, bio, location, years_experience, skills, preferred_locations, preferred_job_titles, work_preference, work_authorization').eq('id', userData.user.id).maybeSingle(),
    admin.from('jobs').select('title, description, requirements, location, work_type, tags, experience_level, work_authorization').eq('id', jobId).eq('status', 'active').maybeSingle(),
  ]);
  if (candidateError || jobError) return json({ error: 'Could not load match information.' }, 500);
  if (!candidate) return json({ error: 'Complete your candidate profile to check your match.' }, 400);
  if (!job) return json({ error: 'Job not found.' }, 404);

  return json({ ...calculateMatch(candidate as Candidate, job as Job), job_id: jobId });
});

function calculateMatch(candidate: Candidate, job: Job) {
  const candidateText = [candidate.headline, candidate.bio, ...(candidate.skills || []), ...(candidate.preferred_job_titles || [])].filter(Boolean).join(' ').toLowerCase();
  const jobText = [job.title, job.description, job.requirements, ...(job.tags || [])].filter(Boolean).join(' ').toLowerCase();
  const skills = (candidate.skills || []).filter((skill) => jobText.includes(skill.toLowerCase()));
  const titleMatch = (candidate.preferred_job_titles || []).some((title) => job.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(job.title.toLowerCase())) || candidateText.includes(job.title.toLowerCase());
  const locationMatch = !candidate.preferred_locations?.length || candidate.preferred_locations.some((location) => job.location.toLowerCase().includes(location.toLowerCase()));
  const workMatch = !candidate.work_preference || candidate.work_preference.toLowerCase() === job.work_type.toLowerCase();
  const authorizationMatch = !job.work_authorization || job.work_authorization === 'anywhere' || !candidate.work_authorization || candidate.work_authorization === job.work_authorization;
  const experienceMatch = !job.experience_level || candidate.years_experience === null || experienceFits(candidate.years_experience, job.experience_level);

  const score = Math.max(0, Math.min(100, Math.round(
    Math.min(skills.length / Math.max((job.tags || []).length, 3), 1) * 45 +
    (titleMatch ? 20 : 0) +
    (locationMatch ? 12 : 0) +
    (workMatch ? 8 : 0) +
    (experienceMatch ? 10 : 0) +
    (authorizationMatch ? 5 : 0),
  )));

  return {
    score,
    summary: score >= 75 ? 'Strong match' : score >= 50 ? 'Promising match' : 'Some alignment',
    matched_skills: skills.slice(0, 8),
    strengths: [titleMatch && 'Relevant role interests', skills.length > 0 && `${skills.length} matching skill${skills.length === 1 ? '' : 's'}`, locationMatch && 'Location preference', workMatch && 'Work preference'].filter(Boolean),
    gaps: [!titleMatch && 'Role title is not in your preferred roles', skills.length === 0 && 'No matching skills found', !locationMatch && 'Location differs from your preferences', !experienceMatch && 'Experience level may be a stretch'].filter(Boolean),
  };
}

function experienceFits(years: number, level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes('entry') || normalized.includes('junior')) return years <= 3;
  if (normalized.includes('mid')) return years >= 2;
  if (normalized.includes('senior') || normalized.includes('lead')) return years >= 5;
  return true;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function corsHeaders(request?: Request) {
  return {
    'Access-Control-Allow-Origin': request?.headers.get('Origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

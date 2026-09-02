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
};

type Job = {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string;
  location: string;
  work_type: string;
  tags: string[];
  experience_level: string | null;
  companies: { name: string } | null;
};

type Action = 'chat' | 'find_jobs' | 'cover_letter';
type JobSearchResult = {
  id: string;
  title: string;
  slug: string;
  company_name: string;
  location: string;
  work_type: string;
  score: number;
  reasons: string[];
  matched_skills: string[];
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

  const body = await request.json().catch(() => ({}));
  const action: Action = body.action === 'cover_letter' ? 'cover_letter' : body.action === 'chat' ? 'chat' : 'find_jobs';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 500) : '';
  const { data: usage, error: usageError } = await userClient.rpc('consume_role_pilot_use', { p_action_type: action === 'chat' ? 'chat' : action });
  if (usageError) return json({ error: 'Role Pilot usage could not be verified.' }, 500);
  if (!usage?.allowed) return json({ error: 'You have used your 5 free Role Pilot requests this month. Upgrade to RoleWave Pro for unrestricted access.', usage }, 402);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: candidate, error: candidateError } = await admin
    .from('candidate_profiles')
    .select('headline, bio, location, years_experience, skills, preferred_locations, preferred_job_titles, work_preference, experience, education')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (candidateError) return json({ error: 'Could not load your profile.' }, 500);
  if (!candidate) return json({ error: 'Complete your candidate profile before asking Role Pilot for help.', usage }, 400);

  if (action === 'cover_letter') {
    const jobId = typeof body.job_id === 'string' ? body.job_id : '';
    if (!jobId) return json({ error: 'Choose a job first.' }, 400);
    const { data: job, error: jobError } = await admin
      .from('jobs')
      .select('id, title, description, requirements, company_id, companies:company_id(name)')
      .eq('id', jobId)
      .eq('status', 'active')
      .maybeSingle();
    if (jobError) return json({ error: 'Could not load that job.' }, 500);
    if (!job) return json({ error: 'Job not found.' }, 404);
    return json({ action, usage, job_id: jobId, cover_letter: buildCoverLetter(candidate as Candidate & { experience: string | null; education: string | null }, job as { title: string; description: string; requirements: string; companies: { name: string } | null }) });
  }

  const { data: jobs, error: jobsError } = await admin.from('jobs').select('id, title, slug, description, requirements, location, work_type, tags, experience_level, companies:company_id(name)').eq('status', 'active').order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(250);
  /* Keep the result set limited to active RoleWave jobs; unpublished jobs never reach the model or client. */
  if (jobsError) return json({ error: 'Could not search RoleWave jobs.' }, 500);

  const intent = action === 'chat' ? detectIntent(prompt) : 'job_search';
  const resultLimit = intent === 'job_search' ? intentResultLimit(prompt) : 0;
  const results = (jobs as Job[] || [])
    .map((job) => scoreJob(candidate as Candidate, job, prompt))
    .sort((a, b) => b.score - a.score)
    .slice(0, resultLimit);

  if (action === 'chat') {
    const messages = Array.isArray(body.messages) ? body.messages.filter((message: unknown): message is { role: 'user' | 'assistant'; content: string } => Boolean(message && typeof message === 'object' && ['user', 'assistant'].includes((message as { role?: string }).role || '') && typeof (message as { content?: unknown }).content === 'string')).slice(-12) : [];
    const assistantMessage = await generateChatReply(messages, candidate as Candidate, intent === 'cover_letter' ? [] : results, intent);
    return json({ action, usage, message: assistantMessage, results: intent === 'cover_letter' ? [] : results, intent });
  }

  return json({ action, prompt, usage, results });
});

function detectIntent(prompt: string): 'cover_letter' | 'resume_tweak' | 'job_search' | 'general' {
  const normalized = prompt.toLowerCase();
  if (/(cover\s*letter|application letter|motivation letter)/.test(normalized)) return 'cover_letter';
  if (/(resume|cv)\s+(tweak|tailor|edit|improve|rewrite)/.test(normalized)) return 'resume_tweak';
  if (/(find|search|show|recommend|look for|job|role|position|vacanc)/.test(normalized)) return 'job_search';
  return 'general';
}

function intentResultLimit(prompt: string) {
  const requested = prompt.match(/\b(?:find|show|give|get|list)\s+(?:me\s+)?(\d{1,2})\b/i)?.[1];
  return requested ? Math.max(1, Math.min(Number(requested), 20)) : 8;
}

async function generateChatReply(messages: { role: 'user' | 'assistant'; content: string }[], candidate: Candidate, results: JobSearchResult[], intent: 'cover_letter' | 'resume_tweak' | 'job_search' | 'general') {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const latestMessage = messages[messages.length - 1]?.content || '';
  if (!apiKey) {
    if (intent === 'cover_letter') return 'I can write that for you. Which job should I use? Choose one of the job cards above, then select “Write cover letter.”';
    if (intent === 'resume_tweak') return 'I can help tailor your resume. Tell me which job you want to target and what part of your resume you want to improve.';
    if (intent === 'general') return 'Hello! I’m here to help with your job search. You can ask me to find jobs, write a cover letter, tailor your resume, or explain how well a role fits your profile.';
    return results.length > 0
      ? `I found ${results.length} active RoleWave jobs that fit your request. Review the job cards below and choose one if you want a cover letter.`
      : `I couldn’t find a close match yet. Try telling me a job title, location, seniority level, or work preference.`;
  }

  const jobContext = results.map((job) => `${job.title} at ${job.company_name} | ${job.location} | ${job.work_type} | ${job.score}% match | ${job.reasons.join(', ')}`).join('\n');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      instructions: `You are Role Pilot, a practical and honest career assistant for RoleWave. Only recommend jobs from the supplied RoleWave job context. Do not invent qualifications, employers, or jobs. Help the candidate with job search, applications, cover letters, and resume improvements. If the candidate asks for a cover letter but has not selected a specific job, ask them to choose one of the listed jobs; do not start a new search or write a generic letter. Candidate profile: ${candidate.headline || 'No headline'}; skills: ${(candidate.skills || []).join(', ') || 'none listed'}; experience: ${candidate.years_experience ?? 'not specified'} years. Current RoleWave job context:\n${jobContext || 'No matching jobs found.'}`,
      input: messages.length ? messages : [{ role: 'user', content: latestMessage }],
      max_output_tokens: 900,
    }),
  });
  if (!response.ok) {
    console.error('OpenAI Role Pilot request failed:', response.status, await response.text().catch(() => ''));
    if (intent === 'cover_letter') return 'I can write a cover letter for you. Choose a job from the conversation, then select “Write cover letter.”';
    if (intent === 'resume_tweak') return 'I can help improve your resume. Tell me which job you want to target and paste the section you want to revise.';
    if (intent === 'general') return 'Hello! I’m here to help with your job search. Ask me to find jobs, write a cover letter, tailor your resume, or explain a match.';
    return results.length > 0 ? `I found ${results.length} matching RoleWave jobs. Review the cards below.` : 'I couldn’t find a close match yet. Try adding a title, location, seniority level, or work preference.';
  }
  const payload = await response.json() as { output_text?: string };
  return payload.output_text?.trim() || 'I found some options for you. Review the job cards below.';
}

function scoreJob(candidate: Candidate, job: Job, prompt: string) {
  const jobText = [job.title, job.description, job.requirements, job.location, job.work_type, ...(job.tags || [])].join(' ').toLowerCase();
  const requestedWords = words(prompt);
  const profileSkills = candidate.skills || [];
  const matchedSkills = profileSkills.filter((skill) => jobText.includes(skill.toLowerCase()));
  const requestedMatches = requestedWords.filter((word) => jobText.includes(word));
  const titleMatch = (candidate.preferred_job_titles || []).some((title) => job.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(job.title.toLowerCase()));
  const locationMatch = !candidate.preferred_locations?.length || candidate.preferred_locations.some((location) => job.location.toLowerCase().includes(location.toLowerCase()));
  const workMatch = !candidate.work_preference || candidate.work_preference.toLowerCase() === job.work_type.toLowerCase();
  const score = Math.min(100, Math.round(
    Math.min(matchedSkills.length / Math.max(profileSkills.length, 3), 1) * 40 +
    Math.min(requestedMatches.length / Math.max(requestedWords.length, 1), 1) * 30 +
    (titleMatch ? 15 : 0) + (locationMatch ? 10 : 0) + (workMatch ? 5 : 0),
  ));
  const reasons = [matchedSkills.length > 0 && `${matchedSkills.length} profile skill${matchedSkills.length === 1 ? '' : 's'} match`, requestedMatches.length > 0 && 'Matches your request', titleMatch && 'Fits your preferred roles', locationMatch && 'Fits your location preferences', workMatch && 'Fits your work preference'].filter(Boolean) as string[];
  return { id: job.id, title: job.title, slug: job.slug, company_name: job.companies?.name || 'RoleWave employer', location: job.location, work_type: job.work_type, score, reasons, matched_skills: matchedSkills.slice(0, 6) };
}

function buildCoverLetter(candidate: Candidate & { experience: string | null; education: string | null }, job: { title: string; description: string; requirements: string; companies: { name: string } | null }) {
  const name = candidate.headline || 'A motivated candidate';
  const skills = (candidate.skills || []).slice(0, 5).join(', ') || 'the skills outlined in my profile';
  const background = candidate.experience?.trim() || candidate.bio?.trim() || 'my background and practical experience';
  const company = job.companies?.name || 'your company';
  return `Dear Hiring Manager,\n\nI am writing to express my interest in the ${job.title} role at ${company}. With experience in ${skills}, I am excited by the opportunity to contribute to your team and deliver thoughtful, reliable work.\n\nMy background includes ${background}. These experiences have strengthened my ability to learn quickly, collaborate with others, and focus on the requirements of the role. I am particularly interested in this opportunity because it aligns with my skills and the direction I want to grow in.\n\nI would welcome the opportunity to discuss how my experience could support ${company}. Thank you for taking the time to review my application.\n\nKind regards,\n${name}`;
}

function words(value: string) {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2))];
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function corsHeaders(request?: Request) {
  return { 'Access-Control-Allow-Origin': request?.headers.get('Origin') || '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
}

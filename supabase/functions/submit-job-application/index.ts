import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !turnstileSecret) {
      return json({ error: 'Application security is not configured.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'You must be signed in to apply.' }, 401);

    const body = await request.json().catch(() => ({}));
    const captchaToken = clean(body.captchaToken, 4096);
    if (!captchaToken) return json({ error: 'Please complete the security check and try again.' }, 400);

    const forwardedFor = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
    const turnstilePayload: Record<string, string> = {
      secret: turnstileSecret,
      response: captchaToken,
    };
    if (forwardedFor) turnstilePayload.remoteip = forwardedFor.split(',')[0].trim();

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(turnstilePayload),
    });
    const turnstileResult = await turnstileResponse.json().catch(() => ({ success: false }));
    if (!turnstileResult.success || (turnstileResult.action && turnstileResult.action !== 'job_application')) {
      return json({ error: 'Please complete the security check and try again.' }, 400);
    }

    const jobId = clean(body.jobId, 80);
    const applicantName = clean(body.applicantName, 160);
    const applicantEmail = clean(body.applicantEmail, 254).toLowerCase();
    const applicantPhone = clean(body.applicantPhone, 60);
    const coverLetter = clean(body.coverLetter, 10000);
    const resumeUrl = clean(body.resumeUrl, 1000);
    const portfolioUrl = clean(body.portfolioUrl, 1000);
    if (!jobId || !applicantName || !isValidEmail(applicantEmail)) {
      return json({ error: 'Please provide your name and a valid email address.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('account_type')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.account_type !== 'candidate') return json({ error: 'Only candidate accounts can apply.' }, 403);

    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select('id, apply_method, status')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job || job.status !== 'active' || job.apply_method !== 'internal') {
      return json({ error: 'This job is not accepting applications on RoleWave.' }, 400);
    }

    const { data: existing, error: existingError } = await adminClient
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('candidate_profile_id', userData.user.id)
      .neq('status', 'withdrawn')
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ alreadyApplied: true });

    const { error: insertError } = await adminClient.from('job_applications').insert({
      job_id: jobId,
      candidate_profile_id: userData.user.id,
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      applicant_phone: applicantPhone || null,
      cover_letter: coverLetter || null,
      resume_url: resumeUrl || null,
      portfolio_url: portfolioUrl || null,
      source: 'registered',
    });
    if (insertError) {
      if (insertError.code === '23505') return json({ alreadyApplied: true });
      throw insertError;
    }

    return json({ ok: true });
  } catch (error) {
    console.error('submit-job-application error:', error);
    return json({ error: 'We could not submit your application. Please try again.' }, 500);
  }
});

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

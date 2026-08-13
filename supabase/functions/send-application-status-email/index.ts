import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildStatusEmailHtml, type ApplicationStatus, type OfferDetails } from './templates/shell.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const FROM_ADDRESS = 'RoleWave <updates@rolewave.cv>';
const ENDPOINT_NAME = 'send-application-status-email';
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_CALLS = 20;

const TARGET_STATUSES: ApplicationStatus[] = [
  'reviewed',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
];

const SUBJECTS: Record<ApplicationStatus, (jobTitle: string) => string> = {
  reviewed: (job) => `Your application for ${job} is under review`,
  shortlisted: (job) => `You've been shortlisted for ${job}`,
  interview: (job) => `Interview stage: ${job}`,
  offer: (job) => `You've received an offer for ${job}`,
  hired: (job) => `You got the role: ${job}`,
  rejected: (job) => `An update on your application for ${job}`,
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Called only by the job_applications_status_email trigger (via
    // pg_net), never directly by clients. Same shared-secret pattern as
    // send-welcome-email, but with its own dedicated secret so a leak of
    // one doesn't compromise the other.
    const webhookSecret = Deno.env.get('APPLICATION_STATUS_WEBHOOK_SECRET');
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return json({ error: 'Status email is not configured.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: log this call, then check how many calls have landed for
    // this endpoint in the last window. Shares the same webhook_call_log
    // table as send-welcome-email, keyed by endpoint name so the two
    // functions don't share a budget.
    await adminClient.from('webhook_call_log').insert({ endpoint: ENDPOINT_NAME });
    const { count: recentCallCount } = await adminClient
      .from('webhook_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', ENDPOINT_NAME)
      .gte('called_at', new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString());

    if ((recentCallCount ?? 0) > RATE_LIMIT_MAX_CALLS) {
      return json({ error: 'Rate limit exceeded.' }, 429);
    }
    adminClient.rpc('prune_webhook_call_log').then(
      () => {},
      () => {},
    );

    const body = await request.json().catch(() => ({}));
    const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
    const status = typeof body.status === 'string' ? body.status : '';

    if (!applicationId || !TARGET_STATUSES.includes(status as ApplicationStatus)) {
      return json({ error: 'Missing or invalid application_id/status.' }, 400);
    }
    const validStatus = status as ApplicationStatus;

    const { data: application, error: applicationError } = await adminClient
      .from('job_applications')
      .select('id, job_id, candidate_profile_id, rejection_reason')
      .eq('id', applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;

    // No application, no account on the application, already emailed for
    // this exact status — all collapse to the same generic response so
    // the response shape can't be used to probe account/application state.
    if (!application || !application.candidate_profile_id) {
      return json({ processed: true });
    }

    const { data: existingSend } = await adminClient
      .from('application_status_emails_sent')
      .select('id')
      .eq('application_id', applicationId)
      .eq('status', validStatus)
      .maybeSingle();

    if (existingSend) {
      return json({ processed: true });
    }

    // Email derived server-side from auth.users, never trusted from the
    // trigger payload — same fix as send-welcome-email.
    const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(
      application.candidate_profile_id,
    );
    if (authUserError || !authUserResult?.user?.email) {
      return json({ processed: true });
    }
    const email = authUserResult.user.email;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, email_application_updates')
      .eq('id', application.candidate_profile_id)
      .maybeSingle();

    if (profileError) throw profileError;

    // Respect the candidate's preference. Don't record a "sent" row here
    // since nothing was sent — if they re-enable the preference later,
    // this specific status transition has already passed and won't
    // refire anyway (the trigger only fires on a live status change).
    if (!profile || profile.email_application_updates === false) {
      return json({ processed: true });
    }

    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select('title, company_id')
      .eq('id', application.job_id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return json({ processed: true });
    }

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('name')
      .eq('id', job.company_id)
      .maybeSingle();

    if (companyError) throw companyError;

    let offerDetails: OfferDetails | null = null;
    if (validStatus === 'offer') {
      const { data: offer, error: offerError } = await adminClient
        .from('offers')
        .select('role_title, salary_amount, salary_currency, salary_period, start_date, work_arrangement, location, benefits_notes, expiry_date')
        .eq('application_id', applicationId)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (offerError) throw offerError;

      if (offer) {
        offerDetails = {
          roleTitle: offer.role_title,
          compensation: formatMoney(offer.salary_amount, offer.salary_currency, offer.salary_period),
          startDate: offer.start_date ? formatDate(offer.start_date) : null,
          workArrangement: offer.work_arrangement,
          location: offer.location,
          expiryDate: offer.expiry_date ? formatDate(offer.expiry_date) : null,
          benefitsNotes: offer.benefits_notes,
        };
      }
    }

    const name = profile.full_name?.trim() || 'there';
    const jobTitle = job.title || 'the role';
    const companyName = company?.name || 'the employer';
    const subject = SUBJECTS[validStatus](jobTitle);
    const html = buildStatusEmailHtml({
      name,
      jobTitle,
      companyName,
      status: validStatus,
      rejectionReason: validStatus === 'rejected' ? application.rejection_reason : null,
      offerDetails,
      ctaUrl: 'https://rolewave.cv/candidate/activity',
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text().catch(() => '');
      console.error(`Resend API error (${resendResponse.status}): ${errorText}`);
      return json({ error: 'Could not send status email.' }, 502);
    }

    // Record the send. onConflict matches the unique(application_id, status)
    // constraint — if a retry lands here twice, the second insert is a
    // silent no-op rather than an error.
    const { error: insertError } = await adminClient
      .from('application_status_emails_sent')
      .upsert(
        { application_id: applicationId, status: validStatus },
        { onConflict: 'application_id,status', ignoreDuplicates: true },
      );

    if (insertError) throw insertError;

    return json({ processed: true });
  } catch (error) {
    console.error('send-application-status-email error:', error);
    return json({ error: 'Could not process request.' }, 500);
  }
});

function formatMoney(amount: number | null, currency: string, period: string): string {
  if (amount == null) return 'Not specified';
  const formatted = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount);
  return `${currency} ${formatted} / ${period}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

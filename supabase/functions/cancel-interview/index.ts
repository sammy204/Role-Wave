import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildInterviewCancelledEmail } from '../_shared/interviewTemplates.ts';
import { sendResendEmail } from '../_shared/interview.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const from = 'RoleWave <updates@rolewave.cv>';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) return json({ error: 'Interview cancellation is not configured.' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);
    const body = await request.json().catch(() => ({}));
    const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
    if (!applicationId) return json({ error: 'Missing application_id.' }, 400);

    const { data: schedule, error: cancelError } = await userClient.rpc('cancel_interview', { p_application_id: applicationId });
    if (cancelError) return json({ error: cancelError.message }, 400);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: application } = await adminClient.from('job_applications').select('candidate_profile_id, job_id').eq('id', applicationId).single();
    if (!application?.candidate_profile_id) return json({ schedule });
    const { data: job } = await adminClient.from('jobs').select('title, company_id').eq('id', application.job_id).single();
    if (!job) return json({ schedule });
    const { data: company } = await adminClient.from('companies').select('name, owner_profile_id').eq('id', job.company_id).single();
    if (!company) return json({ schedule });
    const [{ data: candidateProfile }, { data: employerProfile }, { data: candidateAuth }, { data: employerAuth }] = await Promise.all([
      adminClient.from('profiles').select('full_name').eq('id', application.candidate_profile_id).single(),
      adminClient.from('profiles').select('full_name').eq('id', company.owner_profile_id).single(),
      adminClient.auth.admin.getUserById(application.candidate_profile_id),
      adminClient.auth.admin.getUserById(company.owner_profile_id),
    ]);
    const recipients = [
      { profileId: application.candidate_profile_id, email: candidateAuth.user?.email, name: candidateProfile?.full_name },
      { profileId: company.owner_profile_id, email: employerAuth.user?.email, name: employerProfile?.full_name },
    ];
    for (const recipient of recipients) {
      if (!recipient.email) continue;
      const { data: alreadySent } = await adminClient.from('interview_email_sends').select('id').match({ schedule_id: schedule.id, recipient_profile_id: recipient.profileId, email_type: 'cancellation' }).maybeSingle();
      if (alreadySent) continue;
      await sendResendEmail({
        apiKey: resendApiKey,
        from,
        to: recipient.email,
        subject: `Interview cancelled — ${job.title}`,
        html: buildInterviewCancelledEmail({ firstName: recipient.name?.trim()?.split(/\s+/)[0] || 'there', roleTitle: job.title, companyName: company.name, ctaUrl: recipient.profileId === application.candidate_profile_id ? 'https://rolewave.cv/candidate/activity' : 'https://rolewave.cv/employer/dashboard' }),
      });
      await adminClient.from('interview_email_sends').upsert({ schedule_id: schedule.id, recipient_profile_id: recipient.profileId, email_type: 'cancellation' }, { onConflict: 'schedule_id,recipient_profile_id,email_type', ignoreDuplicates: true });
    }
    return json({ schedule });
  } catch (error) {
    console.error('cancel-interview error:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not cancel interview.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

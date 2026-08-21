import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildPickDayAndTimeEmail } from '../_shared/interviewTemplates.ts';
import { sendResendEmail, type InterviewSlot } from '../_shared/interview.ts';

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
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) return json({ error: 'Interview scheduling is not configured.' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const applicationId = typeof body.application_id === 'string' ? body.application_id : '';
    const meetingLink = typeof body.meeting_link === 'string' ? body.meeting_link.trim() : '';
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
    const slots = Array.isArray(body.slots) ? body.slots : [];
    if (!applicationId || !meetingLink || !timezone || slots.length < 1 || slots.length > 5) return json({ error: 'Provide a meeting link, timezone, and 1 to 5 slots.' }, 400);
    try {
      const link = new URL(meetingLink);
      if (!['http:', 'https:'].includes(link.protocol)) throw new Error('invalid protocol');
    } catch {
      return json({ error: 'Meeting link must be a valid URL.' }, 400);
    }

    const { data: schedule, error: scheduleError } = await userClient.rpc('create_interview_schedule', {
      p_application_id: applicationId,
      p_meeting_link: meetingLink,
      p_employer_timezone: timezone,
      p_slots: slots,
    });
    if (scheduleError) return json({ error: scheduleError.message }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: application, error: applicationError } = await adminClient
      .from('job_applications').select('candidate_profile_id, job_id').eq('id', applicationId).single();
    if (applicationError || !application?.candidate_profile_id) return json({ error: 'Candidate account not found.' }, 400);
    const [{ data: job }, { data: candidate }, { data: candidateTimezoneProfile }, { data: authCandidate }, { data: slotRows }] = await Promise.all([
      adminClient.from('jobs').select('title, company_id').eq('id', application.job_id).single(),
      adminClient.from('profiles').select('full_name').eq('id', application.candidate_profile_id).single(),
      adminClient.from('candidate_profiles').select('timezone').eq('id', application.candidate_profile_id).single(),
      adminClient.auth.admin.getUserById(application.candidate_profile_id),
      adminClient.from('interview_slots').select('*').eq('schedule_id', schedule.id).order('slot_order'),
    ]);
    if (!job || !authCandidate.user?.email) return json({ error: 'Interview details could not be loaded.' }, 500);
    const { data: company } = await adminClient.from('companies').select('name').eq('id', job.company_id).single();
    const interviewSlots = (slotRows || []) as InterviewSlot[];
    const candidateTimezone = candidateTimezoneProfile?.timezone || timezone;
    await sendResendEmail({
      apiKey: resendApiKey,
      from,
      to: authCandidate.user.email,
      subject: `Pick a day and time for your interview — ${job.title} at ${company?.name || 'the company'}`,
      html: buildPickDayAndTimeEmail({
        firstName: candidate?.full_name?.trim()?.split(/\s+/)[0] || 'there',
        roleTitle: job.title,
        companyName: company?.name || 'the company',
        slots: interviewSlots,
        timezone: candidateTimezone,
        ctaUrl: 'https://rolewave.cv/candidate/activity',
      }),
    });
    await adminClient.from('interview_email_sends').upsert({ schedule_id: schedule.id, recipient_profile_id: application.candidate_profile_id, email_type: 'proposal' }, { onConflict: 'schedule_id,recipient_profile_id,email_type', ignoreDuplicates: true });
    return json({ schedule, slots: interviewSlots });
  } catch (error) {
    console.error('create-interview-slots error:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not create interview slots.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

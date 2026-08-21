import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildEmployerInterviewConfirmedEmail, buildInterviewConfirmedEmail } from '../_shared/interviewTemplates.ts';
import { buildInterviewIcs, icsAttachment, sendResendEmail, type InterviewSchedule, type InterviewSlot } from '../_shared/interview.ts';

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
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) return json({ error: 'Interview confirmation is not configured.' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);
    const body = await request.json().catch(() => ({}));
    const slotId = typeof body.slot_id === 'string' ? body.slot_id : '';
    const candidateTimezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC';
    if (!slotId) return json({ error: 'Missing slot_id.' }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let schedule;
    const { data: selectedSchedule, error: selectError } = await userClient.rpc('select_interview_slot', { p_slot_id: slotId });
    if (selectError) {
      // A previous attempt may have confirmed the slot and then failed while
      // sending the second recipient's email. Allow that exact selection to
      // retry the missing confirmation without changing the appointment.
      const { data: existingSchedule } = await adminClient
        .from('interview_schedules')
        .select('*')
        .eq('status', 'confirmed')
        .eq('selected_slot_id', slotId)
        .maybeSingle();
      if (!existingSchedule) return json({ error: selectError.message }, 409);
      schedule = existingSchedule;
    } else {
      schedule = selectedSchedule;
    }
    const { data: slot } = await adminClient.from('interview_slots').select('*').eq('id', slotId).single();
    const { data: application } = await adminClient.from('job_applications').select('candidate_profile_id, job_id').eq('id', schedule.application_id).single();
    if (!slot || !application?.candidate_profile_id) return json({ error: 'Interview details could not be loaded.' }, 500);
    const { data: job } = await adminClient.from('jobs').select('title, company_id').eq('id', application.job_id).single();
    if (!job) return json({ error: 'Interview details could not be loaded.' }, 500);
    const { data: company } = await adminClient.from('companies').select('name, owner_profile_id').eq('id', job.company_id).single();
    if (!job || !company) return json({ error: 'Interview details could not be loaded.' }, 500);
    const [{ data: candidateProfile }, { data: employerProfile }, { data: candidateAuth }, { data: employerAuth }] = await Promise.all([
      adminClient.from('profiles').select('full_name').eq('id', application.candidate_profile_id).single(),
      adminClient.from('profiles').select('full_name').eq('id', company.owner_profile_id).single(),
      adminClient.auth.admin.getUserById(application.candidate_profile_id),
      adminClient.auth.admin.getUserById(company.owner_profile_id),
    ]);
    if (!candidateAuth.user?.email || !employerAuth.user?.email) return json({ error: 'Interview recipients could not be loaded.' }, 500);

    const typedSchedule = schedule as InterviewSchedule;
    const typedSlot = slot as InterviewSlot;
    const ics = buildInterviewIcs({
      scheduleId: typedSchedule.id,
      slot: typedSlot,
      roleTitle: job.title,
      companyName: company.name,
      meetingLink: typedSchedule.meeting_link,
      organizerEmail: employerAuth.user.email,
      attendeeEmail: candidateAuth.user.email,
    });
    const recipients = [
      { profileId: application.candidate_profile_id, email: candidateAuth.user.email, name: candidateProfile?.full_name, timezone: candidateTimezone },
      { profileId: company.owner_profile_id, email: employerAuth.user.email, name: employerProfile?.full_name, timezone: typedSchedule.employer_timezone },
    ];
    const deliveryResults = await Promise.all(recipients.map(async (recipient) => {
      const sendKey = {
        schedule_id: typedSchedule.id,
        recipient_profile_id: recipient.profileId,
        email_type: 'confirmation',
      } as const;
      const { data: alreadySent, error: sendLookupError } = await adminClient
        .from('interview_email_sends')
        .select('id')
        .match(sendKey)
        .maybeSingle();
      if (sendLookupError) throw sendLookupError;
      if (alreadySent) return { profileId: recipient.profileId, sent: true, skipped: true };

      const subject = `Interview confirmed — ${job.title} on ${new Intl.DateTimeFormat('en-US', { timeZone: recipient.timezone, month: 'long', day: 'numeric' }).format(new Date(typedSlot.starts_at))}`;
      const html = recipient.profileId === company.owner_profile_id
        ? buildEmployerInterviewConfirmedEmail({
          firstName: recipient.name?.trim()?.split(/\s+/)[0] || 'there',
          candidateName: candidateProfile?.full_name || 'The candidate',
          roleTitle: job.title,
          companyName: company.name,
          startsAt: typedSlot.starts_at,
          timezone: recipient.timezone,
          meetingLink: typedSchedule.meeting_link,
        })
        : buildInterviewConfirmedEmail({
          firstName: recipient.name?.trim()?.split(/\s+/)[0] || 'there',
          roleTitle: job.title,
          companyName: company.name,
          startsAt: typedSlot.starts_at,
          timezone: recipient.timezone,
          meetingLink: typedSchedule.meeting_link,
        });

      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          console.info('Sending interview confirmation email', {
            scheduleId: typedSchedule.id,
            recipient: recipient.email,
            attempt,
          });
          await sendResendEmail({
            apiKey: resendApiKey,
            from,
            to: recipient.email,
            subject,
            html,
            attachments: [icsAttachment(ics, `rolewave-interview-${typedSchedule.id}.ics`)],
          });
          const { error: sendRecordError } = await adminClient
            .from('interview_email_sends')
            .upsert(sendKey, { onConflict: 'schedule_id,recipient_profile_id,email_type', ignoreDuplicates: true });
          if (sendRecordError) throw sendRecordError;
          return { profileId: recipient.profileId, sent: true, skipped: false };
        } catch (error) {
          lastError = error;
          console.error('Interview confirmation email attempt failed', {
            scheduleId: typedSchedule.id,
            recipient: recipient.email,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
      return {
        profileId: recipient.profileId,
        sent: false,
        skipped: false,
        error: lastError instanceof Error ? lastError.message : 'Email delivery failed.',
      };
    }));
    const failedDeliveries = deliveryResults.filter((result) => !result.sent);
    if (failedDeliveries.length) {
      console.error('Interview confirmation delivery incomplete', {
        scheduleId: typedSchedule.id,
        failedRecipients: failedDeliveries.map((result) => result.profileId),
      });
      return json({ error: 'Interview confirmed, but one or more confirmation emails could not be delivered.' }, 502);
    }
    return json({ schedule: typedSchedule, slot: typedSlot });
  } catch (error) {
    console.error('select-interview-slot error:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not confirm interview.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

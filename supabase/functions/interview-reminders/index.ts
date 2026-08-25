import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml, formatInterviewDate, sendResendEmail } from '../_shared/interview.ts';

type ReminderType = '24_hours' | '1_hour' | '15_minutes';
type Schedule = { id: string; application_id: string; status: string; selected_slot_id: string | null; meeting_link: string; employer_timezone: string };
type Slot = { id: string; schedule_id: string; starts_at: string; duration_minutes: number };
type Application = { id: string; candidate_profile_id: string; job_id: string };
type Job = { id: string; title: string; company_id: string };
type Company = { id: string; name: string; owner_profile_id: string };
type Profile = { id: string; full_name: string | null };

const REMINDERS: { type: ReminderType; milliseconds: number; label: string }[] = [
  { type: '24_hours', milliseconds: 24 * 60 * 60 * 1000, label: 'tomorrow' },
  { type: '1_hour', milliseconds: 60 * 60 * 1000, label: 'in 1 hour' },
  { type: '15_minutes', milliseconds: 15 * 60 * 1000, label: 'in 15 minutes' },
];

Deno.serve(async (request) => {
  const secret = Deno.env.get('INTERVIEW_REMINDER_CRON_SECRET');
  if (!secret || request.headers.get('x-interview-reminder-secret') !== secret) return json({ error: 'Unauthorized.' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Interview reminder service is not configured.' }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const now = Date.now();
    const { data: schedules, error: scheduleError } = await admin
      .from('interview_schedules')
      .select('id, application_id, status, selected_slot_id, meeting_link, employer_timezone')
      .in('status', ['confirmed', 'proposed']);
    if (scheduleError) throw scheduleError;

    const scheduleRows = (schedules || []) as Schedule[];
    const scheduleIds = scheduleRows.map((row) => row.id);
    const applicationIds = scheduleRows.map((row) => row.application_id);
    const [{ data: slots }, { data: applications }] = await Promise.all([
      scheduleIds.length ? admin.from('interview_slots').select('id, schedule_id, starts_at, duration_minutes').in('schedule_id', scheduleIds) : Promise.resolve({ data: [] as Slot[] }),
      applicationIds.length ? admin.from('job_applications').select('id, candidate_profile_id, job_id').in('id', applicationIds) : Promise.resolve({ data: [] as Application[] }),
    ]);
    const slotById = new Map(((slots || []) as Slot[]).map((slot) => [slot.id, slot]));
    const slotsBySchedule = new Map<string, Slot[]>();
    for (const slot of (slots || []) as Slot[]) slotsBySchedule.set(slot.schedule_id, [...(slotsBySchedule.get(slot.schedule_id) || []), slot]);
    const applicationById = new Map(((applications || []) as Application[]).map((application) => [application.id, application]));
    const jobIds = [...new Set(((applications || []) as Application[]).map((application) => application.job_id))];
    const { data: jobs } = jobIds.length ? await admin.from('jobs').select('id, title, company_id').in('id', jobIds) : { data: [] as Job[] };
    const companyIds = [...new Set(((jobs || []) as Job[]).map((job) => job.company_id))];
    const { data: companies } = companyIds.length ? await admin.from('companies').select('id, name, owner_profile_id').in('id', companyIds) : { data: [] as Company[] };
    const profileIds = [...new Set([
      ...((applications || []) as Application[]).map((application) => application.candidate_profile_id),
      ...((companies || []) as Company[]).map((company) => company.owner_profile_id),
    ])];
    const { data: profiles } = profileIds.length ? await admin.from('profiles').select('id, full_name').in('id', profileIds) : { data: [] as Profile[] };
    const jobById = new Map(((jobs || []) as Job[]).map((job) => [job.id, job]));
    const companyById = new Map(((companies || []) as Company[]).map((company) => [company.id, company]));
    const candidateTimezoneById = new Map<string, string>();
    if (profileIds.length) {
      const { data: candidateProfiles } = await admin.from('candidate_profiles').select('id, timezone').in('id', profileIds);
      for (const profile of (candidateProfiles || []) as { id: string; timezone: string | null }[]) {
        if (profile.timezone) candidateTimezoneById.set(profile.id, profile.timezone);
      }
    }

    let remindersSent = 0;
    let completed = 0;
    for (const schedule of scheduleRows) {
      const slot = schedule.selected_slot_id ? slotById.get(schedule.selected_slot_id) : null;
      if (!slot) {
        if (schedule.status === 'proposed') {
          const proposedSlots = slotsBySchedule.get(schedule.id) || [];
          if (proposedSlots.length > 0 && proposedSlots.every((proposedSlot) => new Date(proposedSlot.starts_at).getTime() <= now)) {
            await admin.from('interview_schedules').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', schedule.id).eq('status', 'proposed');
          }
        }
        continue;
      }
      const startsAt = new Date(slot.starts_at).getTime();
      const endsAt = startsAt + slot.duration_minutes * 60_000;
      if (schedule.status === 'confirmed' && endsAt <= now) {
        const { data: completedRow, error } = await admin.from('interview_schedules').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', schedule.id).eq('status', 'confirmed').select('id').maybeSingle();
        if (!error && completedRow) {
          completed += 1;
          await notifyCompleted(admin, schedule, applicationById, jobById, companyById);
        }
        continue;
      }
      if (schedule.status !== 'confirmed' || startsAt <= now) continue;
      const application = applicationById.get(schedule.application_id);
      const job = application ? jobById.get(application.job_id) : undefined;
      const company = job ? companyById.get(job.company_id) : undefined;
      if (!application || !job || !company) continue;
      const recipients = [application.candidate_profile_id, company.owner_profile_id];
      for (const reminder of REMINDERS) {
        if (now < startsAt - reminder.milliseconds || now >= startsAt) continue;
        for (const recipientId of recipients) {
          const { data: claimed, error: claimError } = await admin.from('interview_reminder_sends').insert({ schedule_id: schedule.id, slot_id: slot.id, recipient_profile_id: recipientId, reminder_type: reminder.type }).select('id');
          if (claimError || !claimed?.length) continue;
          const timezone = recipientId === application.candidate_profile_id ? candidateTimezoneById.get(recipientId) || 'Africa/Lagos' : schedule.employer_timezone;
          const when = formatInterviewDate(slot.starts_at, timezone);
          await notifyReminder(admin, schedule, recipientId, job.title, company.name, when, reminder.label);
          const authUser = await admin.auth.admin.getUserById(recipientId);
          if (resendApiKey && authUser.data.user?.email) {
            await sendResendEmail({ apiKey: resendApiKey, from: Deno.env.get('INTERVIEW_EMAIL_FROM') || 'RoleWave <hello@rolewave.cv>', to: authUser.data.user.email, subject: `Interview reminder — ${job.title} ${reminder.label}`, html: reminderEmail(job.title, company.name, when, schedule.meeting_link, recipientId === company.owner_profile_id) }).catch((error) => console.error('Interview reminder email failed', error));
          }
          await sendPush(admin, recipientId, `Interview ${reminder.label}`, `${job.title} at ${company.name} — ${when}`, recipientId === application.candidate_profile_id ? '/candidate/activity' : '/employer/dashboard');
          remindersSent += 1;
        }
      }
    }
    return json({ remindersSent, completed });
  } catch (error) {
    console.error('interview-reminders error:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not process interview reminders.' }, 500);
  }
});

async function notifyReminder(admin: ReturnType<typeof createClient>, schedule: Schedule, userId: string, roleTitle: string, companyName: string, when: string, relative: string) {
  await admin.rpc('create_notification', { p_user_id: userId, p_type: 'interview_reminder', p_payload: { schedule_id: schedule.id, role_title: roleTitle, company_name: companyName, when, relative } });
}

async function notifyCompleted(admin: ReturnType<typeof createClient>, schedule: Schedule, applicationById: Map<string, Application>, jobById: Map<string, Job>, companyById: Map<string, Company>) {
  const application = applicationById.get(schedule.application_id);
  const job = application ? jobById.get(application.job_id) : undefined;
  const company = job ? companyById.get(job.company_id) : undefined;
  if (!application || !company) return;
  for (const userId of [application.candidate_profile_id, company.owner_profile_id]) {
    await admin.rpc('create_notification', { p_user_id: userId, p_type: 'interview_completed', p_payload: { schedule_id: schedule.id, role_title: job?.title, company_name: company.name } });
  }
}

async function sendPush(admin: ReturnType<typeof createClient>, userId: string, title: string, body: string, url: string) {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) return;
  const { data: subscriptions } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId).eq('enabled', true);
  if (!subscriptions?.length) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  for (const subscription of subscriptions as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title, body, url }));
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
    }
  }
}

function reminderEmail(roleTitle: string, companyName: string, when: string, meetingLink: string, employer: boolean) {
  const greeting = employer ? 'Your scheduled interview with the candidate is coming up.' : 'Your scheduled interview is coming up.';
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172238;line-height:1.6"><h2>Interview reminder</h2><p>${greeting}</p><p><strong>${escapeHtml(roleTitle)}</strong> at ${escapeHtml(companyName)}<br>${escapeHtml(when)}</p><p><a href="${escapeHtml(meetingLink)}">Join interview</a></p><p style="color:#667085;font-size:13px">You are receiving this reminder from RoleWave.</p></body></html>`;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

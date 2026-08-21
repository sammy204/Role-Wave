import { escapeHtml, formatInterviewDate, type InterviewSlot } from './interview.ts';

const shell = (title: string, body: string) => `<!doctype html>
<html><body style="margin:0;background:#EDEBE2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
<table role="presentation" width="600" style="max-width:100%;margin:auto;background:#FBFAF7;border-radius:20px;overflow:hidden"><tr><td style="background:#0F6E56;padding:28px 32px;color:white;font:700 18px Georgia,serif">RoleWave</td></tr><tr><td style="padding:32px">${body}</td></tr><tr><td style="padding:0 32px 32px;color:#5F5E5A;font-size:13px">&mdash; The RoleWave Team</td></tr></table>
</body></html>`;

export function buildPickDayAndTimeEmail(params: {
  firstName: string;
  roleTitle: string;
  companyName: string;
  slots: InterviewSlot[];
  timezone: string;
  ctaUrl: string;
}): string {
  const slotList = params.slots
    .map((slot) => `<li style="margin:0 0 10px"><strong>${escapeHtml(formatInterviewDate(slot.starts_at, params.timezone))}</strong></li>`)
    .join('');
  return shell('Pick a day and time', `<h1 style="font:700 28px Georgia,serif;margin:0 0 18px">Pick a day and time</h1>
<p>Hi ${escapeHtml(params.firstName)},</p>
<p>Good news &mdash; ${escapeHtml(params.companyName)} would like to move forward with an interview for the <strong>${escapeHtml(params.roleTitle)}</strong> role.</p>
<p>They've proposed a few times that work for them. Pick whichever fits your schedule:</p>
<ul style="padding-left:22px">${slotList}</ul>
<p style="margin:28px 0"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">Choose a day and time &rarr;</a></p>
<p>Times shown in ${escapeHtml(params.timezone)}. Once you pick, you'll both get a calendar invite with the meeting link.</p>`);
}

export function buildInterviewConfirmedEmail(params: {
  firstName: string;
  roleTitle: string;
  companyName: string;
  startsAt: string;
  timezone: string;
  meetingLink: string;
}): string {
  return shell('Interview confirmed', `<h1 style="font:700 28px Georgia,serif;margin:0 0 18px">Interview confirmed</h1>
<p>Hi ${escapeHtml(params.firstName)},</p>
<p>Your interview is confirmed:</p>
<p><strong>Role:</strong> ${escapeHtml(params.roleTitle)} at ${escapeHtml(params.companyName)}<br>
<strong>When:</strong> ${escapeHtml(formatInterviewDate(params.startsAt, params.timezone))}<br>
<strong>Where:</strong> <a href="${escapeHtml(params.meetingLink)}">${escapeHtml(params.meetingLink)}</a></p>
<p>A calendar invite is attached &mdash; add it to your calendar so it's not lost.</p>`);
}

export function buildInterviewCancelledEmail(params: {
  firstName: string;
  roleTitle: string;
  companyName: string;
  ctaUrl: string;
}): string {
  return shell('Interview cancelled', `<h1 style="font:700 28px Georgia,serif;margin:0 0 18px">Interview cancelled</h1>
<p>Hi ${escapeHtml(params.firstName)},</p>
<p>The interview for <strong>${escapeHtml(params.roleTitle)}</strong> at ${escapeHtml(params.companyName)} has been cancelled by the employer. A new set of days and times will be sent if the interview is rescheduled.</p>
<p><a href="${escapeHtml(params.ctaUrl)}">View your RoleWave activity</a></p>`);
}

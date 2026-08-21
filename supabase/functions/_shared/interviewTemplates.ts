import { escapeHtml, formatInterviewDate, type InterviewSlot } from './interview.ts';

const shell = (body: string, preview: string) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RoleWave interview update</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}body{margin:0;padding:0;width:100%!important;background:#F5F7F8;}@media only screen and (max-width:600px){.email-container{width:100%!important}.fluid-padding{padding-left:24px!important;padding-right:24px!important}.stack-heading{font-size:28px!important}}</style>
</head><body style="margin:0;padding:0;background:#F5F7F8;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7F8;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F8;"><tr><td align="center" style="padding:28px 16px 36px;"><table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
<tr><td class="fluid-padding" style="padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7A8491;"><span>RoleWave</span><span style="float:right;"><a href="https://rolewave.cv/jobs" target="_blank" style="color:#65707D;text-decoration:underline;">Browse jobs</a></span></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E5E9ED;border-radius:8px;padding:42px 52px 44px;"><div style="text-align:center;"><img src="https://rolewave.cv/rolewave-icon.png" width="48" height="48" alt="RoleWave" style="display:inline-block;border-radius:12px;vertical-align:middle;"><div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:700;letter-spacing:-.03em;color:#172238;">RoleWave</div></div>${body}</td></tr>
<tr><td class="fluid-padding" style="padding:24px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A94A1;">You're receiving this because you have an interview activity on RoleWave.<br>&copy; 2026 RoleWave &middot; <a href="https://rolewave.cv" target="_blank" style="color:#8A94A1;text-decoration:underline;">rolewave.cv</a></td></tr>
</table></td></tr></table></body></html>`;

function heading(eyebrow: string, title: string, content: string): string {
  return `<div style="margin-top:54px;font-family:Arial,Helvetica,sans-serif;color:#172238;"><p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1D9E75;">${escapeHtml(eyebrow)}</p><h1 class="stack-heading" style="margin:0;font-size:34px;line-height:1.2;letter-spacing:-.04em;font-weight:700;color:#172238;">${escapeHtml(title)}</h1><div style="width:66px;height:4px;margin:22px 0 26px;background:#1D9E75;border-radius:3px;"></div>${content}</div>`;
}

function detailBlock(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E9ED;border-radius:14px;margin:28px 0 0;"><tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#4F5B6B;">${rows}</td></tr></table>`;
}

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
  const content = `<p style="margin:0;font-size:15px;line-height:1.75;color:#4F5B6B;">Hi ${escapeHtml(params.firstName)},</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">Good news &mdash; ${escapeHtml(params.companyName)} would like to move forward with an interview for the <strong>${escapeHtml(params.roleTitle)}</strong> role.</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">They've proposed a few days and times that work for them. Pick whichever fits your schedule:</p><ul style="margin:18px 0 0;padding-left:22px;font-size:14px;line-height:1.6;color:#4F5B6B;">${slotList}</ul><div style="text-align:center;margin-top:30px;"><a href="${escapeHtml(params.ctaUrl)}" target="_blank" style="display:inline-block;border-radius:7px;background:#1D9E75;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">Choose a day and time &rarr;</a></div><p style="margin:18px 0 0;text-align:center;font-size:13px;line-height:1.5;color:#4F5B6B;">Times shown in ${escapeHtml(params.timezone)}. Once you choose, you'll both get a calendar invite with the meeting link.</p>`;
  return shell(heading('Interview invitation · Action needed', 'Pick a day and time', content), `Choose a day and time for your interview for ${params.roleTitle}.`);
}

interface ConfirmationEmailParams {
  firstName: string;
  roleTitle: string;
  companyName: string;
  startsAt: string;
  timezone: string;
  meetingLink: string;
  candidateName?: string;
}

function confirmationDetails(params: ConfirmationEmailParams, employer: boolean): string {
  const greeting = employer ? `${escapeHtml(params.candidateName || 'The candidate')} has chosen this interview day and time:` : 'Your interview is confirmed:';
  return `<p style="margin:0;font-size:15px;line-height:1.75;color:#4F5B6B;">Hi ${escapeHtml(params.firstName)},</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">${greeting}</p>${detailBlock(`<strong style="color:#172238;">Role:</strong> ${escapeHtml(params.roleTitle)} at ${escapeHtml(params.companyName)}<br><strong style="color:#172238;">When:</strong> ${escapeHtml(formatInterviewDate(params.startsAt, params.timezone))}<br><strong style="color:#172238;">Where:</strong> <a href="${escapeHtml(params.meetingLink)}" style="color:#1D9E75;">${escapeHtml(params.meetingLink)}</a>`)}<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#4F5B6B;">A calendar invite is attached &mdash; add it to your calendar so you don't miss it.</p>`;
}

export function buildInterviewConfirmedEmail(params: ConfirmationEmailParams): string {
  return shell(heading('Interview confirmed', 'Your interview is confirmed', confirmationDetails(params, false)), `Your interview for ${params.roleTitle} is confirmed.`);
}

export function buildEmployerInterviewConfirmedEmail(params: ConfirmationEmailParams): string {
  return shell(heading('Interview confirmed', `${params.candidateName || 'The candidate'} chose a time`, confirmationDetails(params, true)), `${params.candidateName || 'The candidate'} chose an interview day and time.`);
}

export function buildInterviewCancelledEmail(params: {
  firstName: string;
  roleTitle: string;
  companyName: string;
  ctaUrl: string;
}): string {
  const content = `<p style="margin:0;font-size:15px;line-height:1.75;color:#4F5B6B;">Hi ${escapeHtml(params.firstName)},</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">The interview for <strong>${escapeHtml(params.roleTitle)}</strong> at ${escapeHtml(params.companyName)} has been cancelled by the employer. A new set of days and times will be sent if the interview is rescheduled.</p><div style="text-align:center;margin-top:30px;"><a href="${escapeHtml(params.ctaUrl)}" target="_blank" style="display:inline-block;border-radius:7px;background:#1D9E75;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">View RoleWave activity &rarr;</a></div>`;
  return shell(heading('Interview update', 'Interview cancelled', content), `The interview for ${params.roleTitle} has been cancelled.`);
}

export function buildEmployerInterviewCancelledEmail(params: {
  firstName: string;
  candidateName: string;
  roleTitle: string;
  companyName: string;
  ctaUrl: string;
}): string {
  const content = `<p style="margin:0;font-size:15px;line-height:1.75;color:#4F5B6B;">Hi ${escapeHtml(params.firstName)},</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">The interview with <strong>${escapeHtml(params.candidateName)}</strong> for <strong>${escapeHtml(params.roleTitle)}</strong> at ${escapeHtml(params.companyName)} has been cancelled.</p><p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#4F5B6B;">The application has been returned to the Shortlisted stage. You can propose new days and times from your employer dashboard.</p><div style="text-align:center;margin-top:30px;"><a href="${escapeHtml(params.ctaUrl)}" target="_blank" style="display:inline-block;border-radius:7px;background:#1D9E75;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">View employer dashboard &rarr;</a></div>`;
  return shell(heading('Interview update', 'Interview cancelled', content), `The interview with ${params.candidateName} has been cancelled.`);
}

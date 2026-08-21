export interface InterviewSlot {
  id: string;
  starts_at: string;
  duration_minutes: number;
  slot_order: number;
}

export interface InterviewSchedule {
  id: string;
  application_id: string;
  meeting_link: string;
  employer_timezone: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
  selected_slot_id: string | null;
  selected_at: string | null;
  proposed_at: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export function formatInterviewDate(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(new Date(value));
  }
}

function formatIcsDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value: string): string {
  return value.replace(/[\\;,\n]/g, (character) => ({ '\\': '\\\\', ';': '\\;', ',': '\\,', '\n': '\\n' })[character] || character);
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function buildInterviewIcs(params: {
  scheduleId: string;
  slot: InterviewSlot;
  roleTitle: string;
  companyName: string;
  meetingLink: string;
  organizerEmail: string;
  attendeeEmail: string;
}): string {
  const end = new Date(new Date(params.slot.starts_at).getTime() + params.slot.duration_minutes * 60_000).toISOString();
  const uid = `${params.scheduleId}-${params.slot.id}@rolewave.cv`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RoleWave//Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatIcsDate(params.slot.starts_at)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(`Interview: ${params.roleTitle} at ${params.companyName}`)}`,
    `DESCRIPTION:${escapeIcs(`Interview for ${params.roleTitle} at ${params.companyName}. Meeting link: ${params.meetingLink}`)}`,
    `LOCATION:${escapeIcs(params.meetingLink)}`,
    `ORGANIZER;CN=${escapeIcs(params.companyName)}:mailto:${params.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${params.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function icsAttachment(content: string, filename: string) {
  return { filename, content: base64Encode(content) };
}

export async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    }),
  });
  if (!response.ok) {
    console.error(`Resend API error (${response.status}): ${await response.text().catch(() => '')}`);
    throw new Error('Could not send interview email.');
  }
}

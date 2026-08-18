const LOCALE = 'en-GB';

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "18 Aug 2026" — short date, used for lists, cards, activity feeds. */
export function formatDate(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Tuesday, 18 August 2026" — full date, used for detail views. */
export function formatDateLong(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "18 August 2026" — long month, no weekday. Used for blog/editorial bylines. */
export function formatPublishedDate(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "18 Aug" — no year, used for compact notification rows. */
export function formatMonthDay(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
  });
}

/** "2:30 PM" — time only, 12-hour with AM/PM regardless of device locale. */
export function formatTime(value: DateInput): string {
  return toDate(value).toLocaleTimeString(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "18 Aug 2026, 2:30 PM" — full date + time. */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/**
 * Smart timestamp for message threads:
 * - if today: just the time ("2:30 PM")
 * - otherwise: short date + time ("18 Aug 2026, 2:30 PM")
 * Mirrors the logic previously duplicated in EmployerMessages/CandidateMessages.
 */
export function formatMessageTimestamp(value: DateInput): string {
  const then = toDate(value);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();

  const time = formatTime(then);
  return sameDay ? time : `${formatDate(then)}, ${time}`;
}
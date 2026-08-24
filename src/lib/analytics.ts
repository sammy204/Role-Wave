import { hasAnalyticsConsent } from '../components/CookieConsent';
import { supabase } from './supabase';

export const ANALYTICS_EVENTS = [
  'page_view', 'job_search', 'job_view', 'job_saved',
  'application_started', 'application_submitted', 'signup_completed',
  'pwa_installed', 'passkey_enabled', 'job_posted', 'report_submitted',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

const SESSION_KEY = 'rolewave_analytics_session';
const recentEvents = new Map<string, number>();

function getSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'session-unavailable';
  }
}

function getPlatform() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Windows|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

export async function trackEvent(eventName: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!hasAnalyticsConsent()) return;

  const eventKey = `${eventName}:${typeof window === 'undefined' ? '' : window.location.pathname}:${JSON.stringify(properties)}`;
  const now = Date.now();
  const lastRecorded = recentEvents.get(eventKey);
  if (lastRecorded && now - lastRecorded < 1500) return;
  recentEvents.set(eventKey, now);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      user_id: session?.user.id || null,
      session_id: getSessionId(),
      path: typeof window === 'undefined' ? null : `${window.location.pathname}${window.location.search}`,
      platform: getPlatform(),
      properties,
    });
  } catch (error) {
    // Analytics must never interrupt the product experience.
    console.debug('Analytics event was not recorded:', error);
  }
}

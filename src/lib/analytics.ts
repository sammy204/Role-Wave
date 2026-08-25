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
const PWA_INSTALL_TRACKED_KEY = 'rolewave_pwa_install_tracked';
const recentEvents = new Map<string, number>();
let pwaInstallTrackingPromise: Promise<boolean> | null = null;

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

export async function trackEvent(eventName: AnalyticsEventName, properties: AnalyticsProperties = {}): Promise<boolean> {
  if (!hasAnalyticsConsent()) return false;

  const eventKey = `${eventName}:${typeof window === 'undefined' ? '' : window.location.pathname}:${JSON.stringify(properties)}`;
  const now = Date.now();
  const lastRecorded = recentEvents.get(eventKey);
  if (lastRecorded && now - lastRecorded < 1500) return false;
  recentEvents.set(eventKey, now);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('analytics_events').insert({
      event_name: eventName,
      user_id: session?.user.id || null,
      session_id: getSessionId(),
      path: typeof window === 'undefined' ? null : `${window.location.pathname}${window.location.search}`,
      platform: getPlatform(),
      properties,
    });
    if (error) {
      console.debug('Analytics event was not recorded:', error);
      return false;
    }
    return true;
  } catch (error) {
    // Analytics must never interrupt the product experience.
    console.debug('Analytics event was not recorded:', error);
    return false;
  }
}

/**
 * `appinstalled` is not emitted consistently, especially for iOS Safari's
 * "Add to Home Screen" flow. A first launch in standalone mode is the
 * reliable cross-platform fallback. The marker is only saved after a
 * successful analytics write, so consent granted later can still be honored.
 */
export async function trackPwaInstall() {
  if (pwaInstallTrackingPromise) return pwaInstallTrackingPromise;

  try {
    if (localStorage.getItem(PWA_INSTALL_TRACKED_KEY) === 'true') return false;
  } catch {
    // Continue; analytics can still work when storage is unavailable.
  }

  pwaInstallTrackingPromise = trackEvent('pwa_installed', { detection: 'installed_event_or_standalone_launch' })
    .then(async (recorded) => {
      if (!recorded) return false;
      try {
        localStorage.setItem(PWA_INSTALL_TRACKED_KEY, 'true');
      } catch {
        // The event was recorded; only deduplication is unavailable.
      }
      return true;
    })
    .finally(() => {
      pwaInstallTrackingPromise = null;
    });

  return pwaInstallTrackingPromise;
}

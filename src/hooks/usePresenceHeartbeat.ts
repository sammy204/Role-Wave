import { useEffect } from 'react';
import { touchPresence, touchPresenceOnUnload } from '../lib/presence';

const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Marks the signed-in user "online" while this tab is open and visible, and
 * "offline" the moment it's hidden or closed. send-message-push reads this
 * to decide: skip the push and let the in-app toast handle it (app is open),
 * or actually push (app is closed/backgrounded).
 *
 * Mount once at the app-shell level, not per-page — presence means "the app
 * is open somewhere," not "this specific page is open."
 */
export function usePresenceHeartbeat(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      void touchPresence(true).catch(() => undefined);
    };

    const start = () => {
      if (intervalId) return;
      beat();
      intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
        void touchPresence(false).catch(() => undefined);
      }
    };

    const onUnload = () => {
      stop();
      touchPresenceOnUnload();
    };

    if (document.visibilityState === 'visible') start();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [userId]);
}
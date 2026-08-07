import { useEffect } from 'react';
import { touchPresence, touchPresenceOnUnload } from '../lib/presence';

const HEARTBEAT_INTERVAL_MS = 15000;

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
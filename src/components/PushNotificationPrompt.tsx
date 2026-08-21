import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import {
  enablePushNotifications,
  getCurrentPushSubscription,
  pushNotificationsConfigured,
} from '../lib/pushNotifications';
import { getUserFacingError } from '../lib/userFacingError';

export default function PushNotificationPrompt() {
  const isPwa = useIsPwa();
  const { session, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPwa || loading || !session || !pushNotificationsConfigured()) return;

    let alive = true;
    const dismissalKey = `rolewave-push-dismissed:${session.user.id}`;
    const resetRequested = new URLSearchParams(window.location.search).get('reset-push') === '1';
    if (resetRequested) window.localStorage.removeItem(dismissalKey);

    // Render immediately once the PWA, auth, and browser capability checks
    // pass. Service-worker readiness is checked below and must not prevent the
    // user from seeing the prompt.
    const dismissed = window.localStorage.getItem(dismissalKey) === '1';
    setVisible(!dismissed && Notification.permission !== 'denied');

    void getCurrentPushSubscription()
      .then((subscription) => {
        if (!alive) return;
        setVisible(!subscription && !dismissed && Notification.permission !== 'denied');
      })
      .catch(() => {
        // Keep the prompt visible so the user can retry after the service
        // worker finishes registering. Enable will show the actionable error.
      });

    return () => {
      alive = false;
    };
  }, [isPwa, loading, session]);

  if (!visible) return null;

  const handleEnable = async () => {
    setWorking(true);
    setError('');
    try {
      await enablePushNotifications();
      setVisible(false);
    } catch (enableError) {
      setError(getUserFacingError(enableError, 'We couldn’t enable notifications. Please try again.'));
    } finally {
      setWorking(false);
    }
  };

  const dismiss = () => {
    if (session) window.localStorage.setItem(`rolewave-push-dismissed:${session.user.id}`, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[79] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#D3D1C7] bg-white p-3 shadow-[0_18px_42px_rgba(26,26,26,0.16)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#085041]">
        <Bell size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#1A1A1A]">Get job alerts</div>
        <div className="text-xs text-[#5F5E5A]">We’ll notify you about important RoleWave updates.</div>
        {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={working}
        className="shrink-0 rounded-full bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#168a63] disabled:opacity-60"
      >
        {working ? 'Enabling…' : 'Enable'}
      </button>
      <button
        type="button"
        aria-label="Dismiss notification prompt"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-[#5F5E5A] hover:bg-[#F1EFE8]"
      >
        <X size={16} />
      </button>
    </div>
  );
}

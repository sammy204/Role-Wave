import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToNotifications } from '../lib/notifications';
import type { AppNotification } from '../types';

export interface MessageToast {
  toastId: string;
  notification: AppNotification;
}

const AUTO_DISMISS_MS = 6000;

/**
 * Subscribes to this user's message_received notifications and turns each
 * one into a short-lived toast. This is the "app is open" half of the
 * push-vs-toast split: send-message-push independently checks presence and
 * skips the push when it thinks the app is open, so this needs its own
 * realtime subscription rather than depending on push arriving.
 */
export function useMessageToasts(userId: string | null) {
  const [toasts, setToasts] = useState<MessageToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    const timer = timersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(toastId);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setToasts([]);
      return;
    }

    const unsubscribe = subscribeToNotifications(userId, {
      onInsert: (notification) => {
        if (notification.type !== 'message_received') return;

        const toastId = `${notification.id}-${Date.now()}`;
        setToasts((prev) => [...prev, { toastId, notification }]);

        const timer = setTimeout(() => dismiss(toastId), AUTO_DISMISS_MS);
        timersRef.current.set(toastId, timer);
      },
    });

    return () => {
      unsubscribe();
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [userId, dismiss]);

  return { toasts, dismiss };
}
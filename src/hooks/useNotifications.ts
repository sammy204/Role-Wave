import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchNotifications,
  clearAllNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../lib/notifications';
import type { AppNotification } from '../types';

const POLL_INTERVAL_MS = 45000;

/**
 * Live notification feed for the signed-in user, meant to back a bell-icon
 * badge + dropdown shared by CandidateSidebar and WorkspaceNav.
 *
 * Notifications themselves are only ever created server-side (via triggers
 * calling create_notification), so this hook is read-only plus mark-read.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unsubscribeRef = useRef<() => void>(() => {});
  const userIdRef = useRef<string | null>(null);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    userIdRef.current = userId;

    if (!userId) {
      setNotifications([]);
      return;
    }

    try {
      const rows = await fetchNotifications(userId);
      setNotifications(rows);
    } catch {
      // A badge that fails to load shouldn't break navigation - leave state as-is.
    }
  }, []);

  const resubscribe = useCallback((userId: string | null) => {
    unsubscribeRef.current();
    if (!userId) return;
    unsubscribeRef.current = subscribeToNotifications(userId, {
      onInsert: (notification) => setNotifications((prev) => [notification, ...prev]),
      onUpdate: (notification) =>
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? notification : n))),
    });
  }, []);

  useEffect(() => {
    let active = true;
    load().then(() => {
      if (active) resubscribe(userIdRef.current);
    });

    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (userId !== userIdRef.current) {
        userIdRef.current = userId;
        load();
        resubscribe(userId);
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      subscription.unsubscribe();
      unsubscribeRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      load();
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }, [load]);

  const clearAll = useCallback(async () => {
    const previous = notifications;
    setNotifications([]);
    try {
      await clearAllNotifications();
    } catch {
      setNotifications(previous);
      load();
    }
  }, [load, notifications]);

  return { notifications, unreadCount, markRead, markAllRead, clearAll, refresh: load };
}

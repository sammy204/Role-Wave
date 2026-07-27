import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppNotification } from '../types';

export type ConnectionStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

export async function fetchNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

/**
 * Subscribes to new/updated notification rows for a single user.
 * Mirrors the pattern used by subscribeToConversationMessages in lib/messages.ts.
 */
export function subscribeToNotifications(
  userId: string,
  handlers: {
    onInsert: (notification: AppNotification) => void;
    onUpdate?: (notification: AppNotification) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onInsert(payload.new as AppNotification)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onUpdate?.(payload.new as AppNotification)
    )
    .subscribe((status) => {
      handlers.onStatusChange?.(status as ConnectionStatus);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Where clicking a notification should take the user, given their active role. */
export function notificationHref(n: AppNotification, role: 'candidate' | 'employer'): string {
  switch (n.type) {
    case 'message_received':
      return role === 'employer' ? '/employer/messages' : '/candidate/messages';
    case 'application_submitted':
      return '/employer/dashboard';
    case 'application_status_changed':
      return '/candidate/activity';
    case 'employer_verification_approved':
    case 'employer_verification_rejected':
      return '/employer/onboarding';
    case 'job_post_approved':
      return '/employer/dashboard';
    default:
      return role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard';
  }
}

/** Compact relative time ("2m", "3h", "5d") for the notification dropdown. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Human-readable copy for a notification, used by both the badge dropdown and any future full list. */
export function describeNotification(n: AppNotification): string {
  switch (n.type) {
    case 'message_received':
      return typeof n.payload.preview === 'string' ? `New message: "${n.payload.preview}"` : 'New message';
    case 'application_submitted':
      return typeof n.payload.applicant_name === 'string'
        ? `${n.payload.applicant_name} applied to your job`
        : 'New application received';
    case 'application_status_changed':
      return typeof n.payload.new_status === 'string'
        ? `Your application status changed to "${n.payload.new_status}"`
        : 'Your application status changed';
    case 'employer_verification_approved':
      return 'Your employer account was verified';
    case 'employer_verification_rejected':
      return 'Your employer verification needs attention';
    case 'job_post_approved':
      return 'Your job post is now live';
    default:
      return 'New notification';
  }
}
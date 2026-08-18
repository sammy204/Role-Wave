import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from './supabase';

const PENDING_TOKEN_KEY = 'rolewave-native-push-token';
const NATIVE_PUSH_DISABLED_KEY = 'rolewave-native-push-disabled';

export function nativePushNotificationsAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function getNativePushEnabled(userId: string) {
  if (!nativePushNotificationsAvailable() || window.localStorage.getItem(NATIVE_PUSH_DISABLED_KEY) === '1') return false;

  const { data, error } = await supabase
    .from('device_push_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', 'android')
    .eq('enabled', true)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function enableNativePushNotifications() {
  if (!nativePushNotificationsAvailable()) return;
  window.localStorage.removeItem(NATIVE_PUSH_DISABLED_KEY);

  const permission = await PushNotifications.checkPermissions();
  const receivePermission = permission.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive
    : permission.receive;

  if (receivePermission !== 'granted') throw new Error('Notification permission was not granted.');
  await PushNotifications.register();
  await syncNativePushToken();
}

export async function disableNativePushNotifications() {
  if (!nativePushNotificationsAvailable()) return;
  window.localStorage.setItem(NATIVE_PUSH_DISABLED_KEY, '1');

  const token = window.localStorage.getItem(PENDING_TOKEN_KEY);
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!token || !userId) return;

  const { error } = await supabase
    .from('device_push_tokens')
    .update({ enabled: false })
    .eq('user_id', userId)
    .eq('token', token);

  if (error) throw error;
}

export async function initNativePushNotifications() {
  if (Capacitor.getPlatform() !== 'android') return;
  if (window.localStorage.getItem(NATIVE_PUSH_DISABLED_KEY) === '1') return;

  await PushNotifications.addListener('registration', ({ value }) => {
    window.localStorage.setItem(PENDING_TOKEN_KEY, value);
    void syncNativePushToken();
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Native push registration failed:', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    handleForegroundNotification(notification);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const href = getNotificationHref(notification);
    if (href) window.location.assign(href);
  });

  const permission = await PushNotifications.checkPermissions();
  const receivePermission = permission.receive === 'prompt'
    ? (await PushNotifications.requestPermissions()).receive
    : permission.receive;

  if (receivePermission !== 'granted') return;
  await PushNotifications.register();
  await syncNativePushToken();
}

export async function syncNativePushToken() {
  if (Capacitor.getPlatform() !== 'android') return;
  if (window.localStorage.getItem(NATIVE_PUSH_DISABLED_KEY) === '1') return;

  const token = window.localStorage.getItem(PENDING_TOKEN_KEY);
  if (!token) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: 'android',
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  if (error) {
    console.error('Could not save native push token:', error);
    return;
  }

  window.localStorage.removeItem(PENDING_TOKEN_KEY);
}

function getNotificationHref(notification: PushNotificationSchema) {
  const href = notification.data?.href;
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') ? href : null;
}

function handleForegroundNotification(notification: PushNotificationSchema) {
  window.dispatchEvent(new CustomEvent('rolewave-native-push', { detail: notification }));
}

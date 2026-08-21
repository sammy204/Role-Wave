import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SERVICE_WORKER_TIMEOUT_MS = 10000;

export function pushNotificationSupportMessage(): string | null {
  if (typeof window === 'undefined') return 'Push notifications are only available in a browser.';
  if (import.meta.env.DEV) return 'Push notifications are unavailable in development.';
  if (!window.isSecureContext) return 'Push notifications require the secure HTTPS RoleWave site.';
  if (!VAPID_PUBLIC_KEY) return 'Push notifications are not configured in this deployment.';
  if (!('serviceWorker' in navigator)) return 'This iPhone does not support service workers here.';
  if (!('PushManager' in window)) return 'Push is available only in an installed Home Screen app on iOS.';
  if (!('Notification' in window)) return 'This environment does not support web notifications.';
  return null;
}

export function pushNotificationsConfigured(): boolean {
  return pushNotificationSupportMessage() === null;
}

function decodeBase64Url(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushNotificationsConfigured()) return null;
  const registration = await getReadyServiceWorker();
  return registration.pushManager.getSubscription();
}

async function getReadyServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    await navigator.serviceWorker.register('/sw.js', { type: 'module' });
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('The push service worker did not become ready.')),
        SERVICE_WORKER_TIMEOUT_MS
      );
    }),
  ]);
}

export async function enablePushNotifications(): Promise<PushSubscription> {
  if (!pushNotificationsConfigured() || !VAPID_PUBLIC_KEY) {
    throw new Error('Push notifications are not configured for this app.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await getReadyServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY),
    }));

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You must be signed in to enable notifications.');

  const json = subscription.toJSON();
  if (!subscription.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      enabled: true,
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) throw error;
  return subscription;
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (userId) {
    await supabase
      .from('push_subscriptions')
      .update({ enabled: false })
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint);
  }

  await subscription.unsubscribe();
}

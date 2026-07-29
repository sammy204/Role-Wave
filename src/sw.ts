/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const payload = event.data?.json() as
    | { title?: string; body?: string; url?: string; icon?: string }
    | undefined;

  const title = payload?.title || 'RoleWave';
  const options: NotificationOptions = {
    body: payload?.body || 'You have a new RoleWave notification.',
    icon: payload?.icon || '/rolewave-pwa-192.png',
    badge: '/rolewave-pwa-192.png',
    data: { url: payload?.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    (event.notification.data as { url?: string } | undefined)?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => 'focus' in client);
      if (existingClient && 'focus' in existingClient) {
        return existingClient.focus().then(() => existingClient.navigate(targetUrl));
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

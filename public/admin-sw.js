const CACHE = 'usk-admin-v1';
const APP_SHELL = ['/?admin=1', '/admin.webmanifest', '/admin-icon.svg'];

// New-order push notifications (Firebase Cloud Messaging Web Push). FCM
// delivers as a standard Push API event, so this app shows it directly
// instead of pulling in the Firebase Messaging SDK inside the service worker.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const title = payload.notification?.title || 'US&K Family Mart';
  const body = payload.notification?.body || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/admin-icon.svg',
      badge: '/admin-icon.svg',
      data: payload.data || {},
      tag: payload.data?.orderId || undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('admin=1') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/?admin=1');
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      if (new URL(event.request.url).origin === self.location.origin) {
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/?admin=1')))
  );
});

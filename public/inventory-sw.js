const CACHE_NAME = 'usk-inventory-shell-v1';

// New-order push notifications (Firebase Cloud Messaging Web Push). FCM
// delivers as a standard Push API event, so this app shows it directly
// instead of pulling in the Firebase Messaging SDK inside the service worker.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const title = payload.notification?.title || 'US&K Агуулах';
  const body = payload.notification?.body || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/inventory-icon.svg',
      badge: '/inventory-icon.svg',
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
        if (client.url.includes('admin=inventory') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/?admin=inventory');
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Keep API responses live; cache only static app resources for a fast app launch.
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)
      .then((response) => {
        if (response.ok && url.pathname !== '/') {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }))
  );
});
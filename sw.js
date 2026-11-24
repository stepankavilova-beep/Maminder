// Maminder service worker: offline app shell + web push reminders.
const CACHE = 'maminder-v1';
const scope = self.registration.scope; // e.g. https://x.github.io/maminder-app/

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([scope, scope + 'manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  if (req.mode === 'navigate') {
    // always try the network for the page, fall back to the cached shell offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(scope, copy));
          return res;
        })
        .catch(() => caches.match(scope)),
    );
    return;
  }
  // static files are content-hashed: cache first
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'Maminder', body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Maminder', {
      body: data.body || '',
      icon: scope + 'icons/icon-192.png',
      badge: scope + 'icons/icon-192.png',
      data: { url: scope + (data.path || '') },
      tag: data.tag,
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(scope) && 'focus' in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});

const CACHE = 'iolanthe-crew-v1';
const STATIC = [
  '/crew/',
  '/crew/crew.css',
  '/crew/crew.js',
  '/crew/manifest.webmanifest'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  // Never cache API responses
  if (url.pathname.startsWith('/api/')) return;
  ev.respondWith(
    caches.match(ev.request).then(cached => cached || fetch(ev.request))
  );
});

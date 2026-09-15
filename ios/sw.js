const CACHE = 'loppis-pwa-v9';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './offline.js',
  './offline-store.json',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './flag-nb.svg',
  './flag-en.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((url) => c.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/v1/') || url.port === '8795') return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!res.ok) return res;
        const dest = url.pathname.endsWith('offline-store.json')
          ? new Request('./offline-store.json')
          : event.request;
        const copy = res.clone();
        void caches.open(CACHE).then((c) => c.put(dest, copy));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match('./offline-store.json')),
      ),
  );
});

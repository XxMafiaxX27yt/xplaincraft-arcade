// Service worker: lets the arcade install as an app and open without internet.
// Network first (so updates show straight away), the saved copy when offline.
const CACHE = 'xca-v1';
const CORE = ['./', './index.html', './css/arcade.css', './css/cosmetics.css', './css/screens.css', './js/app.js', './games/kit/kit.js', './games/kit/kit.css', './sdk/arcade-sdk.js', './manifest.webmanifest', './assets/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // only this site + fonts/CDN scripts; never the game server API
  const own = url.origin === location.origin;
  const cdn = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!own && !cdn) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (own || res.type === 'cors' || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: own && url.pathname.endsWith('.html') }).then((r) => r || caches.match('./index.html')))
  );
});

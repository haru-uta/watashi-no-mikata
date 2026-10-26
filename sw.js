// 一度 ひらいた 画面と 絵を ためて、電波が なくても つかえる ように する。
// ページ本体は ネットを 先に（あたらしい 版を すぐ とどける）、絵は ためた 物を 先に。
const CACHE = 'watashi-no-mikata-v3';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'sync.js', 'config.js', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isArt = url.origin === location.origin && /\.(png|jpg|webp)$/.test(url.pathname);
  if (isArt || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
  }
});

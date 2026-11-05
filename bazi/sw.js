const CACHE = 'bazi-v2';
const FILES = ['./', 'index.html', 'style.css', 'engine.js', 'texts.js', 'cities.js', 'app.js', 'vendor/qrcode.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'fonts/fonts.css', 'fonts/alegreya-cyr.woff2', 'fonts/alegreya-lat.woff2',
  'fonts/golos-cyr.woff2', 'fonts/golos-lat.woff2', 'fonts/notoserifsc-sub.woff2'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Same-origin only. Network first so updates arrive; cache if offline or the network is slower than 3 s.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = e.request.mode === 'navigate' ? 'index.html' : e.request;
  const fromCache = () => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'));
  const net = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  e.respondWith(new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => fromCache().then(hit => { if (hit && !done) { done = true; resolve(hit); } }), 3000);
    net.then(res => { if (!done) { done = true; clearTimeout(timer); resolve(res); } })
       .catch(() => fromCache().then(hit => { if (!done) { done = true; clearTimeout(timer); resolve(hit || Response.error()); } }));
  }));
});

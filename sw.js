/* Planet as an installable app: the game shell is cached on first visit so it opens instantly (and offline);
   images are cached as you meet them. Bump VERSION whenever game files change. */
const VERSION = 'planet-v10';
const SHELL = ['./', 'index.html', 'logo.png', 'img/mark.png',
  'models/char.glb', 'models/hq.glb', 'models/van.glb', 'audio/music.mp3', 'audio/birds.mp3', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages and code: network first so a new version shows up, cache when offline
  if (url.origin === location.origin && (req.mode === 'navigate' || /\.(js|html|webmanifest)$/.test(url.pathname))){
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(cc => cc.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  // everything else (images, models, audio, fonts, three.js): cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque'){ const c = r.clone(); caches.open(VERSION).then(cc => cc.put(req, c)); } return r; })));
});

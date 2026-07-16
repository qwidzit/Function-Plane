const CACHE = 'fp-v24';
const SHELL = [
  './',
  './index.html',
  './src/styles.css',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/supabase.js',
  './src/supabase-config.js',
  './src/premium-config.js',
  './src/physics-config.js',
  './src/physics-engine.js',
  './src/audio.js',
  './src/accounts.js',
  './src/ui-kit.js',
  './src/app-logo.js',
  './src/data.js',
  './src/overrides-snapshot.js',
  './src/overrides-store.js',
  './src/main-screen.js',
  './src/pack-selector.js',
  './src/level-selector.js',
  './src/settings-screen.js',
  './src/keyboard.js',
  './src/equation-classifier.js',
  './src/level-screen.js',
  './src/level-complete.js',
  './src/how-to-play.js',
  './src/achievements.js',
  './src/account-screen.js',
  './src/admin-screen.js',
  './src/legal-screens.js',
  './src/app.js',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML so updates roll out promptly; cache-first for the
// rest so the shell loads instantly and works offline.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      // Opportunistically cache same-origin successful responses
      if (r && r.ok && url.origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return r;
    }))
  );
});

// ── Web Push ─────────────────────────────────────────────────────────────
// Receives push messages from a backend signed with VAPID keys (see
// PUSH-SETUP.md). Body shape: { title, body, url? }.

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch { data = { body: e.data?.text() || '' }; }
  const title = data.title || 'Function Plane';
  const body  = data.body  || 'New update available';
  const url   = data.url   || './';
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: './icons/icon.svg', badge: './icons/icon.svg',
    data: { url }, tag: 'fp-news', renotify: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const c of clients) {
      if (c.url.endsWith(target) && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(target);
  }));
});

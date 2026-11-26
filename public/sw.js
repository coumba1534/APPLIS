// Service worker : l'appli et le texte du Coran restent disponibles sans connexion.
const VERSION = 'v12';
const CACHE = `khatam-${VERSION}`;
// Chemins relatifs à l'emplacement du service worker (racine du site ou sous-dossier).
const ROOT = new URL('./', self.location).href;
// Fichiers de l'appli (scripts, styles, polices) : la liste est écrite à la construction (vite.config.ts).
self.__ASSETS__ = [];
// Tout ce qu'il faut pour ouvrir l'appli et lire sans connexion : l'appli elle-même, le mushaf,
// les deux textes arabes et la traduction.
const PRECACHE = ['', 'manifest.webmanifest', 'config.json', 'icons/icon-192.png', 'icons/icon.svg',
  'data/ar-hafs.json', 'data/mushaf.json', 'data/ar.json', 'data/fr.json', ...self.__ASSETS__].map((p) => ROOT + p);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  // Réglages à distance : toujours le plus récent, le cache sert seulement hors connexion.
  if (url.origin === self.location.origin && url.pathname.endsWith('/config.json')) {
    event.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Pages : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(ROOT, copy)); return res; })
        .catch(() => caches.match(ROOT)),
    );
    return;
  }

  // Le reste (scripts, polices, Coran) : cache d'abord, puis mise à jour en arrière-plan.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// Notification envoyée par le programme d'envoi (appli fermée) : on l'affiche.
self.addEventListener('push', (event) => {
  let msg = { title: 'Khatm', body: '' };
  try { msg = { ...msg, ...event.data.json() }; } catch { /* message vide */ }
  event.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body, tag: msg.tag || undefined, icon: ROOT + 'icons/icon-192.png', badge: ROOT + 'icons/icon-192.png',
  }));
});

// Ouvrir l'appli quand on touche une notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow(ROOT);
    }),
  );
});

/// <reference lib="webworker" />
// FocusNest service worker (built by vite-plugin-pwa, injectManifest strategy).
//
// What works offline (safe by design):
//   • The whole app shell, icons, sounds and images (precached, versioned)
//   • Guest mode: every feature, because guest data lives on the device
//   • Signed-in mode: the last data the app saw is shown read-only
// What never goes through the cache:
//   • API requests (/api/*, /socket.io/*) — personal data is never stored
//     in the service-worker cache and writes are never replayed blindly.
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

const sw = self;

// ---- precache (list injected at build time; changes on every deploy) ----
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ---- app updates ----
// The page shows "Update available"; when the user accepts, it posts
// SKIP_WAITING and reloads once the new worker takes control.
sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});
clientsClaim();

// ---- navigation: SPA shell, with an offline page as the last resort ----
const shellHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(async (options) => {
    try {
      return await shellHandler(options);
    } catch {
      const cache = await caches.match('/offline.html', { ignoreSearch: true });
      return cache || Response.error();
    }
  }, { denylist: [/^\/api\//, /^\/socket\.io\//, /\/[^/?]+\.[^/]+$/] }),
);

// ---- API & realtime: always network, never cached by the worker ----
registerRoute(({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/'), new NetworkOnly());

// ---- Google Fonts (optional; system fonts are used when offline) ----
registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com', new StaleWhileRevalidate({ cacheName: 'fn-font-css' }));
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'fn-font-files', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
);

// ---- same-origin images not in the precache (e.g. splash screens) ----
registerRoute(
  ({ request, url }) => url.origin === sw.location.origin && request.destination === 'image',
  new CacheFirst({ cacheName: 'fn-images', plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 })] }),
);

// ---- Web Push (break over, focus complete, bedtime reminders) ----
sw.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'FocusNest';
  const options = {
    body: data.body || 'You have a new reminder.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || 'focusnest',
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: [180, 80, 180],
    data: { url: data.url || '/' },
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
  };
  event.waitUntil(
    (async () => {
      await sw.registration.showNotification(title, options);
      // Let any open window know, so it can refresh its state.
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', tag: options.tag }));
    })(),
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', sw.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === sw.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'NAVIGATE', url: target, action: event.action || null });
        return;
      }
      await sw.clients.openWindow(target);
    })(),
  );
});

// Re-subscribe automatically if the browser rotates the push subscription.
sw.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    })(),
  );
});

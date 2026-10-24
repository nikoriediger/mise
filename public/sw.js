/* Service worker: push notifications + offline access to recently viewed recipes. */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const MAX_PAGES = 40;
const MAX_IMAGES = 200;
// Don't cache during local development (keeps hot reload predictable)
const CACHING = self.location.hostname !== "localhost";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (CACHING) event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add("/offline.html")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

/** Signed storage URLs change every hour; cache images by path without the token. */
function imageKey(url) {
  return url.origin + url.pathname;
}

function isStorageImage(url) {
  return url.pathname.startsWith("/storage/v1/object/") && url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!CACHING || request.method !== "GET") return;
  const url = new URL(request.url);

  // App code and fonts: cache first (file names contain a hash)
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Recipe photos and profile pictures: network first, cached copy when offline
  if (isStorageImage(url)) {
    const key = imageKey(url);
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok || res.type === "opaque") {
            caches.open(IMAGE_CACHE).then((c) => c.put(key, res.clone()).then(() => trim(IMAGE_CACHE, MAX_IMAGES)));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Page loads: network first, then the saved copy, then the offline page
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname.startsWith("/recipes/")) {
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, res.clone()).then(() => trim(PAGE_CACHE, MAX_PAGES)));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/offline.html")) || Response.error()),
    );
  }
});

// The app asks to keep a recipe available offline (pages opened via client-side navigation)
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "cache-page" && CACHING && typeof data.url === "string") {
    const path = new URL(data.url, self.location.origin).pathname;
    event.waitUntil(
      fetch(path, { credentials: "include" })
        .then((res) => (res.ok ? caches.open(PAGE_CACHE).then((c) => c.put(path, res).then(() => trim(PAGE_CACHE, MAX_PAGES))) : null))
        .catch(() => {}),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "🌿", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

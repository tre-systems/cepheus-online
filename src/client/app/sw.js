const BUILD_HASH = "__BUILD_HASH__";
const CACHE_NAME = `cepheus-online-${BUILD_HASH}`;
const PRECACHE_URLS = [
  "/",
  "/client.js",
  `/client.js?v=${BUILD_HASH}`,
  "/styles.css",
  `/styles.css?v=${BUILD_HASH}`,
  "/icon.svg",
  "/icon-maskable.svg",
  "/favicon.svg",
  "/site.webmanifest",
  "/manifest.webmanifest",
  "/manifest.json"
];

const isDynamicRequest = (event, url) =>
  event.request.method !== "GET" ||
  url.pathname.startsWith("/rooms/") ||
  url.pathname.startsWith("/api/") ||
  url.pathname === "/health" ||
  url.pathname === "/api/health" ||
  url.pathname === "/sw.js";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients
          .matchAll()
          .then((clients) =>
            clients.forEach((client) =>
              client.postMessage({type: "SW_UPDATED", buildHash: BUILD_HASH})
            )
          )
      )
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (isDynamicRequest(event, url)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetched;
    })
  );
});

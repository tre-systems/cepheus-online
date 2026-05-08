const BUILD_HASH = '__BUILD_HASH__'
const CACHE_NAME = `cepheus-online-${BUILD_HASH}`
const PRECACHE_URLS = [
  '/',
  '/client.js',
  `/client.js?v=${BUILD_HASH}`,
  '/styles.css',
  `/styles.css?v=${BUILD_HASH}`,
  '/icon.svg',
  '/icon-maskable.svg',
  '/favicon.svg',
  '/site.webmanifest',
  '/manifest.webmanifest',
  '/manifest.json'
]

const isDynamicRequest = (event, url) =>
  event.request.method !== 'GET' ||
  url.pathname.startsWith('/rooms/') ||
  url.pathname.startsWith('/api/') ||
  url.pathname === '/health' ||
  url.pathname === '/api/health' ||
  url.pathname === '/sw.js'

const isClientAssetRequest = (url) =>
  url.pathname.startsWith('/client/') ||
  url.pathname === '/client.js' ||
  url.pathname === '/styles.css'

const fetchAndCache = (request) =>
  fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
    }
    return response
  })

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
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
        self.clients.matchAll().then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'SW_UPDATED', buildHash: BUILD_HASH })
          }
        })
      )
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (isDynamicRequest(event, url)) return

  if (isClientAssetRequest(url)) {
    event.respondWith(
      fetchAndCache(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match('/'))
        )
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetchAndCache(event.request).catch(() => cached)

      return cached || fetched
    })
  )
})

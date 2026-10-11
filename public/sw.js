const CACHE_NAME = 'translation-studio-shell-v2'
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/app.svg',
  '/icons/app-192.png',
  '/icons/app-512.png',
]
// Only Vite's fingerprinted JavaScript/CSS bundles belong to the app cache.
const BUILD_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/

function isAppAsset(url) {
  return (
    url.origin === self.location.origin &&
    !url.search &&
    (SHELL_URLS.includes(url.pathname) || BUILD_ASSET.test(url.pathname))
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(SHELL_URLS)
      const html = await (await cache.match('/index.html')).text()
      const assets = [...html.matchAll(/(?:src|href)="([^\"]+)"/g)]
        .map((match) => new URL(match[1], self.location.origin))
        .filter((url) => isAppAsset(url) && BUILD_ASSET.test(url.pathname))
        .map((url) => url.pathname)
      await cache.addAll([...new Set(assets)])
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('translation-studio-shell-') && key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  // API/cloud requests, model weights and runtime downloads bypass this worker.
  if (request.method !== 'GET' || !isAppAsset(url)) return
  if (request.mode === 'navigate') {
    if (!['/', '/index.html'].includes(url.pathname)) return
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match('/index.html')),
      ),
    )
    return
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (
        response.ok &&
        response.type === 'basic' &&
        !response.redirected &&
        isAppAsset(new URL(response.url))
      ) {
        await cache.put(request, response.clone())
      }
      return response
    })(),
  )
})

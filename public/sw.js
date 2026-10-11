const CACHE_NAME = 'translation-studio-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/app.svg', '/icons/app-192.png', '/icons/app-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(SHELL_URLS)
    // Vite fingerprints the entry assets. Cache those alongside the HTML so
    // an offline first revisit can load the already-installed application.
    const html = await (await cache.match('/index.html')).text()
    const assets = [...html.matchAll(/(?:src|href)="([^\"]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
      .map((url) => url.pathname)
    await cache.addAll([...new Set(assets)])
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('translation-studio-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }
  // Deliberately exclude API endpoints, evaluation payloads and model assets.
  if (!SHELL_URLS.includes(url.pathname) && !url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/icons/')) return
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })())
})

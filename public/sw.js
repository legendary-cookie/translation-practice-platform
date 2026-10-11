const CACHE_NAME = 'lingo-practice-shell-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  const isAppShellRequest = request.mode === 'navigate' || ['script', 'style', 'image', 'font'].includes(request.destination)

  if (!isAppShellRequest) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => cachedResponse ?? fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const responseCopy = networkResponse.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy))
      }
      return networkResponse
    })).catch(() => request.mode === 'navigate' ? caches.match('/index.html') : Response.error()),
  )
})

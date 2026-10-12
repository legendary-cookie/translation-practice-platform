// Vite replaces the release marker with a content hash in production builds.
const CACHE_NAME = 'lingo-practice-shell-__RELEASE_ID__'
const CACHE_PREFIX = 'lingo-practice-shell-'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']
const AUDIO_ASSETS = [
  '/audio/interpreting/rights.json',
  '/audio/interpreting/zh-community-garden.wav',
  '/audio/interpreting/en-library.wav',
  '/audio/interpreting/ru-repair.wav',
  '/audio/interpreting/fr-rooftop.wav',
  '/audio/interpreting/hi-seeds.wav',
  '/audio/interpreting/es-notebook.wav',
  '/audio/interpreting/ar-map.wav',
]
const PRECACHE_MANIFEST = '/precache-manifest.json'

function toRootAssetUrl(path) {
  return path.startsWith('/') ? path : `/${path}`
}

async function precacheAppShell() {
  const manifestResponse = await fetch(PRECACHE_MANIFEST, { cache: 'no-store' })
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load ${PRECACHE_MANIFEST} for precaching.`)
  }

  const manifest = await manifestResponse.json()
  const generatedAssets = (Array.isArray(manifest.assets) ? manifest.assets : [])
    .filter((asset) => typeof asset === 'string')
    .map(toRootAssetUrl)

  const cache = await caches.open(CACHE_NAME)
  await cache.addAll([...new Set([...APP_SHELL, ...AUDIO_ASSETS, PRECACHE_MANIFEST, ...generatedAssets])])
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  const isPackagedAudioRequest = requestUrl.pathname.startsWith('/audio/interpreting/')
  const isAppShellRequest = request.mode === 'navigate' || isPackagedAudioRequest || ['script', 'style', 'image', 'font'].includes(request.destination)

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

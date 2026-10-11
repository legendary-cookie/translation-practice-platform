const CACHE_PREFIX = 'lingo-practice-shell-'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']
const PRECACHE_MANIFEST = '/precache-manifest.json'
const BUILT_ASSET_PATH = /^\/assets\/[^/]+\.(?:js|css)$/u

let activeCacheName

function toBuiltAssetPath(path) {
  try {
    const assetUrl = new URL(path, self.location.origin)
    if (assetUrl.origin !== self.location.origin || !BUILT_ASSET_PATH.test(assetUrl.pathname)) {
      return undefined
    }
    return assetUrl.pathname + assetUrl.search
  } catch {
    return undefined
  }
}

async function hashRelease(value) {
  try {
    const digest = await self.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
  }
}

async function readRelease() {
  const [manifestResponse, indexResponse] = await Promise.all([
    fetch(PRECACHE_MANIFEST, { cache: 'no-store' }),
    fetch('/index.html', { cache: 'no-store' }),
  ])
  if (!manifestResponse.ok) {
    throw new Error('Unable to load ' + PRECACHE_MANIFEST + ' for precaching.')
  }
  if (!indexResponse.ok) {
    throw new Error('Unable to load the production app shell: HTTP ' + indexResponse.status + '.')
  }

  const [manifestText, indexHtml] = await Promise.all([
    manifestResponse.clone().text(),
    indexResponse.clone().text(),
  ])
  let manifest
  try {
    manifest = JSON.parse(manifestText)
  } catch {
    throw new Error('Unable to parse ' + PRECACHE_MANIFEST + ' for precaching.')
  }

  const generatedAssets = Array.isArray(manifest.assets)
    ? Array.from(new Set(manifest.assets.map(toBuiltAssetPath).filter((path) => path !== undefined)))
    : []
  if (generatedAssets.length === 0) {
    throw new Error('The ' + PRECACHE_MANIFEST + ' file did not list built JavaScript or CSS assets.')
  }

  return {
    cacheName: CACHE_PREFIX + await hashRelease(indexHtml + '\n' + manifestText),
    generatedAssets,
  }
}

async function deleteSupersededShellCaches(currentCacheName) {
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== currentCacheName)
      .map((key) => caches.delete(key)),
  )
}

async function precacheAppShell(release) {
  const currentRelease = release ?? await readRelease()
  if (activeCacheName === currentRelease.cacheName) {
    return
  }

  const cache = await caches.open(currentRelease.cacheName)
  try {
    await cache.addAll([
      ...APP_SHELL,
      PRECACHE_MANIFEST,
      ...currentRelease.generatedAssets,
    ])
  } catch (error) {
    await caches.delete(currentRelease.cacheName)
    throw error
  }

  activeCacheName = currentRelease.cacheName
  await deleteSupersededShellCaches(activeCacheName)
}

async function getCurrentShellCache() {
  if (activeCacheName) {
    return caches.open(activeCacheName)
  }

  const shellCaches = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX)).sort()
  const latestCacheName = shellCaches[shellCaches.length - 1]
  if (!latestCacheName) {
    return undefined
  }

  activeCacheName = latestCacheName
  return caches.open(latestCacheName)
}

function isAppAssetRequest(requestUrl) {
  return requestUrl.pathname === PRECACHE_MANIFEST
    || APP_SHELL.includes(requestUrl.pathname)
    || BUILT_ASSET_PATH.test(requestUrl.pathname)
}

async function respondToNavigation(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' })
    if (networkResponse.ok && (networkResponse.headers.get('content-type') ?? '').includes('text/html')) {
      try {
        await precacheAppShell()
      } catch {
        // Keep the online response usable if the release manifest or an asset is unavailable.
      }
    }
    return networkResponse
  } catch {
    const cache = await getCurrentShellCache()
    return (await cache?.match(request)) ?? (await cache?.match('/index.html')) ?? Response.error()
  }
}

async function respondToAsset(request) {
  const cache = await getCurrentShellCache()
  const cachedResponse = await cache?.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok && cache) {
      await cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const shellCaches = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX))
      if (!activeCacheName) {
        try {
          const release = await readRelease()
          if (shellCaches.includes(release.cacheName)) {
            activeCacheName = release.cacheName
          }
        } catch {
          // An offline activation can retain the cache prepared during install.
        }
      }

      if (!activeCacheName) {
        activeCacheName = shellCaches.sort()[shellCaches.length - 1]
      }

      if (activeCacheName) {
        await deleteSupersededShellCaches(activeCacheName)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(respondToNavigation(request))
    return
  }

  if (!isAppAssetRequest(requestUrl)) {
    return
  }

  event.respondWith(respondToAsset(request))
})

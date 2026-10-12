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

function parseByteRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) {
    return undefined
  }
  if (size <= 0 || (!match[1] && !match[2])) {
    return { unsatisfiable: true }
  }

  let start
  let end
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { unsatisfiable: true }
    }
    start = Math.max(size - suffixLength, 0)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return { unsatisfiable: true }
  }
  return { start, end: Math.min(end, size - 1) }
}

async function respondWithCachedAudioRange(request, cachedResponse) {
  const withByteRangeSupport = (response) => {
    const headers = new Headers(response.headers)
    headers.set('Accept-Ranges', 'bytes')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
  const rangeHeader = request.headers.get('range')
  if (!rangeHeader) {
    return withByteRangeSupport(cachedResponse)
  }
  if (!/^bytes=\d*-\d*$/i.test(rangeHeader.trim())) {
    return withByteRangeSupport(cachedResponse)
  }

  const body = await cachedResponse.arrayBuffer()
  const range = parseByteRange(rangeHeader, body.byteLength)
  if (!range) {
    return cachedResponse
  }
  if (range.unsatisfiable) {
    return new Response(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${body.byteLength}`,
        'Content-Length': '0',
      },
    })
  }

  const headers = new Headers(cachedResponse.headers)
  headers.delete('Content-Encoding')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${body.byteLength}`)
  headers.set('Content-Length', String(range.end - range.start + 1))
  return new Response(body.slice(range.start, range.end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  const isPackagedAudioRequest = requestUrl.pathname.startsWith('/audio/interpreting/')
  const isAppShellRequest = request.mode === 'navigate' || isPackagedAudioRequest || ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)

  if (!isAppShellRequest) {
    return
  }

  event.respondWith((async () => {
    try {
      const cachedResponse = await caches.match(requestUrl.href)
      if (cachedResponse) {
        return isPackagedAudioRequest
          ? respondWithCachedAudioRange(request, cachedResponse)
          : cachedResponse
      }

      const networkResponse = await fetch(request)
      if (networkResponse.ok && !request.headers.has('range')) {
        const responseCopy = networkResponse.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy))
      }
      return networkResponse
    } catch {
      return request.mode === 'navigate' ? caches.match('/index.html') : Response.error()
    }
  })())
})

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
])

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' blob: 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(message)
}

function createStaticServer(rootDirectory, { port = 0 } = {}) {
  const root = path.resolve(rootDirectory)
  let origin = ''

  const server = http.createServer((request, response) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Method not allowed')
      return
    }

    if (request.headers.host !== new URL(origin).host) {
      sendText(response, 421, 'Misdirected request')
      return
    }

    const queryIndex = request.url.indexOf('?')
    const rawPath = request.url.slice(0, queryIndex < 0 ? undefined : queryIndex)
    let decodedPath
    try {
      decodedPath = decodeURIComponent(rawPath)
    } catch {
      sendText(response, 400, 'Invalid path encoding')
      return
    }

    if (!decodedPath.startsWith('/') || decodedPath.includes('\0') || decodedPath.includes('\\')) {
      sendText(response, 400, 'Invalid path')
      return
    }

    const segments = decodedPath.split('/')
    if (segments.some((segment) => segment === '..')) {
      sendText(response, 403, 'Path traversal is not allowed')
      return
    }

    const relativePath = decodedPath.replace(/^\/+/, '') || 'index.html'
    let filePath = path.resolve(root, relativePath)
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      sendText(response, 403, 'Path is outside the application')
      return
    }

    let fileStat
    try {
      fileStat = fs.statSync(filePath)
      if (!fileStat.isFile()) fileStat = undefined
    } catch {
      fileStat = undefined
    }

    if (!fileStat && path.extname(relativePath) === '') {
      filePath = path.join(root, 'index.html')
      try {
        fileStat = fs.statSync(filePath)
      } catch {
        fileStat = undefined
      }
    }

    if (!fileStat?.isFile()) {
      sendText(response, 404, 'Not found')
      return
    }

    const extension = path.extname(filePath).toLowerCase()
    response.statusCode = 200
    response.setHeader('Cache-Control', ['.js', '.html', '.json'].includes(extension) ? 'no-cache' : 'public, max-age=300')
    response.setHeader('Content-Length', fileStat.size)
    response.setHeader('Content-Type', CONTENT_TYPES.get(extension) || 'application/octet-stream')

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    const stream = fs.createReadStream(filePath)
    stream.on('error', () => {
      if (!response.headersSent) sendText(response, 500, 'Unable to read application file')
      else response.destroy()
    })
    stream.pipe(response)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Local application server did not bind to a TCP port.'))
        return
      }
      origin = `http://127.0.0.1:${address.port}`
      resolve({
        origin,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => error ? closeReject(error) : closeResolve())
        }),
      })
    })
  })
}

module.exports = { createStaticServer }

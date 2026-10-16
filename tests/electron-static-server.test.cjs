const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createStaticServer } = require('../electron/static-server.cjs')

function request(origin, requestPath, { method = 'GET', host } = {}) {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: requestPath,
      method,
      headers: host ? { Host: host } : undefined,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('desktop static server serves only the bundled app over a secure local origin', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-electron-static-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>Lingo Practice</title>')
  fs.mkdirSync(path.join(directory, 'assets'))
  fs.writeFileSync(path.join(directory, 'assets', 'app.js'), 'window.ready = true')
  const local = await createStaticServer(directory)
  context.after(async () => {
    await local.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const home = await request(local.origin, '/')
  assert.equal(home.status, 200)
  assert.match(home.body, /Lingo Practice/u)
  assert.equal(home.headers['x-content-type-options'], 'nosniff')
  assert.match(home.headers['content-security-policy'], /worker-src 'self' blob:/u)

  const asset = await request(local.origin, '/assets/app.js')
  assert.equal(asset.status, 200)
  assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8')

  const appRoute = await request(local.origin, '/practice')
  assert.equal(appRoute.status, 200)
  assert.match(appRoute.body, /Lingo Practice/u)
})

test('desktop static server rejects traversal, unexpected hosts and write methods', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-electron-static-'))
  fs.writeFileSync(path.join(directory, 'index.html'), 'app')
  const local = await createStaticServer(directory)
  context.after(async () => {
    await local.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  assert.equal((await request(local.origin, '/%2e%2e%2foutside.txt')).status, 403)
  assert.equal((await request(local.origin, '/', { host: 'untrusted.invalid' })).status, 421)
  assert.equal((await request(local.origin, '/', { method: 'POST' })).status, 405)
})

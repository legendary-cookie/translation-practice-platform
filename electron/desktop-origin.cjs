const fs = require('node:fs')
const path = require('node:path')
const { createStaticServer } = require('./static-server.cjs')

function validPort(port) {
  return Number.isInteger(port) && port > 1023 && port <= 65535
}

async function startDesktopServer(root, userData, chooseLegacyOrigin) {
  fs.mkdirSync(userData, { recursive: true })
  const configuration = path.join(userData, 'desktop-origin.json')
  let port = 0
  if (fs.existsSync(configuration)) {
    const saved = JSON.parse(fs.readFileSync(configuration, 'utf8'))
    if (!validPort(saved.port)) throw new Error('The saved desktop origin is invalid. Preserve your app data and repair desktop-origin.json before restarting.')
    port = saved.port
  } else {
    const indexedDb = path.join(userData, 'IndexedDB')
    const legacy = fs.existsSync(indexedDb) ? fs.readdirSync(indexedDb).flatMap((name) => {
      const match = name.match(/^http_127\.0\.0\.1_(\d+)\.indexeddb\.leveldb$/u)
      const previousPort = Number(match?.[1])
      return validPort(previousPort) ? [previousPort] : []
    }) : []
    if (legacy.length === 1) port = legacy[0]
    else if (legacy.length > 1) {
      if (!chooseLegacyOrigin) throw new Error('Multiple earlier desktop workspaces were found. Select a workspace before starting.')
      port = await chooseLegacyOrigin(legacy)
      if (!legacy.includes(port)) throw new Error('Desktop workspace selection was cancelled.')
    }
  }

  // A saved port must never silently fall back to a new origin with empty storage.
  const local = await createStaticServer(root, { port })
  try {
    if (!port) {
      const temporary = `${configuration}.${process.pid}.${Date.now()}.tmp`
      fs.writeFileSync(temporary, JSON.stringify({ port: Number(new URL(local.origin).port) }), { flag: 'wx' })
      fs.renameSync(temporary, configuration)
    } else if (!fs.existsSync(configuration)) {
      fs.writeFileSync(configuration, JSON.stringify({ port }), { flag: 'wx' })
    }
  } catch (error) {
    await local.close()
    throw error
  }
  return local
}

module.exports = { startDesktopServer }

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { startDesktopServer } = require('../electron/desktop-origin.cjs')

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-origin-'))
  fs.writeFileSync(path.join(directory, 'index.html'), 'app')
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}

test('desktop origin survives restart and occupied saved ports fail without changing storage identity', async (context) => {
  const directory = fixture(context)
  const first = await startDesktopServer(directory, directory)
  const origin = first.origin
  await first.close()
  const second = await startDesktopServer(directory, directory)
  try {
    assert.equal(second.origin, origin)
    await assert.rejects(startDesktopServer(directory, directory), { code: 'EADDRINUSE' })
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'desktop-origin.json'))).port, Number(new URL(origin).port))
  } finally { await second.close() }
})

test('desktop reuses one legacy IndexedDB origin and requires selection when several exist', async (context) => {
  const directory = fixture(context)
  const probe = await startDesktopServer(directory, directory)
  const port = Number(new URL(probe.origin).port)
  await probe.close()
  fs.unlinkSync(path.join(directory, 'desktop-origin.json'))
  fs.mkdirSync(path.join(directory, 'IndexedDB', `http_127.0.0.1_${port}.indexeddb.leveldb`), { recursive: true })
  const legacy = await startDesktopServer(directory, directory)
  assert.equal(Number(new URL(legacy.origin).port), port)
  await legacy.close()
  fs.unlinkSync(path.join(directory, 'desktop-origin.json'))
  fs.mkdirSync(path.join(directory, 'IndexedDB', `http_127.0.0.1_${port === 42000 ? 42001 : 42000}.indexeddb.leveldb`))
  await assert.rejects(startDesktopServer(directory, directory), /Multiple earlier/u)
  const selected = await startDesktopServer(directory, directory, async () => port)
  assert.equal(Number(new URL(selected.origin).port), port)
  await selected.close()
})

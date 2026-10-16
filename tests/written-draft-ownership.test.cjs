const test = require('node:test')
const assert = require('node:assert/strict')
const { createDataWriteCoordinator } = require('../src/storage/data-write-coordinator.ts')

test('same-context writes queued before its own clear cannot repopulate deleted records', async () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  let queue = Promise.resolve()
  const locks = { request(_name, _options, callback) { const result = queue.then(callback); queue = result.catch(() => {}); return result } }
  const coordinator = createDataWriteCoordinator({ getStorage: () => storage, getLockManager: () => locks, createEpoch: () => 'next' })
  await coordinator.runWrite(async () => {})
  const clear = coordinator.clearData(async () => {})
  let staleWriteRan = false
  const stale = coordinator.runWrite(async () => { staleWriteRan = true })
  await clear
  await assert.rejects(stale, /deleted|another tab/i)
  assert.equal(staleWriteRan, false)
  let freshWriteRan = false
  await coordinator.runWrite(async () => { freshWriteRan = true })
  assert.equal(freshWriteRan, true)
})

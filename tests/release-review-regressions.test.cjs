const assert = require('node:assert/strict')
const test = require('node:test')
const { createDataWriteCoordinator, DATA_EPOCH_STORAGE_KEY } = require('../src/storage/data-write-coordinator.ts')
const { createCloudProvider } = require('../src/ai/cloud-provider.ts')
const { loadImportedAudioMetadata } = require('../src/features/interpreting/audio-import-metadata.ts')

test('a lazy service-worker asset response stays alive until its cache write settles', async () => {
  const handlers = new Map()
  let releaseWrite, startWrite
  const writing = new Promise(resolve => { startWrite = resolve })
  const gate = new Promise(resolve => { releaseWrite = resolve })
  require('node:vm').runInNewContext(require('fs').readFileSync(require('path').resolve(__dirname, '../public/sw.js'), 'utf8'), {
    self: { location: { origin: 'https://synthetic.invalid' }, addEventListener: (type, handler) => handlers.set(type, handler) },
    caches: { match: async () => undefined, open: async () => ({ put: async () => { startWrite(); await gate } }) },
    fetch: async () => new Response('synthetic worker'), URL, Headers, Response,
  })
  let response, settled = false
  handlers.get('fetch')({ request: { method: 'GET', url: 'https://synthetic.invalid/assets/local-worker.js', mode: 'cors', destination: 'worker', headers: new Headers() }, respondWith(promise) { response = promise; promise.then(() => { settled = true }) } })
  await writing
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  releaseWrite()
  assert.equal(await (await response).text(), 'synthetic worker')
})

test('next review excludes mastered cards and invalid dates', () => {
  const { nextActiveReviewAt } = require('../src/domain/learning.ts')
  const active = { review: { dueAt: '2026-10-20T00:00:00Z' } }
  const mastered = { mastered: true, review: { dueAt: '2026-10-01T00:00:00Z' } }
  assert.equal(nextActiveReviewAt([mastered, { review: { dueAt: 'invalid' } }, active]), Date.parse(active.review.dueAt))
  assert.equal(nextActiveReviewAt([mastered]), undefined)
  assert.equal(nextActiveReviewAt([]), undefined)
})

test('a fresh tab rejects interrupted-deletion epochs until an explicit exclusive clear completes', async () => {
  const values = new Map([[DATA_EPOCH_STORAGE_KEY, 'pending:interrupted']])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const coordinator = createDataWriteCoordinator({ getStorage: () => storage, getLockManager: () => ({ request: (_name, _options, callback) => Promise.resolve().then(callback) }), createEpoch: () => 'recovered' })
  let writes = 0
  await assert.rejects(coordinator.runWrite(() => writes++), /deleted|changed/)
  await assert.rejects(coordinator.runExclusive(() => writes++), /deleted|changed/)
  assert.throws(() => coordinator.assertCurrentEpoch(), /deleted|changed/)
  assert.equal(writes, 0)
  await coordinator.clearData(async () => {})
  await coordinator.runWrite(() => writes++)
  assert.equal(writes, 1)
  assert.equal(values.get(DATA_EPOCH_STORAGE_KEY), 'active:recovered')
})

test('cloud completion endpoint preserves provider queries and normalizes the session key', async t => {
  let sent
  const original = global.fetch
  global.fetch = async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: 'Synthetic', dimensions: { accuracy: 80, terminology: 80, grammar: 80, fluency: 80, taskStyle: 80 }, strengths: [], issues: [], alternatives: [], uncertainty: 'Synthetic' }) } }] }) } }
  t.after(() => { global.fetch = original })
  const provider = createCloudProvider({ baseUrl: 'https://synthetic.invalid/v1/?api-version=test', model: 'fixture', apiKey: '  fixture-key\n' })
  assert.equal(provider.getConsentDetails().providerUrl, 'https://synthetic.invalid/v1/chat/completions?api-version=test')
  await provider.evaluate({ mode: 'written', exercise: { sourceText: 'Source', sourceLanguage: 'en', targetLanguage: 'zh' }, learnerAnswer: '译文' })
  assert.equal(sent.options.headers.Authorization, 'Bearer fixture-key')
})

test('oversized source audio is rejected before creating an object URL', async () => {
  let opened = false
  await assert.rejects(loadImportedAudioMetadata({ size: 26 * 1024 * 1024 }, { createObjectURL() { opened = true; return 'blob:fixture' } }), /25 MiB/)
  assert.equal(opened, false)
})

test('overlong source audio is rejected and its temporary URL is revoked', async () => {
  const listeners = new Map(), revoked = []
  const audio = { duration: 601, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), pause() {}, removeAttribute() {}, load() { if (this.src) listeners.get('loadedmetadata')?.() } }
  await assert.rejects(loadImportedAudioMetadata(new Blob(['fixture']), { createAudio: () => audio, createObjectURL: () => 'blob:fixture', revokeObjectURL: url => revoked.push(url) }), /10 minutes/)
  assert.deepEqual(revoked, ['blob:fixture'])
})

test('export reads every persisted store once from one snapshot before audio encoding', async () => {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript')
  const rows = { settings: [], sessions: [{ id: 'session', createdAt: '2026-10-16' }], interpretingSessions: [], recordings: [], examRuns: [], examResults: [], examProfiles: [], feedbackRatings: [{ id: 'rating' }], workspace: [], learningCards: [{ id: 'card' }] }
  const blob = new Blob(['fixture'])
  const originalRead = blob.arrayBuffer.bind(blob)
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => { rows.feedbackRatings = []; rows.learningCards = []; return originalRead() } })
  rows.recordings.push({ id: 'take', blob, mimeType: 'audio/wav', byteLength: 7, createdAt: '2026-10-16', durationMs: 100 })
  const transactions = [], reads = []
  const db = { transaction(names, mode) {
    transactions.push({ names, mode })
    const snapshot = { ...rows }
    return { done: Promise.resolve(), objectStore(name) { return { get: async () => { reads.push(name); return undefined }, getAll: async () => { reads.push(name); return snapshot[name] } } } }
  } }
  const filename = path.resolve(__dirname, '../src/storage/database.ts'), mod = new Module(filename, module)
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalRequire = mod.require.bind(mod)
  mod.require = id => id === 'idb' ? { openDB: async () => db } : originalRequire(id)
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  const exported = await mod.exports.database.exportData()
  assert.equal(transactions.length, 1)
  assert.equal(transactions[0].mode, 'readonly')
  assert.deepEqual(reads.sort(), Object.keys(rows).sort())
  assert.deepEqual(exported.feedbackRatings, [{ id: 'rating' }])
  assert.deepEqual(exported.learningCards, [{ id: 'card' }])
  assert.equal(exported.recordings[0].dataUrl, 'data:audio/wav;base64,Zml4dHVyZQ==')
})

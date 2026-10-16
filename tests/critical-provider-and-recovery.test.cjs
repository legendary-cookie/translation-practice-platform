const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function load(relative, stubs = {}) {
  const filename = path.resolve(__dirname, relative)
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.url', JSON.stringify('https://synthetic.invalid/local-provider.ts'))
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  const original = mod.require.bind(mod)
  mod.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : original(id)
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
function storage() {
  const values = new Map()
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k), key: (i) => [...values.keys()][i] ?? null, get length() { return values.size } }
}
function setGlobal(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, { configurable: true, value })
  t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key])
}
function localFixture(t) {
  const workers = []
  let resolveCache
  let generations = 0
  let now = 0
  const evaluationDelays = []
  setGlobal(t, 'performance', { now: () => now })
  const realSetTimeout = globalThis.setTimeout
  setGlobal(t, 'setTimeout', (cb, ms, ...args) => {
    if (ms <= 120000) evaluationDelays.push(ms)
    return realSetTimeout(cb, ms > 100000 && ms <= 120000 ? 20 : ms, ...args)
  })
  setGlobal(t, 'localStorage', storage())
  setGlobal(t, 'Worker', class { constructor() { this.terminated = false; workers.push(this) } addEventListener() {} postMessage() {} terminate() { this.terminated = true } })
  const provider = load('../src/ai/local-provider.ts', {
    './provider': { ProviderUnavailableError: class ProviderUnavailableError extends Error {} },
    '@mlc-ai/web-llm': { prebuiltAppConfig: {}, hasModelInCache: () => new Promise((r) => { resolveCache = r }), CreateWebWorkerMLCEngine: async () => ({ interruptGenerate() {}, chat: { completions: { create: async () => { generations++; throw new Error('synthetic generation') } } } }) },
  }).createLocalProvider()
  t.after(() => provider.dispose())
  return { provider, workers, resolveCache: () => resolveCache(true), generations: () => generations, advance: (ms) => { now += ms }, evaluationDelays }
}

test('local evidence rejection retries with the validation cause and accepts only corrected literal evidence', async (t) => {
  setGlobal(t, 'localStorage', storage())
  setGlobal(t, 'Worker', class { addEventListener() {} postMessage() {} terminate() {} })
  const requests = []
  const input = { mode: 'written', exercise: { sourceLanguage: 'zh', targetLanguage: 'en', sourceText: '居民共同维护花园。' }, learnerAnswer: 'Residents care for the garden together.' }
  const feedback = { coverage: { S1: 'complete' }, summary: 'Synthetic feedback', dimensions: { accuracy: 90, terminology: 90, grammar: 90, fluency: 90, taskStyle: 90 }, strengths: [], alternatives: [], uncertainty: 'Synthetic fixture', issues: [{ dimension: 'accuracy', sourceId: 'S999', learnerId: '', explanation: 'Synthetic evidence note', suggestion: 'Synthetic revision' }] }
  const provider = load('../src/ai/local-provider.ts', {
    './provider': { ProviderUnavailableError: class ProviderUnavailableError extends Error {} },
    '@mlc-ai/web-llm': { prebuiltAppConfig: {}, hasModelInCache: async () => true, CreateWebWorkerMLCEngine: async () => ({ interruptGenerate() {}, chat: { completions: { create: async (request) => {
      requests.push(request)
      const content = structuredClone(feedback)
      if (requests.length === 2) content.issues[0].sourceId = 'S1'
      return (async function* () { yield { choices: [{ delta: { content: JSON.stringify(content) }, finish_reason: 'stop' }] } })()
    } } } }) },
  }).createLocalProvider()
  t.after(() => provider.dispose())
  await provider.prepare()
  const result = await provider.evaluate(input)
  assert.equal(requests.length, 2)
  assert.match(requests[1].messages[0].content, /Validation failure: Local feedback must select an existing evidence ID/u)
  assert.equal(result.issues[0].sourceQuote, '居民共同维护花园。')
})
test('hung cache preflight reaches the evaluation deadline and releases the serialized slot', async (t) => {
  const f = localFixture(t)
  await f.provider.prepare()
  const result = f.provider.evaluate({})
  await assert.rejects(f.provider.evaluate({}), /already in progress/)
  const settled = await Promise.race([result.catch((error) => error), new Promise((r) => setTimeout(() => r('hung'), 100))])
  assert.notEqual(settled, 'hung', 'cache preflight must be inside the deadline')
  assert.match(settled.message, /timed out/)
  assert.equal(f.workers[0].terminated, true)
  assert.equal(f.provider.getStatus(), 'unavailable')
  await f.provider.prepare()
  f.resolveCache()
  await new Promise((r) => setImmediate(r))
  assert.equal(f.provider.getStatus(), 'ready', 'late cache success cannot change the replacement engine')
  assert.equal(f.workers[1].terminated, false)
  assert.equal(f.generations(), 0)
  const retry = f.provider.evaluate({})
  f.provider.cancelEvaluation()
  await assert.rejects(retry, /cancelled/)
})
test('cache preflight cancellation settles without touching a replacement worker', async (t) => {
  const f = localFixture(t)
  await f.provider.prepare()
  const pending = f.provider.evaluate({})
  assert.equal(f.provider.cancelEvaluation(), true)
  await assert.rejects(pending, /cancelled/)
  await f.provider.prepare()
  f.resolveCache()
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(f.provider.getStatus(), 'ready')
  assert.equal(f.workers[1].terminated, false)
})

test('cache preflight consumes the same 120-second budget as generation', async (t) => {
  const f = localFixture(t)
  await f.provider.prepare()
  const pending = f.provider.evaluate({ mode: 'written', learnerAnswer: 'synthetic answer', exercise: { sourceText: 'synthetic source', sourceLanguage: 'en', targetLanguage: 'zh' } })
  await new Promise((resolve) => setImmediate(resolve))
  f.advance(119000)
  f.resolveCache()
  await assert.rejects(pending, /synthetic generation/)
  assert.equal(f.generations(), 1)
  assert.deepEqual(f.evaluationDelays, [120000, 1000], 'generation gets only the unspent operation budget')
})

function databaseFixture(t) {
  const s = storage()
  setGlobal(t, 'localStorage', s)
  setGlobal(t, 'navigator', { locks: { request: (_name, _options, cb) => Promise.resolve().then(cb) } })
  const runs = new Map(); const results = new Map()
  let failCommit = false
  let tail = Promise.resolve()
  const db = {
    transaction() {
      const gate = tail
      let release
      tail = new Promise((resolve) => { release = resolve })
      let staged
      let aborted = false
      const ready = async () => { await gate; staged ??= new Map(runs) }
      const store = {
        get: async (id) => { await ready(); return staged.get(id) },
        put: async (run) => { await ready(); staged.set(run.id, structuredClone(run)) },
        delete: async (id) => { await ready(); staged.delete(id) },
        index: () => ({ getAll: async () => { await ready(); return [...staged.values()].filter((r) => r.status === 'in-progress') } }),
      }
      const resultStore = { getAll: async () => { await ready(); return [...results.values()] }, index: () => ({ get: async (id) => { await ready(); return results.get(id) } }) }
      return {
        objectStore: (name) => name === 'examRuns' ? store : resultStore,
        abort() { aborted = true },
        get done() {
          return (async () => {
            try {
              await ready()
              if (aborted || failCommit) throw new Error('synthetic commit failure')
              runs.clear()
              for (const [k, v] of staged) runs.set(k, v)
            } finally { release() }
          })()
        },
      }
    },
  }
  const database = load('../src/storage/database.ts', { idb: { openDB: async () => db } }).database
  const legacy = { id: 'legacy', profileId: 'synthetic', profileVersion: 1, status: 'in-progress', startedAt: '2026-10-13T00:00:00Z', lastSavedAt: '2026-10-13T00:01:00Z', currentSectionIndex: 1, overallRemainingSeconds: 713, sectionRemainingSeconds: { a: 0, b: 313 }, answers: { b: { p: 'Exact answer 中文\n  spacing' } } }
  const editor = require('../src/storage/exam-run-editor.ts')
  s.setItem(editor.examRunRecoveryKey(legacy.id), JSON.stringify(legacy))
  return { database, s, runs, results, legacy, editor, fail: () => { failCommit = true } }
}
test('resume materializes a valid journal-only run and claims it without losing answer or timers', async (t) => {
  const f = databaseFixture(t)
  const claimed = await f.database.claimExamRunEditor(f.legacy.id, 'new-owner')
  assert.deepEqual(claimed.answers, f.legacy.answers)
  assert.deepEqual(claimed.sectionRemainingSeconds, f.legacy.sectionRemainingSeconds)
  assert.equal(claimed.overallRemainingSeconds, 713)
  assert.equal(claimed.currentSectionIndex, 1)
  assert.equal(claimed.lastSavedAt, f.legacy.lastSavedAt)
  assert.equal(claimed.editorToken, 'new-owner')
  assert.deepEqual(f.runs.get('legacy'), claimed)
})
for (const fence of ['completed-result', 'completed-mirror', 'discard', 'epoch', 'occupied', 'leased-journal', 'invalid-journal', 'commit']) {
  test(`legacy materialization fails closed at ${fence} fence`, async (t) => {
    const f = databaseFixture(t)
    if (fence === 'completed-result') f.results.set('legacy', { runId: 'legacy' })
    if (fence === 'completed-mirror') f.s.setItem(f.editor.examRunCompletionKey('legacy'), 'true')
    if (fence === 'discard') f.s.setItem(f.editor.examRunTombstoneKey('legacy'), 'true')
    if (fence === 'epoch') f.s.setItem('lingo-practice-data-epoch-v1', 'active:changed')
    if (fence === 'occupied') f.runs.set('other', { ...f.legacy, id: 'other' })
    if (fence === 'leased-journal' || fence === 'invalid-journal') {
      f.s.removeItem(f.editor.examRunRecoveryKey('legacy'))
      const candidate = fence === 'leased-journal' ? { ...f.legacy, editorToken: 'old-owner' } : { ...f.legacy, answers: null }
      f.s.setItem(f.editor.examRunRecoveryKey('legacy', candidate.editorToken), JSON.stringify(candidate))
    }
    if (fence === 'commit') f.fail()
    await assert.rejects(f.database.claimExamRunEditor('legacy', 'new-owner'))
    assert.equal(f.runs.has('legacy'), false)
    assert.equal(f.s.getItem(f.editor.editorLeaseKey('legacy')), null)
  })
}
test('committed discard remains discarded if lease mirror cleanup throws', async () => {
  const s = storage()
  const editor = require('../src/storage/exam-run-editor.ts')
  const { discardExamRunWithTombstone } = require('../src/storage/exam-run-lifecycle.ts')
  s.setItem(editor.examRunRecoveryKey('deleted'), 'exact-journal')
  s.setItem(editor.editorLeaseKey('deleted'), 'old-lease')
  const remove = s.removeItem
  s.removeItem = (key) => { if (key === editor.editorLeaseKey('deleted')) throw new Error('synthetic mirror failure'); remove(key) }
  let deleted = false
  await discardExamRunWithTombstone(s, 'deleted', async () => { deleted = true })
  assert.equal(deleted, true)
  assert.equal(s.getItem(editor.examRunTombstoneKey('deleted')), 'true')
  assert.equal(s.getItem(editor.examRunRecoveryKey('deleted')), null)
})


test('two owners racing to migrate one legacy snapshot cannot both claim it', async (t) => {
  const f = databaseFixture(t)
  const outcomes = await Promise.allSettled(['a', 'b'].map((owner) => f.database.claimExamRunEditor(f.legacy.id, owner)))
  assert.deepEqual(outcomes.map((r) => r.status), ['fulfilled', 'rejected'])
  assert.equal(outcomes[1].reason.name, 'ExamRunEditorOwnedError')
  assert.equal(f.runs.size, 1)
  assert.deepEqual(f.runs.get(f.legacy.id).answers, f.legacy.answers)
})

test('failed lease publication aborts legacy materialization and retains the exact journal', async (t) => {
  const f = databaseFixture(t)
  const journalKey = f.editor.examRunRecoveryKey(f.legacy.id)
  const serialized = f.s.getItem(journalKey)
  const set = f.s.setItem
  f.s.setItem = (key, value) => {
    if (key === f.editor.editorLeaseKey(f.legacy.id)) throw new Error('synthetic lease publication failure')
    set(key, value)
  }
  await assert.rejects(f.database.claimExamRunEditor(f.legacy.id, 'new-owner'), /lease publication failure/)
  assert.equal(f.runs.has(f.legacy.id), false)
  assert.equal(f.s.getItem(journalKey), serialized)
})

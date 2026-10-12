const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

function createExamRunTransactionHarness(seed = {}) {
  let runs = new Map((seed.runs ?? []).map((run) => [run.id, run]))
  let results = new Map((seed.results ?? []).map((result) => [result.runId, result]))
  let tail = Promise.resolve()
  const withTransaction = (operation) => {
    const transaction = tail.then(async () => {
      const draftRuns = new Map(runs)
      const draftResults = new Map(results)
      const store = {
        async getInProgressRuns() { return [...draftRuns.values()].filter((run) => run.status === 'in-progress') },
        async getCompletedRunIds() { return [...draftResults.keys()] },
        async getCompletedResult(runId) { return draftResults.get(runId) },
        async putRun(run) { draftRuns.set(run.id, run) },
        async putResult(result) { draftResults.set(result.runId, result) },
        async deleteRun(runId) { draftRuns.delete(runId) },
      }
      const value = await operation(store)
      runs = draftRuns
      results = draftResults
      return value
    })
    tail = transaction.then(() => undefined, () => undefined)
    return transaction
  }
  return { withTransaction, get runs() { return [...runs.values()] }, get results() { return [...results.values()] } }
}

test('simultaneous exam starts claim one shared run through serialized IDB transactions without Web Locks', async () => {
  const { claimExamRunSlot } = require('../src/storage/exam-run-lifecycle.ts')
  const store = createExamRunTransactionHarness()
  const candidate = (id, profileId) => ({ id, profileId, profileVersion: 1, status: 'in-progress', lastSavedAt: '2026-10-13T00:00:00.000Z' })

  const [tabA, tabB] = await Promise.all([
    claimExamRunSlot(candidate('run-a', 'catti-l2-en'), store.withTransaction),
    claimExamRunSlot(candidate('run-b', 'catti-l2-fr'), store.withTransaction),
  ])

  assert.equal(store.runs.length, 1)
  assert.equal(tabA.run.id, tabB.run.id)
  assert.deepEqual([tabA.created, tabB.created].sort(), [false, true])
})

test('atomic completion result fences stale run saves and remains idempotent with rollback', async () => {
  const { assertExamRunNotCompleted, assertExamRunSlotAvailableInTransaction, completeExamRunAtomically, stageExamRunRecoveryAtomically } = require('../src/storage/exam-run-lifecycle.ts')
  const store = createExamRunTransactionHarness({ runs: [{ id: 'run-a', status: 'in-progress' }] })
  const result = { id: 'result-a', runId: 'run-a', score: 71 }

  const first = await completeExamRunAtomically('run-a', result, store.withTransaction)
  const repeated = await completeExamRunAtomically('run-a', { ...result, id: 'duplicate-result' }, store.withTransaction)

  assert.equal(first, repeated)
  assert.equal(store.results.length, 1)
  assert.equal(store.runs.length, 0)
  await assert.rejects(assertExamRunNotCompleted('run-a', store.withTransaction), /completed/i)
  await assert.doesNotReject(assertExamRunNotCompleted('unrelated-run', store.withTransaction), 'unrelated runs remain eligible for writes')
  const legacyStore = createExamRunTransactionHarness({
    runs: [{ id: 'run-a', status: 'in-progress' }],
    results: [first],
  })
  await assert.doesNotReject(legacyStore.withTransaction((view) => assertExamRunSlotAvailableInTransaction(view, 'new-run')),
    'a stale completed row must not occupy the active slot')

  const failingStore = createExamRunTransactionHarness({ runs: [{ id: 'run-fail', status: 'in-progress' }] })
  const failAfterStagedResult = (operation) => failingStore.withTransaction((storeView) => operation({
    ...storeView,
    async putResult(nextResult) {
      await storeView.putResult(nextResult)
      throw new Error('synthetic transaction abort after result write')
    },
  }))
  await assert.rejects(completeExamRunAtomically('run-fail', { id: 'result-fail', runId: 'run-fail' }, failAfterStagedResult), /transaction abort/i)
  assert.equal(failingStore.results.length, 0)
  assert.equal(failingStore.runs.length, 1)

  const stagedStore = createExamRunTransactionHarness({ runs: [{ id: 'run-staged', status: 'in-progress' }] })
  let releaseCompletion
  let completionWriteStarted
  const completionStarted = new Promise((resolve) => { completionWriteStarted = resolve })
  const completionGate = new Promise((resolve) => { releaseCompletion = resolve })
  const delayedCompletionTransaction = (operation) => stagedStore.withTransaction((storeView) => operation({
    ...storeView,
    async putResult(nextResult) {
      completionWriteStarted()
      await completionGate
      await storeView.putResult(nextResult)
    },
  }))
  const pendingCompletion = completeExamRunAtomically('run-staged', { id: 'result-staged', runId: 'run-staged' }, delayedCompletionTransaction)
  await completionStarted
  let journalWritten = false
  const pendingStage = stageExamRunRecoveryAtomically(
    { id: 'run-staged', status: 'in-progress' },
    stagedStore.withTransaction,
    () => { journalWritten = true },
  )
  releaseCompletion()
  await pendingCompletion
  await assert.rejects(pendingStage, /completed/i)
  assert.equal(journalWritten, false, 'a queued stage cannot republish a journal after completion')
})

test('service worker activation claims the first uncontrolled application page', async () => {
  const handlers = new Map()
  let claimCount = 0
  const workerPath = path.join(__dirname, '..', 'public', 'sw.js')
  const workerSource = fs.readFileSync(workerPath, 'utf8')
  const sandbox = {
    self: {
      location: { origin: 'https://lingo.example' },
      clients: { claim: async () => { claimCount += 1 } },
      addEventListener(type, handler) { handlers.set(type, handler) },
    },
    caches: { keys: async () => [], open: async () => ({ addAll: async () => undefined }), match: async () => undefined },
    fetch: async () => { throw new Error('unexpected network request') },
    URL,
    Headers,
    Response,
  }
  vm.runInNewContext(workerSource, sandbox, { filename: workerPath })
  let activation
  handlers.get('activate')({ waitUntil(promise) { activation = promise } })
  await activation

  assert.equal(claimCount, 1)
  const { isPackagedAudioOfflineReady } = require('../src/features/interpreting/offline-asset-status.ts')
  assert.equal(isPackagedAudioOfflineReady(true, false), false, 'cached audio is not labeled offline-ready until this page is controlled')
  assert.equal(isPackagedAudioOfflineReady(true, true), true)
})

test('rights-manifest requests abort and reject at their deadline so the UI can offer retry', async () => {
  const { requestWithDeadline } = require('../src/features/interpreting/request-with-deadline.ts')
  let requestSignal
  await assert.rejects(requestWithDeadline((signal) => {
    requestSignal = signal
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true })
    })
  }, 15, 'Rights manifest check timed out. Retry the check.'), /timed out/i)
  assert.equal(requestSignal.aborted, true)
})

test('a saved interpreting open becomes stale when clear changes the data generation', () => {
  const { isInterpretingOpenCurrent } = require('../src/features/interpreting/session-open-guard.ts')
  const attempt = { openGeneration: 4, dataGeneration: 12 }
  assert.equal(isInterpretingOpenCurrent(attempt, { openGeneration: 4, dataGeneration: 12, page: 'progress' }), true)
  assert.equal(isInterpretingOpenCurrent(attempt, { openGeneration: 4, dataGeneration: 13, page: 'progress' }), false)
  assert.equal(isInterpretingOpenCurrent(attempt, { openGeneration: 5, dataGeneration: 12, page: 'progress' }), false)
  assert.equal(isInterpretingOpenCurrent(attempt, { openGeneration: 4, dataGeneration: 12, page: 'home' }), false)
})

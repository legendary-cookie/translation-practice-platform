const assert = require('node:assert/strict')
const test = require('node:test')

function createRunStore(seed) {
  let runs = new Map(seed.map((run) => [run.id, structuredClone(run)]))
  let tail = Promise.resolve()
  const transaction = (operation) => {
    const pending = tail.then(async () => {
      const staged = new Map([...runs].map(([id, run]) => [id, structuredClone(run)]))
      const store = {
        async getRun(id) { return staged.get(id) },
        async getInProgressRuns() { return [...staged.values()].filter((run) => run.status === 'in-progress') },
        async getCompletedRunIds() { return [] },
        async getCompletedResult() { return undefined },
        async putRun(run) { staged.set(run.id, structuredClone(run)) },
      }
      const result = await operation(store)
      runs = staged
      return result
    })
    tail = pending.then(() => undefined, () => undefined)
    return pending
  }
  return { transaction, get runs() { return [...runs.values()] } }
}

function memoryStorage(initial = []) {
  const values = new Map(initial)
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
    key(index) { return [...values.keys()][index] ?? null },
    get length() { return values.size },
    values,
  }
}

test('serialized exam editor claims allow one owner and heartbeat survives a paused evaluation', async () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const store = createRunStore([{
    id: 'run-lease', status: 'in-progress', revision: 2, editorToken: undefined,
    editorLeaseExpiresAt: undefined, lastSavedAt: '2026-10-13T00:00:00.000Z',
  }])
  const now = Date.parse('2026-10-13T00:01:00.000Z')
  const attempts = await Promise.allSettled([
    editor.claimExamRunEditor('run-lease', 'tab-a', store.transaction, now),
    editor.claimExamRunEditor('run-lease', 'tab-b', store.transaction, now),
  ])
  const acquired = attempts.filter((attempt) => attempt.status === 'fulfilled')
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected')
  assert.equal(acquired.length, 1)
  assert.equal(rejected.length, 1)
  assert.match(rejected[0].reason.name, /ExamRunEditorOwnedError/)

  const owner = acquired[0].value
  const beforeHeartbeat = owner.editorLeaseExpiresAt
  const duringEvaluation = await editor.renewExamRunEditorLease('run-lease', owner.editorToken, store.transaction, now + 5_000)
  assert.ok(Date.parse(duringEvaluation.editorLeaseExpiresAt) > Date.parse(beforeHeartbeat))
  assert.equal(duringEvaluation.revision, owner.revision, 'lease heartbeats do not rewrite learner/timer revision')
})

test('expired editor takeover fences stale save and staged recovery while preserving only the current revision', async () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const old = {
    id: 'run-takeover', status: 'in-progress', revision: 7, editorToken: 'old-tab',
    editorLeaseExpiresAt: '2026-10-13T00:00:01.000Z', overallRemainingSeconds: 100,
    answers: { section: { passage: 'accepted old answer' } }, lastSavedAt: '2026-10-13T00:00:00.000Z',
  }
  const now = Date.parse('2026-10-13T00:00:10.000Z')
  const store = createRunStore([old])
  const adopted = await editor.claimExamRunEditor('run-takeover', 'new-tab', store.transaction, now, old)
  assert.equal(adopted.answers.section.passage, 'accepted old answer')
  assert.equal(adopted.editorToken, 'new-tab')
  assert.ok(adopted.revision > old.revision)

  await assert.rejects(editor.saveExamRunWithEditor(old, store.transaction), /editor|owner/i)
  await assert.rejects(editor.saveExamRunWithEditor({ ...adopted, editorToken: 'old-tab', revision: adopted.revision + 1, answers: { section: { passage: 'new answer' } } }, store.transaction), /editor|owner/i,
    'a mismatched token cannot persist even if its revision is higher')
  const current = { ...adopted, revision: adopted.revision + 1, answers: { section: { passage: 'new answer' } } }
  await editor.saveExamRunWithEditor(current, store.transaction, now)
  assert.equal(store.runs[0].answers.section.passage, 'new answer')
})

test('expired leases reject a stale editor save even before a different tab claims the run', async () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const store = createRunStore([{
    id: 'run-expired-save', status: 'in-progress', revision: 3, editorToken: 'old-tab',
    editorLeaseExpiresAt: '2026-10-13T00:00:01.000Z', answers: {},
  }])
  await assert.rejects(editor.saveExamRunWithEditor({
    ...store.runs[0], revision: 4, answers: { section: { passage: 'late edit' } },
  }, store.transaction, Date.parse('2026-10-13T00:00:02.000Z')), /lease|owner/i)
  assert.equal(store.runs[0].answers.section, undefined)
})

test('recovery staging requires the exact current editor token and revision inside the IDB transaction', async () => {
  const { stageExamRunRecoveryAtomically } = require('../src/storage/exam-run-lifecycle.ts')
  const owner = {
    id: 'run-stage-owner', status: 'in-progress', revision: 5, editorToken: 'new-owner',
    editorLeaseExpiresAt: '2026-10-13T00:01:00.000Z', lastSavedAt: '2026-10-13T00:00:00.000Z',
  }
  const store = createRunStore([owner])
  let checkpointCount = 0
  await assert.rejects(stageExamRunRecoveryAtomically({
    ...owner, editorToken: 'stale-owner', revision: 6,
  }, store.transaction, () => { checkpointCount += 1 }), /editor|owner/i)
  await assert.rejects(stageExamRunRecoveryAtomically({
    ...owner, revision: 4,
  }, store.transaction, () => { checkpointCount += 1 }), /revision|newer/i)
  assert.equal(checkpointCount, 0)
})

test('synchronous exam checkpoint is visible before return and rejects stale epoch, lease, tombstone, completion, or older revision', () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const now = Date.parse('2026-10-13T00:00:10.000Z')
  const run = {
    id: 'run-checkpoint', status: 'in-progress', revision: 5, editorToken: 'owner',
    editorLeaseExpiresAt: new Date(now + 20_000).toISOString(), answers: { section: { passage: 'latest' } },
    lastSavedAt: '2026-10-13T00:00:10.000Z',
  }
  const storage = memoryStorage([
    [editor.editorLeaseKey(run.id), JSON.stringify({ editorToken: 'owner', expiresAt: run.editorLeaseExpiresAt })],
  ])
  const options = { storage, nowMs: now, isDataEpochCurrent: () => true }
  const key = editor.writeExamRunRecoveryCheckpointSynchronously(run, options)
  assert.equal(JSON.parse(storage.getItem(key)).answers.section.passage, 'latest', 'the latest answer is journaled synchronously')
  storage.setItem(key, JSON.stringify({ ...run, revision: 6, answers: { section: { passage: 'newer' } } }))
  editor.writeExamRunRecoveryCheckpointSynchronously(run, options)
  assert.equal(JSON.parse(storage.getItem(key)).answers.section.passage, 'newer', 'an older snapshot cannot overwrite a newer accepted revision')

  assert.throws(() => editor.writeExamRunRecoveryCheckpointSynchronously(run, { ...options, isDataEpochCurrent: () => false }), /data|epoch/i)
  storage.setItem(editor.editorLeaseKey(run.id), JSON.stringify({ editorToken: 'foreign-owner', expiresAt: run.editorLeaseExpiresAt }))
  assert.throws(() => editor.writeExamRunRecoveryCheckpointSynchronously(run, options), /editor|owner/i)
  storage.setItem(editor.editorLeaseKey(run.id), JSON.stringify({ editorToken: 'owner', expiresAt: run.editorLeaseExpiresAt }))
  storage.setItem(editor.examRunTombstoneKey(run.id), 'true')
  assert.throws(() => editor.writeExamRunRecoveryCheckpointSynchronously(run, options), /discard/i)
  storage.removeItem(editor.examRunTombstoneKey(run.id))
  storage.setItem(editor.examRunCompletionKey(run.id), 'true')
  assert.throws(() => editor.writeExamRunRecoveryCheckpointSynchronously(run, options), /complet/i)
  storage.removeItem(editor.examRunCompletionKey(run.id))
  storage.setItem(key, JSON.stringify({ ...run, answers: { section: { passage: 'different payload, same revision' } } }))
  assert.throws(() => editor.writeExamRunRecoveryCheckpointSynchronously(run, options), /revision|newer/i)
})

test('section advance checkpoints the new section and forfeited time before persistence returns', () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const { advanceSectionAndForfeitTime } = require('../src/domain/exam.ts')
  const profile = {
    totalDurationMinutes: 10,
    sections: [{ id: 'one', timeLimitMinutes: 5 }, { id: 'two', timeLimitMinutes: 5 }],
  }
  const now = Date.parse('2026-10-13T00:00:10.000Z')
  const run = {
    id: 'run-section-checkpoint', status: 'in-progress', revision: 2, editorToken: 'tab-owner',
    editorLeaseExpiresAt: new Date(now + 20_000).toISOString(), lastSavedAt: new Date(now).toISOString(),
    currentSectionIndex: 0, overallRemainingSeconds: 600, sectionRemainingSeconds: { one: 240, two: 300 },
    answers: { one: { passage: 'latest answer' }, two: {} },
  }
  const transitioned = advanceSectionAndForfeitTime(run, profile)
  const storage = memoryStorage([[
    editor.editorLeaseKey(run.id),
    JSON.stringify({ editorToken: run.editorToken, expiresAt: run.editorLeaseExpiresAt }),
  ]])
  const key = editor.writeExamRunRecoveryCheckpointSynchronously(transitioned, {
    storage, nowMs: now, isDataEpochCurrent: () => true,
  })
  const staged = JSON.parse(storage.getItem(key))
  assert.equal(staged.currentSectionIndex, 1)
  assert.equal(staged.overallRemainingSeconds, 360)
  assert.equal(staged.sectionRemainingSeconds.one, 0)
  assert.equal(staged.answers.one.passage, 'latest answer')
})

test('Save and Exit releases the editor owner after persisting the last accepted revision', async () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const run = {
    id: 'run-release', status: 'in-progress', revision: 4, editorToken: 'tab-owner',
    editorLeaseExpiresAt: '2026-10-13T00:01:00.000Z', answers: {},
  }
  const store = createRunStore([run])
  const released = await editor.releaseExamRunEditor({ ...run, revision: 5 }, store.transaction)
  assert.equal(released.editorToken, undefined)
  assert.equal(store.runs[0].editorToken, undefined)
  assert.equal(store.runs[0].revision, 5)
  await assert.rejects(editor.saveExamRunWithEditor({ ...run, revision: 6 }, store.transaction, Date.parse('2026-10-13T00:00:30.000Z')), /editor|owner/i)
})

test('recovery reconciliation adopts only a newer snapshot from the persisted owner and never completed or discarded attempts', () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const persisted = { id: 'run-reconcile', status: 'in-progress', revision: 3, editorToken: 'owner-a', overallRemainingSeconds: 90 }
  const newer = { ...persisted, revision: 4, overallRemainingSeconds: 85 }
  assert.equal(editor.reconcileExamRunRecoverySnapshot(persisted, [newer]).overallRemainingSeconds, 85)
  assert.equal(editor.reconcileExamRunRecoverySnapshot(persisted, [{ ...newer, editorToken: 'foreign-owner' }]), persisted)
  assert.equal(editor.reconcileExamRunRecoverySnapshot(persisted, [{ ...persisted, revision: 2, overallRemainingSeconds: 1 }]), persisted)
  assert.equal(editor.reconcileExamRunRecoverySnapshot(persisted, [newer], { completed: true }), undefined)
  assert.equal(editor.reconcileExamRunRecoverySnapshot(persisted, [newer], { discarded: true }), undefined)
})

test('saved exam report open guard checks live page and data generation after asynchronous reads', () => {
  const guard = require('../src/features/exam/exam-result-open-guard.ts')
  const attempt = { requestGeneration: 3, dataGeneration: 10 }
  assert.equal(guard.isExamResultOpenCurrent(attempt, { ...attempt, page: 'progress' }), true)
  assert.equal(guard.isExamResultOpenCurrent(attempt, { ...attempt, dataGeneration: 11, page: 'progress' }), false)
  assert.equal(guard.isExamResultOpenCurrent(attempt, { ...attempt, requestGeneration: 4, page: 'progress' }), false)
  assert.equal(guard.isExamResultOpenCurrent(attempt, { ...attempt, page: 'home' }), false)
})

test('audio fetch deadline covers response-body reads and aborts the request', async () => {
  const { fetchAudioBlobWithDeadline } = require('../src/features/interpreting/audio-asset-requests.ts')
  let signal
  await assert.rejects(fetchAudioBlobWithDeadline('/audio/source.wav', {
    timeoutMs: 15,
    fetcher: async (_url, options) => {
      signal = options.signal
      return new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'Content-Type': 'audio/wav' } })
    },
  }), /timed out/i)
  assert.equal(signal.aborted, true)
})

test('written-practice elapsed clock freezes through evaluation and resumes without charging the wait', () => {
  const clock = require('../src/features/practice/pauseable-elapsed-clock.ts')
  const startedAt = 1_000
  const paused = clock.pauseElapsedClock(startedAt, 5_000)
  assert.equal(clock.elapsedSecondsAt(paused.startedAt, 10_000, paused.pausedAt), 4)
  const resumed = clock.resumeElapsedClock(paused.startedAt, paused.pausedAt, 20_000)
  assert.equal(clock.elapsedSecondsAt(resumed, 21_000), 5)
})

test('persisted exam reconciliation charges exit downtime but preserves a clock paused for evaluation', () => {
  const { reconcilePersistedRun } = require('../src/features/exam/persisted-run-reconciliation.ts')
  const profile = {
    totalDurationMinutes: 10,
    sections: [
      { id: 'one', timeLimitMinutes: 5 },
      { id: 'two', timeLimitMinutes: 5 },
    ],
  }
  const savedAt = '2026-10-13T00:00:00.000Z'
  const active = {
    id: 'active', profileId: 'profile', profileVersion: 1, status: 'in-progress',
    startedAt: savedAt, lastSavedAt: savedAt, currentSectionIndex: 0,
    overallRemainingSeconds: 600, sectionRemainingSeconds: { one: 300, two: 300 }, answers: {}, revision: 1,
  }
  const activeAfterDowntime = reconcilePersistedRun(active, profile, Date.parse(savedAt) + 5_000)
  assert.equal(activeAfterDowntime.overallRemainingSeconds, 595)
  assert.equal(activeAfterDowntime.sectionRemainingSeconds.one, 295)
  assert.equal(activeAfterDowntime.revision, 2)

  const paused = { ...active, evaluationPausedAt: savedAt }
  const pausedDuringEvaluation = reconcilePersistedRun(paused, profile, Date.parse(savedAt) + 120_000)
  assert.deepEqual(pausedDuringEvaluation, paused)
})

const assert = require('node:assert/strict')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const { ProgressPage } = require('../src/features/progress/ProgressPage.tsx')
const { validateInterpretingFeedback } = require('../src/domain/scoring.ts')

function createInterpretingInput() {
  const recording = {
    id: 'qa-recording',
    exerciseId: 'qa-interpreting',
    segmentIds: ['qa-source-segment'],
    createdAt: '2026-10-13T00:00:00.000Z',
    mimeType: 'audio/webm',
    durationMs: 2000,
    byteLength: 4,
    blob: new Blob(['qa!!'], { type: 'audio/webm' }),
    kind: 'response',
  }
  const exercise = {
    id: 'qa-interpreting',
    mode: 'interpreting',
    sourceLanguage: 'zh',
    targetLanguage: 'en',
    title: 'Synthetic cloud-evidence fixture',
    topic: 'practice',
    difficulty: 'beginner',
    audioUrl: '/synthetic.wav',
    audioMimeType: 'audio/wav',
    durationMs: 2000,
    segments: [{ id: 'qa-source-segment', startMs: 0, endMs: 2000, transcript: 'A literal source segment.' }],
    glossary: [],
    tags: ['general'],
    rightsRecordId: 'qa-synthetic',
    sourceTranscriptStatus: 'authored',
  }
  return {
    exercise,
    interpretingMode: 'simultaneous',
    responseSegments: [{
      id: 'qa-response-segment',
      sourceSegmentId: 'qa-source-segment',
      recordingId: recording.id,
      responseStartMs: 250,
      responseEndMs: 1500,
      transcript: 'A learner response.',
      transcriptSource: 'manual',
      recognitionStatus: 'verified',
    }],
    recordings: [recording],
    deliveryAnalysis: [{
      recordingId: recording.id,
      durationMs: recording.durationMs,
      activeSpeechRatio: 1,
      pauseCount: 0,
      longestPauseMs: 0,
      analysisConfidence: 0.35,
      method: 'local-web-audio-energy-v1',
    }],
  }
}

function createInterpretingFeedback() {
  return {
    summary: 'Synthetic fixture only.',
    contentScores: { meaningTransfer: 80, omissions: 90, additionsMistranslations: 90, terminology: 80 },
    deliveryScores: { fluency: 70, pacing: 75, hesitation: 80 },
    overallScore: 80,
    strengths: [],
    issues: [{
      category: 'fluency',
      sourceSegmentId: 'qa-source-segment',
      responseSegmentId: 'qa-response-segment',
      explanation: 'Synthetic delivery annotation.',
      suggestion: 'Review this response segment.',
      evidenceStatus: 'verified',
    }],
    uncertainEvidence: [],
    alternatives: [],
    uncertainty: 'No learner content was sent; this is a validator fixture.',
  }
}

test('consented attached cloud audio can verify delivery annotations without trusting local energy confidence', () => {
  const input = createInterpretingInput()
  const feedback = createInterpretingFeedback()
  const consentedAudio = {
    providerUrl: 'https://loopback.invalid/v1/chat/completions',
    model: 'synthetic-audio-fixture',
    taskConsentGranted: true,
    attachedRecordingIds: ['qa-recording'],
  }

  const cloud = validateInterpretingFeedback(feedback, input, consentedAudio)
  assert.equal(cloud.deliveryScoreStatus, 'complete')
  assert.equal(cloud.issues[0]?.evidenceStatus, 'verified')

  const localOnly = validateInterpretingFeedback(feedback, input)
  assert.equal(localOnly.deliveryScoreStatus, 'incomplete')
  assert.equal(localOnly.issues.length, 0)
  assert.equal(localOnly.uncertainEvidence[0]?.evidenceStatus, 'uncertain')

  const wrongAttachment = validateInterpretingFeedback(feedback, input, {
    ...consentedAudio,
    attachedRecordingIds: ['unrelated-recording'],
  })
  assert.equal(wrongAttachment.deliveryScoreStatus, 'incomplete')
  assert.equal(wrongAttachment.issues.length, 0)
})

test('unreadable interpreting and exam history never appears as authoritative empty history', () => {
  const markup = renderToStaticMarkup(React.createElement(ProgressPage, {
    sessions: [],
    sessionHistoryStatus: 'ready',
    interpretingSessions: [],
    interpretingHistoryStatus: 'failed',
    examResults: [],
    examHistoryStatus: 'failed',
    onStartPractice() {},
    onRetryInterpretingHistory() {},
    onRetryExamHistory() {},
  }))

  assert.match(markup, /Saved local history is not fully available/i)
  assert.match(markup, /Retry interpreting history/i)
  assert.match(markup, /Retry exam history/i)
  assert.doesNotMatch(markup, /No exam simulations completed yet/i)
})

test('generic history reads preserve failure as a failed state instead of an empty success', async () => {
  const { readHistoryRecords } = require('../src/features/practice/session-history.ts')
  const failed = await readHistoryRecords(async () => { throw new Error('synthetic IndexedDB read failure') })
  assert.deepEqual(failed, { status: 'failed', records: [] })
  assert.deepEqual(await readHistoryRecords(async () => []), { status: 'ready', records: [] })
})

test('failed settings hydration rejects full-record writes until a successful retry', async () => {
  const { createSettingsHydrationAttempt, runAfterSettingsHydrated } = require('../src/features/settings/settings-hydration.ts')
  const saved = { evaluationMode: 'local-only', cloudBaseUrl: 'https://saved.example/v1', cloudModel: 'saved-model', cloudSupportsAudio: true }
  let current = saved
  let writes = 0

  const initial = createSettingsHydrationAttempt()
  const blockedWrite = runAfterSettingsHydrated(initial, async () => {
    writes += 1
    current = { ...current, evaluationMode: 'local-first-cloud-fallback' }
  })
  initial.complete(false)
  await assert.rejects(blockedWrite, /settings could not be loaded/i)
  assert.equal(writes, 0)
  assert.equal(current.cloudBaseUrl, 'https://saved.example/v1')
  assert.equal(current.cloudModel, 'saved-model')
  assert.equal(current.cloudSupportsAudio, true)

  const retry = createSettingsHydrationAttempt()
  const retryWrite = runAfterSettingsHydrated(retry, async () => {
    writes += 1
    current = { ...current, evaluationMode: 'local-first-cloud-fallback' }
  })
  retry.complete(true)
  await retryWrite
  assert.equal(writes, 1)
  assert.equal(current.cloudBaseUrl, 'https://saved.example/v1')
  assert.equal(current.cloudModel, 'saved-model')
  assert.equal(current.cloudSupportsAudio, true)
})

test('an exam saved before exit remains the fallback when the follow-up recovery read rejects', async () => {
  const { getSavedExamRunAfterExit } = require('../src/features/exam/exam-exit.ts')
  const savedRun = { id: 'qa-run', status: 'in-progress', lastSavedAt: '2026-10-13T00:00:00.000Z' }
  const result = await getSavedExamRunAfterExit(savedRun, async () => { throw new Error('synthetic read failure') })
  assert.deepEqual(result, { run: savedRun, recoveryReadFailed: true })
})

test('blank MIME reaches the audio decoder while explicitly non-audio MIME is rejected', () => {
  const { hasUnsupportedDeclaredAudioMime, inferImportedAudioMime } = require('../src/features/interpreting/audio-import.ts')
  assert.equal(hasUnsupportedDeclaredAudioMime(''), false)
  assert.equal(hasUnsupportedDeclaredAudioMime(' audio/wav '), false)
  assert.equal(hasUnsupportedDeclaredAudioMime('text/plain'), true)
  assert.equal(inferImportedAudioMime('', 'valid-source.WAV'), 'audio/wav')
  assert.equal(inferImportedAudioMime('', 'valid-source.unknown'), '')
})

test('data deletion drains in-flight writers, advances the epoch, and rejects queued stale-tab writes', async () => {
  const { createDataWriteCoordinator, DATA_EPOCH_STORAGE_KEY } = require('../src/storage/data-write-coordinator.ts')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  let lockQueue = Promise.resolve()
  const locks = {
    request(_name, _options, callback) {
      const operation = lockQueue.then(callback)
      lockQueue = operation.then(() => undefined, () => undefined)
      return operation
    },
  }
  const createCoordinator = (onCleared) => createDataWriteCoordinator({
    getLockManager: () => locks,
    getStorage: () => storage,
    onCleared,
    createEpoch: () => 'qa-epoch-next',
  })
  const writerTab = createCoordinator()
  const deletingTab = createCoordinator()
  await writerTab.runWrite(async () => undefined)
  await deletingTab.runWrite(async () => undefined)

  let unblockWriter
  let writerStarted
  const started = new Promise((resolve) => { writerStarted = resolve })
  const writerGate = new Promise((resolve) => { unblockWriter = resolve })
  const order = []
  const inFlightWrite = writerTab.runWrite(async () => {
    writerStarted()
    await writerGate
    order.push('in-flight write finished')
  })
  await started
  const clear = deletingTab.clearData(async () => {
    order.push('clear began')
    assert.match(storage.getItem(DATA_EPOCH_STORAGE_KEY), /^pending:/)
  })
  const staleWrite = writerTab.runWrite(async () => { order.push('stale write ran') })
  await Promise.resolve()
  assert.deepEqual(order, [])
  unblockWriter()
  await inFlightWrite
  await clear
  await assert.rejects(staleWrite, /another tab|deleted|invalidated/i)
  assert.deepEqual(order, ['in-flight write finished', 'clear began'])
  assert.equal(storage.getItem(DATA_EPOCH_STORAGE_KEY), 'active:qa-epoch-next')
})

test('a failed IndexedDB clear restores the prior epoch and leaves retained-tab writers valid', async () => {
  const { createDataWriteCoordinator, DATA_EPOCH_STORAGE_KEY } = require('../src/storage/data-write-coordinator.ts')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const locks = { request(_name, _options, callback) { return Promise.resolve().then(callback) } }
  const firstTab = createDataWriteCoordinator({
    getLockManager: () => locks,
    getStorage: () => storage,
    createEpoch: () => 'qa-epoch-failed',
  })
  const secondTab = createDataWriteCoordinator({
    getLockManager: () => locks,
    getStorage: () => storage,
  })
  await firstTab.runWrite(async () => undefined)
  await secondTab.runWrite(async () => undefined)
  const previousEpoch = storage.getItem(DATA_EPOCH_STORAGE_KEY)

  await assert.rejects(firstTab.clearData(async () => { throw new Error('synthetic IndexedDB transaction abort') }), /transaction abort/)
  assert.equal(storage.getItem(DATA_EPOCH_STORAGE_KEY), previousEpoch)
  await secondTab.runWrite(async () => undefined)
})

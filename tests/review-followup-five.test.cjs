const assert = require('node:assert/strict')
const test = require('node:test')

test('replacing imported source audio starts without the previous source transcript', () => {
  const { createImportedAudioExercise, importedTranscriptReducer } = require('../src/features/interpreting/audio-import.ts')
  const previousTranscript = 'Transcript authored for the previous recording.'
  const transcriptAfterReplacement = importedTranscriptReducer(previousTranscript, { type: 'replace-audio' })
  assert.equal(transcriptAfterReplacement, '')
  const exercise = createImportedAudioExercise({
    id: 'replacement-audio',
    sourceLanguage: 'zh',
    targetLanguage: 'en',
    title: 'new-recording',
    difficulty: 'intermediate',
    audioUrl: 'blob:qa-new-recording',
    audioMimeType: 'audio/wav',
    durationMs: 3200,
  })

  assert.equal(exercise.sourceTranscriptStatus, 'missing')
  assert.equal(exercise.segments[0].transcript, '')
  assert.notEqual(exercise.segments[0].transcript, previousTranscript)
})

test('per-run discard tombstone blocks only that exam run and rolls back a failed delete', async () => {
  const { assertExamRunNotDiscarded, discardExamRunWithTombstone } = require('../src/storage/exam-run-lifecycle.ts')
  const values = new Map([['lingo-practice-exam-run-recovery-v1:run-a', '{"id":"run-a"}']])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  await assert.rejects(discardExamRunWithTombstone(storage, 'run-a', async () => {
    throw new Error('synthetic IndexedDB delete failure')
  }), /delete failure/)
  assert.equal(storage.getItem('lingo-practice-exam-run-recovery-v1:run-a'), '{"id":"run-a"}')
  await assert.doesNotReject(assertExamRunNotDiscarded(storage, 'run-a'))

  await discardExamRunWithTombstone(storage, 'run-a', async () => undefined)
  await assert.rejects(assertExamRunNotDiscarded(storage, 'run-a'), /discarded/i)
  await assert.doesNotReject(assertExamRunNotDiscarded(storage, 'run-b'))
  assert.equal(storage.getItem('lingo-practice-exam-run-recovery-v1:run-a'), null)
})

test('exclusive run deletion waits for in-flight tab writers before tombstoning', async () => {
  const { createDataWriteCoordinator } = require('../src/storage/data-write-coordinator.ts')
  const { assertExamRunNotDiscarded, discardExamRunWithTombstone } = require('../src/storage/exam-run-lifecycle.ts')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  let lockQueue = Promise.resolve()
  const lockModes = []
  const locks = {
    request(_name, options, callback) {
      lockModes.push(options.mode)
      const operation = lockQueue.then(callback)
      lockQueue = operation.then(() => undefined, () => undefined)
      return operation
    },
  }
  const writer = createDataWriteCoordinator({ getLockManager: () => locks, getStorage: () => storage })
  const deleting = createDataWriteCoordinator({ getLockManager: () => locks, getStorage: () => storage })
  let release
  let started
  const gate = new Promise((resolve) => { release = resolve })
  const inFlight = new Promise((resolve) => { started = resolve })
  const events = []
  const write = writer.runWrite(async () => { started(); await gate; events.push('write-finished') })
  await inFlight
  const discard = deleting.runExclusive(async () => {
    events.push('discard')
    await discardExamRunWithTombstone(storage, 'run-a', async () => undefined)
  })
  const staleWrite = writer.runWrite(async () => {
    await assertExamRunNotDiscarded(storage, 'run-a')
    events.push('stale-write')
  })
  const unrelatedWrite = writer.runWrite(async () => {
    await assertExamRunNotDiscarded(storage, 'run-b')
    events.push('unrelated-write')
  })
  await Promise.resolve()
  assert.deepEqual(events, [])
  release()
  await write
  await discard
  await assert.rejects(staleWrite, /discarded/i)
  await unrelatedWrite
  assert.deepEqual(events, ['write-finished', 'discard', 'unrelated-write'])
  assert.deepEqual(lockModes, ['shared', 'exclusive', 'shared', 'shared'])
})

test('run discard fails closed when cross-tab locking is unavailable', async () => {
  const { createDataWriteCoordinator } = require('../src/storage/data-write-coordinator.ts')
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  const coordinator = createDataWriteCoordinator({ getLockManager: () => undefined, getStorage: () => storage })
  await assert.rejects(coordinator.runExclusive(async () => undefined), /cross-tab deletion is unavailable/i)
})

test('failed clear rebases pending interpreting saves without losing their prepared data', () => {
  const { rebasePendingInterpretingSaves } = require('../src/features/interpreting/pending-persistence.ts')
  const session = { id: 'session-a', feedback: { summary: 'saved evidence' } }
  const recordings = [{ id: 'take-a', byteLength: 12 }]
  const input = { exercise: { id: 'exercise-a' }, recordings }
  const pending = [{ id: 'pending-a', generation: 4, session, recordings, input }]
  const rebased = rebasePendingInterpretingSaves(pending, 5)
  assert.equal(rebased[0].generation, 5)
  assert.equal(rebased[0].session, session)
  assert.equal(rebased[0].recordings, recordings)
  assert.equal(rebased[0].input, input)
  assert.deepEqual(pending[0], { id: 'pending-a', generation: 4, session, recordings, input })
})

test('feedback identifies consented attached cloud audio instead of labeling it local heuristic analysis', () => {
  const { validateInterpretingFeedback } = require('../src/domain/scoring.ts')
  const { InterpretingFeedbackPanel } = require('../src/features/interpreting/InterpretingFeedbackPanel.tsx')
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const recording = {
    id: 'cloud-take', exerciseId: 'cloud-exercise', segmentIds: ['source-1'],
    createdAt: '2026-10-13T00:00:00.000Z', mimeType: 'audio/wav', durationMs: 1000,
    byteLength: 4, blob: new Blob(['synthetic']), kind: 'response',
  }
  const exercise = {
    id: 'cloud-exercise', mode: 'interpreting', sourceLanguage: 'zh', targetLanguage: 'en',
    title: 'Synthetic', topic: 'fixture', difficulty: 'beginner', audioUrl: '/fixture.wav',
    audioMimeType: 'audio/wav', durationMs: 1000,
    segments: [{ id: 'source-1', startMs: 0, endMs: 1000, transcript: 'Source words.' }],
    glossary: [], tags: [], rightsRecordId: 'fixture', sourceTranscriptStatus: 'authored',
  }
  const input = {
    exercise, interpretingMode: 'consecutive',
    responseSegments: [{ id: 'response-1', sourceSegmentId: 'source-1', recordingId: recording.id,
      responseStartMs: 0, responseEndMs: 900, transcript: 'Response words.', transcriptSource: 'manual', recognitionStatus: 'verified' }],
    recordings: [recording], deliveryAnalysis: [],
  }
  const raw = {
    summary: 'Synthetic only.', contentScores: { meaningTransfer: 80, omissions: 80, additionsMistranslations: 80, terminology: 80 },
    deliveryScores: { fluency: 70, pacing: 70, hesitation: 70 }, strengths: [], issues: [], uncertainEvidence: [], alternatives: [], uncertainty: 'Synthetic fixture.',
  }
  const feedback = validateInterpretingFeedback(raw, input, {
    providerUrl: 'https://synthetic.invalid/v1', model: 'fixture', taskConsentGranted: true, attachedRecordingIds: [recording.id],
  })
  assert.equal(feedback.deliveryEvidenceSource, 'consented-cloud-audio')
  const markup = renderToStaticMarkup(React.createElement(InterpretingFeedbackPanel, {
    exercise, input, feedback, pendingSave: false, isSaving: false,
    onRetrySave() {}, onRevise() {}, onChangeSetup() {},
  }))
  assert.match(markup, /cloud evaluator analyzed learner audio attached after one-time consent/i)
  assert.doesNotMatch(markup, /Local analysis heuristics/)
})

test('inactivity deadline rejects and invokes cleanup after progress goes quiet', async () => {
  const { createInactivityDeadline } = require('../src/ai/inactivity-timeout.ts')
  let cleaned = 0
  const startedAt = Date.now()
  const deadline = createInactivityDeadline(20, () => { cleaned += 1 }, 'synthetic inactivity')
  setTimeout(() => deadline.reset(), 12)
  await assert.rejects(deadline.wrap(new Promise(() => undefined)), /synthetic inactivity/)
  assert.ok(Date.now() - startedAt >= 28, 'activity should extend the inactivity deadline')
  assert.equal(cleaned, 1)
})

const assert = require('node:assert/strict')
const test = require('node:test')

test('deleting an interpreting session invalidates only that session open and blocks reopen until deletion settles', () => {
  const { createInterpretingSessionOpenGuard } = require('../src/features/interpreting/session-open-guard.ts')
  const guard = createInterpretingSessionOpenGuard()
  const openingDeleted = guard.beginOpen('session-deleted')
  const openingOther = guard.beginOpen('session-other')

  guard.beginDelete('session-deleted')
  assert.equal(guard.isCurrent(openingDeleted), false)
  assert.equal(guard.isCurrent(openingOther), true)
  assert.equal(guard.beginOpen('session-deleted'), undefined, 'a stale history click cannot reopen while deletion is pending')

  guard.finishDelete('session-deleted')
  assert.equal(guard.isCurrent(openingDeleted), false, 'finishing deletion does not revive the old request')
  assert.equal(guard.isCurrent(guard.beginOpen('session-deleted')), true, 'a fresh request can open after deletion has settled')
})

test('overlapping deletes keep the interpreting session closed until every delete settles', () => {
  const { createInterpretingSessionOpenGuard } = require('../src/features/interpreting/session-open-guard.ts')
  const guard = createInterpretingSessionOpenGuard()
  guard.beginDelete('session-overlap')
  guard.beginDelete('session-overlap')

  guard.finishDelete('session-overlap')
  assert.equal(guard.beginOpen('session-overlap'), undefined)

  guard.finishDelete('session-overlap')
  assert.equal(guard.beginOpen('session-overlap')?.sessionId, 'session-overlap')
})

test('failed simultaneous source playback stops the recorder and restores the exact prior transcript evidence', async () => {
  const { createTranscriptCaptureState, reduceTranscriptCapture } = require('../src/features/interpreting/transcript-capture-state.ts')
  const { startSimultaneousTake } = require('../src/features/interpreting/simultaneous-take-start.ts')
  const segmentId = 'continuous-segment'
  const prior = createTranscriptCaptureState([{
    sourceSegmentId: segmentId,
    transcript: 'verified words from the prior take',
    transcriptSource: 'on-device',
    recognitionStatus: 'verified',
    recognitionConfidence: 0.93,
  }])
  let state = prior
  let recorderStops = 0
  let wasAdopted = false
  const attempt = { id: 1, takeGeneration: 0, segmentId }

  await assert.rejects(startSimultaneousTake({
    startRecorder: async () => undefined,
    beginTake: () => {
      const previousState = state
      state = reduceTranscriptCapture(state, { type: 'take-started', segmentIds: [segmentId] })
      wasAdopted = true
      return { previousState, takeGeneration: state.takeGeneration }
    },
    playSource: async () => { throw new Error('synthetic source playback failure') },
    stopRecorder: async () => { recorderStops += 1 },
    discardTake: () => undefined,
    rollbackTake: (snapshot) => {
      state = reduceTranscriptCapture(state, {
        type: 'take-start-failed',
        takeGeneration: snapshot.takeGeneration,
        previousState: snapshot.previousState,
      })
    },
  }), /source playback failure/)

  assert.equal(wasAdopted, true)
  assert.equal(recorderStops, 1)
  assert.equal(state.transcripts[segmentId], prior.transcripts[segmentId])
  assert.equal(state.transcriptSources[segmentId], 'on-device')
  assert.equal(state.recognitionStatuses[segmentId], 'verified')
  assert.equal(state.recognitionConfidences[segmentId], 0.93)
  assert.ok(state.takeGeneration > prior.takeGeneration, 'failed-take generation remains advanced so late results cannot match the restored evidence')
  const afterLateRecognition = reduceTranscriptCapture(state, {
    type: 'recognition-succeeded',
    attempt,
    result: { transcript: 'stale recognition from failed take', confidence: 0.99 },
  })
  assert.strictEqual(afterLateRecognition, state, 'late recognition from the failed take cannot overwrite restored evidence')
})

test('discarding during exam editor-lock acquisition releases a late lock without claiming or publishing a runner', async () => {
  const { createExamResumeRequestGuard, claimExamRunForResumeIfCurrent } = require('../src/features/exam/exam-resume-race.ts')
  const guard = createExamResumeRequestGuard()
  const attempt = guard.begin('run-lock-pending')
  let resolveLock
  let didClaim = false
  let releaseCount = 0
  const lockPromise = new Promise((resolve) => { resolveLock = resolve })
  const pendingResume = claimExamRunForResumeIfCurrent({
    acquireLock: () => lockPromise,
    claimRun: async () => { didClaim = true; return { id: attempt.runId } },
    isCurrent: () => guard.isCurrent(attempt),
    releaseLock: (lock) => lock.release(),
  })

  guard.invalidateForDiscard(attempt.runId)
  resolveLock({ release() { releaseCount += 1 } })
  const result = await pendingResume

  assert.deepEqual(result, { status: 'stale' })
  assert.equal(didClaim, false)
  assert.equal(releaseCount, 1)
})

test('discarding during the IDB editor claim releases the acquired lock and rejects the late runner result', async () => {
  const { createExamResumeRequestGuard, claimExamRunForResumeIfCurrent } = require('../src/features/exam/exam-resume-race.ts')
  const guard = createExamResumeRequestGuard()
  const attempt = guard.begin('run-claim-pending')
  let resolveClaim
  let claimStarted
  let releaseCount = 0
  const claimHasStarted = new Promise((resolve) => { claimStarted = resolve })
  const claimPromise = new Promise((resolve) => { resolveClaim = resolve })
  const pendingResume = claimExamRunForResumeIfCurrent({
    acquireLock: async () => ({ release() { releaseCount += 1 } }),
    claimRun: () => { claimStarted(); return claimPromise },
    isCurrent: () => guard.isCurrent(attempt),
    releaseLock: (lock) => lock.release(),
  })

  await claimHasStarted
  guard.invalidateForDiscard(attempt.runId)
  resolveClaim({ id: attempt.runId, status: 'in-progress' })
  const result = await pendingResume

  assert.deepEqual(result, { status: 'stale' })
  assert.equal(releaseCount, 1)
})

test('written cloud consent is usable only for the exact captured exercise and answer', () => {
  const { isWrittenConsentBoundToSubmission } = require('../src/features/practice/written-consent-binding.ts')
  const pending = {
    exercise: { id: 'exercise-captured' },
    answer: 'captured learner answer',
    request: {
      exercise: { id: 'exercise-captured' },
      learnerAnswer: 'captured learner answer',
    },
  }

  assert.equal(isWrittenConsentBoundToSubmission(pending, 'exercise-captured'), true)
  assert.equal(isWrittenConsentBoundToSubmission({ ...pending, request: { ...pending.request, learnerAnswer: 'edited answer' } }, 'exercise-captured'), false)
  assert.equal(isWrittenConsentBoundToSubmission({ ...pending, request: { ...pending.request, exercise: { id: 'other-exercise' } } }, 'exercise-captured'), false)
  assert.equal(isWrittenConsentBoundToSubmission(pending, 'other-exercise'), false)
})

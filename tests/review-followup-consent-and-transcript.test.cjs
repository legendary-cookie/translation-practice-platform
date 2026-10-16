const assert = require('node:assert/strict')
const test = require('node:test')

test('active-take recognition survives recorder finalization; replacement takes clear old and reject late results', async () => {
  const lifecycle = require('../src/features/interpreting/transcript-capture-state.ts')
  const segmentId = 'segment-a'
  let state = lifecycle.createTranscriptCaptureState([{
    sourceSegmentId: segmentId,
    transcript: 'previous take text',
    transcriptSource: 'on-device',
    recognitionStatus: 'verified',
    recognitionConfidence: 0.91,
  }])

  state = lifecycle.reduceTranscriptCapture(state, { type: 'take-started', segmentIds: [segmentId] })
  assert.equal(state.transcripts[segmentId], undefined, 'starting a replacement take clears the prior transcript')
  const attempt = { id: 1, takeGeneration: state.takeGeneration, segmentId }
  state = lifecycle.reduceTranscriptCapture(state, { type: 'recognition-started', attempt })

  let resolveRecognition
  const fakeRecognition = new Promise((resolve) => { resolveRecognition = resolve })
  const fakeRecorder = {
    status: 'recording',
    async stop() {
      this.status = 'idle'
      return { id: 'take-one', durationMs: 800 }
    },
  }
  resolveRecognition({ transcript: 'captured during this take', confidence: 0.88 })
  const result = await fakeRecognition
  assert.equal(fakeRecorder.status, 'recording', 'recognition finishes while the fake recorder is still active')
  state = lifecycle.reduceTranscriptCapture(state, { type: 'recognition-succeeded', attempt, result })
  state = lifecycle.reduceTranscriptCapture(state, { type: 'transcript-confirmed', segmentId })
  await fakeRecorder.stop()
  state = lifecycle.reduceTranscriptCapture(state, { type: 'recording-finalized', takeGeneration: attempt.takeGeneration })
  assert.equal(state.transcripts[segmentId], 'captured during this take', 'stopping the active take preserves its transcript')
  assert.equal(state.transcriptSources[segmentId], 'on-device')
  assert.equal(state.recognitionStatuses[segmentId], 'verified', 'confirmation made during recording survives stop')
  assert.equal(state.recognitionConfidences[segmentId], 0.88)
  const reopened = lifecycle.createTranscriptCaptureState([{
    sourceSegmentId: segmentId,
    transcript: state.transcripts[segmentId],
    transcriptSource: state.transcriptSources[segmentId],
    recognitionStatus: state.recognitionStatuses[segmentId],
    recognitionConfidence: state.recognitionConfidences[segmentId],
  }])
  assert.equal(reopened.transcripts[segmentId], state.transcripts[segmentId])
  assert.equal(reopened.recognitionStatuses[segmentId], 'verified')
  assert.equal(reopened.recognitionConfidences[segmentId], 0.88)

  state = lifecycle.reduceTranscriptCapture(state, { type: 'take-started', segmentIds: [segmentId] })
  const replacementAttempt = { id: 2, takeGeneration: state.takeGeneration, segmentId }
  state = lifecycle.reduceTranscriptCapture(state, { type: 'recognition-started', attempt: replacementAttempt })
  const afterLatePriorResult = lifecycle.reduceTranscriptCapture(state, {
    type: 'recognition-succeeded', attempt, result: { transcript: 'late prior result', confidence: 0.99 },
  })
  assert.strictEqual(afterLatePriorResult, state, 'a late result from a replaced take cannot mutate the new take')

  state = lifecycle.reduceTranscriptCapture(state, { type: 'recognition-failed', attempt: replacementAttempt })
  assert.equal(state.pending?.id, undefined, 'interrupted recognition returns control to the manual path')
  state = lifecycle.reduceTranscriptCapture(state, { type: 'manual-edited', segmentId, transcript: 'manual fallback' })
  assert.equal(state.transcripts[segmentId], 'manual fallback')
  assert.equal(state.transcriptSources[segmentId], 'manual')
  assert.equal(state.recognitionStatuses[segmentId], 'verified')
})

test('exam consent resumes from validated same-input passage feedback and rejects changed answer or rubric reuse', async () => {
  const { createActiveExamRun } = require('../src/domain/exam.ts')
  const { DEFAULT_EXAM_PROFILES } = require('../src/data/exam-profiles.ts')
  const {
    ExamEvaluationBlockedError,
    approveExamPassageFeedback,
    evaluateExamRun,
  } = require('../src/features/exam/exam-evaluator.ts')
  const profile = DEFAULT_EXAM_PROFILES[0]
  const run = createActiveExamRun(profile)
  for (const section of profile.sections) {
    for (const passage of section.passages) {
      run.answers[section.id][passage.id] = `synthetic answer for ${passage.id}`
    }
  }
  const passages = profile.sections.flatMap((section) => section.passages.map((passage) => ({ section, passage })))
  const first = passages[0]
  const consented = passages[1]
  let calls = 0
  const localThenConsentRouter = {
    async evaluate(input) {
      calls += 1
      if (calls === 2) {
        return { status: 'needs-consent', reason: 'Synthetic consent boundary.', request: { exercise: input.exercise, confirm: async () => ({}) } }
      }
      return { status: 'evaluated', provider: 'local', feedback: feedback(70) }
    },
  }

  let blocked
  try {
    await evaluateExamRun(run, profile, localThenConsentRouter)
  } catch (error) {
    blocked = error
  }
  assert.ok(blocked instanceof ExamEvaluationBlockedError)
  assert.equal(blocked.passageId, consented.passage.id)
  const checkpoint = blocked.approvedFeedback
  assert.equal(checkpoint.runId, run.id)
  assert.equal(checkpoint.profileId, profile.id)
  assert.equal(checkpoint.profileVersion, profile.version)
  assert.equal(checkpoint.rubricVersion, profile.rubricVersion)
  assert.deepEqual(Object.keys(checkpoint.passages), [first.passage.id])
  assert.equal(checkpoint.passages[first.passage.id].answer, run.answers[first.section.id][first.passage.id])

  const acceptedCloudFeedback = approveExamPassageFeedback(
    checkpoint, run, profile, consented.passage.id, feedback(72),
  )
  assert.throws(() => approveExamPassageFeedback(
    checkpoint,
    run,
    profile,
    consented.passage.id,
    { ...feedback(72), dimensions: { ...feedback(72).dimensions, accuracy: 500 } },
  ), 'consented feedback still passes through the normal evaluator validator')
  const resumedCalls = []
  const result = await evaluateExamRun(run, profile, {
    async evaluate(input) {
      resumedCalls.push(input)
      return { status: 'evaluated', provider: 'local', feedback: feedback(70) }
    },
  }, undefined, acceptedCloudFeedback)
  assert.equal(resumedCalls.length, passages.length - 2, 'the two validated passages are not regenerated after consent')
  assert.ok(resumedCalls.every((input) => input.exercise.id !== first.passage.id && input.exercise.id !== consented.passage.id))
  assert.ok(result.sectionResults.length > 0)

  const changedRun = structuredClone(run)
  changedRun.answers[first.section.id][first.passage.id] = 'a different answer must not reuse the earlier score'
  const changedCalls = []
  await evaluateExamRun(changedRun, profile, {
    async evaluate(input) {
      changedCalls.push(input)
      return { status: 'evaluated', provider: 'local', feedback: feedback(70) }
    },
  }, undefined, acceptedCloudFeedback)
  assert.ok(changedCalls.some((input) => input.exercise.id === first.passage.id && input.learnerAnswer === changedRun.answers[first.section.id][first.passage.id]))

  const changedRubricCalls = []
  await evaluateExamRun(run, { ...profile, rubricVersion: `${profile.rubricVersion}-next` }, {
    async evaluate(input) {
      changedRubricCalls.push(input)
      return { status: 'evaluated', provider: 'local', feedback: feedback(70) }
    },
  }, undefined, acceptedCloudFeedback)
  assert.equal(changedRubricCalls.length, passages.length, 'a different rubric cannot reuse checkpoint feedback')
})

function feedback(score) {
  return {
    summary: 'Synthetic validated feedback.',
    overallScore: score,
    dimensions: { accuracy: score, terminology: score, grammar: score, fluency: score, taskStyle: score },
    strengths: [],
    issues: [],
    alternatives: [],
    uncertainty: 'Synthetic test feedback only.',
  }
}

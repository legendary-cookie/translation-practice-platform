const assert = require('node:assert/strict')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const writtenGuardModule = require('../src/features/practice/written-evaluation-guard.ts')
const responseRangeModule = require('../src/features/interpreting/response-range.ts')
const { buildEvaluationPrompt } = require('../src/ai/evaluation-prompt.ts')
const { hasCompleteInterpretingDeliveryEvidence } = require('../src/domain/scoring.ts')
const { createAudioPlayer } = require('../src/audio/audio-player.ts')
const { analyzeRecording } = require('../src/audio/audio-analysis.ts')
const { InterpretingWorkspace } = require('../src/features/interpreting/InterpretingWorkspace.tsx')

function createExercise() {
  return {
    id: 'qa-exercise',
    mode: 'interpreting',
    sourceLanguage: 'zh',
    targetLanguage: 'en',
    title: 'Synthetic evidence fixture',
    topic: 'practice',
    difficulty: 'beginner',
    audioUrl: '/synthetic.wav',
    audioMimeType: 'audio/wav',
    durationMs: 2000,
    segments: [
      { id: 'segment-a', startMs: 0, endMs: 1000, transcript: 'Source segment A.' },
      { id: 'segment-b', startMs: 1000, endMs: 2000, transcript: 'Source segment B.' },
    ],
    glossary: [],
    tags: ['general'],
    rightsRecordId: 'qa-synthetic',
  }
}

function createRecording(id = 'recording-a', durationMs = 2000) {
  return {
    id,
    exerciseId: 'qa-exercise',
    segmentIds: ['segment-a', 'segment-b'],
    createdAt: '2026-10-13T00:00:00.000Z',
    mimeType: 'audio/webm;codecs=opus',
    durationMs,
    byteLength: 4,
    blob: new Blob(['qa!!'], { type: 'audio/webm;codecs=opus' }),
    kind: 'response',
  }
}

function createInterpretingInput({ analysis, responseStartMs = 100, responseEndMs = 900 } = {}) {
  const exercise = createExercise()
  const recording = createRecording('recording-a', 2000)
  return {
    exercise,
    interpretingMode: 'simultaneous',
    responseSegments: [{
      id: 'response-a',
      sourceSegmentId: 'segment-a',
      recordingId: recording.id,
      responseStartMs,
      responseEndMs,
      transcript: 'Learner response.',
      transcriptSource: 'manual',
      recognitionStatus: 'verified',
    }],
    recordings: [recording],
    deliveryAnalysis: analysis ? [{ ...analysis, recordingId: recording.id }] : [],
  }
}

class FakeAudio {
  constructor() {
    this.paused = true
    this._currentTime = 0
    this.listeners = new Map()
    this.style = {}
    this.tabIndex = 0
  }

  set currentTime(value) {
    this.dispatch('seeking')
    this._currentTime = value
    this.dispatch('seeked')
  }

  get currentTime() {
    return this._currentTime
  }

  setAttribute() {}
  removeAttribute() {}
  load() {}
  remove() {}

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set()
    listeners.add(listener)
    this.listeners.set(name, listeners)
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener)
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) ?? []) listener()
  }

  play() {
    this.paused = false
    this.dispatch('play')
    return Promise.resolve()
  }

  pause() {
    if (!this.paused) {
      this.paused = true
      this.dispatch('pause')
    }
  }

  advanceTo(seconds) {
    this._currentTime = seconds
    this.dispatch('timeupdate')
  }
}

test('a late written evaluation token cannot remain current after a new exercise or route departure', () => {
  assert.equal(typeof writtenGuardModule?.createWrittenEvaluationGuard, 'function')
  const guard = writtenGuardModule.createWrittenEvaluationGuard()
  const first = guard.begin('exercise-a')
  const second = guard.begin('exercise-b')
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
  guard.invalidate()
  assert.equal(guard.isCurrent(second), false)
})

test('a stale evaluation skips both result attachment and its finally callback', async () => {
  const guard = writtenGuardModule.createWrittenEvaluationGuard()
  const attempt = guard.begin('exercise-a')
  let resolveEvaluation
  const evaluation = new Promise((resolve) => { resolveEvaluation = resolve })
  const callbacks = []
  const completion = writtenGuardModule.runWrittenEvaluationAttempt({
    guard,
    attempt,
    evaluate: () => evaluation,
    onResult: () => callbacks.push('result'),
    onError: () => callbacks.push('error'),
    onFinally: () => callbacks.push('finally'),
  })

  guard.begin('exercise-b')
  resolveEvaluation({ summary: 'stale' })
  await completion
  assert.deepEqual(callbacks, [])
})

test('restoring an unchanged simultaneous take preserves its authored response ranges', () => {
  assert.equal(typeof responseRangeModule?.resolveSimultaneousResponseRange, 'function')
  const resolve = responseRangeModule.resolveSimultaneousResponseRange
  const oldResponse = { recordingId: 'same-take', responseStartMs: 143, responseEndMs: 1079 }
  assert.deepEqual(resolve({
    segment: { startMs: 500, endMs: 1400 },
    recordingId: 'same-take',
    recordingDurationMs: 1800,
    playbackOffsetMs: 0,
    restoredResponse: oldResponse,
  }), { responseStartMs: 143, responseEndMs: 1079 })
  assert.deepEqual(resolve({
    segment: { startMs: 500, endMs: 1400 },
    recordingId: 'replacement-take',
    recordingDurationMs: 1800,
    playbackOffsetMs: 90,
  }), { responseStartMs: 590, responseEndMs: 1490 })
})

test('a learner-confirmed on-device transcript remains confirmed when the workspace is reopened', () => {
  const exercise = createExercise()
  const recording = createRecording('confirmed-take', 1000)
  const input = {
    exercise,
    interpretingMode: 'consecutive',
    responseSegments: [{
      id: 'response-a',
      sourceSegmentId: 'segment-a',
      recordingId: recording.id,
      responseStartMs: 0,
      responseEndMs: 1000,
      transcript: 'Confirmed learner words.',
      transcriptSource: 'on-device',
      recognitionStatus: 'verified',
      recognitionConfidence: 0.41,
    }],
    recordings: [recording],
    deliveryAnalysis: [],
  }
  const markup = renderToStaticMarkup(React.createElement(InterpretingWorkspace, {
    exercise,
    initialInput: input,
    interpretingMode: 'consecutive',
    isSubmitting: false,
    onCancel() {},
    onSubmit() {},
    onSaveSelfReview() {},
  }))
  assert.match(markup, /You confirmed this on-device transcript/)
  assert.doesNotMatch(markup, />Confirm transcript</)
})

test('both evaluator prompts define every score as higher-is-better, including omissions and hesitation', () => {
  const interpreting = buildEvaluationPrompt(createInterpretingInput())
  const written = buildEvaluationPrompt({
    exercise: {
      id: 'written-a', mode: 'written', sourceLanguage: 'zh', targetLanguage: 'en',
      title: 'Written fixture', topic: 'practice', difficulty: 'beginner', sourceText: 'source', glossary: [], tags: ['general'],
    },
    learnerAnswer: 'answer',
    mode: 'written',
  })
  assert.match(written, /higher-is-better/i)
  assert.match(interpreting, /higher-is-better/i)
  assert.match(interpreting, /Meaning transfer, terminology, fluency, and pacing are also strongest at 100/)
  assert.match(interpreting, /omissions.{0,80}100.{0,100}no consequential omissions/i)
  assert.match(interpreting, /additionsMistranslations=100 means no consequential unsupported additions or mistranslations/i)
  assert.match(interpreting, /hesitation=100 means no consequential delivery disruption from hesitation/i)
})

test('seeking to a segment end does not count as listening, but playing through it does', async () => {
  const originalAudio = global.Audio
  const originalDocument = global.document
  global.Audio = FakeAudio
  global.document = { body: { appendChild() {} } }
  try {
    const exercise = createExercise()
    const player = createAudioPlayer(exercise)
    await player.playSegment('segment-a')
    const audio = player.getElement()
    audio.pause()
    player.seek(1)
    assert.equal(player.hasPlayedSegmentToEnd?.('segment-a') ?? false, false)
    player.dispose()

    const secondPlayer = createAudioPlayer(exercise)
    await secondPlayer.playSegment('segment-a')
    const secondAudio = secondPlayer.getElement()
    secondAudio.advanceTo(0.25)
    secondAudio.advanceTo(0.6)
    secondAudio.advanceTo(1.02)
    assert.equal(secondPlayer.hasPlayedSegmentToEnd?.('segment-a') ?? false, true)
    secondPlayer.dispose()
  } finally {
    global.Audio = originalAudio
    global.document = originalDocument
  }
})

test('high-amplitude tone and click do not qualify as delivery-analysis evidence', async () => {
  const originalWindow = global.window
  const signals = [
    Float32Array.from({ length: 1000 }, (_, index) => Math.sin(index * 0.2) * 0.9),
    Float32Array.from({ length: 1000 }, (_, index) => index === 500 ? 1 : 0),
  ]
  let nextSignal = 0
  class SyntheticAudioContext {
    async decodeAudioData() {
      const channel = signals[nextSignal++]
      return { duration: channel.length / 1000, sampleRate: 1000, getChannelData: () => channel }
    }
    async close() {}
  }
  global.window = { AudioContext: SyntheticAudioContext }
  try {
    for (let index = 0; index < signals.length; index += 1) {
      const analysis = await analyzeRecording(new Blob(['synthetic-audio']))
      assert.ok(analysis.analysisConfidence < 0.5)
      assert.equal(analysis.signalQuality, undefined)
      const input = createInterpretingInput({ analysis })
      assert.equal(hasCompleteInterpretingDeliveryEvidence(input), false)
      const prompt = buildEvaluationPrompt(input)
      assert.doesNotMatch(prompt, /"deliveryScores"/)
      assert.doesNotMatch(prompt, /activeSpeechRatio/)
      assert.match(prompt, /not evidence of speech presence, signal quality, or delivery quality/)
    }

    const legacyAmplitudeInput = createInterpretingInput({
      analysis: {
        durationMs: 2000,
        activeSpeechRatio: 1,
        pauseCount: 0,
        longestPauseMs: 0,
        signalQuality: 1,
        analysisConfidence: 0.75,
        method: 'local-web-audio-energy-v1',
      },
    })
    assert.equal(hasCompleteInterpretingDeliveryEvidence(legacyAmplitudeInput), false)
  } finally {
    global.window = originalWindow
  }
})

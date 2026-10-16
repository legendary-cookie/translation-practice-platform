const assert = require('node:assert/strict')
const test = require('node:test')

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, value })
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous)
    else delete globalThis[name]
  }
}

function bounded(promise, timeoutMs = 250) {
  let timeoutId
  return Promise.race([
    promise,
    new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error(`operation exceeded ${timeoutMs}ms`)), timeoutMs) }),
  ]).finally(() => clearTimeout(timeoutId))
}

function fakeStream() {
  const track = {
    readyState: 'live',
    stop() { this.readyState = 'ended' },
    addEventListener() {},
  }
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } }
}

test('a hanging microphone permission request times out, retries, and releases its late stream', async () => {
  let resolveFirst
  let resolveDisposed
  const late = fakeStream()
  const retry = fakeStream()
  const disposedLate = fakeStream()
  let requests = 0
  const restoreWindow = replaceGlobal('window', { isSecureContext: true, location: { hostname: 'localhost' } })
  const restoreNavigator = replaceGlobal('navigator', {
    mediaDevices: {
      getUserMedia() {
        requests += 1
        if (requests === 1) return new Promise((resolve) => { resolveFirst = resolve })
        if (requests === 3) return new Promise((resolve) => { resolveDisposed = resolve })
        return Promise.resolve(retry.stream)
      },
    },
  })
  const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
  const recorder = createResponseRecorder('synthetic-exercise', { permissionTimeoutMs: 20 })
  let disposedRecorder

  try {
    await assert.rejects(bounded(recorder.requestPermission()), /timed out|did not respond/i)
    await bounded(recorder.requestPermission())
    assert.equal(requests, 2, 'permission can be retried after the bounded failure')
    assert.equal(recorder.getActiveTrack(), retry.track)

    resolveFirst(late.stream)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(late.track.readyState, 'ended', 'a stream arriving after timeout is immediately released')
    assert.equal(recorder.getActiveTrack(), retry.track, 'a late stream cannot replace the retried stream')
    recorder.dispose()
    assert.equal(retry.track.readyState, 'ended', 'dispose releases the successful retry stream')

    disposedRecorder = createResponseRecorder('synthetic-exercise', { permissionTimeoutMs: 1000 })
    const pendingPermission = disposedRecorder.requestPermission()
    await new Promise((resolve) => setImmediate(resolve))
    disposedRecorder.dispose()
    await assert.rejects(bounded(pendingPermission), /closed/i, 'dispose cancels a pending permission wait immediately')
    resolveDisposed(disposedLate.stream)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(disposedLate.track.readyState, 'ended', 'a stream arriving after disposal is released')
  } finally {
    recorder.dispose()
    disposedRecorder?.dispose()
    restoreNavigator()
    restoreWindow()
  }
})

test('a hung WebGPU requestAdapter becomes an unavailable result within the capability deadline', async () => {
  const { withCapabilityDeadline } = require('../src/ai/capability-deadline.ts')
  const hungRequestAdapter = new Promise(() => {})
  const webGpu = await bounded(withCapabilityDeadline(hungRequestAdapter, 20, () => ({
    status: 'unavailable',
    adapterAvailable: false,
    features: [],
    reason: 'WebGPU adapter detection timed out. Retry the device capability check.',
  })))

  assert.equal(webGpu.status, 'unavailable')
  assert.match(webGpu.reason, /timed out.*retry/i)
})

test('local evaluation cancellation invalidates its token before a new operation can begin', async () => {
  const { createLocalEvaluationLifecycle, LocalEvaluationCancelledError, raceWithAbort } = require('../src/ai/local-evaluation-lifecycle.ts')
  const lifecycle = createLocalEvaluationLifecycle()
  let cancelled = 0
  const first = lifecycle.begin(() => { cancelled += 1 })

  assert.ok(first)
  assert.equal(lifecycle.begin(), undefined, 'a second local generation cannot overlap the active worker operation')
  assert.equal(first.isCurrent(), true)
  const pendingGeneration = raceWithAbort(new Promise(() => {}), first.signal)
  assert.equal(lifecycle.cancelActive(), true)
  assert.equal(cancelled, 1)
  assert.equal(first.isCurrent(), false)
  assert.throws(() => first.throwIfCancelled(), LocalEvaluationCancelledError)
  await assert.rejects(pendingGeneration, LocalEvaluationCancelledError)

  const replacement = lifecycle.begin()
  assert.ok(replacement)
  assert.equal(first.isCurrent(), false, 'a stale operation remains fenced after a replacement begins')
  assert.equal(replacement.isCurrent(), true)
  first.finish()
  assert.equal(replacement.isCurrent(), true, 'finishing a stale token cannot clear its replacement')
  replacement.finish()
  assert.equal(lifecycle.begin()?.isCurrent(), true)
})

test('an old engine timeout cannot invalidate a newer worker generation', () => {
  const { isLocalEngineGenerationCurrent } = require('../src/ai/local-evaluation-lifecycle.ts')
  const oldWorker = {}
  const newWorker = {}

  assert.equal(isLocalEngineGenerationCurrent(
    { generation: 4, worker: oldWorker },
    { generation: 5, worker: newWorker },
  ), false)
  assert.equal(isLocalEngineGenerationCurrent(
    { generation: 4, worker: oldWorker },
    { generation: 4, worker: oldWorker },
  ), true)
  assert.equal(isLocalEngineGenerationCurrent(
    { generation: 4, worker: oldWorker },
    { generation: 4, worker: newWorker },
  ), false)
})

test('a stalled audio decode is bounded, closes its context, and keeps fallback analysis below scoring confidence', async () => {
  let closeCalls = 0
  const fakeContext = {
    decodeAudioData: () => new Promise(() => {}),
    close() { closeCalls += 1; return Promise.resolve() },
  }
  const restoreWindow = replaceGlobal('window', { AudioContext: function AudioContext() { return fakeContext } })
  const { analyzeRecording, createFallbackAnalysis } = require('../src/audio/audio-analysis.ts')

  try {
    await assert.rejects(
      bounded(analyzeRecording(new Blob(['synthetic audio']), { timeoutMs: 20, createContext: () => fakeContext }), 250),
      /timed out|unavailable/i,
    )
    assert.equal(closeCalls, 1, 'timeout closes the decoder context without waiting on the hung decode')
    const fallback = createFallbackAnalysis(1234)
    assert.equal(fallback.durationMs, 1234)
    assert.ok(fallback.analysisConfidence < 0.5, 'unavailable audio analysis cannot satisfy the scoring confidence gate')
  } finally {
    restoreWindow()
  }
})

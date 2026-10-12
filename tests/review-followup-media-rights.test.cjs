const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const workspace = path.resolve(__dirname, '..')

test('failed recovery-journal removal aborts deletion and restores every saved run snapshot', async () => {
  const { clearExamRunRecoverySnapshotsStrict } = require('../src/storage/database.ts')
  const { createDataWriteCoordinator, DATA_EPOCH_STORAGE_KEY } = require('../src/storage/data-write-coordinator.ts')
  const values = new Map([
    ['lingo-practice-exam-run-recovery-v1:run-a', '{"id":"run-a"}'],
    ['lingo-practice-exam-run-recovery-v1:run-b', '{"id":"run-b"}'],
  ])
  const entries = Array.from(values.entries())
  let removeAttempts = 0
  let idbClearStarted = false
  const storage = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) {
      removeAttempts += 1
      if (removeAttempts === 2) throw new Error('synthetic journal removal failure')
      values.delete(key)
    },
  }
  const locks = { request(_name, _options, callback) { return Promise.resolve().then(callback) } }
  const coordinator = createDataWriteCoordinator({
    getLockManager: () => locks,
    getStorage: () => storage,
    createEpoch: () => 'qa-clear-removal-failure',
  })

  await assert.rejects(coordinator.clearData(async () => {
    clearExamRunRecoverySnapshotsStrict(storage, entries)
    idbClearStarted = true
  }), /synthetic journal removal failure/)
  assert.equal(idbClearStarted, false)
  assert.deepEqual(Array.from(values.entries()).filter(([key]) => key.startsWith('lingo-practice-exam-run-recovery-v1:')).sort(), entries.sort())
  assert.equal(storage.getItem(DATA_EPOCH_STORAGE_KEY), 'active:initial')
})

function withFakeRecorderEnvironment(run) {
  const saved = new Map()
  for (const key of ['window', 'navigator', 'MediaRecorder']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  }

  const trackListeners = new Set()
  const track = {
    readyState: 'live',
    addEventListener(type, listener) {
      if (type === 'ended') trackListeners.add(listener)
    },
    stop() {
      if (this.readyState === 'ended') return
      this.readyState = 'ended'
      for (const listener of trackListeners) listener({ type: 'ended' })
    },
  }
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }
  const recorderInstances = []

  class FakeMediaRecorder {
    static isTypeSupported() { return true }

    constructor(activeStream, options = {}) {
      this.stream = activeStream
      this.mimeType = options.mimeType ?? 'audio/webm'
      this.state = 'inactive'
      this.listeners = new Map()
      this.stream.getAudioTracks()[0].addEventListener('ended', () => this.stop())
      recorderInstances.push(this)
    }

    addEventListener(type, listener, options = {}) {
      const listeners = this.listeners.get(type) ?? []
      listeners.push({ listener, once: options.once === true })
      this.listeners.set(type, listeners)
    }

    dispatch(type, event) {
      const current = this.listeners.get(type) ?? []
      this.listeners.set(type, current.filter((entry) => !entry.once))
      for (const entry of current) entry.listener(event)
    }

    start() { this.state = 'recording' }

    stop() {
      if (this.state === 'inactive') return
      this.state = 'inactive'
      queueMicrotask(() => {
        this.dispatch('dataavailable', { data: new Blob(['synthetic take'], { type: this.mimeType }) })
        this.dispatch('stop', {})
      })
    }
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true, location: { hostname: 'localhost' } },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } },
  })
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: FakeMediaRecorder,
  })

  return Promise.resolve()
    .then(() => run({ track, recorderInstances }))
    .finally(() => {
      for (const key of ['window', 'navigator', 'MediaRecorder']) {
        const descriptor = saved.get(key)
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    })
}

test('track-ended MediaRecorder finalizes one usable take and explicit stop reports the same take once', async () => {
  await withFakeRecorderEnvironment(async ({ track, recorderInstances }) => {
    const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
    const recorder = createResponseRecorder('synthetic-exercise')
    const completions = []
    recorder.subscribe((_state, completion) => {
      if (completion) completions.push(completion)
    })
    try {
      await recorder.start('synthetic-segment', 'consecutive')
      track.stop()
      await new Promise((resolve) => setImmediate(resolve))

      assert.equal(recorderInstances.length, 1)
      assert.equal(recorderInstances[0].state, 'inactive')
      assert.equal(completions.length, 1)
      assert.equal(completions[0].reason, 'stream-ended')
      assert.equal(await completions[0].recording.blob.text(), 'synthetic take')
      assert.equal(completions[0].recording.exerciseId, 'synthetic-exercise')
      assert.equal(await recorder.stop(), undefined)
      assert.equal(completions.length, 1)
    } finally {
      recorder.dispose()
    }
  })
})

test('explicit recorder stop resolves with its finalized recording exactly once', async () => {
  await withFakeRecorderEnvironment(async ({ track }) => {
    const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
    const recorder = createResponseRecorder('synthetic-exercise')
    const completions = []
    recorder.subscribe((_state, completion) => {
      if (completion) completions.push(completion)
    })

    try {
      await recorder.start('synthetic-segment', 'consecutive')
      const [recording, repeatedStop] = await Promise.all([recorder.stop(), recorder.stop()])

      assert.ok(recording)
      assert.equal(repeatedStop?.id, recording.id)
      assert.equal(recording.id, completions[0]?.recording.id)
      assert.equal(completions.length, 1)
      assert.equal(completions[0].reason, 'explicit')
      assert.equal(track.readyState, 'ended')
      assert.equal(await recorder.stop(), undefined)
      assert.equal(completions.length, 1)
    } finally {
      recorder.dispose()
    }
  })
})

test('disposing an active recorder releases its track without emitting a partial take', async () => {
  await withFakeRecorderEnvironment(async ({ track }) => {
    const { createResponseRecorder } = require('../src/audio/audio-recorder.ts')
    const recorder = createResponseRecorder('synthetic-exercise')
    const completions = []
    recorder.subscribe((_state, completion) => {
      if (completion) completions.push(completion)
    })

    await recorder.start('synthetic-segment', 'consecutive')
    recorder.dispose()
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(track.readyState, 'ended')
    assert.equal(completions.length, 0)
  })
})

test('packaged interpreting rights match the real manifest paths, metadata, and audio hashes', () => {
  const { INTERPRETING_EXERCISES } = require('../src/data/interpreting-exercises.ts')
  const { validateInterpretingRightsManifest } = require('../src/data/interpreting-rights.ts')
  const rightsPath = path.join(workspace, 'public', 'audio', 'interpreting', 'rights.json')
  const manifest = JSON.parse(fs.readFileSync(rightsPath, 'utf8'))

  assert.deepEqual(validateInterpretingRightsManifest(INTERPRETING_EXERCISES, manifest), [])
  for (const exercise of INTERPRETING_EXERCISES) {
    const record = manifest[exercise.rightsRecordId]
    assert.equal(record.assetPath, exercise.audioUrl)
    assert.equal(record.mimeType, exercise.audioMimeType)
    assert.equal(record.durationMs, exercise.durationMs)
    const assetPath = path.join(workspace, 'public', record.assetPath.slice(1))
    const actualSha256 = crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex')
    assert.equal(actualSha256, record.sha256)
  }
})

test('packaged rights validation rejects absent records and mismatched asset metadata', () => {
  const { INTERPRETING_EXERCISES } = require('../src/data/interpreting-exercises.ts')
  const { validateInterpretingRightsManifest } = require('../src/data/interpreting-rights.ts')
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'public', 'audio', 'interpreting', 'rights.json'), 'utf8'))
  const broken = structuredClone(manifest)
  delete broken['audio.zh.community-garden.v1']
  broken['audio.en.library.v1'].assetPath = '/audio/interpreting/unrelated.wav'
  broken['audio.ru.repair.v1'].durationMs += 1

  const issues = validateInterpretingRightsManifest(INTERPRETING_EXERCISES, broken)
  assert.ok(issues.some((issue) => /rights record .* is missing/i.test(issue)))
  assert.ok(issues.some((issue) => /asset path/i.test(issue)))
  assert.ok(issues.some((issue) => /duration/i.test(issue)))
})

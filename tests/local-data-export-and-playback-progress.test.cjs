const assert = require('node:assert/strict')
const test = require('node:test')

const { database } = require('../src/storage/database.ts')
const { createAudioPlayer } = require('../src/audio/audio-player.ts')

class FakeAudio {
  constructor() {
    this.paused = true
    this._currentTime = 0
    this.listeners = new Map()
    this.style = {}
  }

  set currentTime(seconds) {
    this.dispatch('seeking')
    this._currentTime = seconds
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
    if (this.paused) return
    this.paused = true
    this.dispatch('pause')
  }

  advanceTo(seconds) {
    this._currentTime = seconds
    this.dispatch('timeupdate')
  }

  advanceToWithoutTimeUpdate(seconds) {
    this._currentTime = seconds
  }
}

test('exports recordings sequentially while retaining metadata and bytes', async () => {
  let activeReads = 0
  let maximumActiveReads = 0
  const recordings = [
    { id: 'take-one', bytes: [0, 1, 2, 255], mimeType: 'audio/wav', fileName: 'first.wav' },
    { id: 'take-two', bytes: [42, 43, 44], mimeType: 'audio/webm;codecs=opus', fileName: 'second.webm' },
    { id: 'take-three', bytes: [9, 8, 7, 6, 5], mimeType: '', fileName: 'third.bin' },
  ].map(({ id, bytes, mimeType, fileName }) => {
    const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType })
    const readBytes = blob.arrayBuffer.bind(blob)
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      async value() {
        activeReads += 1
        maximumActiveReads = Math.max(maximumActiveReads, activeReads)
        await new Promise((resolve) => setImmediate(resolve))
        try {
          return await readBytes()
        } finally {
          activeReads -= 1
        }
      },
    })
    return {
      id,
      exerciseId: 'synthetic-exercise',
      segmentIds: ['segment-one'],
      createdAt: '2026-10-13T00:00:00.000Z',
      mimeType,
      durationMs: 1250,
      byteLength: bytes.length,
      blob,
      kind: 'response',
      fileName,
    }
  })

  const replacements = {
    getSettings: async () => ({ evaluationMode: 'local' }),
    listSessions: async () => [],
    listInterpretingSessions: async () => [],
    listAudioRecordings: async () => recordings,
    listExamRuns: async () => [],
    listExamResults: async () => [],
    listExamProfiles: async () => [],
  }
  const originals = Object.fromEntries(Object.keys(replacements).map((name) => [name, database[name]]))
  Object.assign(database, replacements)

  try {
    const exported = await database.exportData()

    assert.equal(maximumActiveReads, 1, 'only one recording Blob is read into memory at a time')
    assert.equal(exported.recordings.length, recordings.length)
    for (const [index, recording] of recordings.entries()) {
      const { dataUrl, ...metadata } = exported.recordings[index]
      const { blob, ...expectedMetadata } = recording
      assert.deepEqual(metadata, expectedMetadata)
      assert.equal(Object.hasOwn(exported.recordings[index], 'blob'), false)
      const mimeType = recording.mimeType || 'application/octet-stream'
      assert.equal(
        dataUrl,
        `data:${mimeType};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`,
      )
    }
  } finally {
    Object.assign(database, originals)
  }
})

test('pause and resume preserve the final played interval when pause precedes timeupdate', async () => {
  const originalAudio = global.Audio
  const originalDocument = global.document
  global.Audio = FakeAudio
  global.document = { body: { appendChild() {} } }
  const player = createAudioPlayer({
    id: 'synthetic-exercise',
    audioUrl: '/synthetic.wav',
    durationMs: 1000,
    segments: [{ id: 'segment-one', startMs: 0, endMs: 1000 }],
  })

  try {
    await player.playSegment('segment-one')
    const audio = player.getElement()
    audio.advanceTo(0.25)
    audio.advanceToWithoutTimeUpdate(0.55)
    audio.pause()
    assert.equal(player.hasPlayedSegmentToEnd('segment-one'), false)

    await player.resume()
    audio.advanceTo(1.01)
    assert.equal(player.hasPlayedSegmentToEnd('segment-one'), true)
  } finally {
    player.dispose()
    global.Audio = originalAudio
    global.document = originalDocument
  }
})

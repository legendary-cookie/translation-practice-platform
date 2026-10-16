const assert = require('node:assert/strict')
const test = require('node:test')

function createRunStore(seed) {
  let runs = new Map(seed.map((run) => [run.id, structuredClone(run)]))
  return {
    transaction: async (operation) => operation({
      async getRun(id) { return runs.get(id) },
      async putRun(run) { runs.set(run.id, structuredClone(run)) },
    }),
    get run() { return [...runs.values()][0] },
  }
}

test('the unchanged editor renews its lease after sleep, but a replaced token cannot', async () => {
  const editor = require('../src/storage/exam-run-editor.ts')
  const now = Date.parse('2026-10-13T00:10:00.000Z')
  const store = createRunStore([{
    id: 'run-slept-owner', status: 'in-progress', revision: 4, editorToken: 'same-tab-owner',
    editorLeaseExpiresAt: new Date(now - 60_000).toISOString(),
  }])

  const renewed = await editor.renewExamRunEditorLease('run-slept-owner', 'same-tab-owner', store.transaction, now)
  assert.ok(Date.parse(renewed.editorLeaseExpiresAt) > now)

  store.run.editorToken = 'new-owner'
  await assert.rejects(
    editor.renewExamRunEditorLease('run-slept-owner', 'same-tab-owner', store.transaction, now + 1),
    (error) => error.name === 'ExamRunEditorLeaseLostError',
  )
})

test('a hung local audio metadata read times out, releases its URL, and leaves a retryable failure', async () => {
  const { loadImportedAudioMetadata } = require('../src/features/interpreting/audio-import-metadata.ts')
  const revoked = []
  const cleanupOrder = []
  const listeners = new Map()
  const media = {
    duration: Number.NaN,
    preload: '',
    src: '',
    loads: 0,
    paused: false,
    addEventListener(name, callback) {
      const callbacks = listeners.get(name) ?? new Set()
      callbacks.add(callback)
      listeners.set(name, callbacks)
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback) },
    removeAttribute(name) { if (name === 'src') { this.src = ''; cleanupOrder.push('remove-src') } },
    pause() { this.paused = true; cleanupOrder.push('pause') },
    load() { this.loads += 1; if (!this.src) cleanupOrder.push('load-cleared-src') },
  }

  await assert.rejects(loadImportedAudioMetadata(new Blob(['synthetic audio']), {
    timeoutMs: 5,
    createAudio: () => media,
    createObjectURL: () => 'blob:synthetic-hanging-audio',
    revokeObjectURL: (url) => { cleanupOrder.push('revoke'); revoked.push(url) },
  }), /timed out/i)
  assert.deepEqual(revoked, ['blob:synthetic-hanging-audio'])
  assert.equal(media.src, '')
  assert.equal(media.paused, true)
  assert.ok(media.loads >= 2, 'media is reset after metadata failure')
  assert.ok(cleanupOrder.indexOf('remove-src') < cleanupOrder.indexOf('revoke'), 'detach the media source before revoking its URL')
})

test('a successful local metadata read transfers URL ownership to the imported source', async () => {
  const { loadImportedAudioMetadata } = require('../src/features/interpreting/audio-import-metadata.ts')
  const listeners = new Map()
  const revoked = []
  const media = {
    duration: 1.2345, preload: '', src: '',
    addEventListener(name, callback) { const callbacks = listeners.get(name) ?? new Set(); callbacks.add(callback); listeners.set(name, callbacks) },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback) },
    removeAttribute(name) { if (name === 'src') this.src = '' },
    pause() {}, load() { if (this.src) queueMicrotask(() => { for (const callback of listeners.get('loadedmetadata') ?? []) callback() }) },
  }
  const result = await loadImportedAudioMetadata(new Blob(['synthetic audio']), {
    timeoutMs: 100,
    createAudio: () => media,
    createObjectURL: () => 'blob:synthetic-valid-audio',
    revokeObjectURL: (url) => revoked.push(url),
  })
  assert.deepEqual(result, { objectUrl: 'blob:synthetic-valid-audio', durationMs: 1235 })
  assert.deepEqual(revoked, [], 'the caller retains a successfully imported source URL')
  assert.equal(media.src, '', 'the temporary metadata element is detached even on success')
})

test('canceling exam draft discard preserves its run and journal; confirmation invokes fenced deletion once', async () => {
  const { confirmAndDiscardExamRun } = require('../src/features/exam/exam-discard-confirmation.ts')
  const runId = 'run-explicit-discard'
  const persisted = new Map([[runId, { id: runId, status: 'in-progress' }]])
  const journal = new Map([[runId, { answer: 'synthetic retained answer' }]])
  const deletionCalls = []
  const fencedDelete = async (id) => {
    deletionCalls.push(id)
    persisted.delete(id)
    journal.delete(id)
  }

  const cancelled = await confirmAndDiscardExamRun(runId, fencedDelete, () => false)
  assert.equal(cancelled, false)
  assert.equal(deletionCalls.length, 0)
  assert.equal(persisted.get(runId).status, 'in-progress')
  assert.equal(journal.get(runId).answer, 'synthetic retained answer')

  const confirmed = await confirmAndDiscardExamRun(runId, fencedDelete, () => true)
  assert.equal(confirmed, true)
  assert.deepEqual(deletionCalls, [runId])
  assert.equal(persisted.has(runId), false)
  assert.equal(journal.has(runId), false)
})

test('consented audio request maps ordered payload parts to recordings and exact response ranges', async () => {
  const { createCloudProvider } = require('../src/ai/cloud-provider.ts')
  const originalFetch = global.fetch
  const exercise = {
    id: 'interpreting-audio-map', mode: 'interpreting', sourceLanguage: 'zh', targetLanguage: 'en',
    title: 'Synthetic mapping fixture', topic: 'test', difficulty: 'intermediate', audioUrl: 'blob:source',
    audioMimeType: 'audio/wav', durationMs: 5000, sourceTranscriptStatus: 'authored',
    segments: [
      { id: 'source-1', startMs: 0, endMs: 1000, transcript: 'Source one.' },
      { id: 'source-2', startMs: 1000, endMs: 2500, transcript: 'Source two.' },
      { id: 'source-3', startMs: 2500, endMs: 5000, transcript: 'Source three.' },
    ],
    glossary: [], tags: [], rightsRecordId: 'synthetic-rights',
  }
  const recording = (id, durationMs) => ({
    id, exerciseId: exercise.id, segmentIds: [], createdAt: '2026-10-13T00:00:00.000Z',
    mimeType: 'audio/wav', durationMs, byteLength: 1, blob: new Blob(['original']), kind: 'response',
  })
  const input = {
    exercise,
    interpretingMode: 'simultaneous',
    // Deliberately differs from source order; shared recording has two disjoint response ranges.
    responseSegments: [
      { id: 'response-2', sourceSegmentId: 'source-2', recordingId: 'take-shared', responseStartMs: 1200, responseEndMs: 2300, transcript: 'Second response.', transcriptSource: 'manual', recognitionStatus: 'verified' },
      { id: 'response-1', sourceSegmentId: 'source-1', recordingId: 'take-first', responseStartMs: 100, responseEndMs: 900, transcript: 'First response.', transcriptSource: 'manual', recognitionStatus: 'verified' },
      { id: 'response-3', sourceSegmentId: 'source-3', recordingId: 'take-shared', responseStartMs: 3100, responseEndMs: 4600, transcript: 'Third response.', transcriptSource: 'manual', recognitionStatus: 'verified' },
    ],
    recordings: [recording('take-shared', 5000), recording('take-first', 2000)],
    deliveryAnalysis: [],
  }
  const prepared = new Map([
    ['take-shared', new Blob(['prepared-shared-wav'], { type: 'audio/wav' })],
    ['take-first', new Blob(['prepared-first-wav'], { type: 'audio/wav' })],
  ])
  let request
  global.fetch = async (_url, init) => {
    request = JSON.parse(init.body)
    const feedback = {
      summary: 'Synthetic consented audio evaluation.',
      contentScores: { meaningTransfer: 80, omissions: 90, additionsMistranslations: 90, terminology: 80 },
      deliveryScores: { fluency: 70, pacing: 75, hesitation: 80 },
      overallScore: 85, strengths: ['Synthetic fixture.'], issues: [], uncertainEvidence: [], alternatives: [],
      uncertainty: 'Loopback mock only.',
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(feedback) } }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const provider = createCloudProvider({
      baseUrl: 'http://127.0.0.1:5222/v1', model: 'synthetic-audio-map', apiKey: 'synthetic-only', supportsAudio: true,
    })
    await assert.rejects(provider.evaluate(input, prepared), /task-specific consent/i)
    assert.equal(request, undefined, 'no fetch occurs before task-specific consent')
    await provider.evaluate(input, prepared, { taskConsentGranted: true })

    const content = request.messages[1].content
    const prompt = content.find((part) => part.type === 'text').text
    const mappingStart = prompt.indexOf('CLOUD AUDIO ATTACHMENT MAP:\n')
    const mappingEnd = prompt.indexOf('\nEND CLOUD AUDIO ATTACHMENT MAP', mappingStart)
    assert.notEqual(mappingStart, -1, 'consented prompt discloses the attachment map')
    assert.notEqual(mappingEnd, -1)
    const mapping = JSON.parse(prompt.slice(mappingStart + 'CLOUD AUDIO ATTACHMENT MAP:\n'.length, mappingEnd))
    assert.deepEqual(mapping, [
      {
        attachmentIndex: 1, recordingId: 'take-shared', responseSegments: [
          { responseSegmentId: 'response-2', sourceSegmentId: 'source-2', responseStartMs: 1200, responseEndMs: 2300 },
          { responseSegmentId: 'response-3', sourceSegmentId: 'source-3', responseStartMs: 3100, responseEndMs: 4600 },
        ],
      },
      {
        attachmentIndex: 2, recordingId: 'take-first', responseSegments: [
          { responseSegmentId: 'response-1', sourceSegmentId: 'source-1', responseStartMs: 100, responseEndMs: 900 },
        ],
      },
    ])
    const { hasConsentedCloudAudioDeliveryEvidence } = require('../src/domain/scoring.ts')
    const evidence = {
      providerUrl: 'http://127.0.0.1:5222/v1/chat/completions',
      model: 'synthetic-audio-map',
      taskConsentGranted: true,
      attachedRecordingIds: ['take-shared', 'take-first'],
      audioAttachments: mapping,
    }
    assert.equal(hasConsentedCloudAudioDeliveryEvidence(input, evidence), true)
    assert.equal(hasConsentedCloudAudioDeliveryEvidence(input, {
      ...evidence,
      audioAttachments: [{ ...mapping[0], responseSegments: [{ ...mapping[0].responseSegments[0], responseStartMs: 0 }] }, mapping[1]],
    }), false, 'scoring evidence must match the exact ranges bound to the attached parts')
    const audioParts = content.filter((part) => part.type === 'input_audio')
    assert.deepEqual(audioParts.map((part) => Buffer.from(part.input_audio.data, 'base64').toString()), [
      'prepared-shared-wav', 'prepared-first-wav',
    ], 'part indices map to the exact prepared bytes in request order')
  } finally {
    global.fetch = originalFetch
  }
})

const assert = require('node:assert/strict')
const test = require('node:test')
const { serializeAudioRecording, readAudioRecording } = require('../src/storage/audio-record-storage.ts')
const fixture = () => ({ id: 'qa-audio', exerciseId: 'qa', segmentIds: ['one'], createdAt: '2026-10-16T00:00:00Z', mimeType: 'audio/webm;codecs=opus', durationMs: 1200, byteLength: 4, blob: new Blob([Uint8Array.from([0, 128, 254, 255])], { type: 'audio/webm;codecs=opus' }) })

test('audio storage persists standalone bytes and reconstructs exact replay/export data', async () => {
  const record = fixture()
  const stored = await serializeAudioRecording(record)
  assert.equal(Object.hasOwn(stored, 'blob'), false)
  assert.ok(stored.audioBytes instanceof ArrayBuffer)
  const reopened = readAudioRecording(structuredClone(stored))
  assert.deepEqual([...new Uint8Array(await reopened.blob.arrayBuffer())], [0, 128, 254, 255])
  assert.equal(reopened.mimeType, record.mimeType)
  assert.equal(Object.hasOwn(reopened, 'audioBytes'), false)
})

test('legacy Blob records remain readable and unreadable or incomplete takes fail before saving', async () => {
  const record = fixture()
  assert.equal(readAudioRecording(record).blob, record.blob)
  await assert.rejects(serializeAudioRecording({ ...record, byteLength: 5 }), /could not be preserved/)
  await assert.rejects(serializeAudioRecording({ ...record, blob: { arrayBuffer: async () => { throw new Error('unreadable') } } }), /unreadable/)
})

import type { AudioRecordingRecord } from '../domain/types'

export type StoredAudioRecording = Omit<AudioRecordingRecord, 'blob'> & { blob?: Blob; audioBytes?: ArrayBuffer }

/** Inline bytes avoid WebView's persisted Blob references to inaccessible backing files. */
export async function serializeAudioRecording(recording: AudioRecordingRecord): Promise<StoredAudioRecording> {
  const audioBytes = await recording.blob.arrayBuffer()
  if (audioBytes.byteLength !== recording.byteLength) throw new Error('Recording bytes could not be preserved. The take has not been saved.')
  const { blob: _blob, ...metadata } = recording
  return { ...metadata, audioBytes }
}

export function readAudioRecording(recording: StoredAudioRecording): AudioRecordingRecord {
  const { audioBytes, ...metadata } = recording
  if (audioBytes instanceof ArrayBuffer) return { ...metadata, blob: new Blob([audioBytes], { type: recording.mimeType }) }
  if (recording.blob instanceof Blob) return { ...metadata, blob: recording.blob }
  throw new Error('Saved recording data is unavailable. Existing records have not been removed.')
}

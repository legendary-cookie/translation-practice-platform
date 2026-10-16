import type { Difficulty, InterpretingExercise, LanguageCode } from '../../domain/types'

const MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
}

export function hasUnsupportedDeclaredAudioMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase()
  return normalized.length > 0 && !normalized.startsWith('audio/')
}

export type ImportedTranscriptAction = { type: 'replace-audio' } | { type: 'edit'; value: string }

export function importedTranscriptReducer(currentTranscript: string, action: ImportedTranscriptAction): string {
  return action.type === 'replace-audio' ? '' : action.value
}

export function inferImportedAudioMime(mimeType: string, fileName: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('audio/')) return normalized
  if (normalized) return normalized
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? ''
}

export function createImportedAudioExercise(input: {
  id: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  title: string
  difficulty: Difficulty
  audioUrl: string
  audioMimeType: string
  durationMs: number
}): InterpretingExercise {
  const segmentId = `${input.id}-segment-1`
  return {
    id: input.id,
    mode: 'interpreting',
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    title: input.title,
    topic: 'Imported local audio',
    difficulty: input.difficulty,
    audioUrl: input.audioUrl,
    audioMimeType: input.audioMimeType,
    durationMs: input.durationMs,
    segments: [{ id: segmentId, startMs: 0, endMs: input.durationMs, transcript: '' }],
    glossary: [],
    tags: ['general'],
    rightsRecordId: `local-import:${input.title}`,
    sourceTranscriptStatus: 'missing',
  }
}

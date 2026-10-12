import type { InterpretingResponseSegment, RecognitionStatus, TranscriptSource } from '../../domain/types'

export type RecognitionAttempt = {
  id: number
  takeGeneration: number
  segmentId: string
}

export type TranscriptCaptureState = {
  takeGeneration: number
  transcripts: Record<string, string>
  transcriptSources: Record<string, TranscriptSource>
  recognitionStatuses: Record<string, RecognitionStatus>
  recognitionConfidences: Record<string, number>
  pending?: RecognitionAttempt
}

export type TranscriptCaptureEvent =
  | { type: 'take-started'; segmentIds: string[] }
  | { type: 'take-discarded'; segmentIds: string[] }
  | { type: 'recognition-started'; attempt: RecognitionAttempt }
  | { type: 'recognition-succeeded'; attempt: RecognitionAttempt; result: { transcript: string; confidence?: number } }
  | { type: 'recognition-failed'; attempt: RecognitionAttempt }
  | { type: 'manual-edited'; segmentId: string; transcript: string }
  | { type: 'transcript-confirmed'; segmentId: string }
  | { type: 'recording-finalized'; takeGeneration: number }

export function createTranscriptCaptureState(
  responseSegments: readonly Pick<InterpretingResponseSegment,
    'sourceSegmentId' | 'transcript' | 'transcriptSource' | 'recognitionStatus' | 'recognitionConfidence'>[] = [],
): TranscriptCaptureState {
  return {
    takeGeneration: 0,
    transcripts: Object.fromEntries(responseSegments.map((segment) => [segment.sourceSegmentId, segment.transcript])),
    transcriptSources: Object.fromEntries(responseSegments.map((segment) => [segment.sourceSegmentId, segment.transcriptSource])),
    recognitionStatuses: Object.fromEntries(responseSegments.map((segment) => [segment.sourceSegmentId, segment.recognitionStatus])),
    recognitionConfidences: Object.fromEntries(responseSegments.flatMap((segment) => segment.recognitionConfidence === undefined
      ? []
      : [[segment.sourceSegmentId, segment.recognitionConfidence]])),
  }
}

export function isCurrentRecognitionAttempt(state: TranscriptCaptureState, attempt: RecognitionAttempt): boolean {
  return state.takeGeneration === attempt.takeGeneration
    && state.pending?.id === attempt.id
    && state.pending.segmentId === attempt.segmentId
}

export function reduceTranscriptCapture(
  state: TranscriptCaptureState,
  event: TranscriptCaptureEvent,
): TranscriptCaptureState {
  if (event.type === 'take-started' || event.type === 'take-discarded') {
    const segmentIds = new Set(event.segmentIds)
    const transcripts = { ...state.transcripts }
    const transcriptSources = { ...state.transcriptSources }
    const recognitionStatuses = { ...state.recognitionStatuses }
    const recognitionConfidences = { ...state.recognitionConfidences }
    for (const segmentId of segmentIds) {
      delete transcripts[segmentId]
      delete transcriptSources[segmentId]
      delete recognitionStatuses[segmentId]
      delete recognitionConfidences[segmentId]
    }
    return {
      takeGeneration: state.takeGeneration + 1,
      transcripts,
      transcriptSources,
      recognitionStatuses,
      recognitionConfidences,
    }
  }

  if (event.type === 'recognition-started') {
    if (event.attempt.takeGeneration !== state.takeGeneration || state.pending) return state
    return { ...state, pending: event.attempt }
  }

  if (event.type === 'recognition-succeeded') {
    if (!isCurrentRecognitionAttempt(state, event.attempt)) return state
    const recognitionConfidences = { ...state.recognitionConfidences }
    if (event.result.confidence === undefined) delete recognitionConfidences[event.attempt.segmentId]
    else recognitionConfidences[event.attempt.segmentId] = event.result.confidence
    return {
      ...state,
      transcripts: { ...state.transcripts, [event.attempt.segmentId]: event.result.transcript },
      transcriptSources: { ...state.transcriptSources, [event.attempt.segmentId]: 'on-device' },
      recognitionStatuses: { ...state.recognitionStatuses, [event.attempt.segmentId]: 'uncertain' },
      recognitionConfidences,
      pending: undefined,
    }
  }

  if (event.type === 'recognition-failed') {
    return isCurrentRecognitionAttempt(state, event.attempt) ? { ...state, pending: undefined } : state
  }

  if (event.type === 'manual-edited') {
    const recognitionConfidences = { ...state.recognitionConfidences }
    delete recognitionConfidences[event.segmentId]
    return {
      ...state,
      transcripts: { ...state.transcripts, [event.segmentId]: event.transcript },
      transcriptSources: { ...state.transcriptSources, [event.segmentId]: 'manual' },
      recognitionStatuses: { ...state.recognitionStatuses, [event.segmentId]: 'verified' },
      recognitionConfidences,
      pending: state.pending?.segmentId === event.segmentId ? undefined : state.pending,
    }
  }

  if (event.type === 'transcript-confirmed') {
    if (!state.transcripts[event.segmentId]?.trim() || state.transcriptSources[event.segmentId] !== 'on-device') return state
    return {
      ...state,
      recognitionStatuses: { ...state.recognitionStatuses, [event.segmentId]: 'verified' },
    }
  }

  // Finalizing a take must not clear transcript evidence captured from that take.
  // The generation check makes delayed completion from an older take harmless.
  return event.takeGeneration === state.takeGeneration ? state : state
}

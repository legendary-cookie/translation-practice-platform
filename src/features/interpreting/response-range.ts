import type { AudioSegment, InterpretingResponseSegment } from '../../domain/types'

export type ResponseTimeRange = Pick<InterpretingResponseSegment, 'responseStartMs' | 'responseEndMs'>

export function resolveSimultaneousResponseRange(input: {
  segment: Pick<AudioSegment, 'startMs' | 'endMs'>
  recordingId?: string
  recordingDurationMs: number
  playbackOffsetMs: number
  restoredResponse?: Pick<InterpretingResponseSegment, 'recordingId' | 'responseStartMs' | 'responseEndMs'>
}): ResponseTimeRange {
  if (input.recordingId && input.restoredResponse?.recordingId === input.recordingId) {
    return {
      responseStartMs: input.restoredResponse.responseStartMs,
      responseEndMs: input.restoredResponse.responseEndMs,
    }
  }

  const durationMs = Math.max(0, input.recordingDurationMs)
  const responseStartMs = Math.max(0, Math.min(input.segment.startMs + input.playbackOffsetMs, durationMs))
  const responseEndMs = Math.max(responseStartMs, Math.min(input.segment.endMs + input.playbackOffsetMs, durationMs))
  return { responseStartMs, responseEndMs }
}

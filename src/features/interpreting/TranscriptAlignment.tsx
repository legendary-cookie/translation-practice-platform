import { useEffect, useMemo, useRef } from 'react'
import { getLanguage } from '../../domain/languages'
import type { InterpretingExercise, InterpretingFeedback, InterpretingEvaluationInput } from '../../domain/types'

export function TranscriptAlignment({
  exercise,
  input,
  feedback,
}: {
  exercise: InterpretingExercise
  input: InterpretingEvaluationInput
  feedback: InterpretingFeedback
}) {
  const sourceAudio = useRef<HTMLAudioElement>(null)
  const sourceRangeEndSeconds = useRef<number | undefined>(undefined)
  const replayUrls = useMemo(() => new Map(input.recordings.map((recording) => [recording.id, URL.createObjectURL(recording.blob)])), [input.recordings])
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)

  useEffect(() => () => {
    replayUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [replayUrls])

  useEffect(() => {
    const audio = sourceAudio.current
    if (!audio) return
    const stopAtRangeEnd = () => {
      const endSeconds = sourceRangeEndSeconds.current
      if (endSeconds !== undefined && audio.currentTime >= endSeconds) {
        audio.pause()
        audio.currentTime = endSeconds
        sourceRangeEndSeconds.current = undefined
      }
    }
    audio.addEventListener('timeupdate', stopAtRangeEnd)
    return () => audio.removeEventListener('timeupdate', stopAtRangeEnd)
  }, [])

  function seekSource(startMs: number, endMs: number) {
    const audio = sourceAudio.current
    if (!audio) {
      return
    }
    sourceRangeEndSeconds.current = endMs / 1000
    audio.currentTime = startMs / 1000
    void audio.play().catch(() => undefined)
  }

  return (
    <section className="interpreting-alignment" aria-labelledby="alignment-heading">
      <div className="interpreting-card-heading"><div><p className="eyebrow">Evidence alignment</p><h3 id="alignment-heading">Source and response by segment</h3></div><audio ref={sourceAudio} controls preload="metadata" src={exercise.audioUrl} aria-label="Replay source audio">Source audio replay is unavailable.</audio></div>
      <div className="interpreting-alignment-list">
        {exercise.segments.map((segment) => {
          const response = input.responseSegments.find((candidate) => candidate.sourceSegmentId === segment.id)
          const recordingUrl = response?.recordingId ? replayUrls.get(response.recordingId) : undefined
          const segmentAnnotations = [...feedback.issues, ...feedback.uncertainEvidence].filter((annotation) => annotation.sourceSegmentId === segment.id || annotation.responseSegmentId === response?.id)
          return (
            <article className="interpreting-alignment-row" key={segment.id}>
              <div className="interpreting-alignment-source"><div className="interpreting-card-heading"><strong>{segment.id}</strong><button className="button button--quiet interpreting-action" type="button" onClick={() => seekSource(segment.startMs, segment.endMs)}>Play source range</button></div><p dir={sourceLanguage.direction} lang={sourceLanguage.code}>{segment.transcript}</p><small>{(segment.startMs / 1000).toFixed(1)}–{(segment.endMs / 1000).toFixed(1)}s authored source range</small></div>
              <div className="interpreting-alignment-response"><div className="interpreting-card-heading"><strong>Learner response</strong><span className={`pill ${response?.recognitionStatus === 'uncertain' ? 'pill--warning' : ''}`}>{response?.recognitionStatus ?? 'not recorded'}</span></div><p dir={targetLanguage.direction} lang={targetLanguage.code}>{response?.transcript || 'No verified transcript for this response.'}</p>{recordingUrl && <audio controls preload="metadata" src={recordingUrl} aria-label={`Replay learner response for ${segment.id}`}>Learner replay is unavailable.</audio>}<small>{response?.responseStartMs !== undefined && response?.responseEndMs !== undefined ? `${(response.responseStartMs / 1000).toFixed(1)}–${(response.responseEndMs / 1000).toFixed(1)}s response range` : 'No response timing saved.'}{input.interpretingMode === 'simultaneous' && ' · approximate continuous-take boundary'}</small></div>
              {segmentAnnotations.length > 0 && <ul className="interpreting-alignment-annotations">{segmentAnnotations.map((annotation, index) => <li key={`${segment.id}-${annotation.category}-${index}`}><strong>{annotation.evidenceStatus === 'verified' ? annotation.category : 'Check the transcript'}</strong><span>{annotation.explanation}</span></li>)}</ul>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

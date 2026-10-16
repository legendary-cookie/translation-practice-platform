import { t } from '../../i18n'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { getLanguage } from '../../domain/languages'
import type { InterpretingExercise, InterpretingFeedback, InterpretingEvaluationInput } from '../../domain/types'

function BoundedAudioReplay({ src, startMs, endMs, label }: { src: string; startMs: number; endMs: number; label: string }) {
  const startSeconds = startMs / 1000
  const endSeconds = endMs / 1000

  function startWithinRange(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget
    if (audio.currentTime < startSeconds || audio.currentTime >= endSeconds) {
      audio.currentTime = startSeconds
    }
  }

  function keepWithinRange(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget
    if (audio.currentTime < startSeconds) {
      audio.currentTime = startSeconds
    } else if (audio.currentTime >= endSeconds) {
      audio.pause()
      audio.currentTime = endSeconds
    }
  }

  return <audio controls preload="metadata" src={src} aria-label={label} onPlay={startWithinRange} onTimeUpdate={keepWithinRange} onSeeking={keepWithinRange}>{t("Learner replay is unavailable.")}</audio>
}

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
  const [replayUrlSet, setReplayUrlSet] = useState<{
    recordings: InterpretingEvaluationInput['recordings']
    urls: Map<string, string>
  }>()
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const replayUrls = replayUrlSet?.recordings === input.recordings ? replayUrlSet.urls : undefined

  useEffect(() => {
    const urls = new Map(input.recordings.map((recording) => [recording.id, URL.createObjectURL(recording.blob)]))
    setReplayUrlSet({ recordings: input.recordings, urls })
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [input.recordings])

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
      <div className="interpreting-card-heading"><div><p className="eyebrow">{t("Evidence alignment")}</p><h3 id="alignment-heading">{t("Source and response by segment")}</h3></div><audio ref={sourceAudio} controls preload="metadata" src={exercise.audioUrl} aria-label={t("Replay source audio")}>{t("Source audio replay is unavailable.")}</audio></div>
      <div className="interpreting-alignment-list">
        {exercise.segments.map((segment) => {
          const response = input.responseSegments.find((candidate) => candidate.sourceSegmentId === segment.id)
          const recordingUrl = response?.recordingId ? replayUrls?.get(response.recordingId) : undefined
          const segmentAnnotations = [...feedback.issues, ...feedback.uncertainEvidence].filter((annotation) => annotation.sourceSegmentId === segment.id || annotation.responseSegmentId === response?.id)
          return (
            <article className="interpreting-alignment-row" key={segment.id}>
              <div className="interpreting-alignment-source"><div className="interpreting-card-heading"><strong>{segment.id}</strong><button className="button button--quiet interpreting-action" type="button" onClick={() => seekSource(segment.startMs, segment.endMs)}>{t("Play source range")}</button></div><p dir={sourceLanguage.direction} lang={sourceLanguage.code}>{segment.transcript}</p><small>{(segment.startMs / 1000).toFixed(1)}–{(segment.endMs / 1000).toFixed(1)}{t("s authored source range")}</small></div>
              <div className="interpreting-alignment-response"><div className="interpreting-card-heading"><strong>{t("Learner response")}</strong><span className={`pill ${response?.recognitionStatus === 'uncertain' ? 'pill--warning' : ''}`}>{response?.recognitionStatus ?? 'not recorded'}</span></div><p dir={targetLanguage.direction} lang={targetLanguage.code}>{response?.transcript || 'No verified transcript for this response.'}</p>{recordingUrl && response && response.responseEndMs > response.responseStartMs && <BoundedAudioReplay src={recordingUrl} startMs={response.responseStartMs} endMs={response.responseEndMs} label={`Replay learner response for ${segment.id}`} />}{recordingUrl && response && response.responseEndMs <= response.responseStartMs && <small>{t("No recorded audio falls within this response range.")}</small>}<small>{response?.responseStartMs !== undefined && response?.responseEndMs !== undefined ? t("{0}–{1}s response range", (response.responseStartMs / 1000).toFixed(1), (response.responseEndMs / 1000).toFixed(1)) : t("No response timing saved.")}{input.interpretingMode === 'simultaneous' && ' · approximate continuous-take boundary'}</small></div>
              {segmentAnnotations.length > 0 && <ul className="interpreting-alignment-annotations">{segmentAnnotations.map((annotation, index) => <li key={`${segment.id}-${annotation.category}-${index}`}><strong>{annotation.evidenceStatus === 'verified' ? annotation.category : t("Check the transcript")}</strong><span>{annotation.explanation}</span></li>)}</ul>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

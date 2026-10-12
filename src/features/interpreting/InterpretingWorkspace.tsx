import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeRecording } from '../../audio/audio-analysis'
import { createAudioPlayer, type AudioPlayer } from '../../audio/audio-player'
import { createResponseRecorder, type RecorderState } from '../../audio/audio-recorder'
import { getLocalRecognitionCapability, recognizeLocal, type LocalRecognitionCapability } from '../../audio/local-speech-recognition'
import { getLanguage } from '../../domain/languages'
import type {
  AudioRecordingRecord,
  DeliveryAnalysis,
  InterpretingEvaluationInput,
  InterpretingExercise,
  InterpretingMode,
  InterpretingResponseSegment,
  RecognitionStatus,
  TranscriptSource,
} from '../../domain/types'

type Props = {
  exercise: InterpretingExercise
  initialInput?: InterpretingEvaluationInput
  interpretingMode: InterpretingMode
  isSubmitting: boolean
  notice?: string
  onCancel: () => void
  onSubmit: (input: InterpretingEvaluationInput) => void
}

type PlayerState = {
  segmentId?: string
  currentTimeSeconds: number
  isPlaying: boolean
}

function formatSeconds(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(wholeSeconds / 60).toString().padStart(2, '0')}:${(wholeSeconds % 60).toString().padStart(2, '0')}`
}

function fallbackAnalysis(durationMs: number): DeliveryAnalysis {
  return {
    durationMs,
    activeSpeechRatio: 0,
    pauseCount: 0,
    longestPauseMs: 0,
    signalQuality: 0,
    analysisConfidence: 0.2,
    method: 'local-analysis-unavailable-v1',
  }
}

export function InterpretingWorkspace({ exercise, initialInput, interpretingMode, isSubmitting, notice, onCancel, onSubmit }: Props) {
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [playerState, setPlayerState] = useState<PlayerState>({ currentTimeSeconds: 0, isPlaying: false })
  const [recorderState, setRecorderState] = useState<{ status: RecorderState; elapsedMs: number; inputLevel: number; error?: string }>({ status: 'idle', elapsedMs: 0, inputLevel: 0 })
  const [listenedSegments, setListenedSegments] = useState<Set<string>>(() => new Set(initialInput?.exercise.segments.map((segment) => segment.id) ?? []))
  const [takes, setTakes] = useState<Record<string, AudioRecordingRecord>>(() => {
    const restored: Record<string, AudioRecordingRecord> = {}
    for (const recording of initialInput?.recordings ?? []) {
      const response = initialInput?.responseSegments.find((segment) => segment.recordingId === recording.id)
      const key = interpretingMode === 'simultaneous' ? 'continuous' : response?.sourceSegmentId ?? recording.segmentIds[0]
      if (key) restored[key] = recording
    }
    return restored
  })
  const [replayUrls, setReplayUrls] = useState<Record<string, string>>({})
  const [transcripts, setTranscripts] = useState<Record<string, string>>(() => Object.fromEntries((initialInput?.responseSegments ?? []).map((segment) => [segment.sourceSegmentId, segment.transcript])))
  const [transcriptSources, setTranscriptSources] = useState<Record<string, TranscriptSource>>(() => Object.fromEntries((initialInput?.responseSegments ?? []).map((segment) => [segment.sourceSegmentId, segment.transcriptSource])))
  const [recognitionStatuses, setRecognitionStatuses] = useState<Record<string, RecognitionStatus>>(() => Object.fromEntries((initialInput?.responseSegments ?? []).map((segment) => [segment.sourceSegmentId, segment.recognitionStatus])))
  const [deliveryByTake, setDeliveryByTake] = useState<Record<string, DeliveryAnalysis>>(() => Object.fromEntries((initialInput?.deliveryAnalysis ?? []).map((analysis) => {
    const response = initialInput?.responseSegments.find((segment) => segment.recordingId === analysis.recordingId)
    return [interpretingMode === 'simultaneous' ? 'continuous' : response?.sourceSegmentId ?? analysis.recordingId ?? 'restored', analysis]
  })))
  const [skippedSegments, setSkippedSegments] = useState<Set<string>>(() => new Set((initialInput?.responseSegments ?? []).filter((segment) => !segment.recordingId && segment.recognitionStatus === 'unavailable').map((segment) => segment.sourceSegmentId)))
  const [recognition, setRecognition] = useState<LocalRecognitionCapability>()
  const [repeatSegment, setRepeatSegment] = useState(false)
  const [error, setError] = useState<string>()
  const [player, setPlayer] = useState<AudioPlayer>()
  const recorder = useMemo(() => createResponseRecorder(exercise.id), [exercise.id])
  const sourceAudioHost = useRef<HTMLDivElement>(null)
  const listenTargetSegmentRef = useRef<string | undefined>(undefined)
  const recordingTakeKeyRef = useRef<string | undefined>(undefined)
  const currentSegment = exercise.segments[segmentIndex]
  const currentTakeKey = interpretingMode === 'simultaneous' ? 'continuous' : currentSegment.id
  const currentTake = takes[currentTakeKey]
  const currentReplayUrl = replayUrls[currentTakeKey]
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const isImportedSource = exercise.rightsRecordId.startsWith('local-import:')

  useEffect(() => {
    const nextPlayer = createAudioPlayer(exercise)
    setPlayer(nextPlayer)
    return () => {
      setPlayer((current) => current === nextPlayer ? undefined : current)
      nextPlayer.dispose()
    }
  }, [exercise])

  useEffect(() => {
    if (!player) {
      return
    }
    const audio = player.getElement()
    const host = sourceAudioHost.current
    if (!host) {
      return
    }
    host.appendChild(audio)
    audio.controls = true
    audio.removeAttribute('aria-hidden')
    audio.tabIndex = 0
    audio.style.position = 'static'
    audio.style.width = '100%'
    audio.style.height = 'auto'
    audio.style.opacity = '1'
    audio.style.pointerEvents = 'auto'
    audio.style.overflow = 'visible'
    return () => {
      audio.controls = false
    }
  }, [player])

  useEffect(() => {
    if (!player) {
      return
    }
    const unsubscribe = player.subscribe((state) => {
      setPlayerState(state)
      const listeningFor = listenTargetSegmentRef.current
      const listened = listeningFor ? exercise.segments.find((segment) => segment.id === listeningFor) : undefined
      if (listened && state.segmentId === listened.id && !state.isPlaying && state.currentTimeSeconds * 1000 >= listened.endMs - 50) {
        setListenedSegments((segments) => new Set(segments).add(listened.id))
        listenTargetSegmentRef.current = undefined
      }
    })
    return () => {
      unsubscribe()
    }
  }, [player])

  useEffect(() => {
    const unsubscribe = recorder.subscribe(setRecorderState)
    return () => {
      unsubscribe()
      recorder.dispose()
    }
  }, [recorder])

  useEffect(() => {
    const urls = Object.fromEntries(Object.entries(takes).map(([key, recording]) => [key, recorder.getReplayUrl(recording)]))
    setReplayUrls(urls)
    return () => Object.values(urls).forEach((url) => recorder.revokeReplayUrl(url))
  }, [recorder, takes])

  useEffect(() => {
    let cancelled = false
    void getLocalRecognitionCapability(targetLanguage.speechTag).then((capability) => {
      if (!cancelled) {
        setRecognition(capability)
      }
    })
    return () => {
      cancelled = true
    }
  }, [targetLanguage.speechTag])

  async function playCurrentSegment() {
    setError(undefined)
    if (!player) {
      setError('The source audio player is still preparing. Try again in a moment.')
      return
    }
    try {
      listenTargetSegmentRef.current = currentSegment.id
      await player.playSegment(currentSegment.id)
    } catch (caught) {
      listenTargetSegmentRef.current = undefined
      setError(caught instanceof Error ? caught.message : 'The source clip could not be played.')
    }
  }

  async function startRecording() {
    setError(undefined)
    if (recorderState.status === 'requesting' || recorderState.status === 'recording' || recorderState.status === 'paused' || recorderState.status === 'stopping') {
      return
    }
    if (interpretingMode === 'consecutive' && !listenedSegments.has(currentSegment.id)) {
      setError('Listen to the current source segment before recording a consecutive response.')
      return
    }
    if (interpretingMode === 'simultaneous' && skippedSegments.size > 0) {
      setError('A simultaneous take covers the whole source. Unskip every segment before recording it.')
      return
    }
    try {
      player?.pause()
      recordingTakeKeyRef.current = interpretingMode === 'simultaneous' ? 'continuous' : currentSegment.id
      if (interpretingMode === 'consecutive') {
        setSkippedSegments((current) => {
          const next = new Set(current)
          next.delete(currentSegment.id)
          return next
        })
      }
      await recorder.start(interpretingMode === 'consecutive' ? currentSegment.id : undefined, interpretingMode)
      if (interpretingMode === 'simultaneous') {
        if (!player) {
          throw new Error('The source audio player is still preparing. Try again in a moment.')
        }
        try {
          await player.playAllSegments()
        } catch (caught) {
          await recorder.stop().catch(() => undefined)
          recordingTakeKeyRef.current = undefined
          throw caught
        }
      }
    } catch (caught) {
      if (interpretingMode === 'simultaneous') {
        await recorder.stop().catch(() => undefined)
      }
      recordingTakeKeyRef.current = undefined
      setError(caught instanceof Error ? caught.message : 'The microphone could not start.')
    }
  }

  async function stopRecording() {
    setError(undefined)
    player?.pause()
    try {
      const recording = await recorder.stop()
      if (!recording) {
        recordingTakeKeyRef.current = undefined
        return
      }
      const key = recordingTakeKeyRef.current ?? (interpretingMode === 'simultaneous' ? 'continuous' : currentSegment.id)
      recordingTakeKeyRef.current = undefined
      const replacedSegments = interpretingMode === 'simultaneous' ? exercise.segments.map((segment) => segment.id) : [key]
      setTranscripts((current) => { const next = { ...current }; replacedSegments.forEach((id) => delete next[id]); return next })
      setTranscriptSources((current) => { const next = { ...current }; replacedSegments.forEach((id) => delete next[id]); return next })
      setRecognitionStatuses((current) => { const next = { ...current }; replacedSegments.forEach((id) => delete next[id]); return next })
      setTakes((current) => ({ ...current, [key]: recording }))
      setSkippedSegments((current) => {
        const next = new Set(current)
        if (interpretingMode === 'simultaneous') {
          exercise.segments.forEach((segment) => next.delete(segment.id))
        } else {
          next.delete(currentSegment.id)
        }
        return next
      })
      try {
        const analysis = await analyzeRecording(recording.blob)
        setDeliveryByTake((current) => ({ ...current, [key]: { ...analysis, recordingId: recording.id } }))
      } catch {
        setDeliveryByTake((current) => ({ ...current, [key]: { ...fallbackAnalysis(recording.durationMs), recordingId: recording.id } }))
        setError('The take was saved, but local delivery analysis was unavailable. The feedback will say so.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The recording could not be saved.')
    }
  }

  function discardCurrentTake() {
    setTakes((current) => {
      const next = { ...current }
      delete next[currentTakeKey]
      return next
    })
    setReplayUrls((current) => {
      const next = { ...current }
      delete next[currentTakeKey]
      return next
    })
    setDeliveryByTake((current) => {
      const next = { ...current }
      delete next[currentTakeKey]
      return next
    })
    const discardedSegments = interpretingMode === 'simultaneous' ? exercise.segments.map((segment) => segment.id) : [currentSegment.id]
    setTranscripts((current) => { const next = { ...current }; discardedSegments.forEach((id) => delete next[id]); return next })
    setTranscriptSources((current) => { const next = { ...current }; discardedSegments.forEach((id) => delete next[id]); return next })
    setRecognitionStatuses((current) => { const next = { ...current }; discardedSegments.forEach((id) => delete next[id]); return next })
  }

  async function captureLocalTranscript() {
    const track = recorder.getActiveTrack()
    if (!track) {
      setError('Start recording before requesting the optional on-device transcript.')
      return
    }
    setError(undefined)
    try {
      const targetSegmentId = recordingTakeKeyRef.current && recordingTakeKeyRef.current !== 'continuous' ? recordingTakeKeyRef.current : currentSegment.id
      const result = await recognizeLocal(track, targetLanguage.speechTag, targetSegmentId)
      setTranscripts((current) => ({ ...current, [targetSegmentId]: result.transcript }))
      setTranscriptSources((current) => ({ ...current, [targetSegmentId]: 'on-device' }))
      setRecognitionStatuses((current) => ({ ...current, [targetSegmentId]: result.recognitionStatus }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'On-device recognition was unavailable. Use the manual transcript.')
    }
  }

  function buildInput(): InterpretingEvaluationInput | undefined {
    const continuousRecording = takes.continuous
    const incomplete = exercise.segments.some((segment) => {
      const hasTake = interpretingMode === 'simultaneous' ? continuousRecording !== undefined : takes[segment.id] !== undefined
      return !hasTake && !skippedSegments.has(segment.id)
    })
    if (incomplete) {
      setError('Record or explicitly skip every source segment before submitting the interpreting task.')
      return undefined
    }
    const responseSegments: InterpretingResponseSegment[] = exercise.segments.map((segment) => {
      const recording = interpretingMode === 'simultaneous' ? continuousRecording : takes[segment.id]
      const skipped = skippedSegments.has(segment.id)
      const responseStartMs = interpretingMode === 'simultaneous' ? Math.min(segment.startMs, recording?.durationMs ?? segment.startMs) : 0
      const responseEndMs = interpretingMode === 'simultaneous'
        ? Math.max(responseStartMs, Math.min(segment.endMs, recording?.durationMs ?? responseStartMs))
        : recording?.durationMs ?? 0
      return {
        id: `${exercise.id}-response-${segment.id}`,
        sourceSegmentId: segment.id,
        recordingId: skipped ? undefined : recording?.id,
        responseStartMs,
        responseEndMs,
        transcript: transcripts[segment.id] ?? '',
        transcriptSource: transcriptSources[segment.id] ?? 'manual',
        recognitionStatus: skipped ? 'unavailable' : recognitionStatuses[segment.id] ?? (transcripts[segment.id]?.trim() ? 'verified' : 'uncertain'),
      }
    })
    const referencedRecordingIds = new Set(responseSegments.flatMap((segment) => segment.recordingId ? [segment.recordingId] : []))
    const recordings = Array.from(new Map(Object.values(takes)
      .filter((recording) => referencedRecordingIds.has(recording.id))
      .map((recording) => [recording.id, recording])).values())
    return {
      exercise,
      interpretingMode,
      responseSegments,
      recordings,
      deliveryAnalysis: Object.values(deliveryByTake).filter((analysis) => analysis.recordingId && referencedRecordingIds.has(analysis.recordingId)),
    }
  }

  function submit() {
    if (isSubmitting || ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status)) {
      return
    }
    const input = buildInput()
    if (input) {
      onSubmit(input)
    }
  }

  const progress = currentSegment ? ((playerState.currentTimeSeconds - currentSegment.startMs / 1000) / Math.max(0.1, (currentSegment.endMs - currentSegment.startMs) / 1000)) * 100 : 0
  const canRecord = interpretingMode === 'simultaneous' || listenedSegments.has(currentSegment.id)
  const recorderBusy = ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status)
  const allSegmentsReady = !recorderBusy && exercise.segments.every((segment) => (interpretingMode === 'simultaneous' ? takes.continuous : takes[segment.id]) || skippedSegments.has(segment.id))

  return (
    <div className="interpreting-workspace" aria-label="Interpreting practice workspace" aria-busy={isSubmitting}>
      <header className="interpreting-workspace__header"><div><p className="eyebrow">{interpretingMode === 'consecutive' ? 'Consecutive interpreting' : 'Simultaneous interpreting'}</p><h2>{exercise.title}</h2><p>{sourceLanguage.nativeLabel} → {targetLanguage.nativeLabel} · {exercise.segments.length} authored segments · {isImportedSource ? 'source audio stays local to this browser' : 'source audio stays same-origin'}</p></div><button className="text-button interpreting-text-action" type="button" onClick={onCancel} disabled={isSubmitting} aria-disabled={isSubmitting}>Leave desk</button></header>
      {(notice || error || recorderState.error) && <p className="interpreting-notice" role="alert">{notice ?? error ?? recorderState.error}</p>}
      <div className="interpreting-columns">
        <aside className="interpreting-segment-rail" aria-label="Source segments"><p className="eyebrow">Segments</p>{exercise.segments.map((segment, index) => <button className={`interpreting-segment-button ${index === segmentIndex ? 'interpreting-segment-button--active' : ''}`} type="button" key={segment.id} disabled={isSubmitting || recorderBusy} onClick={() => { listenTargetSegmentRef.current = undefined; setSegmentIndex(index); player?.pause() }}><span>{index + 1}</span><span>{formatSeconds((segment.endMs - segment.startMs) / 1000)}</span><small>{takes[segment.id] || takes.continuous ? 'Take saved' : skippedSegments.has(segment.id) ? 'Skipped' : 'Not recorded'}</small></button>)}</aside>
        <section className="interpreting-source-card" aria-labelledby="source-heading">
          <div className="interpreting-card-heading"><div><p className="eyebrow">Source audio</p><h3 id="source-heading">{currentSegment.id}</h3></div><span className="pill">{formatSeconds(currentSegment.startMs / 1000)}–{formatSeconds(currentSegment.endMs / 1000)}</span></div>
          <p className="interpreting-source-transcript" dir={sourceLanguage.direction} lang={sourceLanguage.code}>{currentSegment.transcript || 'No source transcript supplied; delivery-only feedback remains available.'}</p>
          <div className="interpreting-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
          <p className="interpreting-time" aria-live="polite">{formatSeconds(playerState.currentTimeSeconds)} / {formatSeconds(currentSegment.endMs / 1000)}</p>
          <div className="interpreting-native-source-player" ref={sourceAudioHost} aria-label="Native source audio controls" />
          <div className="interpreting-control-row"><button className="button button--primary interpreting-action" type="button" onClick={() => void playCurrentSegment()} disabled={!player}>{playerState.isPlaying ? 'Playing…' : 'Play segment'} <span aria-hidden="true">▶</span></button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.pause()}>Pause</button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.seek(Math.max(currentSegment.startMs / 1000, playerState.currentTimeSeconds - 2))}>−2s</button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.seek(Math.min(currentSegment.endMs / 1000, playerState.currentTimeSeconds + 2))}>+2s</button></div>
          <label className="interpreting-toggle"><input type="checkbox" checked={repeatSegment} onChange={(event) => { setRepeatSegment(event.target.checked); player?.setRepeat(event.target.checked) }} /> Repeat this segment</label>
          <p className="interpreting-helper">Listen before recording in consecutive mode. The source audio is not uploaded by this workspace.</p>
        </section>
        <section className="interpreting-response-card" aria-labelledby="response-heading">
          <div className="interpreting-card-heading"><div><p className="eyebrow">Your delivery</p><h3 id="response-heading">{currentTake ? 'Take ready for review' : recorderState.status === 'recording' ? 'Recording now' : 'Prepare your response'}</h3></div><span className={`interpreting-recording-indicator interpreting-recording-indicator--${recorderState.status}`} role="status">{recorderState.status === 'recording' ? '● Recording' : recorderState.status}</span></div>
          <div className="interpreting-meter" aria-label={`Microphone input level ${Math.round(recorderState.inputLevel * 100)} percent`}><span style={{ width: `${Math.round(recorderState.inputLevel * 100)}%` }} /></div>
          <p className="interpreting-time">{formatSeconds(recorderState.elapsedMs / 1000)} · local microphone only</p>
          <div className="interpreting-control-row"><button className="button button--primary interpreting-action" type="button" onClick={() => void startRecording()} disabled={isSubmitting || ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status) || !canRecord}>{recorderState.status === 'requesting' ? 'Waiting for microphone…' : interpretingMode === 'consecutive' && !canRecord ? 'Listen first' : 'Start recording'} <span aria-hidden="true">●</span></button><button className="button button--quiet interpreting-action" type="button" onClick={() => void stopRecording()} disabled={recorderState.status !== 'recording' && recorderState.status !== 'paused'}>Stop and save</button><button className="button button--quiet interpreting-action" type="button" onClick={() => recorder.pause()} disabled={recorderState.status !== 'recording'}>Pause</button><button className="button button--quiet interpreting-action" type="button" onClick={() => recorder.resume()} disabled={recorderState.status !== 'paused'}>Resume</button></div>
          {currentReplayUrl && <div className="interpreting-replay"><strong>Replay this take</strong><audio controls preload="metadata" src={currentReplayUrl}>Your browser cannot replay this local take.</audio><button className="text-button interpreting-text-action" type="button" onClick={discardCurrentTake}>Discard and rerecord</button></div>}
          <div className="interpreting-transcript-block"><div className="interpreting-card-heading"><strong>Editable response transcript</strong><span className="pill">{recognition?.status === 'available' ? 'Optional on-device recognition' : 'Manual path'}</span></div><textarea dir={targetLanguage.direction} lang={targetLanguage.code} value={transcripts[currentSegment.id] ?? ''} onChange={(event) => { setTranscripts((current) => ({ ...current, [currentSegment.id]: event.target.value })); setTranscriptSources((current) => ({ ...current, [currentSegment.id]: 'manual' })); setRecognitionStatuses((current) => ({ ...current, [currentSegment.id]: 'verified' })) }} placeholder="Type or confirm what you delivered…" aria-label={`Transcript for ${currentSegment.id}`} disabled={isSubmitting} /><div className="interpreting-control-row"><button className="button button--quiet interpreting-action" type="button" onClick={() => void captureLocalTranscript()} disabled={isSubmitting || recorderState.status !== 'recording' || recognition?.status !== 'available'}>Capture on-device transcript</button><span className="interpreting-confidence">{recognitionStatuses[currentSegment.id] === 'uncertain' ? 'Recognition may be wrong — check it.' : transcriptSources[currentSegment.id] === 'on-device' ? 'On-device transcript; confirm or edit it.' : 'Manual text is treated as learner-confirmed evidence.'}</span></div></div>
          <label className="interpreting-toggle"><input type="checkbox" checked={skippedSegments.has(currentSegment.id)} disabled={isSubmitting || recorderBusy || Boolean(currentTake)} onChange={(event) => setSkippedSegments((current) => { const next = new Set(current); if (event.target.checked) next.add(currentSegment.id); else next.delete(currentSegment.id); return next })} /> I am skipping this segment</label>
        </section>
      </div>
      <footer className="interpreting-workspace__footer"><p>{interpretingMode === 'simultaneous' ? 'Continuous takes use approximate segment boundaries; word-level alignment is not fabricated.' : 'Each saved take is tied to its authored source segment.'} Recordings stay in memory until you submit.</p><button className="button button--primary interpreting-submit" type="button" onClick={submit} disabled={isSubmitting || !allSegmentsReady}>{isSubmitting ? 'Preparing feedback…' : 'Submit for practice feedback'} <span aria-hidden="true">→</span></button></footer>
    </div>
  )
}

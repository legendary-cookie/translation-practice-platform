import { t } from '../../i18n'
import { useNativeBack } from '../../native/lifecycle'
import { useEffect, useRef, useState } from 'react'
import { analyzeRecording, createFallbackAnalysis } from '../../audio/audio-analysis'
import { createAudioPlayer, type AudioPlayer } from '../../audio/audio-player'
import { createResponseRecorder, type RecorderState, type ResponseRecorder } from '../../audio/audio-recorder'
import { getLocalRecognitionCapabilityWithTimeout, recognizeLocal, type LocalRecognitionCapability } from '../../audio/local-speech-recognition'
import { getLanguage } from '../../domain/languages'
import { createTranscriptCaptureState, isCurrentRecognitionAttempt, reduceTranscriptCapture, type TranscriptCaptureEvent } from './transcript-capture-state'
import { resolveSimultaneousResponseRange } from './response-range'
import { startSimultaneousTake } from './simultaneous-take-start'
import type {
  AudioRecordingRecord,
  DeliveryAnalysis,
  InterpretingEvaluationInput,
  InterpretingExercise,
  InterpretingMode,
  InterpretingResponseSegment,
} from '../../domain/types'

type Props = {
  exercise: InterpretingExercise
  initialInput?: InterpretingEvaluationInput
  interpretingMode: InterpretingMode
  isSubmitting: boolean
  notice?: string
  onCancel: () => void
  onSubmit: (input: InterpretingEvaluationInput) => void
  onSaveSelfReview: (input: InterpretingEvaluationInput) => void
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

export function InterpretingWorkspace({ exercise, initialInput, interpretingMode, isSubmitting, notice, onCancel, onSubmit, onSaveSelfReview }: Props) {
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
  const [transcriptCapture, setTranscriptCapture] = useState(() => createTranscriptCaptureState(initialInput?.responseSegments ?? []))
  const [pendingAnalysisKeys, setPendingAnalysisKeys] = useState<Set<string>>(() => new Set())
  const [deliveryByTake, setDeliveryByTake] = useState<Record<string, DeliveryAnalysis>>(() => Object.fromEntries((initialInput?.deliveryAnalysis ?? []).map((analysis) => {
    const response = initialInput?.responseSegments.find((segment) => segment.recordingId === analysis.recordingId)
    return [interpretingMode === 'simultaneous' ? 'continuous' : response?.sourceSegmentId ?? analysis.recordingId ?? 'restored', analysis]
  })))
  const [skippedSegments, setSkippedSegments] = useState<Set<string>>(() => new Set((initialInput?.responseSegments ?? []).filter((segment) => !segment.recordingId && segment.recognitionStatus === 'unavailable').map((segment) => segment.sourceSegmentId)))
  const [recognition, setRecognition] = useState<LocalRecognitionCapability>()
  const [repeatSegment, setRepeatSegment] = useState(false)
  const [error, setError] = useState<string>()
  const [player, setPlayer] = useState<AudioPlayer>()
  const [recorder, setRecorder] = useState<ResponseRecorder>()
  const sourceAudioHost = useRef<HTMLDivElement>(null)
  const replayAudioRef = useRef<HTMLAudioElement>(null)
  const listenTargetSegmentRef = useRef<string | undefined>(undefined)
  const recordingTakeKeyRef = useRef<string | undefined>(undefined)
  const recordingTakeGenerationRef = useRef<number | undefined>(undefined)
  const simultaneousPlaybackOffsetMsRef = useRef(0)
  const pendingAnalysisRef = useRef(new Set<string>())
  const transcriptCaptureRef = useRef(transcriptCapture)
  const recognitionAttemptIdRef = useRef(0)
  const pendingRecognitionRef = useRef<{ id: number; takeGeneration: number; segmentId: string } | undefined>(undefined)
  const selfReviewStartedRef = useRef(false)
  const currentSegment = exercise.segments[segmentIndex]
  const currentTakeKey = interpretingMode === 'simultaneous' ? 'continuous' : currentSegment.id
  const currentTake = takes[currentTakeKey]
  const currentReplayUrl = replayUrls[currentTakeKey]
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const { transcripts, transcriptSources, recognitionStatuses, recognitionConfidences } = transcriptCapture
  const pendingRecognitionSegmentId = transcriptCapture.pending?.segmentId
  const isImportedSource = exercise.rightsRecordId.startsWith('local-import:')
  const recorderBusy = ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status)

  function dispatchTranscriptCapture(event: TranscriptCaptureEvent) {
    const next = reduceTranscriptCapture(transcriptCaptureRef.current, event)
    if (next !== transcriptCaptureRef.current) {
      transcriptCaptureRef.current = next
      setTranscriptCapture(next)
    }
    return next
  }

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
    audio.controls = !recorderBusy && interpretingMode === 'simultaneous'
    audio.removeAttribute('aria-hidden')
    audio.tabIndex = audio.controls ? 0 : -1
    audio.style.position = 'static'
    audio.style.width = '100%'
    audio.style.height = 'auto'
    audio.style.opacity = '1'
    audio.style.pointerEvents = 'auto'
    audio.style.overflow = 'visible'
    return () => {
      audio.controls = false
    }
  }, [player, recorderBusy, interpretingMode])

  useEffect(() => {
    if (!player) {
      return
    }
    const unsubscribe = player.subscribe((state) => {
      setPlayerState(state)
      const listeningFor = listenTargetSegmentRef.current ?? state.segmentId
      const listened = listeningFor ? exercise.segments.find((segment) => segment.id === listeningFor) : undefined
      if (listened && state.segmentId === listened.id && !state.isPlaying && player.hasPlayedSegmentToEnd(listened.id)) {
        setListenedSegments((segments) => new Set(segments).add(listened.id))
        listenTargetSegmentRef.current = undefined
      }
    })
    return () => {
      unsubscribe()
    }
  }, [player])

  useEffect(() => {
    const currentRecorder = createResponseRecorder(exercise.id)
    const unsubscribe = currentRecorder.subscribe((state, completion) => {
      setRecorderState(state)
      if (completion) {
        if (completion.reason === 'stream-ended') {
          setError('The microphone input ended. The completed take is ready for review.')
        }
        void handleFinalizedRecording(completion.recording)
      }
    })
    setRecorder(currentRecorder)
    return () => {
      unsubscribe()
      currentRecorder.dispose()
    }
  }, [exercise.id])

  useEffect(() => {
    if (!recorder) {
      setReplayUrls({})
      return
    }
    const urls = Object.fromEntries(Object.entries(takes).map(([key, recording]) => [key, recorder.getReplayUrl(recording)]))
    setReplayUrls(urls)
    return () => Object.values(urls).forEach((url) => recorder.revokeReplayUrl(url))
  }, [recorder, takes])

  useEffect(() => {
    let cancelled = false
    void getLocalRecognitionCapabilityWithTimeout(targetLanguage.speechTag).then((capability) => {
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
    if (recorderBusy) {
      setError('Source playback is disabled while your response is recording.')
      return
    }
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
    if (!recorder) {
      setError('The recording workspace is still preparing. Try again in a moment.')
      return
    }
    if (pendingAnalysisRef.current.size > 0) {
      setError('Wait for the current take analysis to finish before starting another recording.')
      return
    }
    if (pendingRecognitionRef.current) {
      setError('Wait for on-device recognition to finish or fail before starting another take.')
      return
    }
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
      replayAudioRef.current?.pause()
      simultaneousPlaybackOffsetMsRef.current = 0
      if (interpretingMode === 'consecutive') {
        recordingTakeKeyRef.current = currentSegment.id
        setSkippedSegments((current) => {
          const next = new Set(current)
          next.delete(currentSegment.id)
          return next
        })
        await recorder.start(currentSegment.id, interpretingMode)
        const startedState = dispatchTranscriptCapture({ type: 'take-started', segmentIds: [currentSegment.id] })
        recordingTakeGenerationRef.current = startedState.takeGeneration
      } else {
        if (!player) {
          throw new Error('The source audio player is still preparing. Try again in a moment.')
        }
        await startSimultaneousTake({
          startRecorder: () => recorder.start(undefined, 'simultaneous'),
          beginTake: () => {
            const previousState = transcriptCaptureRef.current
            const startedState = dispatchTranscriptCapture({
              type: 'take-started',
              segmentIds: exercise.segments.map((segment) => segment.id),
            })
            recordingTakeKeyRef.current = 'continuous'
            recordingTakeGenerationRef.current = startedState.takeGeneration
            return { previousState, takeGeneration: startedState.takeGeneration }
          },
          playSource: () => player.playAllSegments(),
          stopRecorder: () => recorder.stop(),
          discardTake: () => {
            player.pause()
            recordingTakeKeyRef.current = undefined
            recordingTakeGenerationRef.current = undefined
            simultaneousPlaybackOffsetMsRef.current = 0
          },
          rollbackTake: (snapshot) => {
            dispatchTranscriptCapture({
              type: 'take-start-failed',
              takeGeneration: snapshot.takeGeneration,
              previousState: snapshot.previousState,
            })
          },
        })
        simultaneousPlaybackOffsetMsRef.current = Math.max(0, recorder.getElapsedMs() - player.getCurrentTime() * 1000)
      }
    } catch (caught) {
      if (interpretingMode === 'simultaneous') {
        recordingTakeKeyRef.current = undefined
        recordingTakeGenerationRef.current = undefined
      }
      recordingTakeKeyRef.current = undefined
      recordingTakeGenerationRef.current = undefined
      setError(caught instanceof Error ? caught.message : 'The microphone could not start.')
    }
  }

  async function handleFinalizedRecording(recording: AudioRecordingRecord) {
    const key = recordingTakeKeyRef.current
    if (!key) {
      return
    }
    recordingTakeKeyRef.current = undefined
    const takeGeneration = recordingTakeGenerationRef.current
    recordingTakeGenerationRef.current = undefined
    if (takeGeneration !== undefined) {
      dispatchTranscriptCapture({ type: 'recording-finalized', takeGeneration })
    }
    pendingAnalysisRef.current.add(key)
    setPendingAnalysisKeys(new Set(pendingAnalysisRef.current))
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
      setDeliveryByTake((current) => ({ ...current, [key]: { ...createFallbackAnalysis(recording.durationMs), recordingId: recording.id } }))
      setError('The take was saved, but local delivery analysis was unavailable. The feedback will say so.')
    } finally {
      pendingAnalysisRef.current.delete(key)
      setPendingAnalysisKeys(new Set(pendingAnalysisRef.current))
    }
  }

  async function stopRecording() {
    setError(undefined)
    player?.pause()
    if (!recorder) {
      setError('The recording workspace is still preparing. Try again in a moment.')
      return
    }
    try {
      const recording = await recorder.stop()
      if (!recording && recorderState.status !== 'recording' && recorderState.status !== 'paused') {
        recordingTakeKeyRef.current = undefined
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The recording could not be saved.')
    }
  }

  function pauseRecording() {
    if (interpretingMode === 'simultaneous') {
      player?.pause()
    }
    recorder?.pause()
  }

  async function resumeRecording() {
    if (!recorder) {
      setError('The recording workspace is still preparing. Try again in a moment.')
      return
    }
    if (interpretingMode === 'simultaneous' && player && player.getCurrentTime() * 1000 < exercise.durationMs - 20) {
      try {
        await player.resume()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The source audio could not resume.')
        return
      }
    }
    recorder.resume()
  }

  function discardCurrentTake() {
    if (interpretingMode === 'simultaneous') {
      simultaneousPlaybackOffsetMsRef.current = 0
    }
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
    dispatchTranscriptCapture({ type: 'take-discarded', segmentIds: discardedSegments })
    if (pendingRecognitionRef.current && discardedSegments.includes(pendingRecognitionRef.current.segmentId)) {
      pendingRecognitionRef.current = undefined
    }
  }

  async function captureLocalTranscript() {
    if (pendingRecognitionRef.current) {
      return
    }
    const track = recorder?.getActiveTrack()
    if (!track) {
      setError('Start recording before requesting the optional on-device transcript.')
      return
    }
    setError(undefined)
    const targetSegmentId = recordingTakeKeyRef.current && recordingTakeKeyRef.current !== 'continuous' ? recordingTakeKeyRef.current : currentSegment.id
    const attempt = {
      id: ++recognitionAttemptIdRef.current,
      takeGeneration: transcriptCaptureRef.current.takeGeneration,
      segmentId: targetSegmentId,
    }
    pendingRecognitionRef.current = attempt
    dispatchTranscriptCapture({ type: 'recognition-started', attempt })
    try {
      const result = await recognizeLocal(track, targetLanguage.speechTag, targetSegmentId)
      dispatchTranscriptCapture({ type: 'recognition-succeeded', attempt, result })
    } catch (caught) {
      if (isCurrentRecognitionAttempt(transcriptCaptureRef.current, attempt)) {
        dispatchTranscriptCapture({ type: 'recognition-failed', attempt })
        setError(caught instanceof Error ? caught.message : 'On-device recognition was unavailable. Use the manual transcript.')
      }
    } finally {
      if (pendingRecognitionRef.current?.id === attempt.id) {
        pendingRecognitionRef.current = undefined
      }
    }
  }

  function updateManualTranscript(segmentId: string, transcript: string) {
    dispatchTranscriptCapture({ type: 'manual-edited', segmentId, transcript })
    if (pendingRecognitionRef.current?.segmentId === segmentId) {
      pendingRecognitionRef.current = undefined
    }
  }

  function confirmTranscript(segmentId: string) {
    if (!transcripts[segmentId]?.trim() || transcriptSources[segmentId] !== 'on-device') return
    dispatchTranscriptCapture({ type: 'transcript-confirmed', segmentId })
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
      const restoredResponse = initialInput?.responseSegments.find((response) => response.sourceSegmentId === segment.id)
      const responseRange = interpretingMode === 'simultaneous'
        ? resolveSimultaneousResponseRange({
            segment,
            recordingId: recording?.id,
            recordingDurationMs: recording?.durationMs ?? 0,
            playbackOffsetMs: simultaneousPlaybackOffsetMsRef.current,
            restoredResponse,
          })
        : { responseStartMs: 0, responseEndMs: recording?.durationMs ?? 0 }
      return {
        id: `${exercise.id}-response-${segment.id}`,
        sourceSegmentId: segment.id,
        recordingId: skipped ? undefined : recording?.id,
        ...responseRange,
        transcript: transcripts[segment.id] ?? '',
        transcriptSource: transcriptSources[segment.id] ?? 'manual',
        recognitionStatus: skipped ? 'unavailable' : recognitionStatuses[segment.id] ?? (transcripts[segment.id]?.trim() ? 'verified' : 'uncertain'),
        recognitionConfidence: recognitionConfidences[segment.id],
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
    if (pendingAnalysisRef.current.size > 0) {
      setError('Wait for the take analysis to finish before submitting. If analysis is unavailable, a limited-confidence fallback is saved first.')
      return
    }
    if (pendingRecognitionRef.current) {
      setError('Wait for on-device recognition to finish or fail before submitting.')
      return
    }
    const input = buildInput()
    if (input) {
      onSubmit(input)
    }
  }

  function saveSelfReview() {
    if (isSubmitting || selfReviewStartedRef.current || ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status)) {
      return
    }
    if (pendingAnalysisRef.current.size > 0) {
      setError('Wait for the take analysis to finish before saving this self-review.')
      return
    }
    if (pendingRecognitionRef.current) {
      setError('Wait for on-device recognition to finish or fail before saving this self-review.')
      return
    }
    const input = buildInput()
    if (input) {
      selfReviewStartedRef.current = true
      onSaveSelfReview(input)
    }
  }

  const progress = currentSegment ? ((playerState.currentTimeSeconds - currentSegment.startMs / 1000) / Math.max(0.1, (currentSegment.endMs - currentSegment.startMs) / 1000)) * 100 : 0
  const canRecord = interpretingMode === 'simultaneous' || listenedSegments.has(currentSegment.id)
  const allSegmentsReady = !recorderBusy && pendingAnalysisKeys.size === 0 && pendingRecognitionSegmentId === undefined && exercise.segments.every((segment) => (interpretingMode === 'simultaneous' ? takes.continuous : takes[segment.id]) || skippedSegments.has(segment.id))

  useNativeBack(() => {
    if (isSubmitting) return
    const unsaved = recorderBusy || Object.keys(takes).length > 0 || Object.values(transcripts).some(text => text.trim())
    if (!unsaved || window.confirm(t('Leave this interpreting take? Unsaved recording and transcript changes will be discarded.'))) onCancel()
  })

  return (
    <div className="interpreting-workspace" aria-label={t("Interpreting practice workspace")} aria-busy={isSubmitting}>
      <header className="interpreting-workspace__header"><div><p className="eyebrow">{interpretingMode === 'consecutive' ? t("Consecutive interpreting") : t("Simultaneous interpreting")}</p><h2>{exercise.title}</h2><p>{sourceLanguage.nativeLabel} → {targetLanguage.nativeLabel} · {exercise.segments.length}{t(" authored segments · ")}{isImportedSource ? t("source audio stays local to this browser") : t("source audio stays same-origin")}</p>{exercise.sourceAudioDisclosure && <p className="interpreting-helper" role="note">{t("Source-audio limitation: ")}{exercise.sourceAudioDisclosure}</p>}</div><button className="text-button interpreting-text-action" type="button" onClick={onCancel} disabled={isSubmitting} aria-disabled={isSubmitting}>{t("Leave desk")}</button></header>
      {(error || recorderState.error) && <p className="interpreting-notice" role="alert">{t(error ?? recorderState.error)}</p>}
      {notice && <p className="interpreting-helper" role="status">{t(notice)}</p>}
      <div className="interpreting-columns">
        <aside className="interpreting-segment-rail" aria-label={t("Source segments")}><p className="eyebrow">{t("Segments")}</p>{exercise.segments.map((segment, index) => <button className={`interpreting-segment-button ${index === segmentIndex ? 'interpreting-segment-button--active' : ''}`} type="button" key={segment.id} disabled={isSubmitting || recorderBusy || pendingRecognitionSegmentId !== undefined} onClick={() => { listenTargetSegmentRef.current = undefined; setSegmentIndex(index); player?.pause() }}><span>{index + 1}</span><span>{formatSeconds((segment.endMs - segment.startMs) / 1000)}</span><small>{takes[segment.id] || takes.continuous ? t("Take saved") : skippedSegments.has(segment.id) ? t("Skipped") : t("Not recorded")}</small></button>)}</aside>
        <section className="interpreting-source-card" aria-labelledby="source-heading">
          <div className="interpreting-card-heading"><div><p className="eyebrow">{t("Source audio")}</p><h3 id="source-heading">{currentSegment.id}</h3></div><span className="pill">{formatSeconds(currentSegment.startMs / 1000)}–{formatSeconds(currentSegment.endMs / 1000)}</span></div>
          <p className="interpreting-source-transcript" dir={sourceLanguage.direction} lang={sourceLanguage.code}>{currentSegment.transcript || 'No source transcript supplied; delivery-only feedback remains available.'}</p>
          <div className="interpreting-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
          <p className="interpreting-time" aria-live="polite">{formatSeconds(playerState.currentTimeSeconds)} / {formatSeconds(currentSegment.endMs / 1000)}</p>
          <div className="interpreting-native-source-player" ref={sourceAudioHost} aria-label={t("Native source audio controls")} hidden={interpretingMode === 'consecutive'} />
          <div className="interpreting-control-row"><button className="button button--primary interpreting-action" type="button" onClick={() => void playCurrentSegment()} disabled={!player || recorderBusy}>{playerState.isPlaying ? t("Playing…") : t("Play segment")} <span aria-hidden="true">▶</span></button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.pause()} disabled={recorderBusy}>{t("Pause")}</button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.seek(Math.max(currentSegment.startMs / 1000, playerState.currentTimeSeconds - 2))} disabled={recorderBusy}>−2s</button><button className="button button--quiet interpreting-action" type="button" onClick={() => player?.seek(Math.min(currentSegment.endMs / 1000, playerState.currentTimeSeconds + 2))} disabled={recorderBusy}>+2s</button></div>
          <label className="interpreting-toggle"><input type="checkbox" checked={repeatSegment} disabled={recorderBusy} onChange={(event) => { setRepeatSegment(event.target.checked); player?.setRepeat(event.target.checked) }} />{t(" Repeat this segment")}</label>
          <p className="interpreting-helper">{t("Listen before recording in consecutive mode. The source audio is not uploaded by this workspace.")}</p>
        </section>
        <section className="interpreting-response-card" aria-labelledby="response-heading">
          <div className="interpreting-card-heading"><div><p className="eyebrow">{t("Your delivery")}</p><h3 id="response-heading">{currentTake ? t("Take ready for review") : recorderState.status === 'recording' ? t("Recording now") : t("Prepare your response")}</h3></div><span className={`interpreting-recording-indicator interpreting-recording-indicator--${recorderState.status}`} role="status">{recorderState.status === 'recording' ? t("● Recording") : recorderState.status}</span></div>
          <div className="interpreting-meter" aria-label={t("Microphone input level {0} percent", Math.round(recorderState.inputLevel * 100))}><span style={{ width: `${Math.round(recorderState.inputLevel * 100)}%` }} /></div>
          <p className="interpreting-time">{formatSeconds(recorderState.elapsedMs / 1000)}{t(" · local microphone only")}</p>
          <div className="interpreting-control-row"><button className="button button--primary interpreting-action" type="button" onClick={() => void startRecording()} disabled={!recorder || isSubmitting || pendingAnalysisKeys.size > 0 || pendingRecognitionSegmentId !== undefined || ['requesting', 'recording', 'paused', 'stopping'].includes(recorderState.status) || !canRecord}>{recorderState.status === 'requesting' ? t("Waiting for microphone…") : interpretingMode === 'consecutive' && !canRecord ? t("Listen first") : t("Start recording")} <span aria-hidden="true">●</span></button><button className="button button--quiet interpreting-action" type="button" onClick={() => void stopRecording()} disabled={!recorder || (recorderState.status !== 'recording' && recorderState.status !== 'paused')}>{t("Stop and save")}</button><button className="button button--quiet interpreting-action" type="button" onClick={pauseRecording} disabled={!recorder || recorderState.status !== 'recording'}>{interpretingMode === 'simultaneous' ? t("Pause source and response") : t("Pause")}</button><button className="button button--quiet interpreting-action" type="button" onClick={() => void resumeRecording()} disabled={!recorder || recorderState.status !== 'paused'}>{interpretingMode === 'simultaneous' ? t("Resume source and response") : t("Resume")}</button></div>
          {currentReplayUrl && <div className="interpreting-replay"><strong>{t("Replay this take")}</strong><audio ref={replayAudioRef} controls={!recorderBusy} preload="metadata" src={currentReplayUrl}>{t("Your browser cannot replay this local take.")}</audio><button className="text-button interpreting-text-action" type="button" onClick={discardCurrentTake} disabled={recorderBusy || pendingRecognitionSegmentId !== undefined || pendingAnalysisKeys.has(currentTakeKey)}>{t("Discard and rerecord")}</button></div>}
          <div className="interpreting-transcript-block"><div className="interpreting-card-heading"><strong>{t("Editable response transcript")}</strong><span className="pill">{recognition?.status === 'available' ? t("Optional on-device recognition") : t("Manual path")}</span></div><textarea dir={targetLanguage.direction} lang={targetLanguage.code} value={transcripts[currentSegment.id] ?? ''} onChange={(event) => updateManualTranscript(currentSegment.id, event.target.value)} placeholder={t("Type or confirm what you delivered…")} aria-label={t("Transcript for {0}", currentSegment.id)} disabled={isSubmitting} /><div className="interpreting-control-row"><button className="button button--quiet interpreting-action" type="button" onClick={() => void captureLocalTranscript()} disabled={isSubmitting || recorderState.status !== 'recording' || recognition?.status !== 'available' || pendingRecognitionSegmentId !== undefined}>{pendingRecognitionSegmentId === currentSegment.id ? t("Recognizing on this device…") : t("Capture on-device transcript")}</button>{transcriptSources[currentSegment.id] === 'on-device' && recognitionStatuses[currentSegment.id] !== 'verified' && <button className="button button--quiet interpreting-action" type="button" onClick={() => confirmTranscript(currentSegment.id)} disabled={isSubmitting || !transcripts[currentSegment.id]?.trim()}>{t("Confirm transcript")}</button>}<span className="interpreting-confidence">{transcriptSources[currentSegment.id] === 'on-device' && recognitionStatuses[currentSegment.id] !== 'verified' ? t("Unconfirmed on-device transcript{0}. Confirm or edit before it counts as content evidence.", recognitionConfidences[currentSegment.id] === undefined ? '' : ` · confidence estimate ${Math.round(recognitionConfidences[currentSegment.id] * 100)}%`) : recognitionStatuses[currentSegment.id] === 'uncertain' ? t("Recognition may be wrong — check it.") : transcriptSources[currentSegment.id] === 'on-device' ? t("You confirmed this on-device transcript; its confidence remains an estimate.") : t("Manual text is treated as learner-confirmed evidence.")}</span></div></div>
          <label className="interpreting-toggle"><input type="checkbox" checked={skippedSegments.has(currentSegment.id)} disabled={isSubmitting || recorderBusy || Boolean(currentTake)} onChange={(event) => setSkippedSegments((current) => { const next = new Set(current); if (event.target.checked) next.add(currentSegment.id); else next.delete(currentSegment.id); return next })} />{t(" I am skipping this segment")}</label>
        </section>
      </div>
      <footer className="interpreting-workspace__footer"><p>{interpretingMode === 'simultaneous' ? t("Continuous takes use approximate segment boundaries; word-level alignment is not fabricated.") : t("Each saved take is tied to its authored source segment.")}{t(" Recordings stay in memory until you submit or save a self-review.")}{pendingAnalysisKeys.size > 0 && <span role="status">{t(" Preparing local delivery analysis…")}</span>}</p><div className="interpreting-control-row interpreting-submit-actions"><button className="button button--primary interpreting-action" type="button" onClick={submit} disabled={isSubmitting || !allSegmentsReady}>{isSubmitting ? t("Preparing feedback…") : t("Submit for practice feedback")} <span aria-hidden="true">→</span></button><button className="button button--quiet interpreting-action" type="button" onClick={saveSelfReview} disabled={isSubmitting || !allSegmentsReady}>{t("Save self-review without a score")}</button></div></footer>
    </div>
  )
}

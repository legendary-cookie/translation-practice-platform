import { t } from '../../i18n'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CHINESE_DIRECTIONS, getLanguage } from '../../domain/languages'
import { createImportedAudioExercise, hasUnsupportedDeclaredAudioMime, importedTranscriptReducer, inferImportedAudioMime } from './audio-import'
import type { AudioRecordingRecord, Difficulty, EvaluationMode, InterpretingExercise, InterpretingMode, LocalModelStatus } from '../../domain/types'
import { getInterpretingExercisesForDirection, INTERPRETING_EXERCISES } from '../../data/interpreting-exercises'
import { validateInterpretingRightsManifest } from '../../data/interpreting-rights'
import { getLocalRecognitionCapabilityWithTimeout, installLocalRecognitionLanguage, type LocalRecognitionCapability } from '../../audio/local-speech-recognition'
import { requestWithDeadline } from './request-with-deadline'
import { isPackagedAudioOfflineReady } from './offline-asset-status'
import { fetchAudioBlobWithDeadline } from './audio-asset-requests'
import { loadImportedAudioMetadata } from './audio-import-metadata'

export type InterpretingStart = {
  exercise: InterpretingExercise
  interpretingMode: InterpretingMode
  sourceRecording?: AudioRecordingRecord
}

type ImportedSource = {
  exercise: InterpretingExercise
  recording: AudioRecordingRecord
  objectUrl: string
}

async function hasCachedAudioAsset(audioUrl: string): Promise<boolean> {
  if (!('caches' in window)) {
    return false
  }
  try {
    return Boolean(await window.caches.match(new URL(audioUrl, window.location.href).href))
  } catch {
    return false
  }
}

async function getPackagedAudioStatus(audioUrl: string, signal?: AbortSignal): Promise<'ready' | 'available' | 'unavailable'> {
  const waitForControl = async () => {
    if (!('serviceWorker' in navigator)) return false
    if (navigator.serviceWorker.controller) return true
    return new Promise<boolean>((resolve) => {
      let settled = false
      let timeout: number | undefined
      const finish = (controlled: boolean) => {
        if (settled) return
        settled = true
        if (timeout !== undefined) window.clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        resolve(controlled)
      }
      const onControllerChange = () => {
        if (navigator.serviceWorker.controller) finish(true)
      }
      timeout = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), 1500)
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      void navigator.serviceWorker.ready.then(() => onControllerChange(), () => undefined)
    })
  }

  if (await hasCachedAudioAsset(audioUrl)) {
    const controlled = await waitForControl()
    return isPackagedAudioOfflineReady(true, controlled) ? 'ready' : 'available'
  }

  if ('serviceWorker' in navigator) {
    await waitForControl()
    if (await hasCachedAudioAsset(audioUrl)) {
      return isPackagedAudioOfflineReady(true, Boolean(navigator.serviceWorker.controller)) ? 'ready' : 'available'
    }
  }

  try {
    await fetchAudioBlobWithDeadline(audioUrl, { parentSignal: signal })
    const cached = await hasCachedAudioAsset(audioUrl)
    const controlled = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)
    return isPackagedAudioOfflineReady(cached, controlled) ? 'ready' : 'available'
  } catch {
    return 'unavailable'
  }
}

function createLocalId(prefix: string): string {
  return typeof crypto.randomUUID === 'function' ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`
}

export function InterpretingSetup({
  evaluationMode,
  localStatus,
  onStart,
}: {
  evaluationMode: EvaluationMode
  localStatus: LocalModelStatus
  onStart: (selection: InterpretingStart) => void
}) {
  const [directionId, setDirectionId] = useState(CHINESE_DIRECTIONS[0].id)
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all')
  const [interpretingMode, setInterpretingMode] = useState<InterpretingMode>('consecutive')
  const [assetStatus, setAssetStatus] = useState<'checking' | 'ready' | 'available' | 'unavailable'>('checking')
  const [rightsStatus, setRightsStatus] = useState<'checking' | 'verified' | 'unavailable'>('checking')
  const [rightsError, setRightsError] = useState<string>()
  const [rightsRetry, setRightsRetry] = useState(0)
  const [assetRetry, setAssetRetry] = useState(0)
  const [recognition, setRecognition] = useState<LocalRecognitionCapability>()
  const [isInstallingRecognition, setIsInstallingRecognition] = useState(false)
  const [importedSource, setImportedSource] = useState<ImportedSource>()
  const [importedTranscript, dispatchImportedTranscript] = useReducer(importedTranscriptReducer, '')
  const [importError, setImportError] = useState<string>()
  const transferredObjectUrl = useRef<string | undefined>(undefined)
  const localAudioImportGeneration = useRef(0)
  const recognitionCheckGeneration = useRef(0)
  const direction = CHINESE_DIRECTIONS.find((item) => item.id === directionId) ?? CHINESE_DIRECTIONS[0]
  const sourceLanguage = getLanguage(direction.sourceLanguage)
  const exercises = useMemo(
    () => getInterpretingExercisesForDirection(direction.sourceLanguage, direction.targetLanguage),
    [direction.sourceLanguage, direction.targetLanguage],
  )
  const availableDifficulties = useMemo(() => new Set(exercises.map((exercise) => exercise.difficulty)), [exercises])
  const packagedExercise = exercises.find((candidate) => difficulty === 'all' || candidate.difficulty === difficulty) ?? exercises[0]
  const exercise = importedSource?.exercise ?? packagedExercise
  const importedObjectUrl = importedSource?.objectUrl
  const exerciseAudioUrl = exercise?.audioUrl
  const targetSpeechTag = exercise ? getLanguage(exercise.targetLanguage).speechTag : undefined
  const isImportedAudio = importedSource !== undefined

  useEffect(() => {
    const objectUrl = importedObjectUrl
    return () => {
      if (objectUrl && transferredObjectUrl.current !== objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [importedObjectUrl])

  useEffect(() => () => {
    localAudioImportGeneration.current += 1
    recognitionCheckGeneration.current += 1
  }, [])

  function changeDirection(nextDirectionId: typeof directionId) {
    localAudioImportGeneration.current += 1
    recognitionCheckGeneration.current += 1
    setIsInstallingRecognition(false)
    setDirectionId(nextDirectionId)
    setDifficulty('all')
    setRecognition(undefined)
    setImportedSource(undefined)
    dispatchImportedTranscript({ type: 'replace-audio' })
    setImportError(undefined)
  }

  async function importLocalAudio(file: File | undefined) {
    if (!file) {
      return
    }
    const importGeneration = ++localAudioImportGeneration.current
    recognitionCheckGeneration.current += 1
    setIsInstallingRecognition(false)
    setImportedSource(undefined)
    dispatchImportedTranscript({ type: 'replace-audio' })
    setRecognition(undefined)
    setAssetStatus('checking')
    setImportError(undefined)
    if (hasUnsupportedDeclaredAudioMime(file.type)) {
      setImportError('Choose an audio file. The browser will keep the imported source on this device.')
      setAssetStatus('unavailable')
      return
    }
    const importedMimeType = inferImportedAudioMime(file.type, file.name)
    let objectUrl: string | undefined
    try {
      const metadata = await loadImportedAudioMetadata(file)
      objectUrl = metadata.objectUrl
      if (importGeneration !== localAudioImportGeneration.current) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      const exerciseId = createLocalId('local-audio')
      const segmentId = `${exerciseId}-segment-1`
      const importedExercise = createImportedAudioExercise({
        id: exerciseId,
        sourceLanguage: direction.sourceLanguage,
        targetLanguage: direction.targetLanguage,
        title: file.name.replace(/\.[^/.]+$/, '') || 'Imported local audio',
        difficulty: difficulty === 'all' ? 'intermediate' : difficulty,
        audioUrl: objectUrl,
        audioMimeType: importedMimeType || 'audio/*',
        durationMs: metadata.durationMs,
      })
      setImportedSource({
        exercise: importedExercise,
        objectUrl,
        recording: {
          id: `${exerciseId}-source`,
          exerciseId,
          segmentIds: [segmentId],
          createdAt: new Date().toISOString(),
          mimeType: importedMimeType || 'application/octet-stream',
          durationMs: metadata.durationMs,
          byteLength: file.size,
          blob: file,
          kind: 'source-import',
          fileName: file.name,
        },
      })
      setAssetStatus('ready')
      objectUrl = undefined
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (importGeneration === localAudioImportGeneration.current) {
        setImportError(error instanceof Error ? error.message : 'The selected audio file could not be imported.')
        setAssetStatus('unavailable')
      }
    }
  }

  function updateImportedTranscript(value: string) {
    dispatchImportedTranscript({ type: 'edit', value })
    setImportedSource((current) => current ? {
      ...current,
      exercise: {
        ...current.exercise,
        sourceTranscriptStatus: value.trim() ? 'authored' : 'missing',
        segments: current.exercise.segments.map((segment) => ({ ...segment, transcript: value })),
      },
    } : current)
  }

  useEffect(() => {
    let cancelled = false
    const requestController = new AbortController()
    setAssetStatus('checking')
    if (!exerciseAudioUrl) {
      setAssetStatus('unavailable')
      return () => {
        cancelled = true
        requestController.abort()
      }
    }
    if (isImportedAudio) {
      setAssetStatus('ready')
      return () => {
        cancelled = true
        requestController.abort()
      }
    }
    void getPackagedAudioStatus(exerciseAudioUrl, requestController.signal).then((assetAvailability) => {
      if (!cancelled) {
        setAssetStatus(assetAvailability)
      }
    }).catch(() => {
      if (!cancelled) {
        setAssetStatus('unavailable')
      }
    })
    return () => {
      cancelled = true
      requestController.abort()
    }
  }, [exerciseAudioUrl, isImportedAudio, assetRetry])

  useEffect(() => {
    let cancelled = false
    const requestController = new AbortController()
    setRightsStatus('checking')
    setRightsError(undefined)
    void requestWithDeadline(async (signal) => {
      const response = await fetch('/audio/interpreting/rights.json', { cache: 'no-cache', signal })
      if (!response.ok) {
        throw new Error(`The packaged audio rights manifest returned HTTP ${response.status}.`)
      }
      const manifest: unknown = await response.json()
      const issues = validateInterpretingRightsManifest(INTERPRETING_EXERCISES, manifest)
      if (issues.length > 0) {
        throw new Error(issues.slice(0, 3).join(' '))
      }
      return true
    },
      12_000,
      'The packaged audio rights check timed out. Retry the check.',
      requestController.signal,
    ).then(() => {
      if (!cancelled) setRightsStatus('verified')
    }).catch((caught: unknown) => {
      if (cancelled) return
      setRightsError(caught instanceof Error ? caught.message : 'The packaged audio rights metadata could not be checked.')
      setRightsStatus('unavailable')
    })
    return () => {
      cancelled = true
      requestController.abort()
    }
  }, [rightsRetry])

  useEffect(() => {
    let cancelled = false
    const requestGeneration = ++recognitionCheckGeneration.current
    setIsInstallingRecognition(false)
    setRecognition(undefined)
    if (!targetSpeechTag) {
      setRecognition({ status: 'unavailable', languageTag: '', reason: 'On-device recognition is unavailable for this direction. Continue with manual transcript entry.' })
      return () => {
        cancelled = true
      }
    }
    void getLocalRecognitionCapabilityWithTimeout(targetSpeechTag).then((capability) => {
      if (!cancelled && requestGeneration === recognitionCheckGeneration.current) {
        setRecognition(capability)
      }
    }).catch(() => {
      if (!cancelled && requestGeneration === recognitionCheckGeneration.current) {
        setRecognition({ status: 'unavailable', languageTag: targetSpeechTag, reason: 'The local capability check could not complete. Manual transcript entry remains available.' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [targetSpeechTag])

  async function installRecognitionPack() {
    if (!recognition || recognition.status !== 'downloadable' || isInstallingRecognition) {
      return
    }
    const requestGeneration = recognitionCheckGeneration.current
    const languageTag = recognition.languageTag
    setIsInstallingRecognition(true)
    setRecognition({ ...recognition, status: 'downloading', reason: 'Installing the on-device language pack. Learner audio and transcripts are not part of this download.' })
    try {
      const capability = await installLocalRecognitionLanguage(languageTag)
      if (requestGeneration === recognitionCheckGeneration.current) {
        setRecognition(capability)
      }
    } finally {
      if (requestGeneration === recognitionCheckGeneration.current) {
        setIsInstallingRecognition(false)
      }
    }
  }

  const statusText = localStatus === 'ready'
    ? 'Local evaluation is ready for transcript and delivery metrics.'
    : evaluationMode === 'local-first-cloud-fallback'
      ? 'Local model unavailable? Cloud fallback requires a separate explicit consent step.'
      : 'Local-only mode keeps audio and transcripts on this device when evaluation is unavailable.'

  return (
    <div className="interpreting-layout">
      <section className="practice-intro">
        <p className="eyebrow">{t("Interpreting setup")}</p>
        <h2>{t("Listen, prepare,")}<br />{t("and deliver.")}</h2>
        <p>{t("Source clips are packaged with this app, and you can import a local audio file for a private practice take. Learner recordings, transcripts, imported bytes, and feedback stay in this browser by default.")}</p>
        <div className="privacy-callout"><span className="privacy-callout__icon">◇</span><span>{t(statusText)}</span></div>
      </section>
      <section className="setup-card interpreting-setup-card" aria-labelledby="interpreting-setup-heading">
        <div className="setup-card__heading"><div><p className="eyebrow">{t("Audio choices")}</p><h2 id="interpreting-setup-heading">{t("Set the conditions.")}</h2></div><span className="setup-card__step">{t("Audio / 01")}</span></div>
        <div className="setup-fields">
          <label className="field-label" htmlFor="interpreting-direction">{t("Language direction")}<select id="interpreting-direction" value={directionId} onChange={(event) => changeDirection(event.target.value as typeof directionId)}>{CHINESE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label>
          <label className="field-label" htmlFor="interpreting-difficulty">{t("Difficulty")}<select id="interpreting-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">{t("Any difficulty")}</option><option value="beginner" disabled={!availableDifficulties.has('beginner')}>{t("Beginner")}</option><option value="intermediate" disabled={!availableDifficulties.has('intermediate')}>{t("Intermediate")}</option><option value="advanced" disabled={!availableDifficulties.has('advanced')}>{t("Advanced")}</option></select></label>
          <label className="field-label" htmlFor="interpreting-mode">{t("Interpreting mode")}<select id="interpreting-mode" value={interpretingMode} onChange={(event) => setInterpretingMode(event.target.value as InterpretingMode)}><option value="consecutive">{t("Consecutive · listen then deliver")}</option><option value="simultaneous">{t("Simultaneous · continuous take")}</option></select></label>
          <label className="field-label" htmlFor="interpreting-local-audio">{t("Import local source audio")}<input id="interpreting-local-audio" type="file" accept="audio/*" onChange={(event) => void importLocalAudio(event.target.files?.[0])} /></label>
        </div>
        {importedSource && <div className="interpreting-local-import"><label className="field-label" htmlFor="interpreting-source-transcript">{t("Source transcript (optional)")}<textarea id="interpreting-source-transcript" dir={sourceLanguage.direction} lang={sourceLanguage.code} value={importedTranscript} onChange={(event) => updateImportedTranscript(event.target.value)} placeholder={t("Add the source transcript to enable content feedback; delivery-only feedback remains available without it.")} /></label><p>{importedSource.recording.fileName} · {importedSource.recording.mimeType} · {(importedSource.recording.byteLength / 1024).toFixed(1)}{t(" KB · ")}{(importedSource.recording.durationMs / 1000).toFixed(1)}{t(" seconds. The file remains local until a completed session is saved.")}</p></div>}
        {importError && <p className="form-message" role="alert">{t(importError)}</p>}
        {exercise ? (
          <div className="selected-exercise interpreting-selected-exercise">
            <div><span className="eyebrow">{t("Selected source clip")}</span><h3>{exercise.title}</h3><p>{getLanguage(exercise.sourceLanguage).nativeLabel} → {getLanguage(exercise.targetLanguage).nativeLabel} · {t(exercise.difficulty)} · {exercise.segments.length}{t(" segments · ")}{(exercise.durationMs / 1000).toFixed(1)}{t(" seconds")}</p></div>
            <span className={`interpreting-asset-status interpreting-asset-status--${assetStatus}`} role="status">{assetStatus === 'ready' ? importedSource ? t("Loaded on this device") : t("Offline-ready") : assetStatus === 'available' ? t("Available now · offline copy not confirmed") : assetStatus === 'checking' ? t("Checking asset…") : t("Asset unavailable")}</span>
          </div>
        ) : <p className="form-message" role="status">{t("No audio exercise matches this direction.")}</p>}
        {!isImportedAudio && exercise && assetStatus === 'unavailable' && <button className="text-button" type="button" onClick={() => setAssetRetry((attempt) => attempt + 1)}>{t("Retry audio availability check")}</button>}
        {!isImportedAudio && <div className="interpreting-rights-status" role={rightsStatus === 'unavailable' ? 'alert' : 'status'}>
          {rightsStatus === 'checking' && <span>{t("Verifying the packaged audio rights record…")}</span>}
          {rightsStatus === 'verified' && <span>{t("Packaged audio paths, durations, formats, and rights records are verified.")}</span>}
          {rightsStatus === 'unavailable' && <><span>{t("Packaged audio rights could not be verified. ")}{t(rightsError)}</span><button className="text-button" type="button" onClick={() => setRightsRetry((attempt) => attempt + 1)}>{t("Retry rights check")}</button></>}
        </div>}
        {exercise?.sourceAudioDisclosure && <p className="interpreting-helper" role="note">{t("Source-audio limitation: ")}{exercise.sourceAudioDisclosure}</p>}
        <div className="interpreting-capability" role="status"><strong>{t("Target recognition")}</strong><span>{recognition?.status === 'available' ? t("On-device option available") : recognition?.status === 'downloadable' ? t("Language pack may be downloadable") : recognition?.status === 'downloading' ? t("Language pack downloading") : t("Manual transcript path")}</span><small>{recognition?.reason ?? 'Checking the browser capability…'}</small>{recognition?.status === 'downloadable' && <button className="button button--quiet interpreting-action" type="button" onClick={() => void installRecognitionPack()} disabled={isInstallingRecognition}>{t("Download on-device language pack")}</button>}</div>
        <button className="button button--primary setup-card__start" type="button" disabled={!exercise || !['ready', 'available'].includes(assetStatus) || (!isImportedAudio && rightsStatus !== 'verified')} onClick={() => { if (!exercise || (!isImportedAudio && rightsStatus !== 'verified')) return; if (importedSource) transferredObjectUrl.current = importedSource.objectUrl; onStart({ exercise, interpretingMode, sourceRecording: importedSource?.recording }) }}>{t("Open interpreting desk ")}<span aria-hidden="true">→</span></button>
        <p className="setup-card__note">{t("Content and delivery feedback are separate practice estimates. Recognition is never treated as official evidence, and unsupported languages remain usable through manual transcript entry. Imported source audio is never sent automatically.")}</p>
      </section>
    </div>
  )
}

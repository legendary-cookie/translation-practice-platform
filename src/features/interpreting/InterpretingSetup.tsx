import { useEffect, useMemo, useRef, useState } from 'react'
import { CHINESE_DIRECTIONS, getLanguage } from '../../domain/languages'
import type { AudioRecordingRecord, Difficulty, EvaluationMode, InterpretingExercise, InterpretingMode, LocalModelStatus } from '../../domain/types'
import { getInterpretingExercisesForDirection } from '../../data/interpreting-exercises'
import { getLocalRecognitionCapability, type LocalRecognitionCapability } from '../../audio/local-speech-recognition'

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

async function getPackagedAudioStatus(audioUrl: string): Promise<'ready' | 'available' | 'unavailable'> {
  if (await hasCachedAudioAsset(audioUrl)) {
    return 'ready'
  }

  if ('serviceWorker' in navigator) {
    await Promise.race([
      navigator.serviceWorker.ready.then(() => undefined, () => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ])
    if (await hasCachedAudioAsset(audioUrl)) {
      return 'ready'
    }
  }

  try {
    const response = await fetch(audioUrl, { cache: 'default' })
    if (!response.ok) {
      return 'unavailable'
    }
    return await hasCachedAudioAsset(audioUrl) ? 'ready' : 'available'
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
  const [recognition, setRecognition] = useState<LocalRecognitionCapability>()
  const [importedSource, setImportedSource] = useState<ImportedSource>()
  const [importedTranscript, setImportedTranscript] = useState('')
  const [importError, setImportError] = useState<string>()
  const transferredObjectUrl = useRef<string | undefined>(undefined)
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

  useEffect(() => {
    const objectUrl = importedObjectUrl
    return () => {
      if (objectUrl && transferredObjectUrl.current !== objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [importedObjectUrl])

  async function importLocalAudio(file: File | undefined) {
    if (!file) {
      return
    }
    setImportError(undefined)
    if (!file.type.startsWith('audio/')) {
      setImportError('Choose an audio file. The browser will keep the imported source on this device.')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const metadataAudio = new Audio()
    metadataAudio.preload = 'metadata'
    try {
      const durationMs = await new Promise<number>((resolve, reject) => {
        metadataAudio.addEventListener('loadedmetadata', () => {
          if (!Number.isFinite(metadataAudio.duration) || metadataAudio.duration <= 0) {
            reject(new Error('The selected audio file has no readable duration.'))
            return
          }
          resolve(Math.round(metadataAudio.duration * 1000))
        }, { once: true })
        metadataAudio.addEventListener('error', () => reject(new Error('The selected audio file could not be decoded in this browser.')), { once: true })
        metadataAudio.src = objectUrl
        metadataAudio.load()
      })
      const exerciseId = createLocalId('local-audio')
      const segmentId = `${exerciseId}-segment-1`
      const importedExercise: InterpretingExercise = {
        id: exerciseId,
        mode: 'interpreting',
        sourceLanguage: direction.sourceLanguage,
        targetLanguage: direction.targetLanguage,
        title: file.name.replace(/\.[^/.]+$/, '') || 'Imported local audio',
        topic: 'Imported local audio',
        difficulty: difficulty === 'all' ? 'intermediate' : difficulty,
        audioUrl: objectUrl,
        audioMimeType: file.type || 'audio/*',
        durationMs,
        segments: [{ id: segmentId, startMs: 0, endMs: durationMs, transcript: importedTranscript.trim() }],
        glossary: [],
        tags: ['general'],
        rightsRecordId: `local-import:${file.name}`,
        sourceTranscriptStatus: importedTranscript.trim() ? 'authored' : 'missing',
      }
      setImportedSource({
        exercise: importedExercise,
        objectUrl,
        recording: {
          id: `${exerciseId}-source`,
          exerciseId,
          segmentIds: [segmentId],
          createdAt: new Date().toISOString(),
          mimeType: file.type || 'application/octet-stream',
          durationMs,
          byteLength: file.size,
          blob: file,
          kind: 'source-import',
          fileName: file.name,
        },
      })
      setAssetStatus('ready')
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      setImportError(error instanceof Error ? error.message : 'The selected audio file could not be imported.')
    } finally {
      metadataAudio.removeAttribute('src')
      metadataAudio.load()
    }
  }

  function updateImportedTranscript(value: string) {
    setImportedTranscript(value)
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
    setAssetStatus('checking')
    setRecognition(undefined)
    if (!exercise) {
      setAssetStatus('unavailable')
      return () => {
        cancelled = true
      }
    }
    const capabilityPromise = getLocalRecognitionCapability(getLanguage(exercise.targetLanguage).speechTag)
    if (importedSource) {
      void capabilityPromise.then((capability) => {
        if (!cancelled) {
          setAssetStatus('ready')
          setRecognition(capability)
        }
      })
      return () => {
        cancelled = true
      }
    }
    void Promise.all([
      getPackagedAudioStatus(exercise.audioUrl),
      capabilityPromise,
    ]).then(([assetAvailability, capability]) => {
      if (!cancelled) {
        setAssetStatus(assetAvailability)
        setRecognition(capability)
      }
    }).catch(() => {
      if (!cancelled) {
        setAssetStatus('unavailable')
        setRecognition({ status: 'unavailable', languageTag: getLanguage(exercise.targetLanguage).speechTag, reason: 'The local capability check could not complete. Manual transcript entry remains available.' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [exercise, importedSource])

  const statusText = localStatus === 'ready'
    ? 'Local evaluation is ready for transcript and delivery metrics.'
    : evaluationMode === 'local-first-cloud-fallback'
      ? 'Local model unavailable? Cloud fallback requires a separate explicit consent step.'
      : 'Local-only mode keeps audio and transcripts on this device when evaluation is unavailable.'

  return (
    <div className="interpreting-layout">
      <section className="practice-intro">
        <p className="eyebrow">Interpreting setup</p>
        <h2>Listen, prepare,<br />and deliver.</h2>
        <p>Source clips are packaged with this app, and you can import a local audio file for a private practice take. Learner recordings, transcripts, imported bytes, and feedback stay in this browser by default.</p>
        <div className="privacy-callout"><span className="privacy-callout__icon">◇</span><span>{statusText}</span></div>
      </section>
      <section className="setup-card interpreting-setup-card" aria-labelledby="interpreting-setup-heading">
        <div className="setup-card__heading"><div><p className="eyebrow">Audio choices</p><h2 id="interpreting-setup-heading">Set the conditions.</h2></div><span className="setup-card__step">Audio / 01</span></div>
        <div className="setup-fields">
          <label className="field-label" htmlFor="interpreting-direction">Language direction<select id="interpreting-direction" value={directionId} onChange={(event) => { setDirectionId(event.target.value as typeof directionId); setDifficulty('all'); setImportedSource(undefined); setImportedTranscript(''); setImportError(undefined) }}>{CHINESE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field-label" htmlFor="interpreting-difficulty">Difficulty<select id="interpreting-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">Any difficulty</option><option value="beginner" disabled={!availableDifficulties.has('beginner')}>Beginner</option><option value="intermediate" disabled={!availableDifficulties.has('intermediate')}>Intermediate</option><option value="advanced" disabled={!availableDifficulties.has('advanced')}>Advanced</option></select></label>
          <label className="field-label" htmlFor="interpreting-mode">Interpreting mode<select id="interpreting-mode" value={interpretingMode} onChange={(event) => setInterpretingMode(event.target.value as InterpretingMode)}><option value="consecutive">Consecutive · listen then deliver</option><option value="simultaneous">Simultaneous · continuous take</option></select></label>
          <label className="field-label" htmlFor="interpreting-local-audio">Import local source audio<input id="interpreting-local-audio" type="file" accept="audio/*" onChange={(event) => void importLocalAudio(event.target.files?.[0])} /></label>
        </div>
        {importedSource && <div className="interpreting-local-import"><label className="field-label" htmlFor="interpreting-source-transcript">Source transcript (optional)<textarea id="interpreting-source-transcript" dir={sourceLanguage.direction} lang={sourceLanguage.code} value={importedTranscript} onChange={(event) => updateImportedTranscript(event.target.value)} placeholder="Add the source transcript to enable content feedback; delivery-only feedback remains available without it." /></label><p>{importedSource.recording.fileName} · {importedSource.recording.mimeType} · {(importedSource.recording.byteLength / 1024).toFixed(1)} KB · {(importedSource.recording.durationMs / 1000).toFixed(1)} seconds. The file remains local until a completed session is saved.</p></div>}
        {importError && <p className="form-message" role="alert">{importError}</p>}
        {exercise ? (
          <div className="selected-exercise interpreting-selected-exercise">
            <div><span className="eyebrow">Selected source clip</span><h3>{exercise.title}</h3><p>{getLanguage(exercise.sourceLanguage).nativeLabel} → {getLanguage(exercise.targetLanguage).nativeLabel} · {exercise.difficulty} · {exercise.segments.length} segments · {(exercise.durationMs / 1000).toFixed(1)} seconds</p></div>
            <span className={`interpreting-asset-status interpreting-asset-status--${assetStatus}`} role="status">{assetStatus === 'ready' ? importedSource ? 'Loaded on this device' : 'Offline-ready' : assetStatus === 'available' ? 'Available now · offline copy not confirmed' : assetStatus === 'checking' ? 'Checking asset…' : 'Asset unavailable'}</span>
          </div>
        ) : <p className="form-message" role="status">No audio exercise matches this direction.</p>}
        {exercise?.sourceAudioDisclosure && <p className="interpreting-helper" role="note">Source-audio limitation: {exercise.sourceAudioDisclosure}</p>}
        <div className="interpreting-capability" role="status"><strong>Target recognition</strong><span>{recognition?.status === 'available' ? 'On-device option available' : recognition?.status === 'downloadable' ? 'Language pack may be downloadable' : recognition?.status === 'downloading' ? 'Language pack downloading' : 'Manual transcript path'}</span><small>{recognition?.reason ?? 'Checking the browser capability…'}</small></div>
        <button className="button button--primary setup-card__start" type="button" disabled={!exercise || !['ready', 'available'].includes(assetStatus)} onClick={() => { if (!exercise) return; if (importedSource) transferredObjectUrl.current = importedSource.objectUrl; onStart({ exercise, interpretingMode, sourceRecording: importedSource?.recording }) }}>Open interpreting desk <span aria-hidden="true">→</span></button>
        <p className="setup-card__note">Content and delivery feedback are separate practice estimates. Recognition is never treated as official evidence, and unsupported languages remain usable through manual transcript entry. Imported source audio is never sent automatically.</p>
      </section>
    </div>
  )
}

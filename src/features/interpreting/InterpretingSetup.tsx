import { useEffect, useMemo, useState } from 'react'
import { CHINESE_DIRECTIONS, getLanguage } from '../../domain/languages'
import type { Difficulty, EvaluationMode, InterpretingExercise, InterpretingMode, LocalModelStatus } from '../../domain/types'
import { getInterpretingExercisesForDirection } from '../../data/interpreting-exercises'
import { getLocalRecognitionCapability, type LocalRecognitionCapability } from '../../audio/local-speech-recognition'

export type InterpretingStart = {
  exercise: InterpretingExercise
  interpretingMode: InterpretingMode
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
  const [assetStatus, setAssetStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [recognition, setRecognition] = useState<LocalRecognitionCapability>()
  const direction = CHINESE_DIRECTIONS.find((item) => item.id === directionId) ?? CHINESE_DIRECTIONS[0]
  const exercises = useMemo(
    () => getInterpretingExercisesForDirection(direction.sourceLanguage, direction.targetLanguage),
    [direction.sourceLanguage, direction.targetLanguage],
  )
  const availableDifficulties = useMemo(() => new Set(exercises.map((exercise) => exercise.difficulty)), [exercises])
  const exercise = exercises.find((candidate) => difficulty === 'all' || candidate.difficulty === difficulty) ?? exercises[0]

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
    void Promise.all([
      fetch(exercise.audioUrl, { cache: 'default' }).then((response) => response.ok),
      getLocalRecognitionCapability(getLanguage(exercise.targetLanguage).speechTag),
    ]).then(([assetReady, capability]) => {
      if (!cancelled) {
        setAssetStatus(assetReady ? 'ready' : 'unavailable')
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
  }, [exercise])

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
        <p>Source clips are packaged with this app. Learner recordings, transcripts, and feedback stay in this browser by default.</p>
        <div className="privacy-callout"><span className="privacy-callout__icon">◇</span><span>{statusText}</span></div>
      </section>
      <section className="setup-card interpreting-setup-card" aria-labelledby="interpreting-setup-heading">
        <div className="setup-card__heading"><div><p className="eyebrow">Audio choices</p><h2 id="interpreting-setup-heading">Set the conditions.</h2></div><span className="setup-card__step">Audio / 01</span></div>
        <div className="setup-fields">
          <label className="field-label" htmlFor="interpreting-direction">Language direction<select id="interpreting-direction" value={directionId} onChange={(event) => { setDirectionId(event.target.value as typeof directionId); setDifficulty('all') }}>{CHINESE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field-label" htmlFor="interpreting-difficulty">Difficulty<select id="interpreting-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">Any difficulty</option><option value="beginner" disabled={!availableDifficulties.has('beginner')}>Beginner</option><option value="intermediate" disabled={!availableDifficulties.has('intermediate')}>Intermediate</option><option value="advanced" disabled={!availableDifficulties.has('advanced')}>Advanced</option></select></label>
          <label className="field-label" htmlFor="interpreting-mode">Interpreting mode<select id="interpreting-mode" value={interpretingMode} onChange={(event) => setInterpretingMode(event.target.value as InterpretingMode)}><option value="consecutive">Consecutive · listen then deliver</option><option value="simultaneous">Simultaneous · continuous take</option></select></label>
        </div>
        {exercise ? (
          <div className="selected-exercise interpreting-selected-exercise">
            <div><span className="eyebrow">Selected source clip</span><h3>{exercise.title}</h3><p>{getLanguage(exercise.sourceLanguage).nativeLabel} → {getLanguage(exercise.targetLanguage).nativeLabel} · {exercise.difficulty} · {exercise.segments.length} segments · {(exercise.durationMs / 1000).toFixed(1)} seconds</p></div>
            <span className={`interpreting-asset-status interpreting-asset-status--${assetStatus}`} role="status">{assetStatus === 'ready' ? 'Offline-ready' : assetStatus === 'checking' ? 'Checking asset…' : 'Asset unavailable'}</span>
          </div>
        ) : <p className="form-message" role="status">No audio exercise matches this direction.</p>}
        <div className="interpreting-capability" role="status"><strong>Target recognition</strong><span>{recognition?.status === 'available' ? 'On-device option available' : recognition?.status === 'downloadable' ? 'Language pack may be downloadable' : recognition?.status === 'downloading' ? 'Language pack downloading' : 'Manual transcript path'}</span><small>{recognition?.reason ?? 'Checking the browser capability…'}</small></div>
        <button className="button button--primary setup-card__start" type="button" disabled={!exercise || assetStatus !== 'ready'} onClick={() => exercise && onStart({ exercise, interpretingMode })}>Open interpreting desk <span aria-hidden="true">→</span></button>
        <p className="setup-card__note">Content and delivery feedback are separate practice estimates. Recognition is never treated as official evidence, and unsupported languages remain usable through manual transcript entry.</p>
      </section>
    </div>
  )
}

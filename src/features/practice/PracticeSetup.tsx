import { useWorkspacePreferences } from '../settings/AppearanceSettings'
import { useMemo, useState } from 'react'
import { CHINESE_DIRECTIONS, getLanguage } from '../../domain/languages'
import type { Difficulty, Exercise, EvaluationMode, LocalModelStatus, WrittenPracticeMode } from '../../domain/types'
import { getExercisesForDirection } from '../../data/exercises'

export type PracticeStart = {
  exercise: Exercise
  timeLimitSeconds?: number
}

export function PracticeSetup({
  initialMode = 'written',
  evaluationMode,
  localStatus,
  onStart,
}: {
  initialMode?: WrittenPracticeMode
  evaluationMode: EvaluationMode
  localStatus: LocalModelStatus
  onStart: (selection: PracticeStart) => void
}) {
  const { preferences } = useWorkspacePreferences()
  const [exerciseId, setExerciseId] = useState('')
  const [mode, setMode] = useState<WrittenPracticeMode>(initialMode)
  const [directionId, setDirectionId] = useState(preferences.directionId)
  const [topic, setTopic] = useState('all')
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>(preferences.experience)
  const [timing, setTiming] = useState('untimed')
  const direction = CHINESE_DIRECTIONS.find((item) => item.id === directionId) ?? CHINESE_DIRECTIONS[0]

  const directionExercises = useMemo(
    () => getExercisesForDirection(direction.sourceLanguage, direction.targetLanguage, mode),
    [direction.sourceLanguage, direction.targetLanguage, mode],
  )
  const topicOptions = useMemo(() => Array.from(new Set(directionExercises.map((exercise) => exercise.topic))), [directionExercises])
  const availableDifficulties = useMemo(
    () => new Set(directionExercises.map((exercise) => exercise.difficulty)),
    [directionExercises],
  )
  const filteredExercises = directionExercises.filter((exercise) => {
    const matchesTopic = topic === 'all' || exercise.topic === topic
    const matchesDifficulty = difficulty === 'all' || exercise.difficulty === difficulty
    return matchesTopic && matchesDifficulty
  })

  const selectedExercise = filteredExercises.find((exercise) => exercise.id === exerciseId) ?? filteredExercises[0]

  const statusText = localStatus === 'ready'
    ? 'Local evaluation is ready.'
    : evaluationMode === 'local-first-cloud-fallback'
      ? 'Local model unavailable? Cloud fallback will ask for consent per task.'
      : 'Prepare the local model in Settings; local-only mode will not send content to the cloud.'

  return (
    <div className="practice-layout">
      <section className="practice-intro">
        <p className="eyebrow">Practice setup</p>
        <h2>Choose a passage<br />for today.</h2>
        <p>Every passage is original practice content. Change the direction whenever you want to keep the work fresh.</p>
        <div className="privacy-callout"><span className="privacy-callout__icon">◇</span><span>{statusText}</span></div>
      </section>
      <section className="setup-card" aria-labelledby="setup-heading">
        <div className="setup-card__heading"><div><p className="eyebrow">Your choices</p><h2 id="setup-heading">Set the conditions.</h2></div><span className="setup-card__step">01 / 01</span></div>
        <div className="setup-fields">
          <label className="field-label" htmlFor="practice-mode">Practice mode<select id="practice-mode" value={mode} onChange={(event) => { setMode(event.target.value as WrittenPracticeMode); setTopic('all'); setDifficulty('all') }}><option value="written">Written translation</option><option value="news">News translation</option></select></label>
          <label className="field-label" htmlFor="practice-direction">Language direction<select id="practice-direction" value={directionId} onChange={(event) => { setDirectionId(event.target.value as typeof directionId); setTopic('all'); setDifficulty('all') }}>{CHINESE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field-label" htmlFor="practice-topic">Topic<select id="practice-topic" value={topic} onChange={(event) => { setTopic(event.target.value); setDifficulty('all') }}><option value="all">All topics</option>{topicOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field-label" htmlFor="practice-difficulty">Difficulty<select id="practice-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">Any difficulty</option><option value="beginner" disabled={!availableDifficulties.has('beginner')}>Beginner</option><option value="intermediate" disabled={!availableDifficulties.has('intermediate')}>Intermediate</option><option value="advanced" disabled={!availableDifficulties.has('advanced')}>Advanced</option></select></label>
          <label className="field-label" htmlFor="practice-timing">Timing<select id="practice-timing" value={timing} onChange={(event) => setTiming(event.target.value)}><option value="untimed">Untimed</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label>
        </div>
        <label className="field-label passage-picker">Passage<select value={selectedExercise?.id ?? ''} onChange={(event) => setExerciseId(event.target.value)} disabled={!filteredExercises.length}>{filteredExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.title} · {exercise.difficulty}</option>)}</select></label>
        {selectedExercise ? <div className="selected-exercise"><div><span className="eyebrow">Selected passage</span><h3>{selectedExercise.title}</h3><p>{getLanguage(selectedExercise.sourceLanguage).nativeLabel} → {getLanguage(selectedExercise.targetLanguage).nativeLabel} · {selectedExercise.difficulty}</p></div><span className="selected-exercise__tag">{mode === 'news' ? 'News style' : 'General'}</span></div> : <p className="form-message" role="status">No passage matches these filters. Choose another difficulty or topic.</p>}
        <button className="button button--primary setup-card__start" type="button" disabled={!selectedExercise} onClick={() => selectedExercise && onStart({ exercise: selectedExercise, timeLimitSeconds: timing === 'untimed' ? undefined : Number(timing) * 60 })}>Open translation desk <span aria-hidden="true">→</span></button>
        <p className="setup-card__note">Feedback is always labeled a practice estimate, never an official CATTI or MTI result.</p>
      </section>
    </div>
  )
}

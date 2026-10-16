import { t } from '../../i18n'
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
        <p className="eyebrow">{t("Practice setup")}</p>
        <h2>{t("Choose a passage")}<br />{t("for today.")}</h2>
        <p>{t("Every passage is original practice content. Change the direction whenever you want to keep the work fresh.")}</p>
        <div className="privacy-callout"><span className="privacy-callout__icon">◇</span><span>{t(statusText)}</span></div>
      </section>
      <section className="setup-card" aria-labelledby="setup-heading">
        <div className="setup-card__heading"><div><p className="eyebrow">{t("Your choices")}</p><h2 id="setup-heading">{t("Set the conditions.")}</h2></div><span className="setup-card__step">01 / 01</span></div>
        <div className="setup-fields">
          <label className="field-label" htmlFor="practice-mode">{t("Practice mode")}<select id="practice-mode" value={mode} onChange={(event) => { setMode(event.target.value as WrittenPracticeMode); setTopic('all'); setDifficulty('all') }}><option value="written">{t("Written translation")}</option><option value="news">{t("News translation")}</option></select></label>
          <label className="field-label" htmlFor="practice-direction">{t("Language direction")}<select id="practice-direction" value={directionId} onChange={(event) => { setDirectionId(event.target.value as typeof directionId); setTopic('all'); setDifficulty('all') }}>{CHINESE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label>
          <label className="field-label" htmlFor="practice-topic">{t("Topic")}<select id="practice-topic" value={topic} onChange={(event) => { setTopic(event.target.value); setDifficulty('all') }}><option value="all">{t("All topics")}</option>{topicOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field-label" htmlFor="practice-difficulty">{t("Difficulty")}<select id="practice-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'all' | Difficulty)}><option value="all">{t("Any difficulty")}</option><option value="beginner" disabled={!availableDifficulties.has('beginner')}>{t("Beginner")}</option><option value="intermediate" disabled={!availableDifficulties.has('intermediate')}>{t("Intermediate")}</option><option value="advanced" disabled={!availableDifficulties.has('advanced')}>{t("Advanced")}</option></select></label>
          <label className="field-label" htmlFor="practice-timing">{t("Timing")}<select id="practice-timing" value={timing} onChange={(event) => setTiming(event.target.value)}><option value="untimed">{t("Untimed")}</option><option value="10">{t("10 minutes")}</option><option value="20">{t("20 minutes")}</option><option value="30">{t("30 minutes")}</option></select></label>
        </div>
        <label className="field-label passage-picker">{t("Passage")}<select value={selectedExercise?.id ?? ''} onChange={(event) => setExerciseId(event.target.value)} disabled={!filteredExercises.length}>{filteredExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.title} · {t(exercise.difficulty)}</option>)}</select></label>
        {selectedExercise ? <div className="selected-exercise"><div><span className="eyebrow">{t("Selected passage")}</span><h3>{selectedExercise.title}</h3><p>{getLanguage(selectedExercise.sourceLanguage).nativeLabel} → {getLanguage(selectedExercise.targetLanguage).nativeLabel} · {t(selectedExercise.difficulty)}</p></div><span className="selected-exercise__tag">{mode === 'news' ? t("News style") : t("General")}</span></div> : <p className="form-message" role="status">{t("No passage matches these filters. Choose another difficulty or topic.")}</p>}
        <button className="button button--primary setup-card__start" type="button" disabled={!selectedExercise} onClick={() => selectedExercise && onStart({ exercise: selectedExercise, timeLimitSeconds: timing === 'untimed' ? undefined : Number(timing) * 60 })}>{t("Open translation desk ")}<span aria-hidden="true">→</span></button>
        <p className="setup-card__note">{t("Feedback is always labeled a practice estimate, never an official CATTI or MTI result.")}</p>
      </section>
    </div>
  )
}

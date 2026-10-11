import { useState, useSyncExternalStore } from 'react'
import { getLocalModelState, subscribeLocalModel } from '../../ai/provider'
import { getExercises } from '../../data/exercises'
import { getLanguage, translationDirections } from '../../domain/languages'
import type { Difficulty, Exercise, LanguageCode, PracticeMode } from '../../domain/types'
import './practice.css'

export interface PracticeConfiguration {
  exercise: Exercise
  targetLanguage: LanguageCode
  timeLimitMinutes: number | null
}

export function PracticeSetup({ mode, onModeChange, onStart, onOpenSettings, evaluationBusy = false }: {
  mode: PracticeMode
  onModeChange: (mode: PracticeMode) => void
  onStart: (configuration: PracticeConfiguration) => void
  onOpenSettings: () => void
  evaluationBusy?: boolean
}) {
  const [directionId, setDirectionId] = useState('zh-en')
  const [topic, setTopic] = useState('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [minutes, setMinutes] = useState('untimed')
  const direction = translationDirections.find((item) => item.id === directionId)!
  const available = getExercises(mode, direction.sourceLanguage)
  const topics = [...new Set(available.map((exercise) => exercise.topic))]
  const difficulties = [...new Set(available.map((exercise) => exercise.difficulty))]
  const selected = available.find((exercise) => (topic === 'all' || exercise.topic === topic) && exercise.difficulty === difficulty)
  const local = useSyncExternalStore(subscribeLocalModel, getLocalModelState)

  return <section className="page-panel practice-setup" aria-labelledby="setup-heading">
    <p className="eyebrow">One passage, thoughtful practice</p>
    <h1 id="setup-heading">Choose your practice.</h1>
    <p>Select a direction and a passage from our original exercise collection. News passages are fictional reports written for practice.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (selected) onStart({ exercise: selected, targetLanguage: direction.targetLanguage, timeLimitMinutes: minutes === 'untimed' ? null : Number(minutes) }) }}>
      <fieldset><legend>Practice mode</legend><div className="button-row">
        <button type="button" className={mode === 'written' ? 'button primary' : 'button secondary'} aria-pressed={mode === 'written'} onClick={() => onModeChange('written')}>Written translation</button>
        <button type="button" className={mode === 'news' ? 'button primary' : 'button secondary'} aria-pressed={mode === 'news'} onClick={() => onModeChange('news')}>News translation</button>
      </div></fieldset>
      <div className="setup-grid">
        <label>Translation direction<select value={directionId} onChange={(event) => { setDirectionId(event.target.value); setTopic('all') }}>{translationDirections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All available topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>{difficulties.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
        <label>Timing<select value={minutes} onChange={(event) => setMinutes(event.target.value)}><option value="untimed">Untimed · track elapsed time</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label>
      </div>
      <p className="settings-help">This starter collection offers one intermediate passage per source language in each mode. Timing is a practice target; reaching it keeps your editor available.</p>
      {selected ? <aside className="exercise-preview"><strong>{selected.title}</strong><p>{selected.topic} · {getLanguage(selected.sourceLanguage).label} → {getLanguage(direction.targetLanguage).label} · {selected.difficulty}</p><p>{mode === 'news' ? 'Preserve facts, attribution, and a clear news register.' : 'Preserve meaning and write naturally for your target reader.'}</p></aside> : <p role="status">No passage matches these choices. Choose another topic or level.</p>}
      <aside className="evaluation-note"><strong>{local.status === 'ready' ? 'Local AI is loaded' : 'Local AI is not ready'}</strong><p>{local.message}</p><p>Assessment quality is uncalibrated across languages. A ready model can attempt this short task; context or device limits may still prevent feedback. Submission never downloads a model. Local-only keeps evaluation on this device; optional cloud feedback always asks you to approve the exact request.</p><button className="text-button" type="button" onClick={onOpenSettings}>Open Privacy & data</button></aside>
      {evaluationBusy && <p role="status">Your current answer is being evaluated. Return to the current passage or wait for feedback before starting another.</p>}
      <button className="button primary" disabled={!selected || evaluationBusy}>Begin {mode === 'news' ? 'news' : 'written'} practice</button>
    </form>
  </section>
}

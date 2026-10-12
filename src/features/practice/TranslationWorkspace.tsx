import { useEffect, useMemo, useRef, useState } from 'react'
import { getLanguage } from '../../domain/languages'
import type { Exercise } from '../../domain/types'

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

export function TranslationWorkspace({
  exercise,
  initialAnswer,
  initialElapsedSeconds,
  isSubmitting,
  notice,
  timeLimitSeconds,
  onCancel,
  onDraftChange,
  onElapsedChange,
  onSubmit,
}: {
  exercise: Exercise
  initialAnswer: string
  initialElapsedSeconds: number
  isSubmitting: boolean
  notice?: string
  timeLimitSeconds?: number
  onCancel: () => void
  onDraftChange: (answer: string) => void
  onElapsedChange: (elapsedSeconds: number) => void
  onSubmit: (answer: string, elapsedSeconds: number) => void
}) {
  const [answer, setAnswer] = useState(initialAnswer)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds)
  const startedAt = useRef(Date.now())
  const [validationMessage, setValidationMessage] = useState<string | undefined>()
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const wordCount = useMemo(() => answer.trim() ? answer.trim().split(/\s+/u).filter(Boolean).length : 0, [answer])
  const characterCount = answer.replace(/\s/gu, '').length

  useEffect(() => {
    const restoredElapsedSeconds = Math.max(0, Math.floor(initialElapsedSeconds))
    startedAt.current = Date.now() - restoredElapsedSeconds * 1000
    setElapsedSeconds(restoredElapsedSeconds)
    setAnswer(initialAnswer)
  }, [exercise.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextElapsedSeconds = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsedSeconds(nextElapsedSeconds)
      onElapsedChange(nextElapsedSeconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [onElapsedChange])

  const remainingSeconds = timeLimitSeconds === undefined ? undefined : Math.max(0, timeLimitSeconds - elapsedSeconds)
  const isOvertime = remainingSeconds === 0

  function handleSubmit() {
    if (!answer.trim()) {
      setValidationMessage('Write a translation before submitting.')
      return
    }
    setValidationMessage(undefined)
    onSubmit(answer, elapsedSeconds)
  }

  return (
    <div className="workspace-layout">
      <section className="workspace-main">
        <div className="workspace-heading"><div><button className="back-button" type="button" onClick={onCancel}>← Change setup</button><p className="eyebrow">{exercise.mode === 'news' ? 'News translation' : 'Written translation'}</p><h2>{exercise.title}</h2></div><div className={`timer ${isOvertime ? 'timer--overtime' : ''}`}><span className="timer__label">{timeLimitSeconds === undefined ? 'Elapsed' : 'Remaining'}</span><strong>{formatTime(timeLimitSeconds === undefined ? elapsedSeconds : remainingSeconds ?? elapsedSeconds)}</strong></div></div>
        <div className="source-card"><div className="source-card__topline"><span className="eyebrow">Source · {sourceLanguage.nativeLabel}</span><span className="source-card__meta">{exercise.difficulty} · {exercise.topic}</span></div><p className="source-text" dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{exercise.sourceText}</p></div>
        <label className="answer-panel" htmlFor="translation-answer"><span className="answer-panel__topline"><span><span className="eyebrow">Your translation · {targetLanguage.nativeLabel}</span></span><span className="answer-panel__count">{wordCount} words · {characterCount} characters</span></span><textarea id="translation-answer" dir={targetLanguage.direction} lang={exercise.targetLanguage} value={answer} onChange={(event) => { const nextAnswer = event.target.value; setAnswer(nextAnswer); onDraftChange(nextAnswer) }} placeholder={`Write your ${targetLanguage.label} translation here…`} disabled={isSubmitting} /></label>
        {validationMessage && <p className="form-message form-message--error" role="alert">{validationMessage}</p>}
        {notice && <p className="form-message" role="status">{notice}</p>}
        <div className="workspace-actions"><button className="button button--quiet" type="button" onClick={onCancel} disabled={isSubmitting}>Discard draft</button><button className="button button--primary" type="button" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Evaluating…' : 'Submit for feedback'} <span aria-hidden="true">→</span></button></div>
      </section>
      <aside className="workspace-aside"><details className="glossary-card" open><summary><span>Glossary</span><span aria-hidden="true">⌄</span></summary><div className="glossary-list">{exercise.glossary.map((entry) => <div className="glossary-entry" key={entry.term}><strong dir={sourceLanguage.direction}>{entry.term}</strong><span>{entry.note}</span>{entry.targetHint && <em>{entry.targetHint}</em>}</div>)}</div></details><div className="workspace-tip"><span className="workspace-tip__icon">✦</span><strong>Make room for meaning.</strong><p>There may be more than one good translation. Feedback will point to evidence, not compare you to a single answer.</p></div></aside>
    </div>
  )
}

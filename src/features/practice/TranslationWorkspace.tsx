import { t } from '../../i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getLanguage } from '../../domain/languages'
import type { Exercise } from '../../domain/types'
import { elapsedSecondsAt, resumeElapsedClock } from './pauseable-elapsed-clock'
import { countTextStatistics } from './text-statistics'

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
  clockPaused = false,
  saveStatus,
  onPauseChange,
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
  clockPaused?: boolean
  saveStatus?: string
  onPauseChange?: (paused: boolean) => void
  notice?: string
  timeLimitSeconds?: number
  onCancel: () => void
  onDraftChange: (answer: string) => void
  onElapsedChange: (elapsedSeconds: number) => void
  onSubmit: (answer: string, elapsedSeconds: number) => void
}) {
  const [focusMode, setFocusMode] = useState(false)
  const [mobilePane, setMobilePane] = useState<'source' | 'answer'>('answer')
  const [answer, setAnswer] = useState(initialAnswer)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds)
  const startedAt = useRef(Date.now())
  const pausedAt = useRef<number | undefined>(undefined)
  const onElapsedChangeRef = useRef(onElapsedChange)
  onElapsedChangeRef.current = onElapsedChange
  const [validationMessage, setValidationMessage] = useState<string | undefined>()
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const { words: wordCount, characters: characterCount } = useMemo(() => countTextStatistics(answer, exercise.targetLanguage), [answer, exercise.targetLanguage])

  useEffect(() => {
    const restoredElapsedSeconds = Math.max(0, Math.floor(initialElapsedSeconds))
    startedAt.current = Date.now() - restoredElapsedSeconds * 1000
    pausedAt.current = clockPaused ? Date.now() : undefined
    setElapsedSeconds(restoredElapsedSeconds)
    setAnswer(initialAnswer)
  }, [exercise.id])

  useEffect(() => {
    if (clockPaused) {
      pausedAt.current ??= Date.now()
      const frozenElapsed = elapsedSecondsAt(startedAt.current, Date.now(), pausedAt.current)
      setElapsedSeconds(frozenElapsed)
      onElapsedChangeRef.current(frozenElapsed)
      return
    }
    if (pausedAt.current !== undefined) {
      startedAt.current = resumeElapsedClock(startedAt.current, pausedAt.current, Date.now())
      pausedAt.current = undefined
    }
    const timer = window.setInterval(() => {
      const nextElapsedSeconds = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsedSeconds(nextElapsedSeconds)
      onElapsedChangeRef.current(nextElapsedSeconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [clockPaused, exercise.id])

  const remainingSeconds = timeLimitSeconds === undefined ? undefined : Math.max(0, timeLimitSeconds - elapsedSeconds)
  const isOvertime = remainingSeconds === 0

  function handleSubmit() {
    if (!answer.trim()) {
      setValidationMessage('Write a translation before submitting.')
      return
    }
    setValidationMessage(undefined)
    const submittedElapsedSeconds = elapsedSecondsAt(startedAt.current, Date.now(), pausedAt.current)
    setElapsedSeconds(submittedElapsedSeconds)
    onElapsedChangeRef.current(submittedElapsedSeconds)
    onSubmit(answer, submittedElapsedSeconds)
  }

  return (
    <div className={`workspace-layout ${focusMode ? 'workspace-layout--focus' : ''}`} data-mobile-pane={mobilePane}>
      <section className="workspace-main">
        <div className="workspace-heading"><div><button className="back-button" type="button" onClick={onCancel}>{t("← Change setup")}</button><p className="eyebrow">{exercise.mode === 'news' ? t("News translation") : t("Written translation")}</p><h2>{exercise.title}</h2></div><div className={`timer ${isOvertime ? 'timer--overtime' : ''}`}><span className="timer__label">{timeLimitSeconds === undefined ? t("Elapsed") : t("Remaining")}</span><strong>{formatTime(timeLimitSeconds === undefined ? elapsedSeconds : remainingSeconds ?? elapsedSeconds)}</strong></div></div>
        <div className="editor-toolbar"><div className="mobile-pane-switch segmented-control" role="group" aria-label={t("Translation panes")}><button className="button button--quiet" type="button" aria-pressed={mobilePane === 'source'} onClick={() => setMobilePane('source')}>{t("Read source")}</button><button className="button button--quiet" type="button" aria-pressed={mobilePane === 'answer'} onClick={() => setMobilePane('answer')}>{t("Write answer")}</button></div><div className="settings-actions"><button className="button button--quiet" type="button" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}>{focusMode ? t("Show glossary") : t("Focus mode")}</button>{onPauseChange && <button className="button button--quiet" type="button" onClick={() => onPauseChange(!clockPaused)}>{clockPaused ? t("Resume timer") : t("Pause timer")}</button>}</div></div>
        <div className="translation-panes">
        <div className="source-card"><div className="source-card__topline"><span className="eyebrow">{t("Source · ")}{sourceLanguage.nativeLabel}</span><span className="source-card__meta">{t(exercise.difficulty)} · {exercise.topic}</span></div><p className="source-text" dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{exercise.sourceText}</p></div>
        <label className="answer-panel" htmlFor="translation-answer"><span className="answer-panel__topline"><span><span className="eyebrow">{t("Your translation · ")}{targetLanguage.nativeLabel}</span></span><span className="answer-panel__count">{wordCount}{t(" words · ")}{characterCount}{t(" characters")}</span></span><textarea id="translation-answer" dir={targetLanguage.direction} lang={exercise.targetLanguage} value={answer} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing && !isSubmitting) { event.preventDefault(); handleSubmit() } }} onChange={(event) => { const nextAnswer = event.target.value; setAnswer(nextAnswer); onDraftChange(nextAnswer) }} placeholder={t("Write your {0} translation here…", t(targetLanguage.label))} disabled={isSubmitting} /></label>
        </div>
        <p className="draft-status" role="status">{saveStatus ?? 'Draft stays in this tab'} · {clockPaused ? t("Timer paused") : t("Timer running")}</p>
        {validationMessage && <p className="form-message form-message--error" role="alert">{t(validationMessage)}</p>}
        {notice && <p className="form-message" role="status">{t(notice)}</p>}
        <div className="workspace-actions"><button className="button button--quiet" type="button" onClick={onCancel} disabled={isSubmitting}>{t("Change passage")}</button><button className="button button--primary" type="button" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? t("Evaluating…") : t("Submit for feedback")} <span aria-hidden="true">→</span></button></div>
      </section>
      <aside className="workspace-aside"><details className="glossary-card" open><summary><span>{t("Glossary")}</span><span aria-hidden="true">⌄</span></summary><div className="glossary-list">{exercise.glossary.map((entry) => <div className="glossary-entry" key={entry.term}><strong dir={sourceLanguage.direction}>{entry.term}</strong><span>{entry.note}</span>{entry.targetHint && <em>{entry.targetHint}</em>}</div>)}</div></details><div className="workspace-tip"><span className="workspace-tip__icon">✦</span><strong>{t("Make room for meaning.")}</strong><p>{t("There may be more than one good translation. Feedback will point to evidence, not compare you to a single answer.")}</p></div></aside>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { clearPendingConsent, getLocalModelState, getSessionKey, routeEvaluation, subscribeLocalModel } from '../../ai/provider'
import { getLanguage } from '../../domain/languages'
import { validateFeedback } from '../../domain/scoring'
import type { EvaluationInput, EvaluationRouteResult, SessionRecord } from '../../domain/types'
import { database } from '../../storage/database'
import { CloudConsentDialog } from '../settings/CloudConsentDialog'
import { FeedbackPanel } from './FeedbackPanel'
import type { PracticeConfiguration } from './PracticeSetup'
import './practice.css'

type ConsentRequest = Extract<EvaluationRouteResult, { status: 'needs-consent' }>
type Completed = { input: EvaluationInput; session: SessionRecord }

function duration(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

function wordCount(answer: string, language: string): { count: number; label: string } {
  if (typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter(language, { granularity: 'word' }).segment(answer)
    return { count: [...segments].filter((segment) => segment.isWordLike).length, label: 'words' }
  }
  return { count: answer.trim() ? answer.trim().split(/\s+/u).length : 0, label: 'space-separated words (approximate)' }
}

export function TranslationWorkspace({ configuration, active, onOpenSettings, onSaved, onBusyChange, onSavingChange }: {
  configuration: PracticeConfiguration
  active: boolean
  onOpenSettings: () => void
  onSaved: () => void
  onBusyChange: (busy: boolean) => void
  onSavingChange: (busy: boolean) => void
}) {
  const { exercise, targetLanguage, timeLimitMinutes } = configuration
  const source = getLanguage(exercise.sourceLanguage)
  const target = getLanguage(targetLanguage)
  const local = useSyncExternalStore(subscribeLocalModel, getLocalModelState)
  const [answer, setAnswer] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [phase, setPhase] = useState<'editing' | 'evaluating' | 'review'>('editing')
  const [consent, setConsent] = useState<ConsentRequest | null>(null)
  const [unavailable, setUnavailable] = useState('')
  const [completed, setCompleted] = useState<Completed | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const mounted = useRef(false)
  const busy = useRef(false)
  const editingMillis = useRef(0)
  const editingStarted = useRef<number | null>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const count = useMemo(() => wordCount(answer, targetLanguage), [answer, targetLanguage])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearPendingConsent() }
  }, [])
  useEffect(() => {
    if (!active && consent) {
      clearPendingConsent(); setConsent(null); setUnavailable('Cloud approval cancelled. Your answer stays here. Submit again for a fresh preview.')
    }
  }, [active, consent])
  useEffect(() => {
    if (!active || phase !== 'editing' || consent) return
    const started = performance.now()
    editingStarted.current = started
    const previous = editingMillis.current
    const tick = () => setElapsedSeconds(Math.floor((previous + performance.now() - started) / 1000))
    const interval = window.setInterval(tick, 1000)
    return () => { window.clearInterval(interval); editingMillis.current = previous + performance.now() - started; editingStarted.current = null; setElapsedSeconds(Math.floor(editingMillis.current / 1000)) }
  }, [active, phase, consent])

  async function evaluate(input: EvaluationInput, cloudConsent: boolean) {
    if (busy.current) return
    const submittedSeconds = Math.floor((editingMillis.current + (editingStarted.current === null ? 0 : performance.now() - editingStarted.current)) / 1000)
    busy.current = true
    onBusyChange(true)
    setPhase('evaluating'); setUnavailable(''); setConsent(null)
    try {
      const result = await routeEvaluation(input, { cloudConsent, sessionKey: cloudConsent ? getSessionKey() : undefined })
      if (!mounted.current) { clearPendingConsent(); return }
      if (result.status === 'needs-consent') {
        setConsent(result); setPhase('editing')
      } else if (result.status === 'unavailable') {
        setUnavailable(result.reason); setPhase('editing')
      } else {
        const feedback = validateFeedback(result.feedback, input)
        setCompleted({ input, session: {
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), exerciseId: input.exercise.id,
          mode: input.exercise.mode, sourceLanguage: input.exercise.sourceLanguage,
          targetLanguage: input.targetLanguage, learnerAnswer: input.learnerAnswer, feedback,
          elapsedSeconds: submittedSeconds,
        } })
        setSaved(false); setSaveError(''); setPhase('review')
      }
    } catch (error) {
      if (mounted.current) { setUnavailable(error instanceof Error ? error.message : 'Feedback could not be assessed reliably. Review manually.'); setPhase('editing') }
    } finally { busy.current = false; onBusyChange(false) }
  }

  async function save() {
    if (!completed || saving || saved) return
    onSavingChange(true)
    setSaving(true); setSaveError('')
    try {
      const feedback = validateFeedback(completed.session.feedback, completed.input)
      await database.saveSession({ ...completed.session, feedback })
      if (mounted.current) { setSaved(true); onSaved() }
    } catch (error) { if (mounted.current) setSaveError(error instanceof Error ? error.message : 'Could not save this session.') }
    finally { onSavingChange(false); if (mounted.current) setSaving(false) }
  }

  function revise() {
    clearPendingConsent(); setCompleted(null); setSaved(false); setSaveError(''); setUnavailable(''); setPhase('editing')
    window.requestAnimationFrame(() => editor.current?.focus())
  }

  return <section className="translation-workspace" aria-labelledby="workspace-heading">
    <div className="workspace-heading"><div><p className="eyebrow">{exercise.mode === 'news' ? 'News translation' : 'Written translation'} · {exercise.difficulty}</p><h1 id="workspace-heading">{exercise.title}</h1><p><bdi>{source.label} → {target.label}</bdi> · {exercise.topic}</p></div><div className="session-clock"><span>Elapsed practice</span><strong aria-label={`${Math.floor(elapsedSeconds / 60)} minutes ${elapsedSeconds % 60} seconds`}>{duration(elapsedSeconds)}</strong><span>{timeLimitMinutes ? `${timeLimitMinutes}-minute target` : 'Untimed'}</span></div></div>
    <p className="settings-help">Your draft stays in this open page while you navigate. Reloading or closing the page clears unsaved work. Elapsed time pauses outside Practice, while evaluating, and while reviewing feedback.</p>
    {timeLimitMinutes !== null && elapsedSeconds >= timeLimitMinutes * 60 && <p className="time-notice" role="status">Practice target reached. You can keep writing and submit when ready.</p>}
    <div className="workspace-grid">
      <section className="source-panel" aria-labelledby="source-heading"><h2 id="source-heading">Source passage · {source.label}</h2><p className="passage" lang={source.code} dir={source.direction}>{exercise.sourceText}</p><p className="source-credit">Original practice passage · authored {exercise.authoredAt}{exercise.mode === 'news' ? ' · fictional report' : ''}</p>
        <details className="glossary"><summary>Exercise glossary ({exercise.glossary.length})</summary><dl>{exercise.glossary.map((entry) => <div key={entry.term}><dt lang={source.code} dir={source.direction}>{entry.term}</dt><dd dir="auto">{entry.hint}</dd></div>)}</dl></details>
      </section>
      <form className="answer-panel" onSubmit={(event) => { event.preventDefault(); if (answer.trim() && phase === 'editing' && !consent) void evaluate({ exercise: structuredClone(exercise), targetLanguage, learnerAnswer: answer }, false) }}>
        <h2><label htmlFor="translation-answer">Your translation · {target.label}</label></h2><p id="answer-help" className="settings-help">{exercise.mode === 'news' ? 'Keep facts and attribution precise, with a concise news register.' : 'Convey the meaning in natural language for the target reader.'} Up to 6,000 characters.</p>
        <textarea id="translation-answer" ref={editor} lang={target.code} dir={target.direction} value={answer} onChange={(event) => { clearPendingConsent(); setAnswer(event.target.value); setUnavailable('') }} readOnly={phase !== 'editing' || !!consent} maxLength={6000} aria-describedby="answer-help answer-count" spellCheck={false} autoComplete="off" rows={13} />
        <p id="answer-count" className="answer-count">{count.count} {count.label} · {answer.length} / 6,000 characters</p>
        <button className="button primary" disabled={!answer.trim() || phase !== 'editing' || !!consent}>{phase === 'evaluating' ? 'Evaluating…' : phase === 'review' ? 'Feedback ready below' : 'Request practice feedback'}</button>
        <p className="settings-help">AI feedback is a practice estimate. Only a completed, validated assessment can be saved to history.</p>
      </form>
    </div>
    <aside className="evaluation-note"><strong>On-device AI: {local.status === 'ready' ? 'loaded' : local.status}</strong><p>{local.message}</p>{['checking', 'downloading'].includes(local.status) && <progress aria-label="Local model preparation" value={local.progress} max={1} />}<p>Submission uses a model only if already loaded. It never starts a download. Cloud feedback requires local-first preferences and your approval of each exact request.</p><button className="text-button" type="button" disabled={phase === 'evaluating'} onClick={onOpenSettings}>Open Privacy & data</button></aside>
    {phase === 'evaluating' && <div className="evaluation-progress" role="status"><progress aria-label="Assessment in progress" /><p>Checking your submitted answer and preparing feedback. This may take a few minutes; your answer is retained.</p></div>}
    {unavailable && <aside className="manual-review" role="status"><h2>Continue with manual review</h2><p>{unavailable}</p><p>No scores or completed session were saved. Your answer remains in the editor.</p><ol><li>Compare each sentence with the source for meaning, missing details, and additions.</li><li>Check names, numbers, terminology, and attribution.</li><li>Read your target text aloud for grammar, flow, and {exercise.mode === 'news' ? 'news register' : 'natural expression'}.</li><li>Revise in the editor, or prepare/configure an evaluator in Privacy & data and retry.</li></ol></aside>}
    {completed && <FeedbackPanel feedback={completed.session.feedback} input={completed.input} active={active} onRevise={revise} onSave={() => { void save() }} saving={saving} saved={saved} saveError={saveError} />}
    {consent && active && <CloudConsentDialog request={consent} onConfirm={() => { void evaluate(consent.input, true) }} onCancel={() => { clearPendingConsent(); setConsent(null); setUnavailable('Cloud evaluation cancelled. No translation was sent. Review manually or submit again when ready.') }} />}
  </section>
}

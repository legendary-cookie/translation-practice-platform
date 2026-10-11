import { useEffect, useMemo, useState } from 'react'
import { createCloudProvider } from './ai/cloud-provider'
import type { LocalModelProgress } from './ai/local-provider'
import { createLocalProvider } from './ai/local-provider'
import { createEvaluationRouter, type CloudConsentRequest } from './ai/provider'
import { database, DEFAULT_SETTINGS } from './storage/database'
import { Dashboard } from './features/dashboard/Dashboard'
import { FeedbackPanel } from './features/practice/FeedbackPanel'
import { PracticeSetup, type PracticeStart } from './features/practice/PracticeSetup'
import { TranslationWorkspace } from './features/practice/TranslationWorkspace'
import type { Exercise, SessionRecord, StoredSettings, TranslationFeedback } from './domain/types'
import { DEFAULT_LOCAL_MODEL_ID } from './domain/types'
import { getLanguage } from './domain/languages'
import './features/practice/practice.css'

export type Page = 'home' | 'practice' | 'progress' | 'settings'

type NavigationItem = {
  id: Page
  label: string
  icon: string
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'practice', label: 'Practice', icon: '✎' },
  { id: 'progress', label: 'Progress', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const pageCopy: Record<Page, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'Your study space', title: 'Translate with intention.' },
  practice: { eyebrow: 'Practice desk', title: 'Make a translation pass.' },
  progress: { eyebrow: 'Local history', title: 'See the work you have done.' },
  settings: { eyebrow: 'Privacy and setup', title: 'Keep your practice yours.' },
}

function Navigation({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
  return (
    <nav className="navigation" aria-label="Primary navigation">
      <div className="brand-mark" aria-label="Lingo Practice">
        <span className="brand-mark__symbol">文</span>
        <span className="brand-mark__name">Lingo Practice</span>
      </div>
      <div className="navigation__items">
        {navigationItems.map((item) => (
          <button className={`navigation__item ${currentPage === item.id ? 'navigation__item--active' : ''}`} key={item.id} type="button" aria-current={currentPage === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
            <span className="navigation__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="navigation__footer"><span className="status-dot" aria-hidden="true" /><span>Local-first mode</span></div>
    </nav>
  )
}

function PlaceholderPage({ page }: { page: Page }) {
  const copy = page === 'progress'
    ? { icon: '↗', eyebrow: 'Local history', title: 'Your progress will appear here.', description: 'Complete a validated practice session to start building local history.' }
    : { icon: '⚙', eyebrow: 'Privacy and setup', title: 'Your settings are coming together.', description: 'Choose an evaluation mode and manage this browser’s local data.' }

  return (
    <div className="page-content">
      <section className="empty-state"><span className="empty-state__icon" aria-hidden="true">{copy.icon}</span><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.description}</p></section>
    </div>
  )
}

function ConsentDialog({
  exercise,
  request,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  exercise: Exercise
  request: CloudConsentRequest
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  return (
    <div className="consent-backdrop" role="presentation">
      <div className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-heading">
        <p className="eyebrow">One task · explicit consent</p>
        <h2 id="consent-heading">Send this translation to the cloud?</h2>
        <p>The local evaluator is not available for this task. A cloud provider will receive exactly the source passage and your answer shown below, along with the rubric prompt.</p>
        <div className="consent-evidence">
          <section><h3>Exact source · {sourceLanguage.nativeLabel}</h3><p className="consent-quote" dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{request.sourceText}</p></section>
          <section><h3>Exact answer · {targetLanguage.nativeLabel}</h3><p className="consent-quote" dir={targetLanguage.direction} lang={exercise.targetLanguage}>{request.learnerAnswer}</p></section>
        </div>
        <p className="consent-warning">This is a one-time decision for this task. The API key remains session-only, and the service worker does not cache this request or response.</p>
        <div className="consent-actions"><button className="button button--quiet" type="button" onClick={onCancel} disabled={isSubmitting}>Keep local-only</button><button className="button button--primary" type="button" onClick={onConfirm} disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Consent and evaluate'} <span aria-hidden="true">→</span></button></div>
      </div>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS)
  const [cloudDraft, setCloudDraft] = useState({ baseUrl: '', model: '', apiKey: '' })
  const [localProgress, setLocalProgress] = useState<LocalModelProgress>({ status: 'not-prepared', text: 'Local model has not been prepared.' })
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | undefined>()
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>()
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState(0)
  const [feedback, setFeedback] = useState<TranslationFeedback | undefined>()
  const [practiceNotice, setPracticeNotice] = useState<string | undefined>()
  const [pendingConsent, setPendingConsent] = useState<CloudConsentRequest | undefined>()
  const [isEvaluating, setIsEvaluating] = useState(false)

  const handleLocalProgress = (progress: LocalModelProgress) => {
    setLocalProgress(progress)
    if (progress.status === 'ready' || progress.status === 'unavailable') {
      setSettings((current) => {
        const nextSettings = { ...current, localModelStatus: progress.status }
        void database.saveSettings(nextSettings)
        return nextSettings
      })
    }
  }

  const localProvider = useMemo(() => createLocalProvider(DEFAULT_LOCAL_MODEL_ID, handleLocalProgress), [])

  useEffect(() => () => localProvider.dispose(), [localProvider])

  useEffect(() => {
    void database.getSettings().then((savedSettings) => {
      setSettings(savedSettings)
      setCloudDraft({ baseUrl: savedSettings.cloudBaseUrl, model: savedSettings.cloudModel, apiKey: '' })
    }).catch(() => undefined)
    void database.listSessions().then(setRecentSessions).catch(() => undefined)
  }, [])

  const cloudProvider = useMemo(() => {
    if (!cloudDraft.baseUrl.trim() || !cloudDraft.model.trim() || !cloudDraft.apiKey.trim()) {
      return undefined
    }
    try {
      return createCloudProvider(cloudDraft)
    } catch {
      return undefined
    }
  }, [cloudDraft])

  const evaluationRouter = useMemo(() => createEvaluationRouter({
    getMode: () => settings.evaluationMode,
    getLocalProvider: () => localProvider,
    getCloudProvider: () => cloudProvider,
  }), [cloudProvider, localProvider, settings.evaluationMode])

  function updateSettings(nextSettings: StoredSettings) {
    setSettings(nextSettings)
    void database.saveSettings(nextSettings)
  }

  function beginPractice(selection: PracticeStart) {
    setActiveExercise(selection.exercise)
    setTimeLimitSeconds(selection.timeLimitSeconds)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setCurrentPage('practice')
  }

  function resetPractice() {
    setActiveExercise(undefined)
    setTimeLimitSeconds(undefined)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
  }

  async function saveCompletedSession(nextFeedback: TranslationFeedback, provider: 'local' | 'cloud') {
    if (!activeExercise) {
      return
    }
    const session: SessionRecord = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      exerciseId: activeExercise.id,
      mode: activeExercise.mode,
      sourceLanguage: activeExercise.sourceLanguage,
      targetLanguage: activeExercise.targetLanguage,
      answer: draftAnswer,
      feedback: nextFeedback,
      elapsedSeconds: draftElapsedSeconds,
    }
    setFeedback(nextFeedback)
    setPracticeNotice(`${provider === 'cloud' ? 'Cloud' : 'Local'} evaluation complete. Saved to this device.`)
    try {
      await database.saveSession(session)
      setRecentSessions((sessions) => [session, ...sessions.filter((item) => item.id !== session.id)])
    } catch {
      setPracticeNotice('Feedback is ready, but this browser could not save the session locally.')
    }
  }

  async function submitAnswer(answer: string, elapsedSeconds: number) {
    if (!activeExercise) {
      return
    }
    setDraftAnswer(answer)
    setDraftElapsedSeconds(elapsedSeconds)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setIsEvaluating(true)
    try {
      const result = await evaluationRouter.evaluate({ exercise: activeExercise, learnerAnswer: answer, mode: activeExercise.mode })
      if (result.status === 'evaluated') {
        await saveCompletedSession(result.feedback, result.provider)
      } else if (result.status === 'needs-consent') {
        setPendingConsent(result.request)
        setPracticeNotice(`${result.reason} Review the exact task before deciding whether to use cloud evaluation.`)
      } else {
        setPracticeNotice(result.reason)
      }
    } catch (error) {
      setPracticeNotice(error instanceof Error ? error.message : 'Evaluation could not be completed.')
    } finally {
      setIsEvaluating(false)
    }
  }

  async function confirmCloudEvaluation() {
    if (!pendingConsent) {
      return
    }
    setIsEvaluating(true)
    try {
      const nextFeedback = await pendingConsent.confirm()
      setPendingConsent(undefined)
      await saveCompletedSession(nextFeedback, 'cloud')
    } catch (error) {
      setPracticeNotice(error instanceof Error ? error.message : 'Cloud evaluation could not be completed. You can review the consent and try again.')
    } finally {
      setIsEvaluating(false)
    }
  }

  const pageCopyForCurrentPage = pageCopy[currentPage]

  return (
    <div className="app-shell">
      <aside className="sidebar"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">{pageCopyForCurrentPage.eyebrow}</p><h1>{pageCopyForCurrentPage.title}</h1></div><div className="topbar__meta"><span className="status-dot" aria-hidden="true" /><span>Saved on this device</span></div></header>
        {currentPage === 'home' && <Dashboard localProgress={localProgress} recentSessions={recentSessions} onNavigate={setCurrentPage} />}
        {currentPage === 'practice' && !activeExercise && <PracticeSetup evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginPractice} />}
        {currentPage === 'practice' && activeExercise && !feedback && <TranslationWorkspace exercise={activeExercise} initialAnswer={draftAnswer} isSubmitting={isEvaluating} notice={practiceNotice} timeLimitSeconds={timeLimitSeconds} onCancel={resetPractice} onSubmit={submitAnswer} />}
        {currentPage === 'practice' && activeExercise && feedback && <FeedbackPanel answer={draftAnswer} exercise={activeExercise} feedback={feedback} onRevise={() => { setFeedback(undefined); setPracticeNotice('Revise your answer, then submit again for a new practice estimate.') }} />}
        {currentPage === 'progress' && <PlaceholderPage page="progress" />}
        {currentPage === 'settings' && <PlaceholderPage page="settings" />}
      </main>
      <div className="mobile-navigation"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></div>
      {activeExercise && pendingConsent && <ConsentDialog exercise={activeExercise} request={pendingConsent} isSubmitting={isEvaluating} onCancel={() => setPendingConsent(undefined)} onConfirm={() => void confirmCloudEvaluation()} />}
    </div>
  )
}

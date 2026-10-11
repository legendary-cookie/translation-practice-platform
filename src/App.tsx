import { useEffect, useMemo, useRef, useState } from 'react'
import { createCloudProvider } from './ai/cloud-provider'
import { forgetLocalModelReady, hadLocalModelReady, type LocalModelProgress } from './ai/local-provider'
import { createLocalProvider } from './ai/local-provider'
import { createInitialCapability, detectDeviceCapability, type CapabilityAssessment } from './ai/capability'
import { createEvaluationRouter, type CloudConsentRequest } from './ai/provider'
import { database, DEFAULT_SETTINGS } from './storage/database'
import { Dashboard } from './features/dashboard/Dashboard'
import { FeedbackPanel } from './features/practice/FeedbackPanel'
import { PracticeSetup, type PracticeStart } from './features/practice/PracticeSetup'
import { TranslationWorkspace } from './features/practice/TranslationWorkspace'
import { ProgressPage } from './features/progress/ProgressPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ExamCatalog } from './features/exam/ExamCatalog'
import { ExamRunner } from './features/exam/ExamRunner'
import { ExamResultsReport } from './features/exam/ExamResultsReport'
import { ExamEvaluationBlockedError, evaluateExamRun } from './features/exam/exam-evaluator'
import { DEFAULT_EXAM_PROFILES } from './data/exam-profiles'
import { DirectionQualityNotice, ModelCapabilityStatus } from './features/settings/ModelCapabilityStatus'
import type {
  ActiveExamRun,
  ConsolidatedExamResult,
  ExamProfile,
  Exercise,
  SessionRecord,
  StoredSettings,
  TranslationFeedback,
} from './domain/types'
import { DEFAULT_LOCAL_MODEL_ID } from './domain/types'
import { getLanguage } from './domain/languages'
import './features/practice/practice.css'
import './features/progress/progress.css'
import './features/exam/exam.css'

export type Page = 'home' | 'practice' | 'exam' | 'progress' | 'settings'

type NavigationItem = {
  id: Page
  label: string
  icon: string
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'practice', label: 'Practice', icon: '✎' },
  { id: 'exam', label: 'Exam', icon: '◷' },
  { id: 'progress', label: 'Progress', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const pageCopy: Record<Page, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'Your study space', title: 'Translate with intention.' },
  practice: { eyebrow: 'Practice desk', title: 'Make a translation pass.' },
  exam: { eyebrow: 'Exam simulation', title: 'Test under realistic conditions.' },
  progress: { eyebrow: 'Local history', title: 'See the work you have done.' },
  settings: { eyebrow: 'Privacy and setup', title: 'Keep your practice yours.' },
}

type PendingExamConsent = {
  run: ActiveExamRun
  passageId: string
  request: CloudConsentRequest
  approvedFeedback: Record<string, TranslationFeedback>
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
  const [capability, setCapability] = useState<CapabilityAssessment>(createInitialCapability)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | undefined>()
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>()
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState(0)
  const [feedback, setFeedback] = useState<TranslationFeedback | undefined>()
  const [practiceNotice, setPracticeNotice] = useState<string | undefined>()
  const [pendingConsent, setPendingConsent] = useState<CloudConsentRequest | undefined>()
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [examProfiles, setExamProfiles] = useState<ExamProfile[]>(DEFAULT_EXAM_PROFILES)
  const [activeExamRun, setActiveExamRun] = useState<ActiveExamRun | undefined>()
  const [recentExamResults, setRecentExamResults] = useState<ConsolidatedExamResult[]>([])
  const [examView, setExamView] = useState<'catalog' | 'runner' | 'results'>('catalog')
  const [selectedExamProfile, setSelectedExamProfile] = useState<ExamProfile | undefined>()
  const [activeExamResult, setActiveExamResult] = useState<ConsolidatedExamResult | undefined>()
  const [isEvaluatingExam, setIsEvaluatingExam] = useState(false)
  const [examEvaluationProgress, setExamEvaluationProgress] = useState<{ completed: number; total: number } | undefined>()
  const [examEvaluationNotice, setExamEvaluationNotice] = useState<string | undefined>()
  const [pendingExamConsent, setPendingExamConsent] = useState<PendingExamConsent | undefined>()
  const dataLoadGeneration = useRef(0)
  const diagnosticAutoStarted = useRef(false)

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
    let cancelled = false
    void detectDeviceCapability().then((nextCapability) => {
      if (!cancelled) {
        setCapability(nextCapability)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV || diagnosticAutoStarted.current || capability.localModel.status !== 'available' || !new URLSearchParams(window.location.search).has('localDiagnostic')) {
      return
    }
    diagnosticAutoStarted.current = true
    void prepareLocalModel()
  }, [capability.localModel.status])

  useEffect(() => {
    let cancelled = false
    void localProvider.isCached().then((cached) => {
      if (!cancelled && hadLocalModelReady() && !cached) {
        setLocalProgress({
          status: 'unavailable',
          text: 'The local model cache is missing after a previous successful preparation.',
          error: 'The browser may have evicted the model assets. Prepare the local model again before retrying.',
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [localProvider])

  useEffect(() => {
    const loadGeneration = dataLoadGeneration.current
    void database.getSettings().then((savedSettings) => {
      if (dataLoadGeneration.current !== loadGeneration) {
        return
      }
      setSettings(savedSettings)
      setCloudDraft({ baseUrl: savedSettings.cloudBaseUrl, model: savedSettings.cloudModel, apiKey: '' })
    }).catch(() => undefined)
    void database.listSessions().then((sessions) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setRecentSessions(sessions)
      }
    }).catch(() => undefined)
    void database.listExamProfiles().then((profiles) => {
      if (dataLoadGeneration.current === loadGeneration && profiles.length > 0) {
        setExamProfiles(profiles)
      }
    }).catch(() => undefined)
    void database.getActiveExamRun().then((run) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setActiveExamRun(run)
      }
    }).catch(() => undefined)
    void database.listExamResults().then((results) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setRecentExamResults(results)
      }
    }).catch(() => undefined)
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
    getCapability: () => capability,
  }), [capability, cloudProvider, localProvider, settings.evaluationMode])

  function updateSettings(nextSettings: StoredSettings) {
    setSettings(nextSettings)
    void database.saveSettings(nextSettings)
  }

  async function prepareLocalModel() {
    if (capability.localModel.status !== 'available') {
      setLocalProgress({ status: 'unavailable', text: capability.localModel.reason, error: capability.localModel.reason })
      return
    }
    try {
      await localProvider.prepare()
    } catch {
      return
    }
  }

  async function clearLocalData() {
    dataLoadGeneration.current += 1
    await database.clearData()
    localProvider.dispose()
    forgetLocalModelReady()
    setSettings(DEFAULT_SETTINGS)
    setCloudDraft({ baseUrl: '', model: '', apiKey: '' })
    setLocalProgress({ status: 'not-prepared', text: 'Local model has not been prepared.' })
    setRecentSessions([])
    setActiveExamRun(undefined)
    setRecentExamResults([])
    setActiveExamResult(undefined)
    setSelectedExamProfile(undefined)
    setExamView('catalog')
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    resetPractice()
  }

  function handleSelectExamProfile(profile: ExamProfile) {
    setSelectedExamProfile(profile)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setExamView('runner')
  }

  function handleResumeExamRun(run: ActiveExamRun) {
    const profile =
      examProfiles.find((p) => p.id === run.profileId) ??
      DEFAULT_EXAM_PROFILES.find((p) => p.id === run.profileId)
    if (profile) {
      setSelectedExamProfile(profile)
      setActiveExamRun(run)
      setExamEvaluationNotice(undefined)
      setPendingExamConsent(undefined)
      setExamView('runner')
      setCurrentPage('exam')
    }
  }

  async function handleDiscardExamRun(runId: string) {
    await database.deleteExamRun(runId)
    setActiveExamRun(undefined)
  }

  async function handleSubmitExamRun(
    completedRun: ActiveExamRun,
    approvedFeedback: Record<string, TranslationFeedback> = {},
  ) {
    if (!selectedExamProfile) {
      return
    }
    setExamEvaluationNotice(undefined)
    setIsEvaluatingExam(true)
    setExamEvaluationProgress({ completed: 0, total: 1 })
    try {
      const result = await evaluateExamRun(
        completedRun,
        selectedExamProfile,
        evaluationRouter,
        (completed, total) => setExamEvaluationProgress({ completed, total }),
        approvedFeedback,
      )
      await database.saveExamResult(result)
      await database.deleteExamRun(completedRun.id)
      setActiveExamRun(undefined)
      setActiveExamResult(result)
      setRecentExamResults((prev) => [result, ...prev.filter((r) => r.id !== result.id)])
      setPendingExamConsent(undefined)
      setExamView('results')
    } catch (error) {
      if (error instanceof ExamEvaluationBlockedError && error.status === 'needs-consent' && error.request) {
        setPendingExamConsent({
          run: completedRun,
          passageId: error.passageId,
          request: error.request,
          approvedFeedback,
        })
        setExamEvaluationNotice(`${error.message} Review the exact task before deciding whether to use cloud evaluation.`)
      } else {
        const reason = error instanceof Error ? error.message : 'Evaluation could not be completed.'
        setExamEvaluationNotice(`Exam evaluation unavailable: ${reason} No practice estimate was saved; the exam remains available for retry.`)
      }
    } finally {
      setIsEvaluatingExam(false)
      setExamEvaluationProgress(undefined)
    }
  }

  async function confirmExamCloudEvaluation() {
    const pending = pendingExamConsent
    if (!pending) {
      return
    }

    setExamEvaluationNotice(undefined)
    setIsEvaluatingExam(true)
    try {
      const feedback = await pending.request.confirm()
      setPendingExamConsent(undefined)
      await handleSubmitExamRun(pending.run, {
        ...pending.approvedFeedback,
        [pending.passageId]: feedback,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Cloud evaluation could not be completed.'
      setExamEvaluationNotice(`Cloud evaluation could not be completed: ${reason} The exam remains unscored; you can retry.`)
    } finally {
      setIsEvaluatingExam(false)
      setExamEvaluationProgress(undefined)
    }
  }

  async function handleCancelExamRun() {
    const run = await database.getActiveExamRun()
    setActiveExamRun(run)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setExamView('catalog')
    setSelectedExamProfile(undefined)
  }

  function handleRetakeExam() {
    setExamView('catalog')
    setActiveExamResult(undefined)
    setSelectedExamProfile(undefined)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
  }


  function saveCloudPreferences(baseUrl: string, model: string) {
    updateSettings({ ...settings, cloudBaseUrl: baseUrl.trim(), cloudModel: model.trim() })
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
  const isTakingExam = currentPage === 'exam' && examView === 'runner' && selectedExamProfile !== undefined

  return (
    <div className="app-shell">
      <aside className="sidebar"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></aside>
      <main className="main-content">
        {!isTakingExam && (
          <header className="topbar">
            <div>
              <p className="eyebrow">{pageCopyForCurrentPage.eyebrow}</p>
              <h1>{pageCopyForCurrentPage.title}</h1>
            </div>
            <div className="topbar__meta">
              <span className="status-dot" aria-hidden="true" />
              <span>Saved on this device</span>
            </div>
          </header>
        )}
        {currentPage === 'home' && (
          <Dashboard
            localProgress={localProgress}
            recentSessions={recentSessions}
            activeExamRun={activeExamRun}
            recentExamResults={recentExamResults}
            onNavigate={(page) => {
              if (page === 'exam' && activeExamRun) {
                handleResumeExamRun(activeExamRun)
              } else {
                setCurrentPage(page)
              }
            }}
          />
        )}
        {currentPage === 'practice' && !activeExercise && <><DirectionQualityNotice capability={capability} /><PracticeSetup evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginPractice} /></>}
        {currentPage === 'practice' && activeExercise && !feedback && <TranslationWorkspace exercise={activeExercise} initialAnswer={draftAnswer} isSubmitting={isEvaluating} notice={practiceNotice} timeLimitSeconds={timeLimitSeconds} onCancel={resetPractice} onSubmit={submitAnswer} />}
        {currentPage === 'practice' && activeExercise && feedback && <FeedbackPanel answer={draftAnswer} exercise={activeExercise} feedback={feedback} onRevise={() => { setFeedback(undefined); setPracticeNotice('Revise your answer, then submit again for a new practice estimate.') }} onChangeSetup={resetPractice} />}
        {currentPage === 'exam' && !isEvaluatingExam && examEvaluationNotice && (
          <section className="notice-banner notice-banner--warning" role="alert" style={{ marginBottom: '1.5rem' }}>
            {examEvaluationNotice}
          </section>
        )}
        {currentPage === 'exam' && !isEvaluatingExam && <ModelCapabilityStatus capability={capability} />}
        {currentPage === 'exam' && isEvaluatingExam && (
          <div className="exam-modal-backdrop" role="presentation">
            <div className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="eval-heading">
              <h3 id="eval-heading" className="exam-modal__title">Evaluating Exam Submissions…</h3>
              <p className="exam-modal__body">
                Assessing answered passages against the rubric dimensions.
                {examEvaluationProgress && (
                  <span> Completed {examEvaluationProgress.completed} of {examEvaluationProgress.total} tasks.</span>
                )}
              </p>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    background: '#0284c7',
                    width: `${examEvaluationProgress ? Math.round((examEvaluationProgress.completed / examEvaluationProgress.total) * 100) : 0}%`,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {currentPage === 'exam' && !isEvaluatingExam && examView === 'runner' && selectedExamProfile && (
          <ExamRunner
            profile={selectedExamProfile}
            initialRun={activeExamRun}
            onSubmitRun={handleSubmitExamRun}
            onCancel={handleCancelExamRun}
          />
        )}
        {currentPage === 'exam' && !isEvaluatingExam && examView === 'results' && activeExamResult && (
          <ExamResultsReport
            result={activeExamResult}
            onRetake={handleRetakeExam}
            onBackToDashboard={() => setCurrentPage('home')}
          />
        )}
        {currentPage === 'exam' && !isEvaluatingExam && (examView === 'catalog' || (!selectedExamProfile && !activeExamResult)) && (
          <ExamCatalog
            profiles={examProfiles}
            activeRun={activeExamRun}
            onSelectProfile={handleSelectExamProfile}
            onResumeRun={handleResumeExamRun}
            onDiscardRun={handleDiscardExamRun}
          />
        )}
        {currentPage === 'progress' && (
          <ProgressPage
            sessions={recentSessions}
            examResults={recentExamResults}
            onStartPractice={() => setCurrentPage('practice')}
            onStartExam={() => {
              setExamView('catalog')
              setSelectedExamProfile(undefined)
              setActiveExamResult(undefined)
              setCurrentPage('exam')
            }}
          />
        )}
        {currentPage === 'settings' && <SettingsPage capability={capability} cloudDraft={cloudDraft} localProgress={localProgress} localProvider={localProvider} onCloudDraftChange={setCloudDraft} onDeleteData={clearLocalData} onEvaluationModeChange={(mode) => updateSettings({ ...settings, evaluationMode: mode })} onPrepareLocal={prepareLocalModel} onSaveCloudPreferences={saveCloudPreferences} settings={settings} sessionCount={recentSessions.length} />}
      </main>
      <div className="mobile-navigation"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></div>
      {activeExercise && pendingConsent && <ConsentDialog exercise={activeExercise} request={pendingConsent} isSubmitting={isEvaluating} onCancel={() => setPendingConsent(undefined)} onConfirm={() => void confirmCloudEvaluation()} />}
      {pendingExamConsent && (
        <ConsentDialog
          exercise={pendingExamConsent.request.exercise}
          request={pendingExamConsent.request}
          isSubmitting={isEvaluatingExam}
          onCancel={() => {
            setPendingExamConsent(undefined)
            setExamEvaluationNotice('Cloud evaluation was not approved. No practice estimate was saved; the exam remains available for retry.')
          }}
          onConfirm={() => void confirmExamCloudEvaluation()}
        />
      )}
    </div>
  )
}

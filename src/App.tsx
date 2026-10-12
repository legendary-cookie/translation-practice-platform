import { useEffect, useMemo, useRef, useState } from 'react'
import { createCloudProvider } from './ai/cloud-provider'
import { forgetLocalModelReady, hadLocalModelReady, type LocalModelProgress } from './ai/local-provider'
import { createLocalProvider } from './ai/local-provider'
import { createInitialCapability, detectDeviceCapability, type CapabilityAssessment } from './ai/capability'
import { createEvaluationRouter, isInterpretingFeedback, isTranslationFeedback, type CloudConsentRequest } from './ai/provider'
import { database, DEFAULT_SETTINGS } from './storage/database'
import { Dashboard } from './features/dashboard/Dashboard'
import { FeedbackPanel } from './features/practice/FeedbackPanel'
import { PracticeSetup, type PracticeStart } from './features/practice/PracticeSetup'
import { TranslationWorkspace } from './features/practice/TranslationWorkspace'
import { InterpretingSetup, type InterpretingStart } from './features/interpreting/InterpretingSetup'
import { InterpretingWorkspace } from './features/interpreting/InterpretingWorkspace'
import { InterpretingFeedbackPanel } from './features/interpreting/InterpretingFeedbackPanel'
import { ProgressPage } from './features/progress/ProgressPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ExamCatalog } from './features/exam/ExamCatalog'
import { ExamRunner } from './features/exam/ExamRunner'
import { ExamResultsReport } from './features/exam/ExamResultsReport'
import { ExamEvaluationBlockedError, evaluateExamRun } from './features/exam/exam-evaluator'
import { DEFAULT_EXAM_PROFILES } from './data/exam-profiles'
import { getInterpretingExerciseById } from './data/interpreting-exercises'
import { DirectionQualityNotice, ModelCapabilityStatus } from './features/settings/ModelCapabilityStatus'
import type {
  ActiveExamRun,
  AudioRecordingRecord,
  ConsolidatedExamResult,
  ExamProfile,
  Exercise,
  InterpretingExercise,
  InterpretingExerciseSnapshot,
  InterpretingEvaluationInput,
  InterpretingFeedback,
  InterpretingMode,
  InterpretingSessionRecord,
  SessionRecord,
  StoredSettings,
  TranslationFeedback,
} from './domain/types'
import { DEFAULT_LOCAL_MODEL_ID } from './domain/types'
import { getLanguage } from './domain/languages'
import './features/practice/practice.css'
import './features/progress/progress.css'
import './features/exam/exam.css'
import './features/interpreting/interpreting.css'

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

type PendingPracticeConsent = {
  request: CloudConsentRequest
  answer: string
  elapsedSeconds: number
}

type PendingInterpretingConsent = {
  request: CloudConsentRequest
  input: InterpretingEvaluationInput
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
  exercise: Exercise | InterpretingExercise
  request: CloudConsentRequest
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const isWritten = 'sourceText' in exercise
  return (
    <div className="consent-backdrop" role="presentation">
      <div className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-heading">
        <p className="eyebrow">One task · explicit consent</p>
        <h2 id="consent-heading">Send this task to the cloud?</h2>
        <p>The local evaluator is not available for this task. Review the exact provider, model, text, audio metadata, and derived metrics below before making a one-time decision.</p>
        <p className="consent-warning">Provider: {request.payloadPreview.providerUrl} · Model: {request.payloadPreview.model}</p>
        <div className="consent-evidence">
          {isWritten ? (
            <>
              <section><h3>Exact source · {sourceLanguage.nativeLabel}</h3><p className="consent-quote" dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{request.sourceText}</p></section>
              <section><h3>Exact answer · {targetLanguage.nativeLabel}</h3><p className="consent-quote" dir={targetLanguage.direction} lang={exercise.targetLanguage}>{request.learnerAnswer}</p></section>
            </>
          ) : request.payloadPreview.parts.map((part, index) => (
            <section key={`${part.kind}-${index}`}><h3>{part.label}</h3>{part.text && <p className="consent-quote">{part.text}</p>}{part.previewUrl && <><audio controls preload="metadata" src={part.previewUrl}>Audio preview is unavailable.</audio><p className="consent-quote">{part.mimeType} · {part.durationMs} ms · {part.byteLength} bytes</p></>}</section>
          ))}
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
  const [cloudDraft, setCloudDraft] = useState({ baseUrl: '', model: '', apiKey: '', supportsAudio: false })
  const [localProgress, setLocalProgress] = useState<LocalModelProgress>({ status: 'not-prepared', text: 'Local model has not been prepared.' })
  const [capability, setCapability] = useState<CapabilityAssessment>(createInitialCapability)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | undefined>()
  const [practiceSetupMode, setPracticeSetupMode] = useState<'written' | 'interpreting'>('written')
  const [activeInterpretingExercise, setActiveInterpretingExercise] = useState<InterpretingExercise | undefined>()
  const [activeInterpretingMode, setActiveInterpretingMode] = useState<InterpretingMode>('consecutive')
  const [activeInterpretingSourceRecording, setActiveInterpretingSourceRecording] = useState<AudioRecordingRecord | undefined>()
  const [activeInterpretingSourceUrl, setActiveInterpretingSourceUrl] = useState<string | undefined>()
  const [activeInterpretingInput, setActiveInterpretingInput] = useState<InterpretingEvaluationInput | undefined>()
  const [interpretingFeedback, setInterpretingFeedback] = useState<InterpretingFeedback | undefined>()
  const [recentInterpretingSessions, setRecentInterpretingSessions] = useState<InterpretingSessionRecord[]>([])
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>()
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState(0)
  const [feedback, setFeedback] = useState<TranslationFeedback | undefined>()
  const [practiceNotice, setPracticeNotice] = useState<string | undefined>()
  const [pendingConsent, setPendingConsent] = useState<PendingPracticeConsent | undefined>()
  const [pendingInterpretingConsent, setPendingInterpretingConsent] = useState<PendingInterpretingConsent | undefined>()
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
      setCloudDraft({ baseUrl: savedSettings.cloudBaseUrl, model: savedSettings.cloudModel, apiKey: '', supportsAudio: savedSettings.cloudSupportsAudio })
    }).catch(() => undefined)
    void database.listSessions().then((sessions) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setRecentSessions(sessions)
      }
    }).catch(() => undefined)
    void database.listInterpretingSessions().then((sessions) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setRecentInterpretingSessions(sessions)
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
    setIsEvaluating(false)
    setIsEvaluatingExam(false)
    setExamEvaluationProgress(undefined)
    await database.clearData()
    localProvider.dispose()
    forgetLocalModelReady()
    setSettings(DEFAULT_SETTINGS)
    setCloudDraft({ baseUrl: '', model: '', apiKey: '', supportsAudio: false })
    setLocalProgress({ status: 'not-prepared', text: 'Local model has not been prepared.' })
    setRecentSessions([])
    setRecentInterpretingSessions([])
    setActiveExamRun(undefined)
    setRecentExamResults([])
    setActiveExamResult(undefined)
    setSelectedExamProfile(undefined)
    setExamView('catalog')
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setPendingInterpretingConsent(undefined)
    resetPractice()
  }

  function handleSelectExamProfile(profile: ExamProfile) {
    if (activeExamRun) {
      setExamEvaluationNotice('An unfinished exam is already saved. Resume it or discard it before starting a new simulation.')
      setExamView('catalog')
      setCurrentPage('exam')
      return
    }
    setSelectedExamProfile(profile)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setExamView('runner')
  }

  function handleResumeExamRun(run: ActiveExamRun) {
    const profile =
      examProfiles.find((p) => p.id === run.profileId) ??
      DEFAULT_EXAM_PROFILES.find((p) => p.id === run.profileId)
    if (!profile) {
      setSelectedExamProfile(undefined)
      setExamView('catalog')
      setExamEvaluationNotice('This saved exam uses a profile that is no longer available. Discard the saved attempt before starting a new simulation.')
      setCurrentPage('exam')
      return
    }
    if (run.profileVersion !== profile.version) {
      setSelectedExamProfile(undefined)
      setExamView('catalog')
      setExamEvaluationNotice(`This saved exam uses profile version ${run.profileVersion}, but version ${profile.version} is now installed. It cannot be resumed safely; discard the saved attempt before starting a new simulation.`)
      setCurrentPage('exam')
      return
    }
    setSelectedExamProfile(profile)
    setActiveExamRun(run)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setExamView('runner')
    setCurrentPage('exam')
  }

  async function handleDiscardExamRun(runId: string) {
    await database.deleteExamRun(runId)
    setActiveExamRun(undefined)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
  }

  async function handleSubmitExamRun(
    completedRun: ActiveExamRun,
    approvedFeedback: Record<string, TranslationFeedback> = {},
  ) {
    if (!selectedExamProfile) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    setActiveExamRun(completedRun)
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
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      const storedResult = await database.completeExamRun(completedRun.id, result)
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      setActiveExamRun(undefined)
      setActiveExamResult(storedResult)
      setRecentExamResults((prev) => [storedResult, ...prev.filter((r) => r.id !== storedResult.id && r.runId !== storedResult.runId)])
      setPendingExamConsent(undefined)
      setExamView('results')
    } catch (error) {
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
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
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluatingExam(false)
        setExamEvaluationProgress(undefined)
      }
    }
  }

  async function confirmExamCloudEvaluation() {
    const pending = pendingExamConsent
    if (!pending) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current

    setExamEvaluationNotice(undefined)
    setIsEvaluatingExam(true)
    try {
      const feedback = await pending.request.confirm()
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (!isTranslationFeedback(feedback)) {
        setExamEvaluationNotice('The cloud provider returned interpreting feedback for an exam passage. No practice estimate was saved; the exam remains available for retry.')
        return
      }
      setPendingExamConsent(undefined)
      await handleSubmitExamRun(pending.run, {
        ...pending.approvedFeedback,
        [pending.passageId]: feedback,
      })
    } catch (error) {
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      const reason = error instanceof Error ? error.message : 'Cloud evaluation could not be completed.'
      setExamEvaluationNotice(`Cloud evaluation could not be completed: ${reason} The exam remains unscored; you can retry.`)
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluatingExam(false)
        setExamEvaluationProgress(undefined)
      }
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

  function handleExamPersistenceError(message: string) {
    setExamEvaluationNotice((current) => current ? `${current} ${message}` : message)
  }

  function handleRetakeExam() {
    setExamView('catalog')
    setActiveExamResult(undefined)
    setSelectedExamProfile(undefined)
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
  }

  async function handleOpenExamResult(result: ConsolidatedExamResult) {
    try {
      const storedResult = await database.getExamResult(result.id)
      if (!storedResult) {
        setExamEvaluationNotice('This saved exam report is no longer available in local storage.')
        setCurrentPage('progress')
        return
      }
      setActiveExamResult(storedResult)
      setSelectedExamProfile(storedResult.profileSnapshot)
      setExamView('results')
      setExamEvaluationNotice(undefined)
      setCurrentPage('exam')
    } catch {
      setExamEvaluationNotice('This saved exam report could not be opened from local storage.')
      setCurrentPage('progress')
    }
  }


  function saveCloudPreferences(baseUrl: string, model: string, supportsAudio: boolean) {
    updateSettings({ ...settings, cloudBaseUrl: baseUrl.trim(), cloudModel: model.trim(), cloudSupportsAudio: supportsAudio })
  }

  function beginPractice(selection: PracticeStart) {
    setPracticeSetupMode('written')
    setActiveExercise(selection.exercise)
    setActiveInterpretingExercise(undefined)
    setActiveInterpretingInput(undefined)
    setInterpretingFeedback(undefined)
    setTimeLimitSeconds(selection.timeLimitSeconds)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setCurrentPage('practice')
  }

  function beginInterpreting(selection: InterpretingStart) {
    if (activeInterpretingSourceUrl && activeInterpretingSourceUrl !== selection.exercise.audioUrl) {
      URL.revokeObjectURL(activeInterpretingSourceUrl)
    }
    setPracticeSetupMode('interpreting')
    setActiveExercise(undefined)
    setActiveInterpretingExercise(selection.exercise)
    setActiveInterpretingMode(selection.interpretingMode)
    setActiveInterpretingSourceRecording(selection.sourceRecording)
    setActiveInterpretingSourceUrl(selection.sourceRecording ? selection.exercise.audioUrl : undefined)
    setActiveInterpretingInput(undefined)
    setInterpretingFeedback(undefined)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setPendingInterpretingConsent(undefined)
    setCurrentPage('practice')
  }

  function resetPractice() {
    if (activeInterpretingSourceUrl) {
      URL.revokeObjectURL(activeInterpretingSourceUrl)
    }
    setPracticeSetupMode('written')
    setActiveExercise(undefined)
    setActiveInterpretingExercise(undefined)
    setActiveInterpretingInput(undefined)
    setActiveInterpretingSourceRecording(undefined)
    setActiveInterpretingSourceUrl(undefined)
    setInterpretingFeedback(undefined)
    setTimeLimitSeconds(undefined)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setPendingInterpretingConsent(undefined)
  }

  async function saveCompletedSession(
    nextFeedback: TranslationFeedback,
    provider: 'local' | 'cloud',
    answer: string,
    elapsedSeconds: number,
    generation: number,
  ) {
    if (!activeExercise || dataLoadGeneration.current !== generation) {
      return
    }
    const session: SessionRecord = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      exerciseId: activeExercise.id,
      mode: activeExercise.mode,
      sourceLanguage: activeExercise.sourceLanguage,
      targetLanguage: activeExercise.targetLanguage,
      answer,
      feedback: nextFeedback,
      elapsedSeconds,
    }
    setFeedback(nextFeedback)
    setPracticeNotice(`${provider === 'cloud' ? 'Cloud' : 'Local'} evaluation complete. Saved to this device.`)
    try {
      await database.saveSession(session)
      if (dataLoadGeneration.current !== generation) {
        return
      }
      setRecentSessions((sessions) => [session, ...sessions.filter((item) => item.id !== session.id)])
    } catch {
      if (dataLoadGeneration.current === generation) {
        setPracticeNotice('Feedback is ready, but this browser could not save the session locally.')
      }
    }
  }

  async function saveCompletedInterpretingSession(
    input: InterpretingEvaluationInput,
    nextFeedback: InterpretingFeedback,
    provider: 'local' | 'cloud' | 'manual',
    generation: number,
  ) {
    const sessionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `interpreting-session-${Date.now()}`
    let sourceExercise: InterpretingExerciseSnapshot | undefined
    if (input.sourceRecording) {
      const { audioUrl: _audioUrl, ...snapshot } = input.exercise
      sourceExercise = snapshot
    }
    const session: InterpretingSessionRecord = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      exerciseId: input.exercise.id,
      mode: 'interpreting',
      sourceLanguage: input.exercise.sourceLanguage,
      targetLanguage: input.exercise.targetLanguage,
      interpretingMode: input.interpretingMode,
      responseSegments: input.responseSegments,
      recordingIds: input.recordings.map((recording) => recording.id),
      sourceRecordingId: input.sourceRecording?.id,
      sourceExercise,
      deliveryAnalysis: input.deliveryAnalysis,
      feedback: nextFeedback,
      evaluator: provider,
    }
    setActiveInterpretingInput(input)
    setInterpretingFeedback(nextFeedback)
    setPracticeNotice(`${provider === 'cloud' ? 'Cloud' : provider === 'local' ? 'Local' : 'Manual'} interpreting feedback is ready. Practice estimates are saved only on this device.`)
    if (dataLoadGeneration.current !== generation) {
      return
    }
    try {
      const recordings = input.sourceRecording ? [...input.recordings, input.sourceRecording] : input.recordings
      await Promise.all(recordings.map((recording: AudioRecordingRecord) => database.saveAudioRecording({ ...recording, sessionId })))
      await database.saveInterpretingSession(session)
      if (dataLoadGeneration.current !== generation) {
        return
      }
      setRecentInterpretingSessions((sessions) => [session, ...sessions.filter((item) => item.id !== session.id)])
    } catch {
      if (dataLoadGeneration.current === generation) {
        setPracticeNotice('Interpreting feedback is ready, but this browser could not save the audio-backed session locally.')
      }
    }
  }

  async function handleOpenInterpretingSession(session: InterpretingSessionRecord) {
    let exercise = getInterpretingExerciseById(session.exerciseId)
    let sourceRecording: AudioRecordingRecord | undefined
    let sourceUrl: string | undefined
    if (session.sourceRecordingId && session.sourceExercise) {
      sourceRecording = await database.getAudioRecording(session.sourceRecordingId)
      if (!sourceRecording) {
        setPracticeNotice('This saved local source audio is no longer available in this browser.')
        setCurrentPage('progress')
        return
      }
      sourceUrl = URL.createObjectURL(sourceRecording.blob)
      exercise = { ...session.sourceExercise, audioUrl: sourceUrl }
    }
    if (!exercise) {
      setPracticeNotice('This saved interpreting exercise is no longer available in the installed catalog.')
      setCurrentPage('progress')
      return
    }
    const recordings = (await Promise.all(session.recordingIds.map((recordingId) => database.getAudioRecording(recordingId)))).filter((recording): recording is AudioRecordingRecord => recording !== undefined)
    if (activeInterpretingSourceUrl) {
      URL.revokeObjectURL(activeInterpretingSourceUrl)
    }
    setActiveExercise(undefined)
    setPracticeSetupMode('interpreting')
    setActiveInterpretingExercise(exercise)
    setActiveInterpretingMode(session.interpretingMode)
    setActiveInterpretingSourceRecording(sourceRecording)
    setActiveInterpretingSourceUrl(sourceUrl)
    setActiveInterpretingInput({
      exercise,
      interpretingMode: session.interpretingMode,
      responseSegments: session.responseSegments,
      recordings,
      deliveryAnalysis: session.deliveryAnalysis,
      sourceRecording,
    })
    setInterpretingFeedback(session.feedback)
    setPracticeNotice(recordings.length === session.recordingIds.length && (!session.sourceRecordingId || sourceRecording !== undefined)
      ? 'Reopened from this device. Audio replay remains local.'
      : 'Reopened from this device, but one or more local replay files are missing.')
    setCurrentPage('practice')
  }

  async function submitAnswer(answer: string, elapsedSeconds: number) {
    if (!activeExercise) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    setDraftAnswer(answer)
    setDraftElapsedSeconds(elapsedSeconds)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setIsEvaluating(true)
    try {
      const result = await evaluationRouter.evaluate({ exercise: activeExercise, learnerAnswer: answer, mode: activeExercise.mode })
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (result.status === 'evaluated') {
        if (isTranslationFeedback(result.feedback)) {
          await saveCompletedSession(result.feedback, result.provider, answer, elapsedSeconds, submissionGeneration)
        } else {
          setPracticeNotice('The evaluator returned interpreting feedback for a written task. No practice estimate was saved.')
        }
      } else if (result.status === 'needs-consent') {
        setPendingConsent({ request: result.request, answer, elapsedSeconds })
        setPracticeNotice(`${result.reason} Review the exact task before deciding whether to use cloud evaluation.`)
      } else {
        setPracticeNotice(result.reason)
      }
    } catch (error) {
      if (dataLoadGeneration.current === submissionGeneration) {
        setPracticeNotice(error instanceof Error ? error.message : 'Evaluation could not be completed.')
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluating(false)
      }
    }
  }

  async function submitInterpreting(input: InterpretingEvaluationInput) {
    const enrichedInput = activeInterpretingSourceRecording
      ? { ...input, sourceRecording: activeInterpretingSourceRecording }
      : input
    const submissionGeneration = dataLoadGeneration.current
    setActiveInterpretingInput(enrichedInput)
    setPracticeNotice(undefined)
    setPendingInterpretingConsent(undefined)
    setIsEvaluating(true)
    try {
      const result = await evaluationRouter.evaluate(enrichedInput)
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (result.status === 'evaluated') {
        if (isInterpretingFeedback(result.feedback)) {
          await saveCompletedInterpretingSession(enrichedInput, result.feedback, result.provider, submissionGeneration)
        } else {
          setPracticeNotice('The evaluator returned written feedback for an interpreting task. No practice estimate was saved.')
        }
      } else if (result.status === 'needs-consent') {
        setPendingInterpretingConsent({ request: result.request, input: enrichedInput })
        setPracticeNotice(`${result.reason} Review the exact audio and transcript payload before deciding whether to use cloud evaluation.`)
      } else {
        setPracticeNotice(result.reason)
      }
    } catch (error) {
      if (dataLoadGeneration.current === submissionGeneration) {
        setPracticeNotice(error instanceof Error ? error.message : 'Interpreting evaluation could not be completed.')
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluating(false)
      }
    }
  }

  async function confirmCloudEvaluation() {
    const pending = pendingConsent
    if (!pending) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    setIsEvaluating(true)
    try {
      const nextFeedback = await pending.request.confirm()
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (!isTranslationFeedback(nextFeedback)) {
        setPracticeNotice('The cloud provider returned interpreting feedback for a written task. No practice estimate was saved.')
        return
      }
      setPendingConsent(undefined)
      await saveCompletedSession(nextFeedback, 'cloud', pending.answer, pending.elapsedSeconds, submissionGeneration)
    } catch (error) {
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current === submissionGeneration) {
        setPracticeNotice(error instanceof Error ? error.message : 'Cloud evaluation could not be completed. You can review the consent and try again.')
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluating(false)
      }
    }
  }

  async function confirmInterpretingCloudEvaluation() {
    const pending = pendingInterpretingConsent
    if (!pending) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    setIsEvaluating(true)
    try {
      const nextFeedback = await pending.request.confirm()
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (!isInterpretingFeedback(nextFeedback)) {
        setPracticeNotice('The cloud provider returned written feedback for an interpreting task. No practice estimate was saved.')
        return
      }
      setPendingInterpretingConsent(undefined)
      await saveCompletedInterpretingSession(pending.input, nextFeedback, 'cloud', submissionGeneration)
    } catch (error) {
      pending.request.revokePreview?.()
      if (dataLoadGeneration.current === submissionGeneration) {
        setPracticeNotice(error instanceof Error ? error.message : 'Cloud interpreting evaluation could not be completed. The audio and transcript remain local.')
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluating(false)
      }
    }
  }

  const pageCopyForCurrentPage = pageCopy[currentPage]
  const isTakingExam = currentPage === 'exam' && examView === 'runner' && selectedExamProfile !== undefined
  const isTakingInterpreting = currentPage === 'practice' && activeInterpretingExercise !== undefined && interpretingFeedback === undefined

  return (
    <div className="app-shell">
      {!isTakingExam && !isTakingInterpreting && <aside className="sidebar"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></aside>}
      <main className="main-content">
        {!isTakingExam && !isTakingInterpreting && (
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
            onStartInterpreting={() => { setPracticeSetupMode('interpreting'); setCurrentPage('practice') }}
            onNavigate={(page) => {
              if (page === 'exam' && activeExamRun) {
                handleResumeExamRun(activeExamRun)
              } else {
                setCurrentPage(page)
              }
            }}
          />
        )}
        {currentPage === 'practice' && !activeExercise && !activeInterpretingExercise && practiceSetupMode === 'written' && <><DirectionQualityNotice capability={capability} /><PracticeSetup evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginPractice} /></>}
        {currentPage === 'practice' && !activeExercise && !activeInterpretingExercise && practiceSetupMode === 'interpreting' && <InterpretingSetup evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginInterpreting} />}
        {currentPage === 'practice' && activeExercise && !feedback && <TranslationWorkspace exercise={activeExercise} initialAnswer={draftAnswer} initialElapsedSeconds={draftElapsedSeconds} isSubmitting={isEvaluating} notice={practiceNotice} timeLimitSeconds={timeLimitSeconds} onCancel={resetPractice} onDraftChange={setDraftAnswer} onElapsedChange={setDraftElapsedSeconds} onSubmit={submitAnswer} />}
        {currentPage === 'practice' && activeExercise && feedback && <FeedbackPanel answer={draftAnswer} exercise={activeExercise} feedback={feedback} onRevise={() => { setFeedback(undefined); setPracticeNotice('Revise your answer, then submit again for a new practice estimate.') }} onChangeSetup={resetPractice} />}
        {currentPage === 'practice' && activeInterpretingExercise && !interpretingFeedback && <InterpretingWorkspace exercise={activeInterpretingExercise} interpretingMode={activeInterpretingMode} isSubmitting={isEvaluating} notice={practiceNotice} onCancel={resetPractice} onSubmit={(input) => void submitInterpreting(input)} />}
        {currentPage === 'practice' && activeInterpretingExercise && interpretingFeedback && activeInterpretingInput && <InterpretingFeedbackPanel exercise={activeInterpretingExercise} input={activeInterpretingInput} feedback={interpretingFeedback} notice={practiceNotice} onRevise={() => { setInterpretingFeedback(undefined); setPracticeNotice('Review the take and transcript, then submit again.') }} onChangeSetup={resetPractice} />}
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
            onPersistenceError={handleExamPersistenceError}
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
            interpretingSessions={recentInterpretingSessions}
            examResults={recentExamResults}
            onStartPractice={() => setCurrentPage('practice')}
            onStartInterpreting={() => { setPracticeSetupMode('interpreting'); setCurrentPage('practice') }}
            onOpenInterpretingSession={(session) => void handleOpenInterpretingSession(session).catch(() => { setPracticeNotice('This saved interpreting session could not be opened from local storage.'); setCurrentPage('progress') })}
            onOpenExamResult={(result) => void handleOpenExamResult(result)}
            onStartExam={() => {
              setExamView('catalog')
              setSelectedExamProfile(undefined)
              setActiveExamResult(undefined)
              setCurrentPage('exam')
            }}
          />
        )}
        {currentPage === 'settings' && <SettingsPage capability={capability} cloudDraft={cloudDraft} localProgress={localProgress} localProvider={localProvider} onCloudDraftChange={setCloudDraft} onDeleteData={clearLocalData} onEvaluationModeChange={(mode) => updateSettings({ ...settings, evaluationMode: mode })} onPrepareLocal={prepareLocalModel} onSaveCloudPreferences={saveCloudPreferences} settings={settings} sessionCount={recentSessions.length} interpretingSessionCount={recentInterpretingSessions.length} />}
      </main>
      {!isTakingExam && !isTakingInterpreting && <div className="mobile-navigation"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></div>}
      {activeExercise && pendingConsent && <ConsentDialog exercise={activeExercise} request={pendingConsent.request} isSubmitting={isEvaluating} onCancel={() => { pendingConsent.request.revokePreview?.(); setPendingConsent(undefined) }} onConfirm={() => void confirmCloudEvaluation()} />}
      {pendingInterpretingConsent && <ConsentDialog exercise={pendingInterpretingConsent.request.exercise} request={pendingInterpretingConsent.request} isSubmitting={isEvaluating} onCancel={() => { pendingInterpretingConsent.request.revokePreview?.(); setPendingInterpretingConsent(undefined); setPracticeNotice('Cloud evaluation was not approved. Audio and transcripts remain local.') }} onConfirm={() => void confirmInterpretingCloudEvaluation()} />}
      {pendingExamConsent && (
        <ConsentDialog
          exercise={pendingExamConsent.request.exercise}
          request={pendingExamConsent.request}
          isSubmitting={isEvaluatingExam}
          onCancel={() => {
            pendingExamConsent.request.revokePreview?.()
            setPendingExamConsent(undefined)
            setExamEvaluationNotice('Cloud evaluation was not approved. No practice estimate was saved; the exam remains available for retry.')
          }}
          onConfirm={() => void confirmExamCloudEvaluation()}
        />
      )}
    </div>
  )
}

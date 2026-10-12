import { useEffect, useMemo, useRef, useState } from 'react'
import { createCloudProvider, validateCloudProviderPreferences } from './ai/cloud-provider'
import { forgetLocalModelReady, hadLocalModelReady, type LocalModelProgress } from './ai/local-provider'
import { createLocalProvider } from './ai/local-provider'
import { createInitialCapability, detectDeviceCapability, type CapabilityAssessment } from './ai/capability'
import { createEvaluationRouter, isInterpretingFeedback, isTranslationFeedback, type CloudConsentRequest } from './ai/provider'
import { database, DEFAULT_SETTINGS, subscribeToDataCleared, subscribeToDatabaseNotice } from './storage/database'
import { Dashboard } from './features/dashboard/Dashboard'
import { FeedbackPanel } from './features/practice/FeedbackPanel'
import { PracticeSetup, type PracticeStart } from './features/practice/PracticeSetup'
import { TranslationWorkspace } from './features/practice/TranslationWorkspace'
import { createWrittenEvaluationGuard, runWrittenEvaluationAttempt, type WrittenEvaluationAttempt } from './features/practice/written-evaluation-guard'
import { InterpretingSetup, type InterpretingStart } from './features/interpreting/InterpretingSetup'
import { InterpretingWorkspace } from './features/interpreting/InterpretingWorkspace'
import { InterpretingFeedbackPanel } from './features/interpreting/InterpretingFeedbackPanel'
import { rebasePendingInterpretingSaves } from './features/interpreting/pending-persistence'
import { SessionHistoryNotice } from './features/progress/SessionHistoryNotice'
import { ProgressPage } from './features/progress/ProgressPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { createLocalModelStatusSettingsUpdate, isLocalProgressGenerationCurrent } from './features/settings/local-model-progress-guard'
import { mergeRecentSessions, persistWrittenPracticeSession, readHistoryRecords, type SessionHistoryStatus } from './features/practice/session-history'
import { createSettingsHydrationAttempt, runAfterSettingsHydrated, type SettingsHydrationAttempt } from './features/settings/settings-hydration'
import { getSavedExamRunAfterExit } from './features/exam/exam-exit'
import { isInterpretingOpenCurrent } from './features/interpreting/session-open-guard'
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

export type Page = 'home' | 'practice' | 'interpreting' | 'exam' | 'progress' | 'settings'

type NavigationItem = {
  id: Page
  label: string
  icon: string
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'practice', label: 'Practice', icon: '✎' },
  { id: 'interpreting', label: 'Interpreting', icon: '♫' },
  { id: 'exam', label: 'Exam', icon: '◷' },
  { id: 'progress', label: 'Progress', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const pageCopy: Record<Page, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'Your study space', title: 'Translate with intention.' },
  practice: { eyebrow: 'Practice desk', title: 'Make a translation pass.' },
  interpreting: { eyebrow: 'Audio practice', title: 'Listen, interpret, and review.' },
  exam: { eyebrow: 'Exam simulation', title: 'Test under realistic conditions.' },
  progress: { eyebrow: 'Local history', title: 'See the work you have done.' },
  settings: { eyebrow: 'Privacy and setup', title: 'Keep your practice yours.' },
}

async function snapshotBundledSourceAudio(exercise: InterpretingExercise): Promise<AudioRecordingRecord> {
  const response = await fetch(exercise.audioUrl)
  if (!response.ok) {
    throw new Error('The bundled source audio could not be saved for this self-review.')
  }
  const blob = await response.blob()
  const mimeType = blob.type || 'audio/wav'
  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `source-${Date.now()}`,
    exerciseId: exercise.id,
    segmentIds: exercise.segments.map((segment) => segment.id),
    createdAt: new Date().toISOString(),
    mimeType,
    durationMs: exercise.durationMs,
    byteLength: blob.size,
    blob,
    kind: 'source-bundled',
    fileName: `${exercise.id}-source.${mimeType.split('/')[1]?.split(';')[0] ?? 'audio'}`,
  }
}

type PendingExamConsent = {
  run: ActiveExamRun
  passageId: string
  request: CloudConsentRequest
  approvedFeedback: Record<string, TranslationFeedback>
}

type PendingPracticeConsent = {
  exercise: Exercise
  attempt: WrittenEvaluationAttempt
  request: CloudConsentRequest
  answer: string
  elapsedSeconds: number
}

type PendingInterpretingConsent = {
  request: CloudConsentRequest
  input: InterpretingEvaluationInput
}

type PendingInterpretingPersistence = {
  id: string
  createdAt: string
  input: InterpretingEvaluationInput
  feedback: InterpretingFeedback
  provider: 'local' | 'cloud' | 'manual'
  generation: number
  session?: InterpretingSessionRecord
  recordings?: AudioRecordingRecord[]
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
        {!isWritten && <p className="consent-warning">Source clip audio stays on this device. Only the text and learner-audio parts listed below are sent after you confirm.</p>}
        <p className="consent-warning">Provider: {request.payloadPreview.providerUrl} · Model: {request.payloadPreview.model}</p>
        <div className="consent-evidence">
          {isWritten ? (
            <>
              <section><h3>Exact source · {sourceLanguage.nativeLabel}</h3><p className="consent-quote" dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{request.sourceText}</p></section>
              <section><h3>Exact answer · {targetLanguage.nativeLabel}</h3><p className="consent-quote" dir={targetLanguage.direction} lang={exercise.targetLanguage}>{request.learnerAnswer}</p></section>
            </>
          ) : request.payloadPreview.parts.map((part, index) => {
            const partLanguage = part.language ? getLanguage(part.language) : undefined
            return (
              <section key={`${part.kind}-${index}`}>
                <h3>{part.label}</h3>
                {part.text && <p className="consent-quote" dir={partLanguage?.direction} lang={partLanguage?.code}>{part.text}</p>}
                {part.previewUrl && <><audio controls preload="metadata" src={part.previewUrl}>Audio preview is unavailable.</audio><p className="consent-quote">{part.mimeType} · {part.durationMs} ms · {part.byteLength} bytes</p></>}
              </section>
            )
          })}
        </div>
        <p className="consent-warning">This is a one-time decision for this task. The API key remains session-only, and the service worker does not cache this request or response.</p>
        <div className="consent-actions"><button className="button button--quiet" type="button" onClick={onCancel} disabled={isSubmitting}>Keep local-only</button><button className="button button--primary" type="button" onClick={onConfirm} disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Consent and evaluate'} <span aria-hidden="true">→</span></button></div>
      </div>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const currentPageRef = useRef<Page>(currentPage)
  currentPageRef.current = currentPage
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS)
  const [cloudDraft, setCloudDraft] = useState({ baseUrl: '', model: '', apiKey: '', supportsAudio: false })
  const [databaseNotice, setDatabaseNotice] = useState<string | undefined>()
  const [remoteDataNotice, setRemoteDataNotice] = useState<string | undefined>()
  const [settingsHydrationStatus, setSettingsHydrationStatus] = useState<SessionHistoryStatus>('loading')
  const [localProgress, setLocalProgress] = useState<LocalModelProgress>({ status: 'not-prepared', text: 'Local model has not been prepared.' })
  const [capability, setCapability] = useState<CapabilityAssessment>(createInitialCapability)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [sessionHistoryStatus, setSessionHistoryStatus] = useState<SessionHistoryStatus>('loading')
  const [activeExercise, setActiveExercise] = useState<Exercise | undefined>()
  const [practiceSetupMode, setPracticeSetupMode] = useState<'written' | 'interpreting'>('written')
  const [activeInterpretingExercise, setActiveInterpretingExercise] = useState<InterpretingExercise | undefined>()
  const [activeInterpretingMode, setActiveInterpretingMode] = useState<InterpretingMode>('consecutive')
  const [activeInterpretingSourceRecording, setActiveInterpretingSourceRecording] = useState<AudioRecordingRecord | undefined>()
  const [activeInterpretingSourceUrl, setActiveInterpretingSourceUrl] = useState<string | undefined>()
  const [activeInterpretingSessionId, setActiveInterpretingSessionId] = useState<string | undefined>()
  const [activeInterpretingInput, setActiveInterpretingInput] = useState<InterpretingEvaluationInput | undefined>()
  const [interpretingFeedback, setInterpretingFeedback] = useState<InterpretingFeedback | undefined>()
  const [recentInterpretingSessions, setRecentInterpretingSessions] = useState<InterpretingSessionRecord[]>([])
  const [interpretingHistoryStatus, setInterpretingHistoryStatus] = useState<SessionHistoryStatus>('loading')
  const [pendingInterpretingSaves, setPendingInterpretingSaves] = useState<PendingInterpretingPersistence[]>([])
  const [savingInterpretingSaveIds, setSavingInterpretingSaveIds] = useState<Set<string>>(new Set())
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
  const [examHistoryStatus, setExamHistoryStatus] = useState<SessionHistoryStatus>('loading')
  const [examView, setExamView] = useState<'catalog' | 'runner' | 'results'>('catalog')
  const [selectedExamProfile, setSelectedExamProfile] = useState<ExamProfile | undefined>()
  const [activeExamResult, setActiveExamResult] = useState<ConsolidatedExamResult | undefined>()
  const [isEvaluatingExam, setIsEvaluatingExam] = useState(false)
  const [examEvaluationProgress, setExamEvaluationProgress] = useState<{ completed: number; total: number } | undefined>()
  const [examEvaluationNotice, setExamEvaluationNotice] = useState<string | undefined>()
  const [pendingExamConsent, setPendingExamConsent] = useState<PendingExamConsent | undefined>()
  const [examRecoveryStatus, setExamRecoveryStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [localProviderEpoch, setLocalProviderEpoch] = useState(0)
  const [initialPracticeMode, setInitialPracticeMode] = useState<'written' | 'news'>('written')
  const settingsRef = useRef<StoredSettings>(DEFAULT_SETTINGS)
  const settingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve())
  const settingsHydrationRef = useRef<SettingsHydrationAttempt | undefined>(undefined)
  const cloudDraftRevisionRef = useRef(0)
  const dataLoadGeneration = useRef(0)
  const sessionHistoryLoadRequestRef = useRef(0)
  const interpretingHistoryLoadRequestRef = useRef(0)
  const examHistoryLoadRequestRef = useRef(0)
  const lastRemoteClearEpochRef = useRef<string | undefined>(undefined)
  const localProviderEpochRef = useRef(0)
  const localProgressHandlerRef = useRef<(progress: LocalModelProgress, providerEpoch: number, dataGeneration: number) => void>(() => undefined)
  const remoteDataClearHandlerRef = useRef<(epoch: string) => void>(() => undefined)
  const pendingPersistenceRef = useRef(new Set<Promise<unknown>>())
  const diagnosticAutoStarted = useRef(false)
  const interpretingSessionOpenGenerationRef = useRef(0)
  const examStartRequestRef = useRef(false)
  const examResultOpenGenerationRef = useRef(0)
  const savingInterpretingSaveIdsRef = useRef(new Set<string>())
  const writtenEvaluationGuardRef = useRef(createWrittenEvaluationGuard())

  if (!settingsHydrationRef.current) settingsHydrationRef.current = createSettingsHydrationAttempt()

  useEffect(() => {
    const sourceUrl = activeInterpretingSourceUrl
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl)
      }
    }
  }, [activeInterpretingSourceUrl])

  const handleLocalProgress = (progress: LocalModelProgress, providerEpoch: number, dataGeneration: number) => {
    const expectedGeneration = { providerEpoch, dataGeneration }
    const isCurrent = () => isLocalProgressGenerationCurrent(expectedGeneration, {
      providerEpoch: localProviderEpochRef.current,
      dataGeneration: dataLoadGeneration.current,
    })
    if (!isCurrent()) {
      return
    }
    setLocalProgress(progress)
    if (progress.status === 'ready' || progress.status === 'unavailable') {
      void updateSettings(createLocalModelStatusSettingsUpdate(progress.status, expectedGeneration, () => ({
        providerEpoch: localProviderEpochRef.current,
        dataGeneration: dataLoadGeneration.current,
      }))).catch(() => undefined)
    }
  }

  localProgressHandlerRef.current = handleLocalProgress
  const localProvider = useMemo(() => {
    const providerEpoch = localProviderEpoch
    const dataGeneration = dataLoadGeneration.current
    return createLocalProvider(DEFAULT_LOCAL_MODEL_ID, (progress) => {
      if (isLocalProgressGenerationCurrent({ providerEpoch, dataGeneration }, {
        providerEpoch: localProviderEpochRef.current,
        dataGeneration: dataLoadGeneration.current,
      })) {
        localProgressHandlerRef.current(progress, providerEpoch, dataGeneration)
      }
    })
  }, [localProviderEpoch])

  function trackPersistence<T>(operation: Promise<T>): Promise<T> {
    let tracked: Promise<T>
    tracked = operation.finally(() => pendingPersistenceRef.current.delete(tracked))
    pendingPersistenceRef.current.add(tracked)
    return tracked
  }

  async function loadWrittenSessionHistory() {
    const dataGeneration = dataLoadGeneration.current
    const request = ++sessionHistoryLoadRequestRef.current
    setSessionHistoryStatus('loading')
    const result = await readHistoryRecords(() => database.listSessions())
    if (dataLoadGeneration.current !== dataGeneration || sessionHistoryLoadRequestRef.current !== request) return
    if (result.status === 'failed') setSessionHistoryStatus('failed')
    else {
      setRecentSessions((current) => mergeRecentSessions(result.records, current))
      setSessionHistoryStatus('ready')
    }
  }

  async function loadInterpretingHistory() {
    const dataGeneration = dataLoadGeneration.current
    const request = ++interpretingHistoryLoadRequestRef.current
    setInterpretingHistoryStatus('loading')
    const result = await readHistoryRecords(() => database.listInterpretingSessions())
    if (dataLoadGeneration.current !== dataGeneration || interpretingHistoryLoadRequestRef.current !== request) return
    if (result.status === 'failed') setInterpretingHistoryStatus('failed')
    else {
      setRecentInterpretingSessions(result.records)
      setInterpretingHistoryStatus('ready')
    }
  }

  async function loadExamHistory() {
    const dataGeneration = dataLoadGeneration.current
    const request = ++examHistoryLoadRequestRef.current
    setExamHistoryStatus('loading')
    const result = await readHistoryRecords(() => database.listExamResults())
    if (dataLoadGeneration.current !== dataGeneration || examHistoryLoadRequestRef.current !== request) return
    if (result.status === 'failed') setExamHistoryStatus('failed')
    else {
      setRecentExamResults(result.records)
      setExamHistoryStatus('ready')
    }
  }

  async function loadStoredSettings() {
    const attempt = createSettingsHydrationAttempt()
    settingsHydrationRef.current = attempt
    const loadGeneration = dataLoadGeneration.current
    const cloudDraftRevisionAtLoad = cloudDraftRevisionRef.current
    setSettingsHydrationStatus('loading')
    try {
      const savedSettings = await database.getSettings()
      if (dataLoadGeneration.current !== loadGeneration || settingsHydrationRef.current !== attempt) {
        attempt.complete(false)
        return
      }
      settingsRef.current = savedSettings
      setSettings(savedSettings)
      if (cloudDraftRevisionRef.current === cloudDraftRevisionAtLoad) {
        setCloudDraft({ baseUrl: savedSettings.cloudBaseUrl, model: savedSettings.cloudModel, apiKey: '', supportsAudio: savedSettings.cloudSupportsAudio })
      }
      attempt.complete(true)
      setSettingsHydrationStatus('ready')
    } catch {
      attempt.complete(false)
      if (dataLoadGeneration.current === loadGeneration && settingsHydrationRef.current === attempt) {
        setSettingsHydrationStatus('failed')
      }
    }
  }

  useEffect(() => () => localProvider.dispose(), [localProvider])

  useEffect(() => subscribeToDatabaseNotice(setDatabaseNotice), [])
  remoteDataClearHandlerRef.current = handleRemoteDataCleared
  useEffect(() => subscribeToDataCleared((epoch) => remoteDataClearHandlerRef.current(epoch)), [])

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
    void loadStoredSettings()
    void loadWrittenSessionHistory()
    void loadInterpretingHistory()
    void database.listExamProfiles().then((profiles) => {
      if (dataLoadGeneration.current === loadGeneration && profiles.length > 0) {
        setExamProfiles(profiles)
      }
    }).catch(() => undefined)
    void database.getActiveExamRun().then((run) => {
      if (dataLoadGeneration.current === loadGeneration) {
        setActiveExamRun(run)
        setExamRecoveryStatus('ready')
      }
    }).catch(() => {
      if (dataLoadGeneration.current === loadGeneration) {
        setExamRecoveryStatus('failed')
        setExamEvaluationNotice('Saved exam recovery could not be checked. Reload this page before starting another exam.')
      }
    })
    void loadExamHistory()
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

  function updateSettings(update: Partial<StoredSettings> | ((current: StoredSettings) => StoredSettings)): Promise<void> {
    const operation = settingsWriteQueueRef.current.then(async () => {
      const hydration = settingsHydrationRef.current
      if (!hydration) throw new Error('Saved settings have not been loaded.')
      await runAfterSettingsHydrated(hydration, async () => {
        const previous = settingsRef.current
        const nextSettings = typeof update === 'function' ? update(previous) : { ...previous, ...update }
        if (nextSettings === previous) return
        settingsRef.current = nextSettings
        setSettings(nextSettings)
        try {
          await database.saveSettings(nextSettings)
        } catch (error) {
          if (settingsRef.current === nextSettings) {
            settingsRef.current = previous
            setSettings(previous)
          }
          throw error
        }
      })
    })
    const trackedOperation = trackPersistence(operation)
    settingsWriteQueueRef.current = trackedOperation.then(() => undefined, () => undefined)
    return trackedOperation
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

  function resetUiAfterLocalDataClear(nextProviderEpoch: number, notice?: string) {
    interpretingSessionOpenGenerationRef.current += 1
    setLocalProviderEpoch(nextProviderEpoch)
    forgetLocalModelReady()
    const readySettingsHydration = createSettingsHydrationAttempt()
    readySettingsHydration.complete(true)
    settingsHydrationRef.current = readySettingsHydration
    setSettingsHydrationStatus('ready')
    settingsRef.current = DEFAULT_SETTINGS
    setSettings(DEFAULT_SETTINGS)
    setCloudDraft({ baseUrl: '', model: '', apiKey: '', supportsAudio: false })
    setLocalProgress({ status: 'not-prepared', text: 'Local model has not been prepared.' })
    setRecentSessions([])
    sessionHistoryLoadRequestRef.current += 1
    setSessionHistoryStatus('ready')
    setRecentInterpretingSessions([])
    interpretingHistoryLoadRequestRef.current += 1
    setInterpretingHistoryStatus('ready')
    setPendingInterpretingSaves([])
    setActiveExamRun(undefined)
    setRecentExamResults([])
    examHistoryLoadRequestRef.current += 1
    setExamHistoryStatus('ready')
    setExamProfiles(DEFAULT_EXAM_PROFILES)
    setActiveExamResult(undefined)
    setSelectedExamProfile(undefined)
    setExamView('catalog')
    setExamRecoveryStatus('ready')
    setExamEvaluationNotice(undefined)
    setPendingExamConsent(undefined)
    setPendingInterpretingConsent(undefined)
    setActiveExercise(undefined)
    setActiveInterpretingExercise(undefined)
    setActiveInterpretingInput(undefined)
    setActiveInterpretingSourceRecording(undefined)
    setActiveInterpretingSourceUrl(undefined)
    setActiveInterpretingSessionId(undefined)
    setInterpretingFeedback(undefined)
    setPracticeSetupMode('written')
    setTimeLimitSeconds(undefined)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPendingConsent(undefined)
    setPracticeNotice(undefined)
    setRemoteDataNotice(notice)
    setCurrentPage('home')
  }

  function handleRemoteDataCleared(epoch: string) {
    if (lastRemoteClearEpochRef.current === epoch) return
    lastRemoteClearEpochRef.current = epoch
    dataLoadGeneration.current += 1
    writtenEvaluationGuardRef.current.activate(undefined)
    pendingConsent?.request.revokePreview?.()
    pendingInterpretingConsent?.request.revokePreview?.()
    setPendingConsent(undefined)
    setPendingInterpretingConsent(undefined)
    const nextProviderEpoch = localProviderEpochRef.current + 1
    localProviderEpochRef.current = nextProviderEpoch
    localProvider.dispose()
    setIsEvaluating(false)
    setIsEvaluatingExam(false)
    setExamEvaluationProgress(undefined)
    resetUiAfterLocalDataClear(nextProviderEpoch, 'Local data was cleared in another tab. This tab has discarded its stale view; reload it before saving new work.')
  }

  async function retryHistoryReads() {
    await Promise.all([loadWrittenSessionHistory(), loadInterpretingHistory(), loadExamHistory()])
  }

  async function clearLocalData() {
    // Refuse unsupported browsers before stopping providers or discarding live UI state.
    database.assertCanClearData()
    dataLoadGeneration.current += 1
    writtenEvaluationGuardRef.current.activate(undefined)
    pendingConsent?.request.revokePreview?.()
    setPendingConsent(undefined)
    const nextProviderEpoch = localProviderEpochRef.current + 1
    localProviderEpochRef.current = nextProviderEpoch
    localProvider.dispose()
    setIsEvaluating(false)
    setIsEvaluatingExam(false)
    setExamEvaluationProgress(undefined)
    await Promise.allSettled([...pendingPersistenceRef.current])
    try {
      await database.clearData()
    } catch (error) {
      setPendingInterpretingSaves((saves) => rebasePendingInterpretingSaves(saves, dataLoadGeneration.current))
      const restartNotice = 'Data deletion failed after the local evaluator was stopped. Prepare the model again before using local evaluation.'
      settingsRef.current = { ...settingsRef.current, localModelStatus: 'not-prepared' }
      setSettings(settingsRef.current)
      setLocalProgress({ status: 'not-prepared', text: 'Local model needs preparation after the failed deletion.', error: restartNotice })
      setLocalProviderEpoch(nextProviderEpoch)
      throw error
    }
    resetUiAfterLocalDataClear(nextProviderEpoch)
  }

  async function handleSelectExamProfile(profile: ExamProfile) {
    if (examRecoveryStatus !== 'ready') {
      setExamEvaluationNotice(examRecoveryStatus === 'loading'
        ? 'Checking for a saved exam attempt. Start will be available when recovery finishes.'
        : 'Saved exam recovery could not be checked. Reload this page before starting another exam.')
      return
    }
    if (examStartRequestRef.current) return
    if (activeExamRun) {
      setExamEvaluationNotice('An unfinished exam is already saved. Resume it or discard it before starting a new simulation.')
      setExamView('catalog')
      setCurrentPage('exam')
      return
    }
    examStartRequestRef.current = true
    const generation = dataLoadGeneration.current
    setExamEvaluationNotice('Claiming the local exam attempt…')
    try {
      const claim = await database.claimActiveExamRun(profile)
      if (dataLoadGeneration.current !== generation) return
      setActiveExamRun(claim.run)
      setPendingExamConsent(undefined)
      setCurrentPage('exam')
      if (!claim.created) {
        setSelectedExamProfile(undefined)
        setExamView('catalog')
        setExamEvaluationNotice('An unfinished exam was claimed in another tab. Resume that saved attempt or discard it before starting a different simulation.')
        return
      }
      setSelectedExamProfile(profile)
      setExamEvaluationNotice(undefined)
      setExamView('runner')
    } catch (error) {
      if (dataLoadGeneration.current === generation) {
        const reason = error instanceof Error && error.message ? ` (${error.message})` : ''
        setSelectedExamProfile(undefined)
        setExamView('catalog')
        setCurrentPage('exam')
        setExamEvaluationNotice(`The exam attempt could not be claimed locally${reason}. No new simulation was started.`)
      }
    } finally {
      examStartRequestRef.current = false
    }
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

  function navigateToPage(page: Page) {
    examResultOpenGenerationRef.current += 1
    if (currentPage === 'practice' && page !== 'practice') {
      writtenEvaluationGuardRef.current.invalidate()
      pendingConsent?.request.revokePreview?.()
      setPendingConsent(undefined)
      setIsEvaluating(false)
    }
    if (page === 'interpreting') {
      openInterpretingSetup()
      return
    }
    if (page !== 'progress') {
      interpretingSessionOpenGenerationRef.current += 1
    }
    if (page === 'practice') {
      setInitialPracticeMode('written')
      setPracticeSetupMode('written')
    }
    if (page === 'exam') {
      setExamView('catalog')
      setSelectedExamProfile(undefined)
      setActiveExamResult(undefined)
      setExamEvaluationNotice(undefined)
      setPendingExamConsent(undefined)
    }
    setCurrentPage(page)
  }

  function openInterpretingSetup() {
    interpretingSessionOpenGenerationRef.current += 1
    setActiveInterpretingExercise(undefined)
    setActiveInterpretingInput(undefined)
    setActiveInterpretingSessionId(undefined)
    setActiveInterpretingSourceRecording(undefined)
    setActiveInterpretingSourceUrl(undefined)
    setInterpretingFeedback(undefined)
    setPendingInterpretingConsent(undefined)
    setPracticeSetupMode('interpreting')
    setCurrentPage('interpreting')
  }

  async function handleDiscardExamRun(runId: string) {
    try {
      await database.deleteExamRun(runId)
      setActiveExamRun(undefined)
      setExamEvaluationNotice(undefined)
      setPendingExamConsent(undefined)
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : ''
      setExamEvaluationNotice(`The saved exam draft could not be discarded${reason}. It remains available for recovery.`)
    }
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
      const storedResult = await trackPersistence(database.completeExamRun(completedRun.id, result))
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
        const resumableRun = {
          ...completedRun,
          evaluationPausedAt: undefined,
          lastSavedAt: new Date().toISOString(),
        }
        try {
          await database.saveExamRun(resumableRun)
          if (dataLoadGeneration.current !== submissionGeneration) {
            return
          }
          setActiveExamRun(resumableRun)
          setSelectedExamProfile(undefined)
          setExamView('catalog')
          setExamEvaluationNotice(`Exam evaluation unavailable: ${reason} No practice estimate was saved. The attempt is saved locally; resume it from the catalog to continue with the timer running.`)
        } catch (saveError) {
          const saveReason = saveError instanceof Error ? ` (${saveError.message})` : ''
          setExamEvaluationNotice(`Exam evaluation unavailable: ${reason} No practice estimate was saved. The attempt remains paused because its resume state could not be saved${saveReason}; use Save and Exit to retry the local save.`)
        }
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

  async function cancelExamCloudEvaluation() {
    const pending = pendingExamConsent
    if (!pending) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    pending.request.revokePreview?.()
    setIsEvaluatingExam(true)
    try {
      const resumableRun = {
        ...pending.run,
        evaluationPausedAt: undefined,
        lastSavedAt: new Date().toISOString(),
      }
      await database.saveExamRun(resumableRun)
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      setActiveExamRun(resumableRun)
      setPendingExamConsent(undefined)
      setSelectedExamProfile(undefined)
      setExamView('catalog')
      setExamEvaluationNotice('Cloud evaluation was not approved. No practice estimate was saved. The attempt is saved locally; resume it from the catalog to continue with the timer running.')
    } catch (error) {
      if (dataLoadGeneration.current === submissionGeneration) {
        const reason = error instanceof Error ? ` (${error.message})` : ''
        setPendingExamConsent(undefined)
        setExamEvaluationNotice(`Cloud evaluation was not approved. No practice estimate was saved, and the attempt remains paused because its resume state could not be saved${reason}; use Save and Exit to retry the local save.`)
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluatingExam(false)
      }
    }
  }

  async function handleCancelExamRun(savedRun: ActiveExamRun) {
    const recovery = await getSavedExamRunAfterExit(savedRun, () => database.getActiveExamRun())
    setActiveExamRun(recovery.run)
    setExamEvaluationNotice(recovery.recoveryReadFailed
      ? 'The attempt was saved locally, but its follow-up recovery check failed. The saved attempt is retained; retry by reopening the exam catalog.'
      : undefined)
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
    interpretingSessionOpenGenerationRef.current += 1
    const requestGeneration = ++examResultOpenGenerationRef.current
    const requestIsCurrent = () => requestGeneration === examResultOpenGenerationRef.current && currentPage === 'progress'
    try {
      const storedResult = await database.getExamResult(result.id)
      if (!requestIsCurrent()) return
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
      if (!requestIsCurrent()) return
      setExamEvaluationNotice('This saved exam report could not be opened from local storage.')
      setCurrentPage('progress')
    }
  }


  async function saveCloudPreferences(baseUrl: string, model: string, supportsAudio: boolean) {
    validateCloudProviderPreferences(baseUrl, model)
    await updateSettings({ cloudBaseUrl: baseUrl.trim(), cloudModel: model.trim(), cloudSupportsAudio: supportsAudio })
  }

  function beginPractice(selection: PracticeStart) {
    writtenEvaluationGuardRef.current.activate(selection.exercise.id)
    pendingConsent?.request.revokePreview?.()
    setIsEvaluating(false)
    setPracticeSetupMode('written')
    setActiveExercise(selection.exercise)
    setActiveInterpretingExercise(undefined)
    setActiveInterpretingInput(undefined)
    setActiveInterpretingSessionId(undefined)
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
    writtenEvaluationGuardRef.current.activate(undefined)
    setPracticeSetupMode('interpreting')
    setActiveInterpretingExercise(selection.exercise)
    setActiveInterpretingMode(selection.interpretingMode)
    setActiveInterpretingSourceRecording(selection.sourceRecording)
    setActiveInterpretingSourceUrl(selection.sourceRecording ? selection.exercise.audioUrl : undefined)
    setActiveInterpretingSessionId(undefined)
    setActiveInterpretingInput(undefined)
    setInterpretingFeedback(undefined)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setPendingInterpretingConsent(undefined)
    setCurrentPage('interpreting')
  }

  function resetPractice() {
    writtenEvaluationGuardRef.current.activate(undefined)
    pendingConsent?.request.revokePreview?.()
    setIsEvaluating(false)
    if (currentPage === 'interpreting') {
      setPracticeSetupMode('interpreting')
      setActiveInterpretingExercise(undefined)
      setActiveInterpretingInput(undefined)
      setActiveInterpretingSourceRecording(undefined)
      setActiveInterpretingSourceUrl(undefined)
      setActiveInterpretingSessionId(undefined)
      setInterpretingFeedback(undefined)
    } else {
      setPracticeSetupMode('written')
      setActiveExercise(undefined)
      setTimeLimitSeconds(undefined)
      setDraftAnswer('')
      setDraftElapsedSeconds(0)
      setFeedback(undefined)
      setPendingConsent(undefined)
    }
    setPracticeNotice(undefined)
    setPendingInterpretingConsent(undefined)
  }

  function startNewsPractice() {
    const hasMeaningfulDraft = Boolean(activeExercise && !feedback && (draftAnswer.trim() || draftElapsedSeconds > 0))
    if (hasMeaningfulDraft && !window.confirm('Starting news practice will discard your current written draft. Continue?')) {
      return
    }
    writtenEvaluationGuardRef.current.activate(undefined)
    pendingConsent?.request.revokePreview?.()
    setIsEvaluating(false)
    setPracticeSetupMode('written')
    setActiveExercise(undefined)
    setTimeLimitSeconds(undefined)
    setDraftAnswer('')
    setDraftElapsedSeconds(0)
    setFeedback(undefined)
    setPendingConsent(undefined)
    setInitialPracticeMode('news')
    setCurrentPage('practice')
  }

  async function saveCompletedSession(
    exercise: Exercise,
    nextFeedback: TranslationFeedback,
    provider: 'local' | 'cloud',
    answer: string,
    elapsedSeconds: number,
    generation: number,
    attempt: WrittenEvaluationAttempt,
  ) {
    const attemptIsCurrent = () => writtenEvaluationGuardRef.current.isCurrent(attempt)
    if (!attemptIsCurrent() || dataLoadGeneration.current !== generation) {
      return
    }
    const session: SessionRecord = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      exerciseId: exercise.id,
      mode: exercise.mode,
      sourceLanguage: exercise.sourceLanguage,
      targetLanguage: exercise.targetLanguage,
      answer,
      feedback: nextFeedback,
      elapsedSeconds,
    }
    await persistWrittenPracticeSession({
      session,
      save: () => trackPersistence(database.saveSession(session)),
      isDataGenerationCurrent: () => dataLoadGeneration.current === generation,
      isAttemptCurrent: attemptIsCurrent,
      onPublishHistory: (savedSession) => {
        setRecentSessions((sessions) => mergeRecentSessions([savedSession], sessions))
      },
      onSaveForCurrentAttempt: () => {
        setFeedback(nextFeedback)
        setPracticeNotice(`${provider === 'cloud' ? 'Cloud' : 'Local'} evaluation complete. Saved to this device.`)
      },
      onSaveFailure: () => {
        setFeedback(nextFeedback)
        setPracticeNotice('Feedback is ready, but this browser could not save the session locally.')
      },
    })
  }

  async function saveCompletedInterpretingSession(
    input: InterpretingEvaluationInput,
    nextFeedback: InterpretingFeedback,
    provider: 'local' | 'cloud' | 'manual',
    generation: number,
  ) {
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `interpreting-session-${Date.now()}`
    const pending: PendingInterpretingPersistence = {
      id,
      createdAt: new Date().toISOString(),
      input,
      feedback: nextFeedback,
      provider,
      generation,
    }
    setActiveInterpretingInput(input)
    setActiveInterpretingSessionId(id)
    setInterpretingFeedback(nextFeedback)
    setPracticeNotice(provider === 'manual'
      ? 'Scoreless self-review is ready. Saving its audio and notes only on this device.'
      : `${provider === 'cloud' ? 'Cloud' : 'Local'} interpreting feedback is ready. Saving the practice estimate only on this device.`)
    if (dataLoadGeneration.current !== generation) {
      return
    }
    setPendingInterpretingSaves((saves) => [pending, ...saves.filter((save) => save.id !== pending.id)])
    await persistPendingInterpretingSession(pending)
  }

  async function persistPendingInterpretingSession(pending: PendingInterpretingPersistence) {
    if (savingInterpretingSaveIdsRef.current.has(pending.id)) {
      return
    }
    savingInterpretingSaveIdsRef.current.add(pending.id)
    setSavingInterpretingSaveIds((ids) => new Set(ids).add(pending.id))
    let prepared = pending
    try {
      if (!prepared.session || !prepared.recordings) {
        const sourceRecording = prepared.input.sourceRecording ?? await snapshotBundledSourceAudio(prepared.input.exercise)
        const { audioUrl: _audioUrl, ...sourceExercise } = prepared.input.exercise
        const session: InterpretingSessionRecord = {
          id: prepared.id,
          createdAt: prepared.createdAt,
          exerciseId: prepared.input.exercise.id,
          mode: 'interpreting',
          sourceLanguage: prepared.input.exercise.sourceLanguage,
          targetLanguage: prepared.input.exercise.targetLanguage,
          interpretingMode: prepared.input.interpretingMode,
          responseSegments: prepared.input.responseSegments,
          recordingIds: prepared.input.recordings.map((recording) => recording.id),
          sourceRecordingId: sourceRecording.id,
          sourceExercise,
          exerciseSnapshotVersion: 1,
          deliveryAnalysis: prepared.input.deliveryAnalysis,
          feedback: prepared.feedback,
          evaluator: prepared.provider,
        }
        const recordings = [...prepared.input.recordings, sourceRecording].map((recording) => ({ ...recording, sessionId: prepared.id }))
        prepared = { ...prepared, session, recordings }
        setPendingInterpretingSaves((saves) => saves.map((save) => save.id === prepared.id ? prepared : save))
      }
      if (dataLoadGeneration.current !== prepared.generation) {
        return
      }
      const session = prepared.session
      const recordings = prepared.recordings
      if (!session || !recordings) {
        throw new Error('The saved self-review could not be prepared for local storage.')
      }
      await trackPersistence(database.saveInterpretingSessionWithRecordings(session, recordings))
      if (dataLoadGeneration.current !== prepared.generation) {
        return
      }
      setRecentInterpretingSessions((sessions) => [session, ...sessions.filter((item) => item.id !== session.id)])
      setPendingInterpretingSaves((saves) => saves.filter((save) => save.id !== prepared.id))
      setPracticeNotice(prepared.provider === 'manual'
        ? 'Scoreless self-review and audio saved on this device. No automated score was generated.'
        : 'Interpreting practice estimate and audio saved on this device.')
    } catch (caught) {
      if (dataLoadGeneration.current === prepared.generation) {
        setPendingInterpretingSaves((saves) => saves.map((save) => save.id === prepared.id ? prepared : save))
        const reason = caught instanceof Error ? caught.message : 'The local storage operation failed.'
        setPracticeNotice(`This interpreting session is still only in memory; it could not be saved locally: ${reason} Retry the local save before leaving if possible.`)
      }
    } finally {
      savingInterpretingSaveIdsRef.current.delete(pending.id)
      setSavingInterpretingSaveIds((ids) => {
        const next = new Set(ids)
        next.delete(pending.id)
        return next
      })
    }
  }

  async function retryPendingInterpretingSave(id: string) {
    const pending = pendingInterpretingSaves.find((save) => save.id === id)
    if (pending) {
      await persistPendingInterpretingSession(pending)
    }
  }

  function saveScorelessInterpretingSelfReview(input: InterpretingEvaluationInput) {
    const enrichedInput = activeInterpretingSourceRecording
      ? { ...input, sourceRecording: activeInterpretingSourceRecording }
      : input
    const feedback: InterpretingFeedback = {
      contentScoreStatus: 'incomplete',
      deliveryScoreStatus: 'incomplete',
      summary: 'Saved for learner self-review. No AI evaluation or score was generated.',
      strengths: [],
      issues: [],
      uncertainEvidence: [],
      alternatives: [],
      uncertainty: 'Compare your recording with the source audio and reference transcript. This local self-review contains no automated transcript assessment or delivery score.',
    }
    void saveCompletedInterpretingSession(enrichedInput, feedback, 'manual', dataLoadGeneration.current)
  }

  async function handleOpenInterpretingSession(session: InterpretingSessionRecord) {
    const requestGeneration = ++interpretingSessionOpenGenerationRef.current
    const dataGeneration = dataLoadGeneration.current
    const requestIsCurrent = () => isInterpretingOpenCurrent(
      { openGeneration: requestGeneration, dataGeneration },
      {
        openGeneration: interpretingSessionOpenGenerationRef.current,
        dataGeneration: dataLoadGeneration.current,
        page: currentPageRef.current,
      },
    )
    const bundledExercise = getInterpretingExerciseById(session.exerciseId)
    if (!session.exerciseSnapshotVersion && !session.sourceExercise && !session.sourceRecordingId) {
      if (requestIsCurrent()) {
        setPracticeNotice('This older saved take has no immutable source-audio snapshot, so reopening it could mismatch the original evidence. Start a new take instead.')
        navigateToPage('progress')
      }
      return
    }
    let exercise = bundledExercise
    let sourceRecording: AudioRecordingRecord | undefined
    let sourceUrl: string | undefined
    try {
      if (session.sourceRecordingId) {
        sourceRecording = await database.getAudioRecording(session.sourceRecordingId)
        if (!requestIsCurrent()) {
          return
        }
        if (!sourceRecording) {
          setPracticeNotice('This saved local source audio is no longer available in this browser.')
          navigateToPage('progress')
          return
        }
        sourceUrl = URL.createObjectURL(sourceRecording.blob)
        if (session.sourceExercise) {
          exercise = { ...session.sourceExercise, audioUrl: sourceUrl }
        }
      } else if (session.sourceExercise && bundledExercise) {
        exercise = { ...session.sourceExercise, audioUrl: bundledExercise.audioUrl }
      }
      if (!exercise) {
        if (sourceUrl) {
          URL.revokeObjectURL(sourceUrl)
          sourceUrl = undefined
        }
        setPracticeNotice('This saved interpreting exercise is no longer available in the installed catalog.')
        navigateToPage('progress')
        return
      }
      const recordings = (await Promise.all(session.recordingIds.map((recordingId) => database.getAudioRecording(recordingId)))).filter((recording): recording is AudioRecordingRecord => recording !== undefined)
      if (!requestIsCurrent()) {
        if (sourceUrl) URL.revokeObjectURL(sourceUrl)
        return
      }
      writtenEvaluationGuardRef.current.activate(undefined)
      setActiveExercise(undefined)
      setPracticeSetupMode('interpreting')
      setActiveInterpretingExercise(exercise)
      setActiveInterpretingMode(session.interpretingMode)
      setActiveInterpretingSourceRecording(sourceRecording)
      setActiveInterpretingSourceUrl(sourceUrl)
      setActiveInterpretingSessionId(session.id)
      setActiveInterpretingInput({
        exercise,
        interpretingMode: session.interpretingMode,
        responseSegments: session.responseSegments,
        recordings,
        deliveryAnalysis: session.deliveryAnalysis,
        sourceRecording,
      })
      setInterpretingFeedback({
        ...session.feedback,
        deliveryEvidenceSource: session.feedback.deliveryEvidenceSource
          ?? (session.evaluator === 'cloud' && session.feedback.deliveryScores ? 'consented-cloud-audio' : undefined),
      })
      setPracticeNotice(recordings.length === session.recordingIds.length && (!session.sourceRecordingId || sourceRecording !== undefined)
        ? 'Reopened from this device. Audio replay remains local.'
        : 'Reopened from this device, but one or more local replay files are missing.')
      sourceUrl = undefined
      setCurrentPage('interpreting')
    } catch {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
      if (requestIsCurrent()) {
        setPracticeNotice('This saved interpreting session could not be opened from local storage.')
        navigateToPage('progress')
      }
    }
  }

  async function handleDeleteInterpretingSession(id: string) {
    await trackPersistence(database.deleteInterpretingSession(id))
    setRecentInterpretingSessions((sessions) => sessions.filter((session) => session.id !== id))
    if (activeInterpretingSessionId === id) {
      setActiveInterpretingSessionId(undefined)
      setActiveInterpretingExercise(undefined)
      setActiveInterpretingInput(undefined)
      setActiveInterpretingSourceRecording(undefined)
      setActiveInterpretingSourceUrl(undefined)
      setInterpretingFeedback(undefined)
      setPracticeNotice('The saved interpreting session and its local audio were deleted from this device.')
    }
  }

  async function submitAnswer(answer: string, elapsedSeconds: number) {
    const exercise = activeExercise
    if (!exercise) {
      return
    }
    const submissionGeneration = dataLoadGeneration.current
    const attempt = writtenEvaluationGuardRef.current.begin(exercise.id)
    setDraftAnswer(answer)
    setDraftElapsedSeconds(elapsedSeconds)
    setPracticeNotice(undefined)
    setPendingConsent(undefined)
    setIsEvaluating(true)
    await runWrittenEvaluationAttempt({
      guard: writtenEvaluationGuardRef.current,
      attempt,
      evaluate: () => evaluationRouter.evaluate({ exercise, learnerAnswer: answer, mode: exercise.mode }),
      onResult: async (result) => {
        if (dataLoadGeneration.current !== submissionGeneration) return
        if (result.status === 'evaluated') {
          if (isTranslationFeedback(result.feedback)) {
            await saveCompletedSession(exercise, result.feedback, result.provider, answer, elapsedSeconds, submissionGeneration, attempt)
          } else {
            setPracticeNotice('The evaluator returned interpreting feedback for a written task. No practice estimate was saved.')
          }
        } else if (result.status === 'needs-consent') {
          setPendingConsent({ exercise, attempt, request: result.request, answer, elapsedSeconds })
          setPracticeNotice(`${result.reason} Review the exact task before deciding whether to use cloud evaluation.`)
        } else {
          setPracticeNotice(result.reason)
        }
      },
      onError: (error) => {
        if (dataLoadGeneration.current === submissionGeneration) {
          setPracticeNotice(error instanceof Error ? error.message : 'Evaluation could not be completed.')
        }
      },
      onFinally: () => {
        if (dataLoadGeneration.current === submissionGeneration) {
          setIsEvaluating(false)
        }
      },
    })
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
    const attemptIsCurrent = () => writtenEvaluationGuardRef.current.isCurrent(pending.attempt)
    if (!attemptIsCurrent()) {
      pending.request.revokePreview?.()
      setPendingConsent(undefined)
      return
    }
    setIsEvaluating(true)
    try {
      const nextFeedback = await pending.request.confirm()
      pending.request.revokePreview?.()
      if (!attemptIsCurrent() || dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (!isTranslationFeedback(nextFeedback)) {
        setPracticeNotice('The cloud provider returned interpreting feedback for a written task. No practice estimate was saved.')
        return
      }
      setPendingConsent(undefined)
      await saveCompletedSession(pending.exercise, nextFeedback, 'cloud', pending.answer, pending.elapsedSeconds, submissionGeneration, pending.attempt)
    } catch (error) {
      pending.request.revokePreview?.()
      if (attemptIsCurrent() && dataLoadGeneration.current === submissionGeneration) {
        setPracticeNotice(error instanceof Error ? error.message : 'Cloud evaluation could not be completed. You can review the consent and try again.')
      }
    } finally {
      if (attemptIsCurrent() && dataLoadGeneration.current === submissionGeneration) {
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
      if (dataLoadGeneration.current !== submissionGeneration) {
        return
      }
      if (!isInterpretingFeedback(nextFeedback)) {
        setPracticeNotice('The cloud provider returned written feedback for an interpreting task. No practice estimate was saved; the submitted payload may have reached the configured endpoint.')
        return
      }
      pending.request.revokePreview?.()
      setPendingInterpretingConsent(undefined)
      await saveCompletedInterpretingSession(pending.input, nextFeedback, 'cloud', submissionGeneration)
    } catch (error) {
      if (dataLoadGeneration.current === submissionGeneration) {
        const reason = error instanceof Error ? error.message : 'The provider returned an unexpected error.'
        setPracticeNotice(`Cloud interpreting evaluation could not be completed: ${reason} No feedback was saved; the attempted payload may have reached the configured endpoint.`)
      }
    } finally {
      if (dataLoadGeneration.current === submissionGeneration) {
        setIsEvaluating(false)
      }
    }
  }

  const pageCopyForCurrentPage = pageCopy[currentPage]
  const isTakingExam = currentPage === 'exam' && examView === 'runner' && selectedExamProfile !== undefined
  const isTakingInterpreting = currentPage === 'interpreting' && activeInterpretingExercise !== undefined && interpretingFeedback === undefined
  const currentPendingInterpretingSave = pendingInterpretingSaves.find((save) => save.input === activeInterpretingInput)
  const firstPendingInterpretingSave = pendingInterpretingSaves[0]
  const currentPendingSaveVisibleInPanel = currentPage === 'interpreting' && interpretingFeedback !== undefined && currentPendingInterpretingSave !== undefined

  return (
    <div className="app-shell">
      {!isTakingExam && !isTakingInterpreting && <aside className="sidebar"><Navigation currentPage={currentPage} onNavigate={navigateToPage} /></aside>}
      <main className="main-content">
        {firstPendingInterpretingSave && !currentPendingSaveVisibleInPanel && (
          <section className="notice-banner notice-banner--warning pending-interpreting-save" role="alert">
            <span>{pendingInterpretingSaves.length === 1 ? 'One interpreting self-review is still only in memory.' : `${pendingInterpretingSaves.length} interpreting self-reviews are still only in memory.`} Retry local storage when it is available.</span>
            <button className="button button--quiet interpreting-action" type="button" onClick={() => void retryPendingInterpretingSave(firstPendingInterpretingSave.id)} disabled={savingInterpretingSaveIds.has(firstPendingInterpretingSave.id)}>
              {savingInterpretingSaveIds.has(firstPendingInterpretingSave.id) ? 'Saving locally…' : 'Retry local save'}
            </button>
          </section>
        )}
        {databaseNotice && <section className="notice-banner notice-banner--warning" role="alert" style={{ marginBottom: '1.5rem' }}>{databaseNotice}</section>}
        {remoteDataNotice && <section className="notice-banner notice-banner--warning" role="alert" style={{ marginBottom: '1.5rem' }}>{remoteDataNotice}</section>}
        {sessionHistoryStatus === 'failed' && <SessionHistoryNotice onRetry={() => void loadWrittenSessionHistory()} />}
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
            sessionHistoryStatus={sessionHistoryStatus}
            activeExamRun={activeExamRun}
            recentExamResults={recentExamResults}
            onStartInterpreting={openInterpretingSetup}
            onStartNews={startNewsPractice}
            onNavigate={navigateToPage}
          />
        )}
        {currentPage === 'practice' && !activeExercise && practiceSetupMode === 'written' && <><DirectionQualityNotice capability={capability} /><PracticeSetup initialMode={initialPracticeMode} evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginPractice} /></>}
        {currentPage === 'interpreting' && !activeInterpretingExercise && practiceSetupMode === 'interpreting' && <InterpretingSetup evaluationMode={settings.evaluationMode} localStatus={localProgress.status} onStart={beginInterpreting} />}
        {currentPage === 'practice' && activeExercise && !feedback && <TranslationWorkspace exercise={activeExercise} initialAnswer={draftAnswer} initialElapsedSeconds={draftElapsedSeconds} isSubmitting={isEvaluating} notice={practiceNotice} timeLimitSeconds={timeLimitSeconds} onCancel={resetPractice} onDraftChange={setDraftAnswer} onElapsedChange={setDraftElapsedSeconds} onSubmit={submitAnswer} />}
        {currentPage === 'practice' && activeExercise && feedback && <FeedbackPanel answer={draftAnswer} exercise={activeExercise} feedback={feedback} onRevise={() => { setFeedback(undefined); setPracticeNotice('Revise your answer, then submit again for a new practice estimate.') }} onChangeSetup={resetPractice} />}
        {currentPage === 'interpreting' && activeInterpretingExercise && !interpretingFeedback && <InterpretingWorkspace exercise={activeInterpretingExercise} initialInput={activeInterpretingInput} interpretingMode={activeInterpretingMode} isSubmitting={isEvaluating} notice={practiceNotice} onCancel={resetPractice} onSubmit={(input) => void submitInterpreting(input)} onSaveSelfReview={saveScorelessInterpretingSelfReview} />}
        {currentPage === 'interpreting' && activeInterpretingExercise && interpretingFeedback && activeInterpretingInput && <InterpretingFeedbackPanel exercise={activeInterpretingExercise} input={activeInterpretingInput} feedback={interpretingFeedback} notice={practiceNotice} pendingSave={currentPendingInterpretingSave !== undefined} isSaving={currentPendingInterpretingSave ? savingInterpretingSaveIds.has(currentPendingInterpretingSave.id) : false} onRetrySave={() => currentPendingInterpretingSave && void retryPendingInterpretingSave(currentPendingInterpretingSave.id)} onRevise={() => { setInterpretingFeedback(undefined); setPracticeNotice('Review the take and transcript, then submit again.') }} onChangeSetup={resetPractice} />}
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
            isEvaluationPaused={Boolean(pendingExamConsent)}
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
            recoveryStatus={examRecoveryStatus}
            onSelectProfile={handleSelectExamProfile}
            onResumeRun={handleResumeExamRun}
            onDiscardRun={handleDiscardExamRun}
          />
        )}
        {currentPage === 'progress' && (
          <ProgressPage
            sessions={recentSessions}
            sessionHistoryStatus={sessionHistoryStatus}
            interpretingSessions={recentInterpretingSessions}
            interpretingHistoryStatus={interpretingHistoryStatus}
            examResults={recentExamResults}
            examHistoryStatus={examHistoryStatus}
            onStartPractice={() => navigateToPage('practice')}
            onStartInterpreting={openInterpretingSetup}
            onOpenInterpretingSession={(session) => void handleOpenInterpretingSession(session)}
            onDeleteInterpretingSession={handleDeleteInterpretingSession}
            onOpenExamResult={(result) => void handleOpenExamResult(result)}
            onStartExam={() => navigateToPage('exam')}
            onRetrySessionHistory={() => void loadWrittenSessionHistory()}
            onRetryInterpretingHistory={() => void loadInterpretingHistory()}
            onRetryExamHistory={() => void loadExamHistory()}
          />
        )}
        {currentPage === 'settings' && <SettingsPage capability={capability} cloudDraft={cloudDraft} localProgress={localProgress} localProvider={localProvider} onCloudDraftChange={(draft) => { cloudDraftRevisionRef.current += 1; setCloudDraft(draft) }} onDeleteData={clearLocalData} onEvaluationModeChange={(mode) => updateSettings({ evaluationMode: mode })} onPrepareLocal={prepareLocalModel} onSaveCloudPreferences={saveCloudPreferences} settings={settings} settingsHydrationStatus={settingsHydrationStatus} onRetrySettings={() => void loadStoredSettings()} sessionCount={recentSessions.length} writtenHistoryStatus={sessionHistoryStatus} interpretingSessionCount={recentInterpretingSessions.length} interpretingHistoryStatus={interpretingHistoryStatus} examResultCount={recentExamResults.length} examHistoryStatus={examHistoryStatus} onRetryHistory={retryHistoryReads} />}
      </main>
      {!isTakingExam && !isTakingInterpreting && <div className="mobile-navigation"><Navigation currentPage={currentPage} onNavigate={navigateToPage} /></div>}
      {activeExercise && pendingConsent && <ConsentDialog exercise={pendingConsent.exercise} request={pendingConsent.request} isSubmitting={isEvaluating} onCancel={() => { pendingConsent.request.revokePreview?.(); setPendingConsent(undefined) }} onConfirm={() => void confirmCloudEvaluation()} />}
      {pendingInterpretingConsent && <ConsentDialog exercise={pendingInterpretingConsent.request.exercise} request={pendingInterpretingConsent.request} isSubmitting={isEvaluating} onCancel={() => { pendingInterpretingConsent.request.revokePreview?.(); setPendingInterpretingConsent(undefined); setPracticeNotice('Cloud evaluation was not approved. Audio and transcripts remain local.') }} onConfirm={() => void confirmInterpretingCloudEvaluation()} />}
      {pendingExamConsent && (
        <ConsentDialog
          exercise={pendingExamConsent.request.exercise}
          request={pendingExamConsent.request}
          isSubmitting={isEvaluatingExam}
          onCancel={() => {
            void cancelExamCloudEvaluation()
          }}
          onConfirm={() => void confirmExamCloudEvaluation()}
        />
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ActiveExamRun, ExamProfile } from '../../domain/types'
import {
  advanceSection,
  createActiveExamRun,
  decrementTimers,
  advanceSectionAndForfeitTime,
  getElapsedTimerTick,
  isLastSection,
} from '../../domain/exam'
import { database } from '../../storage/database'
import { ExamHeader } from './ExamHeader'
import { ExamSectionWorkspace } from './ExamSectionWorkspace'
import './exam.css'

export type ExamRunnerProps = {
  profile: ExamProfile
  initialRun?: ActiveExamRun
  onSubmitRun: (run: ActiveExamRun) => void | Promise<void>
  onCancel: (savedRun: ActiveExamRun) => void
  onPersistenceError?: (message: string) => void
  isEvaluationPaused?: boolean
}

async function saveAndSubmitRun(
  run: ActiveExamRun,
  onSubmitRun: ExamRunnerProps['onSubmitRun'],
  onPersistenceError?: ExamRunnerProps['onPersistenceError'],
): Promise<void> {
  let persistenceError: unknown
  try {
    await database.saveExamRun(run)
  } catch (error) {
    persistenceError = error
  }

  try {
    await onSubmitRun(run)
  } finally {
    if (persistenceError) {
      const reason = persistenceError instanceof Error && persistenceError.message
        ? ` (${persistenceError.message})`
        : ''
      const message = `The final exam state could not be saved locally${reason} The in-memory attempt was submitted, but it may not be recoverable if this page closes.`
      console.error('Final exam run persistence failed before submission.', persistenceError)
      onPersistenceError?.(message)
    }
  }
}

function reconcilePersistedRun(run: ActiveExamRun, profile: ExamProfile): ActiveExamRun {
  if (run.evaluationPausedAt) {
    return run
  }
  const savedAt = Date.parse(run.lastSavedAt)
  const elapsedSinceSave = Number.isFinite(savedAt)
    ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
    : 0
  const { run: updatedRun, overallExpired } = decrementTimers(run, profile, elapsedSinceSave)
  let nextRun = updatedRun

  if (!overallExpired) {
    while (!isLastSection(nextRun, profile)) {
      const sectionId = profile.sections[nextRun.currentSectionIndex]?.id
      if (!sectionId || (nextRun.sectionRemainingSeconds[sectionId] ?? 0) > 0) {
        break
      }
      nextRun = advanceSection(nextRun, profile)
    }
  }

  return nextRun
}

export function ExamRunner({
  profile,
  initialRun,
  onSubmitRun,
  onCancel,
  onPersistenceError,
  isEvaluationPaused = false,
}: ExamRunnerProps) {
  const [run, setRun] = useState<ActiveExamRun>(() => initialRun ? reconcilePersistedRun(initialRun, profile) : createActiveExamRun(profile))
  const [showAidsModal, setShowAidsModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [sectionExpiredAlert, setSectionExpiredAlert] = useState<string | undefined>()

  const runRef = useRef<ActiveExamRun>(run)
  runRef.current = run

  const isDirtyRef = useRef(false)
  const lastTickTime = useRef(Date.now())
  const timerIntervalRef = useRef<number | undefined>(undefined)
  const submissionStartedRef = useRef(false)
  const reportedPersistenceFailuresRef = useRef(new Set<string>())
  const onSubmitRunRef = useRef(onSubmitRun)
  const onPersistenceErrorRef = useRef(onPersistenceError)
  const isEvaluationPausedRef = useRef(isEvaluationPaused)
  onSubmitRunRef.current = onSubmitRun
  onPersistenceErrorRef.current = onPersistenceError
  isEvaluationPausedRef.current = isEvaluationPaused

  const reportPersistenceError = (operation: string, error: unknown) => {
    const reason = error instanceof Error && error.message ? ` (${error.message})` : ''
    const message = `${operation} could not be saved locally${reason} Your current in-memory exam remains open, but it may not be recoverable if this page closes.`
    console.error(`${operation} persistence failed.`, error)
    if (!reportedPersistenceFailuresRef.current.has(operation)) {
      reportedPersistenceFailuresRef.current.add(operation)
      onPersistenceErrorRef.current?.(message)
    }
  }

  const stopTimer = () => {
    if (timerIntervalRef.current !== undefined) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = undefined
    }
  }

  // Initial persist if brand new run
  useEffect(() => {
    void database.saveExamRun(runRef.current).catch((error) => {
      reportPersistenceError('The initial exam state', error)
    })
  }, [])

  // Window beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue =
        'You have an active exam in progress. Changes that were not successfully saved locally may not be recoverable. Leaving may interrupt your timing.'
      return event.returnValue
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const persistLatestRun = (operation: string) => {
      const runToSave = runRef.current
      void database.stageExamRunRecovery(runToSave).catch((error) => reportPersistenceError('The exam recovery checkpoint', error))
      void database.saveExamRun(runToSave).then(() => {
        if (runRef.current === runToSave) {
          isDirtyRef.current = false
        }
      }).catch((error) => reportPersistenceError(operation, error))
    }
    const handlePageHide = () => persistLatestRun('The page-exit exam save')
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistLatestRun('The background exam save')
      }
    }
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Timer loop with wall-clock diffing
  useEffect(() => {
    lastTickTime.current = Date.now()

    const intervalId = window.setInterval(() => {
      if (isEvaluationPausedRef.current || runRef.current.evaluationPausedAt) {
        lastTickTime.current = Date.now()
        return
      }
      if (runRef.current.overallRemainingSeconds <= 0 && runRef.current.submissionAttemptedAt) {
        stopTimer()
        return
      }

      const now = Date.now()
      const { elapsedSeconds, nextAnchorMs } = getElapsedTimerTick(lastTickTime.current, now)

      if (elapsedSeconds >= 1) {
        lastTickTime.current = nextAnchorMs

        const { run: updatedRun, sectionExpired, overallExpired } = decrementTimers(
          runRef.current,
          profile,
          elapsedSeconds,
        )
        let nextRun = updatedRun
        let advancedSection = false

        if (sectionExpired && !overallExpired) {
          while (!isLastSection(nextRun, profile)) {
            const sectionId = profile.sections[nextRun.currentSectionIndex]?.id
            if (!sectionId || (nextRun.sectionRemainingSeconds[sectionId] ?? 0) > 0) {
              break
            }
            nextRun = advanceSection(nextRun, profile)
            advancedSection = true
          }
        }

        const shouldAutoSubmit = overallExpired && !submissionStartedRef.current && !nextRun.submissionAttemptedAt
        const submissionRun = shouldAutoSubmit
          ? { ...nextRun, submissionAttemptedAt: new Date().toISOString() }
          : nextRun

        runRef.current = submissionRun
        setRun(submissionRun)
        isDirtyRef.current = !shouldAutoSubmit

        if (advancedSection) {
          setSectionExpiredAlert(
            `Time for Section ${updatedRun.currentSectionIndex + 1} has expired. The exam advanced to the next section.`,
          )
        }

        if (shouldAutoSubmit) {
          submissionStartedRef.current = true
          isDirtyRef.current = false
          stopTimer()
          void saveAndSubmitRun(submissionRun, onSubmitRunRef.current, onPersistenceErrorRef.current)
        }
      }
    }, 1000)
    timerIntervalRef.current = intervalId

    return () => {
      if (timerIntervalRef.current === intervalId) {
        timerIntervalRef.current = undefined
      }
      window.clearInterval(intervalId)
    }
  }, [profile])

  // Periodic auto-save every 3 seconds if dirty
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (isDirtyRef.current) {
        isDirtyRef.current = false
        const runToSave = runRef.current
        void database.saveExamRun(runToSave).catch((error) => {
          isDirtyRef.current = true
          reportPersistenceError('The periodic exam autosave', error)
        })
      }
    }, 3000)

    return () => {
      clearInterval(autoSaveInterval)
    }
  }, [])

  const currentSection = profile.sections[run.currentSectionIndex] ?? profile.sections[0]
  const currentSectionAnswers = run.answers[currentSection.id] ?? {}
  const currentSectionSeconds = run.sectionRemainingSeconds[currentSection.id] ?? 0
  const isCurrentSectionLocked = submissionStartedRef.current || Boolean(run.evaluationPausedAt) || currentSectionSeconds <= 0 || run.overallRemainingSeconds <= 0

  const handleAnswerChange = (passageId: string, text: string) => {
    if (submissionStartedRef.current) {
      return
    }
    const currentRun = runRef.current
    const section = profile.sections[currentRun.currentSectionIndex] ?? currentSection
    const updatedRun: ActiveExamRun = {
      ...currentRun,
      answers: {
        ...currentRun.answers,
        [section.id]: {
          ...(currentRun.answers[section.id] ?? {}),
          [passageId]: text,
        },
      },
      lastSavedAt: new Date().toISOString(),
    }
    runRef.current = updatedRun
    isDirtyRef.current = true
    void database.stageExamRunRecovery(updatedRun).catch((error) => reportPersistenceError('The exam recovery checkpoint', error))
    setRun(updatedRun)
  }

  const handleAnswerBlur = () => {
    if (submissionStartedRef.current) {
      return
    }
    const runToSave = runRef.current
    isDirtyRef.current = true
    void database.stageExamRunRecovery(runToSave).catch((error) => reportPersistenceError('The exam recovery checkpoint', error))
    void database.saveExamRun(runToSave).then(() => {
      if (runRef.current === runToSave) {
        isDirtyRef.current = false
      }
    }).catch((error) => {
      isDirtyRef.current = true
      reportPersistenceError('The answer-blur exam save', error)
    })
  }

  const handleNextSection = () => {
    if (submissionStartedRef.current) {
      return
    }
    const currentRun = runRef.current
    if (isLastSection(currentRun, profile)) {
      setShowSubmitModal(true)
    } else {
      const nextRun = advanceSectionAndForfeitTime(currentRun, profile)
      runRef.current = nextRun
      isDirtyRef.current = true
      setRun(nextRun)
      void database.saveExamRun(nextRun).catch((error) => {
        reportPersistenceError('The section-change exam save', error)
      })
    }
  }

  const handleConfirmSubmit = () => {
    if (submissionStartedRef.current) {
      return
    }
    submissionStartedRef.current = true
    setShowSubmitModal(false)
    const currentRun = runRef.current
    const now = new Date().toISOString()
    const submissionRun = {
      ...currentRun,
      lastSavedAt: now,
      evaluationPausedAt: now,
      ...(currentRun.overallRemainingSeconds <= 0 && !currentRun.submissionAttemptedAt
        ? { submissionAttemptedAt: now }
        : {}),
    }
    runRef.current = submissionRun
    setRun(submissionRun)
    isDirtyRef.current = false
    stopTimer()
    void saveAndSubmitRun(submissionRun, onSubmitRunRef.current, onPersistenceErrorRef.current)
  }

  const handleSaveAndExit = async () => {
    const previousRun = runRef.current
    isDirtyRef.current = false
    const exitingRun = {
      ...previousRun,
      evaluationPausedAt: undefined,
      lastSavedAt: new Date().toISOString(),
    }
    runRef.current = exitingRun
    try {
      await database.saveExamRun(exitingRun)
      onCancel(exitingRun)
    } catch (error) {
      runRef.current = previousRun
      isDirtyRef.current = true
      isDirtyRef.current = true
      reportPersistenceError('The save-and-exit exam state', error)
    }
  }

  // Count answered passages
  let totalPassages = 0
  let answeredPassages = 0
  for (const section of profile.sections) {
    for (const passage of section.passages) {
      totalPassages += 1
      if ((run.answers[section.id]?.[passage.id] ?? '').trim().length > 0) {
        answeredPassages += 1
      }
    }
  }

  return (
    <div className="exam-runner" role="main">
      <ExamHeader
        title={profile.title}
        sectionTitle={currentSection.title}
        sectionIndex={run.currentSectionIndex}
        totalSections={profile.sections.length}
        overallSeconds={run.overallRemainingSeconds}
        sectionSeconds={currentSectionSeconds}
        aidPolicy={profile.allowedAids}
        isProvisional={profile.status === 'provisional_draft'}
        onOpenAidsModal={() => setShowAidsModal(true)}
        onSubmitEarly={() => setShowSubmitModal(true)}
        onExit={() => void handleSaveAndExit()}
      />

      <ExamSectionWorkspace
        section={currentSection}
        answers={currentSectionAnswers}
        onAnswerChange={handleAnswerChange}
        onAnswerBlur={handleAnswerBlur}
        onNextSection={handleNextSection}
        isLastSection={isLastSection(run, profile)}
        isLocked={isCurrentSectionLocked}
        unusedSectionSeconds={currentSectionSeconds}
      />

      {/* Allowed Aids Policy Modal */}
      {showAidsModal && (
        <div className="exam-modal-backdrop" role="presentation">
          <div className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="aids-heading">
            <h3 id="aids-heading" className="exam-modal__title">
              Permitted Aids & Policy
            </h3>
            <div className="exam-modal__body">
              <p>
                <strong>Paper Dictionaries: </strong>
                {profile.allowedAids.paperDictionaryAllowed
                  ? 'Permitted (up to 2 printed bilingual general dictionaries in real CATTI exam).'
                  : 'Strictly Prohibited (Closed-book exam).'}
              </p>
              <p>
                <strong>Online & Electronic Aids: </strong>
                Strictly prohibited. All machine translation, browser lookups, electronic dictionaries, and mobile phones are banned.
              </p>
              <p>{profile.allowedAids.notes}</p>
            </div>
            <div className="exam-modal__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => setShowAidsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early / Final Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="exam-modal-backdrop" role="presentation">
          <div className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="submit-heading">
            <h3 id="submit-heading" className="exam-modal__title">
              Submit Examination?
            </h3>
            <div className="exam-modal__body">
              <p>
                You have completed <strong>{answeredPassages}</strong> of <strong>{totalPassages}</strong> passages across all sections.
              </p>
              <p>
                Once submitted, your translations will be evaluated against the rubric dimensions and consolidated into a practice assessment scorecard.
              </p>
              {answeredPassages < totalPassages && (
                <p style={{ color: '#b45309', fontWeight: 600 }}>
                  Note: You have unanswered passages remaining. Unanswered passages will receive zero points.
                </p>
              )}
            </div>
            <div className="exam-modal__actions">
              <button
                className="button button--quiet"
                type="button"
                onClick={() => setShowSubmitModal(false)}
              >
                Return to Exam
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={handleConfirmSubmit}
              >
                Yes, Submit Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Expired Alert Modal */}
      {sectionExpiredAlert && (
        <div className="exam-modal-backdrop" role="presentation">
          <div className="exam-modal" role="dialog" aria-modal="true" aria-labelledby="expired-heading">
            <h3 id="expired-heading" className="exam-modal__title">
              Section Time Expired
            </h3>
            <div className="exam-modal__body">
              <p>{sectionExpiredAlert}</p>
            </div>
            <div className="exam-modal__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => setSectionExpiredAlert(undefined)}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

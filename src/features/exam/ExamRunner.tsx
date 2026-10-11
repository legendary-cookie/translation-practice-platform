import { useEffect, useRef, useState } from 'react'
import type { ActiveExamRun, ExamProfile } from '../../domain/types'
import {
  advanceSection,
  createActiveExamRun,
  decrementTimers,
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
  onCancel: () => void
  onPersistenceError?: (message: string) => void
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

export function ExamRunner({
  profile,
  initialRun,
  onSubmitRun,
  onCancel,
  onPersistenceError,
}: ExamRunnerProps) {
  const [run, setRun] = useState<ActiveExamRun>(() => initialRun ?? createActiveExamRun(profile))
  const [showAidsModal, setShowAidsModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [sectionExpiredAlert, setSectionExpiredAlert] = useState<string | undefined>()

  const runRef = useRef<ActiveExamRun>(run)
  runRef.current = run

  const isDirtyRef = useRef(false)
  const lastTickTime = useRef(Date.now())

  // Initial persist if brand new run
  useEffect(() => {
    void database.saveExamRun(runRef.current)
  }, [])

  // Window beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue =
        'You have an active exam in progress. Your work is saved locally on this device, but leaving may interrupt your timing.'
      return event.returnValue
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Timer loop with wall-clock diffing
  useEffect(() => {
    lastTickTime.current = Date.now()

    const intervalId = setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - lastTickTime.current) / 1000)

      if (elapsedSeconds >= 1) {
        lastTickTime.current = now

        setRun((prevRun) => {
          const { run: updatedRun, sectionExpired, overallExpired } = decrementTimers(
            prevRun,
            profile,
            elapsedSeconds,
          )
          isDirtyRef.current = true

          if (overallExpired) {
            clearInterval(intervalId)
            void saveAndSubmitRun(updatedRun, onSubmitRun, onPersistenceError)
            return updatedRun
          }

          if (sectionExpired && !isLastSection(updatedRun, profile)) {
            const nextRun = advanceSection(updatedRun, profile)
            setSectionExpiredAlert(
              `Time for Section ${updatedRun.currentSectionIndex + 1} has expired. The exam advanced to the next section.`,
            )
            return nextRun
          }

          return updatedRun
        })
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [onSubmitRun, profile])

  // Periodic auto-save every 3 seconds if dirty
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (isDirtyRef.current) {
        isDirtyRef.current = false
        void database.saveExamRun(runRef.current)
      }
    }, 3000)

    return () => {
      clearInterval(autoSaveInterval)
      if (isDirtyRef.current) {
        void database.saveExamRun(runRef.current)
      }
    }
  }, [])

  const currentSection = profile.sections[run.currentSectionIndex] ?? profile.sections[0]
  const currentSectionAnswers = run.answers[currentSection.id] ?? {}
  const currentSectionSeconds = run.sectionRemainingSeconds[currentSection.id] ?? 0
  const isCurrentSectionLocked = currentSectionSeconds <= 0 && run.overallRemainingSeconds > 0

  const handleAnswerChange = (passageId: string, text: string) => {
    setRun((prevRun) => {
      const updatedAnswers = {
        ...prevRun.answers,
        [currentSection.id]: {
          ...(prevRun.answers[currentSection.id] ?? {}),
          [passageId]: text,
        },
      }
      const updatedRun: ActiveExamRun = {
        ...prevRun,
        answers: updatedAnswers,
        lastSavedAt: new Date().toISOString(),
      }
      isDirtyRef.current = true
      return updatedRun
    })
  }

  const handleNextSection = () => {
    if (isLastSection(run, profile)) {
      setShowSubmitModal(true)
    } else {
      const nextRun = advanceSection(run, profile)
      setRun(nextRun)
      void database.saveExamRun(nextRun)
    }
  }

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false)
    void saveAndSubmitRun(run, onSubmitRun, onPersistenceError)
  }

  const handleSaveAndExit = async () => {
    await database.saveExamRun(run)
    onCancel()
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
        onNextSection={handleNextSection}
        isLastSection={isLastSection(run, profile)}
        isLocked={isCurrentSectionLocked}
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

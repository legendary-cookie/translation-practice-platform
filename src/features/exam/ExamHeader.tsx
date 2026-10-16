import { t } from '../../i18n'
import type { ExamAidPolicy } from '../../domain/types'
import { formatSeconds, PROVISIONAL_DRAFT_LABEL } from '../../domain/exam'

export type ExamHeaderProps = {
  title: string
  sectionTitle: string
  sectionIndex: number
  totalSections: number
  overallSeconds: number
  sectionSeconds: number
  aidPolicy: ExamAidPolicy
  isProvisional?: boolean
  onOpenAidsModal: () => void
  onSubmitEarly: () => void
  onExit: () => void
}

export function ExamHeader({
  title,
  sectionTitle,
  sectionIndex,
  totalSections,
  overallSeconds,
  sectionSeconds,
  aidPolicy,
  isProvisional,
  onOpenAidsModal,
  onSubmitEarly,
  onExit,
}: ExamHeaderProps) {
  const isOverallWarning = overallSeconds <= 900 && overallSeconds > 300
  const isOverallCritical = overallSeconds <= 300
  const isSectionWarning = sectionSeconds <= 300 && sectionSeconds > 60
  const isSectionCritical = sectionSeconds <= 60

  return (
    <header className="exam-header" aria-label={t("Exam Simulation Header")}>
      <div className="exam-header__title-group">
        <div className="exam-header__title-row">
          <h1 className="exam-header__title">{title}</h1>
          <span className="exam-header__section-badge">{t("Section ")}{sectionIndex + 1}{t(" of ")}{totalSections}
          </span>
          {isProvisional && (
            <span
              className="exam-header__provisional-badge"
              title={t("This profile contains provisional parameters pending authoritative confirmation")}
            >
              {t(PROVISIONAL_DRAFT_LABEL)}
            </span>
          )}
        </div>
        <small className="muted-label">{sectionTitle}</small>
      </div>

      <div className="exam-header__timers">
        <div
          className={`exam-timer ${
            isSectionCritical
              ? 'exam-timer--critical'
              : isSectionWarning
              ? 'exam-timer--warning'
              : ''
          }`}
          role="timer" aria-live="off"
        >
          <span className="exam-timer__label">{t("Section timer")}</span>
          <span className="exam-timer__digits">{formatSeconds(sectionSeconds)}</span>
        </div>

        <div
          className={`exam-timer ${
            isOverallCritical
              ? 'exam-timer--critical'
              : isOverallWarning
              ? 'exam-timer--warning'
              : ''
          }`}
          role="timer" aria-live="off"
        >
          <span className="exam-timer__label">{t("Total time left")}</span>
          <span className="exam-timer__digits">{formatSeconds(overallSeconds)}</span>
        </div>
      </div>

      <div className="exam-header__actions">
        <button
          className="exam-header__aid-button"
          type="button"
          onClick={onOpenAidsModal}
          title={t("View permitted aids policy for this exam")}
        >
          <span>📖</span>
          <span>{aidPolicy.paperDictionaryAllowed ? t("Paper Dictionaries") : t("Closed Book")}</span>
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={onExit}
          title={t("Exit and save progress locally to resume later")}
        >{t("Save & Exit")}</button>
        <button
          className="button button--primary"
          type="button"
          onClick={onSubmitEarly}
        >{t("Submit Exam")}</button>
      </div>
    </header>
  )
}

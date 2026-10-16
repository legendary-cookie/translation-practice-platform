import { t } from '../../i18n'
import { getLanguage } from '../../domain/languages'
import type { InterpretingEvaluationInput, InterpretingFeedback, InterpretingExercise } from '../../domain/types'
import { TranscriptAlignment } from './TranscriptAlignment'

export function InterpretingFeedbackPanel({
  exercise,
  input,
  feedback,
  notice,
  pendingSave,
  isSaving,
  onRetrySave,
  onRevise,
  onChangeSetup,
}: {
  exercise: InterpretingExercise
  input: InterpretingEvaluationInput
  feedback: InterpretingFeedback
  notice?: string
  pendingSave: boolean
  isSaving: boolean
  onRetrySave: () => void
  onRevise: () => void
  onChangeSetup: () => void
}) {
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const contentScores = feedback.contentScores
  const deliveryScores = feedback.deliveryScores
  return (
    <div className="interpreting-feedback-page" aria-label={t("Interpreting practice feedback")}>
      <header className="interpreting-feedback-header"><div><p className="eyebrow">{feedback.overallScore === undefined ? t("Interpreting self-review") : t("Interpreting practice estimate")}</p><h2>{t("Review the evidence, not just the number.")}</h2><p>{exercise.title} · {getLanguage(exercise.sourceLanguage).nativeLabel} → {targetLanguage.nativeLabel} · {t(input.interpretingMode)}</p></div><span className="pill">{t("Not an official CATTI/MTI result")}</span></header>
      {notice && <p className="interpreting-notice" role="status">{t(notice)}</p>}
      {pendingSave && <div className="interpreting-notice interpreting-save-retry" role="status"><p>{t("This recording and its self-review are not saved yet. The pending copy is held in this page until local storage succeeds.")}</p><button className="button button--quiet interpreting-action" type="button" onClick={onRetrySave} disabled={isSaving}>{isSaving ? t("Saving locally…") : t("Retry local save")}</button></div>}
      <section className="interpreting-score-groups" aria-label={t("Separate interpreting score groups")}>
        <article className="interpreting-score-card"><p className="eyebrow">{t("Content")}</p>{contentScores ? <div className="interpreting-score-list"><div><span>{t("Meaning transfer")}</span><strong>{contentScores.meaningTransfer}</strong></div><div><span>{t("Completeness / omissions")}</span><strong>{contentScores.omissions}</strong></div><div><span>{t("Additions and mistranslations")}</span><strong>{contentScores.additionsMistranslations}</strong></div><div><span>{t("Terminology")}</span><strong>{contentScores.terminology}</strong></div></div> : <p>{t("No content score is displayed without verified transcript evidence and an evaluator.")}</p>}<small>{feedback.contentScoreStatus === 'complete' ? t("Based on verified transcript evidence.") : t("No uncertain recognition token is converted into a learner error or false precision.")}</small></article>
        <article className="interpreting-score-card"><p className="eyebrow">{t("Delivery")}</p>{deliveryScores ? <div className="interpreting-score-list"><div><span>{t("Fluency")}</span><strong>{deliveryScores.fluency}</strong></div><div><span>{t("Pacing")}</span><strong>{deliveryScores.pacing}</strong></div><div><span>{t("Hesitation")}</span><strong>{deliveryScores.hesitation}</strong></div></div> : <p>{t("No delivery score is displayed without supported audio evidence and evaluation.")}</p>}<small>{deliveryScores
          ? feedback.deliveryEvidenceSource === 'consented-cloud-audio'
            ? t("A cloud evaluator analyzed learner audio attached after one-time consent; this is not pronunciation certification.")
            : feedback.deliveryEvidenceSource === 'local-analysis'
              ? t("Local audio-analysis heuristics; not pronunciation certification.")
              : t("Saved delivery evidence provenance is unavailable; do not treat this as a verified speech assessment.")
          : t("No delivery score is shown without supported audio evidence.")}</small></article>
        <article className="interpreting-score-card interpreting-score-card--summary"><p className="eyebrow">{t("Summary")}</p><strong>{feedback.overallScore === undefined ? t("No score generated") : `${feedback.overallScore}/100`}</strong><p>{feedback.summary}</p><small>{feedback.overallScore === undefined ? t("This is a saved practice record, not a score.") : t("Practice estimate only.")}</small></article>
      </section>
      <section className="interpreting-feedback-copy"><h3>{t("What to revisit")}</h3><p>{feedback.uncertainty}</p>{feedback.strengths.length > 0 && <div><strong>{t("Strengths")}</strong><ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></div>}{feedback.issues.length > 0 && <div><strong>{t("Verified evidence-backed issues")}</strong><ul>{feedback.issues.map((issue, index) => <li key={`${issue.category}-${index}`}><strong>{t(issue.category)}</strong> · {issue.explanation} <span>{t("Suggestion: ")}{issue.suggestion}</span></li>)}</ul></div>}{feedback.uncertainEvidence.length > 0 && <div className="interpreting-uncertain"><strong>{t("Check the transcript before treating these as errors")}</strong><ul>{feedback.uncertainEvidence.map((issue, index) => <li key={`uncertain-${issue.category}-${index}`}>{issue.explanation} <span>{issue.suggestion}</span></li>)}</ul></div>}{feedback.alternatives.length > 0 && <div><strong>{t("Alternative renderings")}</strong><ul>{feedback.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul></div>}</section>
      <TranscriptAlignment exercise={exercise} input={input} feedback={feedback} />
      <footer className="interpreting-workspace__footer"><p>{t("Audio and transcript evidence remain in this browser. You can record another take or choose another exercise.")}</p><div className="interpreting-control-row"><button className="button button--quiet interpreting-action" type="button" onClick={onRevise}>{t("Record another take")}</button><button className="button button--primary interpreting-action" type="button" onClick={onChangeSetup}>{t("Change setup")}</button></div></footer>
    </div>
  )
}

import { t } from '../../i18n'
import { FeedbackActions } from './FeedbackActions'
import { useState } from 'react'
import { database } from '../../storage/database'
import { newReviewState } from '../../domain/learning'
import { getLanguage } from '../../domain/languages'
import type { Exercise, FeedbackAnnotation, ScoreDimension, TranslationFeedback } from '../../domain/types'

const dimensionLabels: Record<ScoreDimension, string> = {
  accuracy: 'Accuracy and meaning',
  terminology: 'Terminology',
  grammar: 'Grammar',
  fluency: 'Fluency',
  taskStyle: 'Task style and register',
}

function Evidence({ issue, exercise, sessionId, issueIndex }: { issue: FeedbackAnnotation; exercise: Exercise; sessionId?: string; issueIndex: number }) {
  const [saveMessage, setSaveMessage] = useState<string>()
  const [saving, setSaving] = useState(false)
  async function saveIssue() {
    setSaving(true)
    try {
      await database.saveLearningCard({ id: crypto.randomUUID(), kind: 'mistake', source: issue.sourceQuote || issue.learnerQuote || exercise.title, target: issue.suggestion, sourceLanguage: issue.sourceQuote ? exercise.sourceLanguage : exercise.targetLanguage, targetLanguage: exercise.targetLanguage, notes: `${t(dimensionLabels[issue.dimension])}: ${issue.explanation}`, dimension: issue.dimension, learnerQuote: issue.learnerQuote, createdAt: new Date().toISOString(), review: newReviewState() })
      setSaveMessage('Saved in Progress → Mistake notebook. Edit the suggestion before relying on it.')
    } catch { setSaveMessage('This note could not be saved. Try again when local storage is available.') }
    finally { setSaving(false) }
  }
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  return (
    <article className="issue-card">
      <div className="issue-card__heading"><span className="issue-card__dimension">{t(dimensionLabels[issue.dimension])}</span><span aria-hidden="true">↘</span></div>
      <details className="evidence-details"><summary>{t("Read evidence and revision")}</summary>
      {issue.sourceQuote && <div className="evidence-block"><span className="evidence-label">{t("Source evidence")}</span><blockquote dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{issue.sourceQuote}</blockquote></div>}
      {issue.learnerQuote && <div className="evidence-block"><span className="evidence-label">{t("Your answer")}</span><blockquote dir={targetLanguage.direction} lang={exercise.targetLanguage}>{issue.learnerQuote}</blockquote></div>}
      <p className="issue-explanation">{issue.explanation}</p>
      <div className="suggestion"><span>{t("Try this")}</span><p>{issue.suggestion}</p></div>
      </details>
      <button className="button button--quiet" type="button" disabled={saving} onClick={() => void saveIssue()}>{saving ? t("Saving…") : t("Save revision note")}</button>
      <FeedbackActions issue={issue} exercise={exercise} sessionId={sessionId} issueIndex={issueIndex} />
      {saveMessage && <p className="muted-copy" role="status">{t(saveMessage)}</p>}
    </article>
  )
}

export function FeedbackPanel({
  sessionId,
  answer,
  exercise,
  feedback,
  onRevise,
  onChangeSetup,
}: {
  sessionId?: string
  answer: string
  exercise: Exercise
  feedback: TranslationFeedback
  onRevise: () => void
  onChangeSetup: () => void
}) {
  return (
    <div className="feedback-layout">
      <section className="feedback-summary">
        <div className="feedback-summary__topline"><div><div className="feedback-summary__actions"><button className="back-button" type="button" onClick={onRevise}>{t("← Revise translation")}</button><button className="back-button" type="button" onClick={onChangeSetup}>{t("← Change setup")}</button></div><p className="eyebrow">{t("Feedback · ")}{exercise.title}</p><h2>{t("Your practice readout.")}</h2></div><div className="estimate-badge"><strong>{feedback.overallScore}</strong><span>{t("Practice estimate")}<br />{t("out of 100")}</span></div></div>
        <div className="estimate-notice"><span>{t("Practice estimate only")}</span><p>{t("This feedback is for study and reflection. It is not an official CATTI or MTI result.")}</p></div>
        <p className="feedback-summary__copy">{feedback.summary}</p>
        <div className="dimension-grid">{(Object.keys(dimensionLabels) as ScoreDimension[]).map((dimension) => <div className="dimension-score" key={dimension}><div><span>{t(dimensionLabels[dimension])}</span><strong>{feedback.dimensions[dimension]}</strong></div><div className="score-track"><span style={{ width: `${feedback.dimensions[dimension]}%` }} /></div></div>)}</div>
        <div className="feedback-columns"><div><span className="eyebrow">{t("What is working")}</span><ul className="feedback-list">{feedback.strengths.length ? feedback.strengths.map((strength) => <li key={strength}>{strength}</li>) : <li>{t("No specific strengths were returned.")}</li>}</ul></div><div><span className="eyebrow">{t("Other valid renderings")}</span>{feedback.alternatives.length ? <ul className="feedback-list">{feedback.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul> : <p className="muted-copy">{t("The evaluator did not add an alternative for this pass.")}</p>}</div></div>
        <div className="uncertainty-box"><span className="eyebrow">{t("Uncertainty")}</span><p>{feedback.uncertainty}</p></div>
      </section>
      <section className="feedback-issues" aria-labelledby="evidence-heading"><div className="section-heading"><div><p className="eyebrow">{t("Evidence and revision")}</p><h2 id="evidence-heading">{t("Look closer.")}</h2></div><span className="section-heading__note">{feedback.issues.length}{t(" evidence note")}{feedback.issues.length === 1 ? '' : 's'}</span></div>{feedback.issues.length ? feedback.issues.map((issue, index) => <Evidence key={`${issue.dimension}-${index}`} issue={issue} exercise={exercise} sessionId={sessionId} issueIndex={index} />) : <div className="no-issues"><span>✓</span><p>{t("No evidence-backed issues survived validation for this pass.")}</p></div>}<div className="answer-review"><span className="eyebrow">{t("Submitted answer")}</span><p dir={getLanguage(exercise.targetLanguage).direction} lang={exercise.targetLanguage}>{answer}</p></div></section>
    </div>
  )
}

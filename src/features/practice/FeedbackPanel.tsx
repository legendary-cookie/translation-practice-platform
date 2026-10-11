import { getLanguage } from '../../domain/languages'
import type { Exercise, FeedbackAnnotation, ScoreDimension, TranslationFeedback } from '../../domain/types'

const dimensionLabels: Record<ScoreDimension, string> = {
  accuracy: 'Accuracy and meaning',
  terminology: 'Terminology',
  grammar: 'Grammar',
  fluency: 'Fluency',
  taskStyle: 'Task style and register',
}

function Evidence({ issue, exercise }: { issue: FeedbackAnnotation; exercise: Exercise }) {
  const sourceLanguage = getLanguage(exercise.sourceLanguage)
  const targetLanguage = getLanguage(exercise.targetLanguage)
  return (
    <article className="issue-card">
      <div className="issue-card__heading"><span className="issue-card__dimension">{dimensionLabels[issue.dimension]}</span><span aria-hidden="true">↘</span></div>
      {issue.sourceQuote && <div className="evidence-block"><span className="evidence-label">Source evidence</span><blockquote dir={sourceLanguage.direction} lang={exercise.sourceLanguage}>{issue.sourceQuote}</blockquote></div>}
      {issue.learnerQuote && <div className="evidence-block"><span className="evidence-label">Your answer</span><blockquote dir={targetLanguage.direction} lang={exercise.targetLanguage}>{issue.learnerQuote}</blockquote></div>}
      <p className="issue-explanation">{issue.explanation}</p>
      <div className="suggestion"><span>Try this</span><p>{issue.suggestion}</p></div>
    </article>
  )
}

export function FeedbackPanel({
  answer,
  exercise,
  feedback,
  onRevise,
  onChangeSetup,
}: {
  answer: string
  exercise: Exercise
  feedback: TranslationFeedback
  onRevise: () => void
  onChangeSetup: () => void
}) {
  return (
    <div className="feedback-layout">
      <section className="feedback-summary">
        <div className="feedback-summary__topline"><div><div className="feedback-summary__actions"><button className="back-button" type="button" onClick={onRevise}>← Revise translation</button><button className="back-button" type="button" onClick={onChangeSetup}>← Change setup</button></div><p className="eyebrow">Feedback · {exercise.title}</p><h2>Your practice readout.</h2></div><div className="estimate-badge"><strong>{feedback.overallScore}</strong><span>Practice estimate<br />out of 100</span></div></div>
        <div className="estimate-notice"><span>Practice estimate only</span><p>This feedback is for study and reflection. It is not an official CATTI or MTI result.</p></div>
        <p className="feedback-summary__copy">{feedback.summary}</p>
        <div className="dimension-grid">{(Object.keys(dimensionLabels) as ScoreDimension[]).map((dimension) => <div className="dimension-score" key={dimension}><div><span>{dimensionLabels[dimension]}</span><strong>{feedback.dimensions[dimension]}</strong></div><div className="score-track"><span style={{ width: `${feedback.dimensions[dimension]}%` }} /></div></div>)}</div>
        <div className="feedback-columns"><div><span className="eyebrow">What is working</span><ul className="feedback-list">{feedback.strengths.length ? feedback.strengths.map((strength) => <li key={strength}>{strength}</li>) : <li>No specific strengths were returned.</li>}</ul></div><div><span className="eyebrow">Other valid renderings</span>{feedback.alternatives.length ? <ul className="feedback-list">{feedback.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul> : <p className="muted-copy">The evaluator did not add an alternative for this pass.</p>}</div></div>
        <div className="uncertainty-box"><span className="eyebrow">Uncertainty</span><p>{feedback.uncertainty}</p></div>
      </section>
      <section className="feedback-issues" aria-labelledby="evidence-heading"><div className="section-heading"><div><p className="eyebrow">Evidence and revision</p><h2 id="evidence-heading">Look closer.</h2></div><span className="section-heading__note">{feedback.issues.length} evidence note{feedback.issues.length === 1 ? '' : 's'}</span></div>{feedback.issues.length ? feedback.issues.map((issue, index) => <Evidence key={`${issue.dimension}-${index}`} issue={issue} exercise={exercise} />) : <div className="no-issues"><span>✓</span><p>No evidence-backed issues survived validation for this pass.</p></div>}<div className="answer-review"><span className="eyebrow">Submitted answer</span><p dir={getLanguage(exercise.targetLanguage).direction} lang={exercise.targetLanguage}>{answer}</p></div></section>
    </div>
  )
}

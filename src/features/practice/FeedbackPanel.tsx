import { useEffect, useRef } from 'react'
import { dimensionLabels, evaluationDimensions } from '../../domain/scoring'
import { getLanguage } from '../../domain/languages'
import type { EvaluationInput, TranslationFeedback } from '../../domain/types'

export function FeedbackPanel({
  feedback,
  input,
  active,
  onRevise,
  onSave,
  saving,
  saved,
  saveError,
}: {
  feedback: TranslationFeedback
  input: EvaluationInput
  active: boolean
  onRevise: () => void
  onSave: () => void
  saving: boolean
  saved: boolean
  saveError: string
}) {
  const source = getLanguage(input.exercise.sourceLanguage)
  const target = getLanguage(input.targetLanguage)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (active) heading.current?.focus()
  }, [active])
  return (
    <section className="feedback-panel" aria-labelledby="feedback-heading">
      <p className="eyebrow">Reflect, then revise</p>
      <h2 id="feedback-heading" ref={heading} tabIndex={-1}>
        Your translation feedback
      </h2>
      <p className="estimate-label">
        Practice estimate · not an official CATTI / MTI assessment
      </p>
      <p dir="auto">{feedback.summary}</p>
      <dl className="rubric-grid">
        {evaluationDimensions.map((dimension) => (
          <div key={dimension}>
            <dt>{dimensionLabels[dimension]}</dt>
            <dd>
              {feedback.dimensions[dimension]}
              <span> / 100</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="settings-help">
        These AI scores are uncalibrated. Use the evidence and your own judgment
        when deciding how to revise.
      </p>
      <h3>Strengths to keep</h3>
      {feedback.strengths.length ? (
        <ul>
          {feedback.strengths.map((strength, index) => (
            <li key={index} dir="auto">
              {strength}
            </li>
          ))}
        </ul>
      ) : (
        <p>No specific strengths were reported.</p>
      )}
      <h3>Evidence and revision ideas</h3>
      {feedback.issues.length ? (
        feedback.issues.map((issue, index) => (
          <article className="feedback-issue" key={index}>
            <h4>
              {dimensionLabels[issue.dimension]}{' '}
              <span className="badge">{issue.severity}</span>
            </h4>
            <div className="evidence-grid">
              <div>
                <strong>Source evidence</strong>
                {issue.sourceQuote ? (
                  <blockquote lang={source.code} dir={source.direction}>
                    {issue.sourceQuote}
                  </blockquote>
                ) : (
                  <p className="settings-help">
                    No source span · possible addition
                  </p>
                )}
              </div>
              <div>
                <strong>Your submitted words</strong>
                {issue.learnerQuote ? (
                  <blockquote lang={target.code} dir={target.direction}>
                    {issue.learnerQuote}
                  </blockquote>
                ) : (
                  <p className="settings-help">
                    No answer span · possible omission
                  </p>
                )}
              </div>
            </div>
            <p dir="auto">{issue.explanation}</p>
            <p dir="auto">
              <strong>Try a revision: </strong>
              {issue.suggestion}
            </p>
          </article>
        ))
      ) : (
        <p>
          No issues with supporting quotes were reported. This does not
          establish that the translation is error free.
        </p>
      )}
      <aside className="uncertainty-note">
        <h3>Uncertainty and valid alternatives</h3>
        <p>
          More than one translation may work. Treat suggestions as
          possibilities, and check claims against the source.
        </p>
        <ul>
          {feedback.uncertainty.map((item, index) => (
            <li key={index} dir="auto">
              {item}
            </li>
          ))}
        </ul>
      </aside>
      {saveError && (
        <p className="settings-error" role="alert">
          {saveError} Your answer and feedback remain here; you can retry
          saving.
        </p>
      )}
      {saved && (
        <p role="status">
          Completed session saved in this browser on this device.
        </p>
      )}
      <div className="button-row">
        <button
          type="button"
          className="button primary"
          disabled={saving}
          onClick={onRevise}
        >
          Revise this answer
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={saving || saved}
          onClick={onSave}
        >
          {saving
            ? 'Saving…'
            : saved
              ? 'Session saved'
              : 'Save completed session'}
        </button>
      </div>
      <p className="settings-help">
        Revision keeps your text and starts a fresh assessment. Each cloud
        assessment needs its own approval. An unsaved revision is not added to
        history.
      </p>
    </section>
  )
}

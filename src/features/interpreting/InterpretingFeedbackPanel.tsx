import { getLanguage } from '../../domain/languages'
import type { InterpretingEvaluationInput, InterpretingFeedback, InterpretingExercise } from '../../domain/types'
import { TranscriptAlignment } from './TranscriptAlignment'

export function InterpretingFeedbackPanel({
  exercise,
  input,
  feedback,
  notice,
  onRevise,
  onChangeSetup,
}: {
  exercise: InterpretingExercise
  input: InterpretingEvaluationInput
  feedback: InterpretingFeedback
  notice?: string
  onRevise: () => void
  onChangeSetup: () => void
}) {
  const targetLanguage = getLanguage(exercise.targetLanguage)
  const contentScores = feedback.contentScores
  return (
    <div className="interpreting-feedback-page" aria-label="Interpreting practice feedback">
      <header className="interpreting-feedback-header"><div><p className="eyebrow">Interpreting practice estimate</p><h2>Review the evidence, not just the number.</h2><p>{exercise.title} · {getLanguage(exercise.sourceLanguage).nativeLabel} → {targetLanguage.nativeLabel} · {input.interpretingMode}</p></div><span className="pill">Not an official CATTI/MTI result</span></header>
      {notice && <p className="interpreting-notice" role="status">{notice}</p>}
      <section className="interpreting-score-groups" aria-label="Separate interpreting score groups">
        <article className="interpreting-score-card"><p className="eyebrow">Content</p>{contentScores ? <div className="interpreting-score-list"><div><span>Meaning transfer</span><strong>{contentScores.meaningTransfer}</strong></div><div><span>Completeness / omissions</span><strong>{contentScores.omissions}</strong></div><div><span>Additions and mistranslations</span><strong>{contentScores.additionsMistranslations}</strong></div><div><span>Terminology</span><strong>{contentScores.terminology}</strong></div></div> : <p>Content scores are incomplete because no fully verified transcript evidence was available.</p>}<small>{feedback.contentScoreStatus === 'complete' ? 'Based on verified transcript evidence.' : 'No uncertain recognition token is converted into a learner error or false precision.'}</small></article>
        <article className="interpreting-score-card"><p className="eyebrow">Delivery</p><div className="interpreting-score-list"><div><span>Fluency</span><strong>{feedback.deliveryScores.fluency}</strong></div><div><span>Pacing</span><strong>{feedback.deliveryScores.pacing}</strong></div><div><span>Hesitation</span><strong>{feedback.deliveryScores.hesitation}</strong></div></div><small>Heuristics come from local timing/audio analysis; they are not pronunciation certification.</small></article>
        <article className="interpreting-score-card interpreting-score-card--summary"><p className="eyebrow">Summary</p><strong>{feedback.overallScore === undefined ? 'Incomplete' : `${feedback.overallScore}/100`}</strong><p>{feedback.summary}</p><small>Practice estimate only.</small></article>
      </section>
      <section className="interpreting-feedback-copy"><h3>What to revisit</h3><p>{feedback.uncertainty}</p>{feedback.strengths.length > 0 && <div><strong>Strengths</strong><ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></div>}{feedback.issues.length > 0 && <div><strong>Verified evidence-backed issues</strong><ul>{feedback.issues.map((issue, index) => <li key={`${issue.category}-${index}`}><strong>{issue.category}</strong> · {issue.explanation} <span>Suggestion: {issue.suggestion}</span></li>)}</ul></div>}{feedback.uncertainEvidence.length > 0 && <div className="interpreting-uncertain"><strong>Check the transcript before treating these as errors</strong><ul>{feedback.uncertainEvidence.map((issue, index) => <li key={`uncertain-${issue.category}-${index}`}>{issue.explanation} <span>{issue.suggestion}</span></li>)}</ul></div>}{feedback.alternatives.length > 0 && <div><strong>Alternative renderings</strong><ul>{feedback.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul></div>}</section>
      <TranscriptAlignment exercise={exercise} input={input} feedback={feedback} />
      <footer className="interpreting-workspace__footer"><p>Audio and transcript evidence remain in this browser. You can record another take or choose another exercise.</p><div className="interpreting-control-row"><button className="button button--quiet interpreting-action" type="button" onClick={onRevise}>Record another take</button><button className="button button--primary interpreting-action" type="button" onClick={onChangeSetup}>Change setup</button></div></footer>
    </div>
  )
}

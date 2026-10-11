import { useEffect, useState } from 'react'
import { getLanguage } from '../../domain/languages'
import { dimensionLabels, evaluationDimensions } from '../../domain/scoring'
import type { SessionRecord } from '../../domain/types'
import { database } from '../../storage/database'
import './progress.css'

function score(session: SessionRecord): number {
  return evaluationDimensions.reduce((total, dimension) => total + session.feedback.dimensions[dimension], 0) / evaluationDimensions.length
}

function average(sessions: SessionRecord[]): number {
  return sessions.reduce((total, session) => total + score(session), 0) / sessions.length
}

function direction(session: SessionRecord): string {
  return `${getLanguage(session.sourceLanguage).label} → ${getLanguage(session.targetLanguage).label}`
}

function modeLabel(mode: SessionRecord['mode']): string { return mode === 'news' ? 'News translation' : 'Written translation' }
function dateLabel(value: string): string { return new Date(value).toLocaleString() }

export function ProgressPage({ historyVersion, onStartPractice }: { historyVersion: number; onStartPractice: () => void }) {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setSessions(null); setError('')
    void database.listSessions().then((value) => { if (active) setSessions(value) }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : 'Could not load saved sessions.') })
    return () => { active = false }
  }, [historyVersion, reload])

  const recent = sessions?.slice(0, 10).reverse() ?? []
  const groups = new Map<string, SessionRecord[]>()
  for (const session of sessions ?? []) {
    const label = `${direction(session)} · ${modeLabel(session.mode)}`
    groups.set(label, [...(groups.get(label) ?? []), session])
  }

  return <section className="progress-page" aria-labelledby="progress-heading">
    <header><p className="eyebrow">Your learning record</p><h1 id="progress-heading">Progress, passage by passage.</h1><p>Only completed assessments you explicitly saved appear here. History belongs to this browser profile on this device; it is not synchronized with another device.</p></header>
    {error ? <div className="page-panel"><p role="alert" className="settings-error">{error}</p><button type="button" className="button secondary" onClick={() => setReload((value) => value + 1)}>Retry loading history</button></div> : sessions === null ? <p role="status">Loading saved practice…</p> : sessions.length === 0 ? <div className="page-panel"><h2>No saved sessions yet</h2><p>Complete a passage, review the feedback, then choose Save completed session. Your first saved assessment will start this record.</p><button type="button" className="button primary" onClick={onStartPractice}>Start written practice</button></div> : <>
      <div className="progress-summary"><div><span>Saved assessments</span><strong>{sessions.length}</strong></div><div><span>Mean practice estimate</span><strong>{average(sessions).toFixed(1)} <small>/ 100</small></strong></div><div><span>Directions practised</span><strong>{new Set(sessions.map((session) => `${session.sourceLanguage}-${session.targetLanguage}`)).size}</strong></div></div>
      <p className="settings-help">Practice estimates are uncalibrated AI feedback, not official exam scores. The mean gives equal weight to all five dimensions and each saved assessment. Passage difficulty, language, mode, and evaluator can change the scores; repeated saves of revisions are separate assessments.</p>
      <section className="progress-card" aria-labelledby="trend-heading"><h2 id="trend-heading">Recent score trend</h2><p className="settings-help">Up to 10 most recent saved assessments, from oldest to newest. Scores across different tasks are not a measured change in ability.</p><ol className="score-trend">{recent.map((session) => <li key={session.id}><div><time dateTime={session.createdAt}>{dateLabel(session.createdAt)}</time><span><bdi>{direction(session)}</bdi> · {modeLabel(session.mode)}</span></div><meter min={0} max={100} value={score(session)} aria-label={`${direction(session)}, ${modeLabel(session.mode)}, mean practice estimate`} /><strong>{score(session).toFixed(1)} / 100</strong></li>)}</ol>{recent.length === 1 && <p className="settings-help">One saved assessment provides a starting point. Save another to compare results.</p>}</section>
      <section className="progress-card" aria-labelledby="dimensions-heading"><h2 id="dimensions-heading">Dimension averages</h2><dl className="dimension-averages">{evaluationDimensions.map((dimension) => <div key={dimension}><dt>{dimensionLabels[dimension]}</dt><dd><meter min={0} max={100} value={sessions.reduce((total, session) => total + session.feedback.dimensions[dimension], 0) / sessions.length} aria-label={`${dimensionLabels[dimension]} average`} /><strong>{(sessions.reduce((total, session) => total + session.feedback.dimensions[dimension], 0) / sessions.length).toFixed(1)} / 100</strong><span>{sessions.filter((session) => session.feedback.issues.some((issue) => issue.dimension === dimension)).length} of {sessions.length} assessments include an issue in this dimension</span></dd></div>)}</dl><p className="settings-help">Issue counts reflect saved model annotations. A missing annotation does not establish an error-free translation.</p></section>
      <section className="progress-card" aria-labelledby="breakdown-heading"><h2 id="breakdown-heading">By direction & mode</h2><ul className="progress-breakdown">{[...groups].map(([label, records]) => <li key={label}><bdi>{label}</bdi><span>{records.length} saved · mean {average(records).toFixed(1)} / 100</span></li>)}</ul></section>
      <section className="progress-card" aria-labelledby="history-heading"><h2 id="history-heading">Saved session history</h2><p className="settings-help">Open an assessment to inspect its saved answer and feedback.</p><div className="saved-history">{sessions.map((session) => <details key={session.id}><summary><bdi>{direction(session)}</bdi><span>{modeLabel(session.mode)} · {dateLabel(session.createdAt)} · {score(session).toFixed(1)} / 100</span></summary><p className="settings-help">Editing time: {Math.floor(session.elapsedSeconds / 60)} minutes {session.elapsedSeconds % 60} seconds.</p><h3>Saved translation</h3><p className="saved-answer" lang={session.targetLanguage} dir={getLanguage(session.targetLanguage).direction}>{session.learnerAnswer}</p><h3>Practice feedback</h3><p dir="auto">{session.feedback.summary}</p><dl className="saved-scores">{evaluationDimensions.map((dimension) => <div key={dimension}><dt>{dimensionLabels[dimension]}</dt><dd>{session.feedback.dimensions[dimension]} / 100</dd></div>)}</dl>{session.feedback.strengths.length > 0 && <><h3>Strengths</h3><ul>{session.feedback.strengths.map((strength, index) => <li key={index} dir="auto">{strength}</li>)}</ul></>}<h3>Saved annotations</h3>{session.feedback.issues.length === 0 ? <p>No issue annotations were saved. Valid alternatives and errors may still have been missed.</p> : <ol className="saved-issues">{session.feedback.issues.map((issue, index) => <li key={index}><strong>{dimensionLabels[issue.dimension]} · {issue.severity}</strong><p>Source evidence: {issue.sourceQuote ? <q lang={session.sourceLanguage} dir={getLanguage(session.sourceLanguage).direction}>{issue.sourceQuote}</q> : 'No source span (possible addition).'}</p><p>Answer evidence: {issue.learnerQuote ? <q lang={session.targetLanguage} dir={getLanguage(session.targetLanguage).direction}>{issue.learnerQuote}</q> : 'No answer span (possible omission).'}</p><p dir="auto">{issue.explanation}</p><p dir="auto">Revision: {issue.suggestion}</p></li>)}</ol>}<h3>Uncertainty</h3><ul>{session.feedback.uncertainty.map((item, index) => <li key={index} dir="auto">{item}</li>)}</ul></details>)}</div></section>
    </>}
  </section>
}

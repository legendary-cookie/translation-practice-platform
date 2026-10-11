import { getLanguage } from '../../domain/languages'
import type { ScoreDimension, SessionRecord } from '../../domain/types'

const dimensions: ScoreDimension[] = ['accuracy', 'terminology', 'grammar', 'fluency', 'taskStyle']
const dimensionLabels: Record<ScoreDimension, string> = {
  accuracy: 'Accuracy and meaning',
  terminology: 'Terminology',
  grammar: 'Grammar',
  fluency: 'Fluency',
  taskStyle: 'Task style and register',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0
}

export function ProgressPage({ sessions, onStartPractice }: { sessions: SessionRecord[]; onStartPractice: () => void }) {
  if (!sessions.length) {
    return (
      <div className="progress-page">
        <section className="progress-empty"><span className="empty-state__icon" aria-hidden="true">↗</span><p className="eyebrow">Local history</p><h2>Your progress starts with your first pass.</h2><p>There are no saved sessions on this browser yet. Complete a written or news translation to see practice estimates and dimension trends here.</p><button className="button button--primary" type="button" onClick={onStartPractice}>Start a practice session <span aria-hidden="true">→</span></button></section>
      </div>
    )
  }

  const overallAverage = average(sessions.map((session) => session.feedback.overallScore))
  const dimensionAverages = dimensions.reduce<Record<ScoreDimension, number>>((result, dimension) => {
    result[dimension] = average(sessions.map((session) => session.feedback.dimensions[dimension]))
    return result
  }, {} as Record<ScoreDimension, number>)
  const directionCounts = sessions.reduce<Map<string, { sourceLanguage: SessionRecord['sourceLanguage']; targetLanguage: SessionRecord['targetLanguage']; count: number; average: number[] }>>((result, session) => {
    const key = `${session.sourceLanguage}-${session.targetLanguage}`
    const current = result.get(key) ?? { sourceLanguage: session.sourceLanguage, targetLanguage: session.targetLanguage, count: 0, average: [] }
    current.count += 1
    current.average.push(session.feedback.overallScore)
    result.set(key, current)
    return result
  }, new Map())

  return (
    <div className="progress-page">
      <section className="progress-overview"><div><p className="eyebrow">Local history</p><h2>Small passes add up.</h2><p>Your summaries come only from completed sessions saved in this browser. Scores remain practice estimates.</p></div><div className="progress-overview__score"><strong>{overallAverage}</strong><span>average practice<br />estimate</span></div></section>
      <section className="progress-stat-grid"><article className="progress-stat"><span className="eyebrow">Sessions</span><strong>{sessions.length}</strong><span>saved locally</span></article><article className="progress-stat"><span className="eyebrow">Directions</span><strong>{directionCounts.size}</strong><span>practised so far</span></article><article className="progress-stat"><span className="eyebrow">Time spent</span><strong>{Math.round(sessions.reduce((total, session) => total + session.elapsedSeconds, 0) / 60)}m</strong><span>recorded practice</span></article></section>
      <section className="progress-panels"><article className="progress-card"><div className="progress-card__heading"><div><p className="eyebrow">Score trend</p><h3>Recent practice estimates</h3></div><span className="section-heading__note">Newest first</span></div><div className="trend-list">{sessions.slice(0, 8).map((session) => <div className="trend-row" key={session.id}><div className="trend-row__label"><span>{getLanguage(session.sourceLanguage).nativeLabel} → {getLanguage(session.targetLanguage).nativeLabel}</span><small>{formatDate(session.createdAt)}</small></div><div className="trend-row__track"><span style={{ width: `${session.feedback.overallScore}%` }} /></div><strong>{session.feedback.overallScore}</strong></div>)}</div></article><article className="progress-card"><div className="progress-card__heading"><div><p className="eyebrow">Skill summary</p><h3>Dimension averages</h3></div></div><div className="skill-list">{dimensions.map((dimension) => <div className="skill-row" key={dimension}><div><span>{dimensionLabels[dimension]}</span><strong>{dimensionAverages[dimension]}</strong></div><div className="trend-row__track"><span style={{ width: `${dimensionAverages[dimension]}%` }} /></div></div>)}</div></article></section>
      <section className="progress-panels"><article className="progress-card"><div className="progress-card__heading"><div><p className="eyebrow">Language directions</p><h3>Where you are spending time</h3></div></div><div className="direction-list">{Array.from(directionCounts.values()).map((direction) => <div className="direction-row" key={`${direction.sourceLanguage}-${direction.targetLanguage}`}><span>{getLanguage(direction.sourceLanguage).label} → {getLanguage(direction.targetLanguage).label}</span><span>{direction.count} session{direction.count === 1 ? '' : 's'} · {average(direction.average)}/100</span></div>)}</div></article><article className="progress-card progress-card--note"><span className="progress-card__mark">✦</span><h3>Use the pattern, not the number.</h3><p>These summaries help you decide what to revisit. They are not calibrated, official, or a substitute for CATTI or MTI scoring.</p></article></section>
    </div>
  )
}

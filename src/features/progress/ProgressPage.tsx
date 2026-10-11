import { useState } from 'react'
import { getLanguage } from '../../domain/languages'
import type { ConsolidatedExamResult, ScoreDimension, SessionRecord } from '../../domain/types'
import { PRACTICE_ESTIMATE_DISCLAIMER } from '../../domain/exam'

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

export function ProgressPage({
  sessions,
  examResults = [],
  onStartPractice,
  onStartExam,
}: {
  sessions: SessionRecord[]
  examResults?: ConsolidatedExamResult[]
  onStartPractice: () => void
  onStartExam?: () => void
}) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'exams'>('sessions')

  const hasAnyData = sessions.length > 0 || examResults.length > 0

  if (!hasAnyData) {
    return (
      <div className="progress-page" role="main">
        <section className="progress-empty">
          <span className="empty-state__icon" aria-hidden="true">↗</span>
          <p className="eyebrow">Local history</p>
          <h2>Your progress starts with your first pass.</h2>
          <p>
            There are no saved sessions or mock exams on this browser yet. Complete a written translation or an exam simulation to see practice estimates and dimension trends here.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
            <button className="button button--primary" type="button" onClick={onStartPractice}>
              Start a practice session <span aria-hidden="true">→</span>
            </button>
            {onStartExam && (
              <button className="button button--quiet" type="button" onClick={onStartExam}>
                Try an exam simulation <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  // Written translation stats
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

  // Exam simulation stats
  const examAveragePercentage = average(examResults.map((r) => r.percentage))
  const examDimensionAverages = dimensions.reduce<Record<ScoreDimension, number>>((result, dimension) => {
    result[dimension] = average(examResults.map((r) => r.consolidatedDimensions[dimension] ?? 0))
    return result
  }, {} as Record<ScoreDimension, number>)

  return (
    <div className="progress-page" role="main">
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
        <button
          className={`button ${activeTab === 'sessions' ? 'button--primary' : 'button--quiet'}`}
          type="button"
          onClick={() => setActiveTab('sessions')}
        >
          Daily Practice ({sessions.length})
        </button>
        <button
          className={`button ${activeTab === 'exams' ? 'button--primary' : 'button--quiet'}`}
          type="button"
          onClick={() => setActiveTab('exams')}
        >
          Mock Exam Simulations ({examResults.length})
        </button>
      </div>

      {activeTab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <section className="progress-empty">
              <p>No daily practice sessions recorded yet.</p>
              <button className="button button--primary" type="button" onClick={onStartPractice}>
                Start a practice session <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <>
              <section className="progress-overview">
                <div>
                  <p className="eyebrow">Local history</p>
                  <h2>Small passes add up.</h2>
                  <p>Your summaries come only from completed sessions saved in this browser. Scores remain practice estimates.</p>
                </div>
                <div className="progress-overview__score">
                  <strong>{overallAverage}</strong>
                  <span>average practice<br />estimate</span>
                </div>
              </section>

              <section className="progress-stat-grid">
                <article className="progress-stat">
                  <span className="eyebrow">Sessions</span>
                  <strong>{sessions.length}</strong>
                  <span>saved locally</span>
                </article>
                <article className="progress-stat">
                  <span className="eyebrow">Directions</span>
                  <strong>{directionCounts.size}</strong>
                  <span>practised so far</span>
                </article>
                <article className="progress-stat">
                  <span className="eyebrow">Time spent</span>
                  <strong>{Math.round(sessions.reduce((total, session) => total + session.elapsedSeconds, 0) / 60)}m</strong>
                  <span>recorded practice</span>
                </article>
              </section>

              <section className="progress-panels">
                <article className="progress-card">
                  <div className="progress-card__heading">
                    <div>
                      <p className="eyebrow">Score trend</p>
                      <h3>Recent practice estimates</h3>
                    </div>
                    <span className="section-heading__note">Newest first</span>
                  </div>
                  <div className="trend-list">
                    {sessions.slice(0, 8).map((session) => (
                      <div className="trend-row" key={session.id}>
                        <div className="trend-row__label">
                          <span>{getLanguage(session.sourceLanguage).nativeLabel} → {getLanguage(session.targetLanguage).nativeLabel}</span>
                          <small>{formatDate(session.createdAt)} · Practice estimate</small>
                        </div>
                        <div className="trend-row__track">
                          <span style={{ width: `${session.feedback.overallScore}%` }} />
                        </div>
                        <strong>
                          {session.feedback.overallScore}
                          <small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>Practice estimate</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="progress-card">
                  <div className="progress-card__heading">
                    <div>
                      <p className="eyebrow">Skill summary</p>
                      <h3>Dimension averages</h3>
                    </div>
                  </div>
                  <div className="skill-list">
                    {dimensions.map((dimension) => (
                      <div className="skill-row" key={dimension}>
                        <div>
                          <span>{dimensionLabels[dimension]}</span>
                          <strong>{dimensionAverages[dimension]}</strong>
                        </div>
                        <div className="trend-row__track">
                          <span style={{ width: `${dimensionAverages[dimension]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="progress-panels">
                <article className="progress-card">
                  <div className="progress-card__heading">
                    <div>
                      <p className="eyebrow">Language directions</p>
                      <h3>Where you are spending time</h3>
                    </div>
                  </div>
                  <div className="direction-list">
                    {Array.from(directionCounts.values()).map((direction) => (
                      <div className="direction-row" key={`${direction.sourceLanguage}-${direction.targetLanguage}`}>
                        <span>{getLanguage(direction.sourceLanguage).label} → {getLanguage(direction.targetLanguage).label}</span>
                        <span>{direction.count} session{direction.count === 1 ? '' : 's'} · {average(direction.average)}/100</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="progress-card progress-card--note">
                  <span className="progress-card__mark">✦</span>
                  <h3>Use the pattern, not the number.</h3>
                  <p>These summaries help you decide what to revisit. They are not calibrated, official, or a substitute for CATTI or MTI scoring.</p>
                </article>
              </section>
            </>
          )}
        </>
      )}

      {activeTab === 'exams' && (
        <>
          {examResults.length === 0 ? (
            <section className="progress-empty">
              <p>No exam simulations completed yet.</p>
              {onStartExam && (
                <button className="button button--primary" type="button" onClick={onStartExam}>
                  Choose an exam profile <span aria-hidden="true">→</span>
                </button>
              )}
            </section>
          ) : (
            <>
              <section className="progress-overview">
                <div>
                  <p className="eyebrow">Mock Exam History</p>
                  <h2>Timed Exam Simulations</h2>
                  <p>Consolidated multi-section results saved on this device. All scores are practice estimates.</p>
                </div>
                <div className="progress-overview__score">
                  <strong>{examAveragePercentage}%</strong>
                  <span>average overall<br />estimate</span>
                </div>
              </section>

              <section className="progress-stat-grid">
                <article className="progress-stat">
                  <span className="eyebrow">Total Attempts</span>
                  <strong>{examResults.length}</strong>
                  <span>simulations completed</span>
                </article>
                <article className="progress-stat">
                  <span className="eyebrow">Above Benchmark</span>
                  <strong>
                    {examResults.filter((r) => r.estimatedStatus === 'above-benchmark').length}
                  </strong>
                  <span>attempts met benchmark</span>
                </article>
                <article className="progress-stat">
                  <span className="eyebrow">Latest Score</span>
                  <strong>
                    {examResults[0].totalScore} / {examResults[0].maxScore}
                  </strong>
                  <span>{examResults[0].percentage}% · practice estimate</span>
                </article>
              </section>

              <section className="progress-panels">
                <article className="progress-card">
                  <div className="progress-card__heading">
                    <div>
                      <p className="eyebrow">Attempts</p>
                      <h3>Completed Mock Exams</h3>
                    </div>
                    <span className="section-heading__note">Newest first</span>
                  </div>
                  <div className="trend-list">
                    {examResults.map((result) => {
                      const badgeClass =
                        result.estimatedStatus === 'above-benchmark'
                          ? 'pill--success'
                          : result.estimatedStatus === 'near-benchmark'
                          ? 'pill--warning'
                          : 'pill--muted'
                      return (
                        <div className="trend-row" key={result.id}>
                          <div className="trend-row__label">
                            <span>{result.examTitle}</span>
                            <small>
                              {formatDate(result.completedAt)} · Practice estimate · <span className={`pill ${badgeClass}`}>{result.estimatedStatus}</span>
                            </small>
                          </div>
                          <strong>
                            {result.totalScore} / {result.maxScore} pts ({result.percentage}%) · Practice estimate
                          </strong>
                        </div>
                      )
                    })}
                  </div>
                </article>

                <article className="progress-card">
                  <div className="progress-card__heading">
                    <div>
                      <p className="eyebrow">Rubric Competencies</p>
                      <h3>Exam Dimension Averages</h3>
                    </div>
                  </div>
                  <div className="skill-list">
                    {dimensions.map((dimension) => (
                      <div className="skill-row" key={dimension}>
                        <div>
                          <span>{dimensionLabels[dimension]}</span>
                          <strong>{examDimensionAverages[dimension]} / 100</strong>
                        </div>
                        <div className="trend-row__track">
                          <span style={{ width: `${examDimensionAverages[dimension]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="progress-panels">
                <article className="progress-card progress-card--note" style={{ width: '100%' }}>
                  <span className="progress-card__mark">✦</span>
                  <h3>Practice Estimate Notice</h3>
                  <p>{PRACTICE_ESTIMATE_DISCLAIMER}</p>
                </article>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

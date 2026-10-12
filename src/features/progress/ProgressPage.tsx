import { useState } from 'react'
import type { SessionHistoryStatus } from '../practice/session-history'
import { getLanguage } from '../../domain/languages'
import type { ConsolidatedExamResult, InterpretingSessionRecord, ScoreDimension, SessionRecord } from '../../domain/types'
import { PRACTICE_ESTIMATE_DISCLAIMER } from '../../domain/exam'

function InterpretingHistoryActions({
  session,
  onOpen,
  onDelete,
}: {
  session: InterpretingSessionRecord
  onOpen?: (session: InterpretingSessionRecord) => void
  onDelete?: (id: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string>()

  async function deleteSession() {
    if (!onDelete || isDeleting) return
    setIsDeleting(true)
    setError(undefined)
    try {
      await onDelete(session.id)
      setConfirming(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The saved interpreting audio could not be deleted from this device.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="interpreting-history-actions">
      {onOpen && <button className="button button--quiet interpreting-action" type="button" onClick={() => onOpen(session)}>Open saved self-review</button>}
      {onDelete && <button className="button button--danger interpreting-action" type="button" onClick={() => { setConfirming(true); setError(undefined) }}>Delete saved take</button>}
      {confirming && <div className="interpreting-delete-confirmation" role="group" aria-label="Confirm deletion of saved interpreting take">
        <p>Delete this session and its local source/response audio? This cannot be undone here. Export your data first if you need a backup.</p>
        <div className="interpreting-history-actions__confirm">
          <button className="button button--danger interpreting-action" type="button" onClick={() => void deleteSession()} disabled={isDeleting}>{isDeleting ? 'Deleting locally…' : 'Delete session and audio'}</button>
          <button className="button button--quiet interpreting-action" type="button" onClick={() => setConfirming(false)} disabled={isDeleting}>Keep it</button>
        </div>
      </div>}
      {error && <p className="settings-error" role="alert">{error}</p>}
    </div>
  )
}

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
  sessionHistoryStatus = 'ready',
  interpretingSessions = [],
  interpretingHistoryStatus = 'ready',
  examResults = [],
  examHistoryStatus = 'ready',
  onStartPractice,
  onStartInterpreting,
  onOpenInterpretingSession,
  onDeleteInterpretingSession,
  onOpenExamResult,
  onStartExam,
  onRetrySessionHistory,
  onRetryInterpretingHistory,
  onRetryExamHistory,
}: {
  sessions: SessionRecord[]
  sessionHistoryStatus?: SessionHistoryStatus
  interpretingSessions?: InterpretingSessionRecord[]
  interpretingHistoryStatus?: SessionHistoryStatus
  examResults?: ConsolidatedExamResult[]
  examHistoryStatus?: SessionHistoryStatus
  onStartPractice: () => void
  onStartInterpreting?: () => void
  onOpenInterpretingSession?: (session: InterpretingSessionRecord) => void
  onDeleteInterpretingSession?: (id: string) => Promise<void>
  onOpenExamResult?: (result: ConsolidatedExamResult) => void
  onStartExam?: () => void
  onRetrySessionHistory?: () => void
  onRetryInterpretingHistory?: () => void
  onRetryExamHistory?: () => void
}) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'interpreting' | 'exams'>('sessions')

  const hasAnyData = sessions.length > 0 || interpretingSessions.length > 0 || examResults.length > 0

  if (!hasAnyData) {
    const statuses = [sessionHistoryStatus, interpretingHistoryStatus, examHistoryStatus]
    const failedSources = [
      sessionHistoryStatus === 'failed' ? 'written practice' : undefined,
      interpretingHistoryStatus === 'failed' ? 'interpreting' : undefined,
      examHistoryStatus === 'failed' ? 'exam' : undefined,
    ].filter((source): source is string => Boolean(source))
    const isLoading = statuses.some((status) => status === 'loading')
    const isFailed = failedSources.length > 0
    return (
      <div className="progress-page" role="main">
        <section className="progress-empty">
          <span className="empty-state__icon" aria-hidden="true">↗</span>
          <p className="eyebrow">Local history</p>
          <h2>{isFailed ? 'Saved local history is not fully available.' : isLoading ? 'Checking local history.' : 'Your progress starts with your first pass.'}</h2>
          <p>
            {isFailed
              ? `This browser could not read ${failedSources.join(', ')} history. Existing records may still be present; retry before assuming there is no saved work.`
              : isLoading
                ? 'Checking this device for saved practice sessions. You can continue practicing while the local history check finishes.'
                : 'There are no saved sessions or mock exams on this browser yet. Complete a written translation, interpreting take, or exam simulation to see practice estimates and dimension trends here.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
            {sessionHistoryStatus === 'failed' && onRetrySessionHistory && <button className="button button--quiet" type="button" onClick={onRetrySessionHistory}>Retry written history</button>}
            {interpretingHistoryStatus === 'failed' && onRetryInterpretingHistory && <button className="button button--quiet" type="button" onClick={onRetryInterpretingHistory}>Retry interpreting history</button>}
            {examHistoryStatus === 'failed' && onRetryExamHistory && <button className="button button--quiet" type="button" onClick={onRetryExamHistory}>Retry exam history</button>}
            <button className="button button--primary" type="button" onClick={onStartPractice}>
              Start a practice session <span aria-hidden="true">→</span>
            </button>
            {onStartExam && (
              <button className="button button--quiet" type="button" onClick={onStartExam}>
                Try an exam simulation <span aria-hidden="true">→</span>
              </button>
            )}
            {onStartInterpreting && <button className="button button--quiet" type="button" onClick={onStartInterpreting}>Try interpreting</button>}
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
      {(sessionHistoryStatus === 'failed' || interpretingHistoryStatus === 'failed' || examHistoryStatus === 'failed') && <section className="notice-banner notice-banner--warning" role="alert">
        Saved local history is not fully available. Existing records may still be present; retry the failed history reads before treating any count as empty.
        {sessionHistoryStatus === 'failed' && onRetrySessionHistory && <button className="button button--quiet" type="button" onClick={onRetrySessionHistory}>Retry written history</button>}
        {interpretingHistoryStatus === 'failed' && onRetryInterpretingHistory && <button className="button button--quiet" type="button" onClick={onRetryInterpretingHistory}>Retry interpreting history</button>}
        {examHistoryStatus === 'failed' && onRetryExamHistory && <button className="button button--quiet" type="button" onClick={onRetryExamHistory}>Retry exam history</button>}
      </section>}
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
        <button
          className={`button ${activeTab === 'interpreting' ? 'button--primary' : 'button--quiet'}`}
          type="button"
          onClick={() => setActiveTab('interpreting')}
        >
          Interpreting ({interpretingSessions.length})
        </button>
      </div>

      {activeTab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <section className="progress-empty">
              <p>{sessionHistoryStatus === 'failed' ? 'Written practice history could not be read; saved sessions may still exist on this device.' : sessionHistoryStatus === 'loading' ? 'Checking this device for saved written sessions…' : 'No daily practice sessions recorded yet.'}</p>
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
                    {sessions.map((session) => {
                      const sourceLanguage = getLanguage(session.sourceLanguage)
                      const targetLanguage = getLanguage(session.targetLanguage)
                      return (
                        <div className="progress-session-entry" key={session.id}>
                          <div className="trend-row">
                            <div className="trend-row__label">
                              <span>{sourceLanguage.nativeLabel} → {targetLanguage.nativeLabel}</span>
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
                          <details className="progress-session-detail">
                            <summary>Review answer and feedback</summary>
                            <p className="progress-session-detail__disclaimer">{PRACTICE_ESTIMATE_DISCLAIMER}</p>
                            <h4>Your answer</h4>
                            <blockquote dir={targetLanguage.direction} lang={targetLanguage.code}>{session.answer || 'No answer was saved for this session.'}</blockquote>
                            <h4>Summary</h4>
                            <p>{session.feedback.summary}</p>
                            {session.feedback.strengths.length > 0 && <><h4>Strengths</h4><ul>{session.feedback.strengths.map((strength, index) => <li key={`${session.id}-strength-${index}`}>{strength}</li>)}</ul></>}
                            {session.feedback.issues.length > 0 && <><h4>Issues and evidence</h4><ul>{session.feedback.issues.map((issue, index) => <li key={`${session.id}-issue-${index}`}><strong>{issue.dimension}</strong><p>{issue.explanation}</p>{issue.sourceQuote && <blockquote dir={sourceLanguage.direction} lang={sourceLanguage.code}>{issue.sourceQuote}</blockquote>}{issue.learnerQuote && <blockquote dir={targetLanguage.direction} lang={targetLanguage.code}>{issue.learnerQuote}</blockquote>}{issue.suggestion && <p>Suggestion: {issue.suggestion}</p>}</li>)}</ul></>}
                            {session.feedback.alternatives.length > 0 && <><h4>Alternatives</h4><ul>{session.feedback.alternatives.map((alternative, index) => <li key={`${session.id}-alternative-${index}`}>{alternative}</li>)}</ul></>}
                            {session.feedback.uncertainty && <p><strong>Uncertainty:</strong> {session.feedback.uncertainty}</p>}
                          </details>
                        </div>
                      )
                    })}
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

      {activeTab === 'interpreting' && (
        <>
          {interpretingSessions.length === 0 ? (
            <section className="progress-empty">
              <p>{interpretingHistoryStatus === 'failed' ? 'Interpreting history could not be read; saved audio sessions may still exist on this device.' : interpretingHistoryStatus === 'loading' ? 'Checking this device for saved interpreting sessions…' : 'No interpreting sessions completed yet.'}</p>
              {interpretingHistoryStatus === 'failed' && onRetryInterpretingHistory && <button className="button button--quiet" type="button" onClick={onRetryInterpretingHistory}>Retry interpreting history</button>}
              {onStartInterpreting && <button className="button button--primary" type="button" onClick={onStartInterpreting}>Start an interpreting take <span aria-hidden="true">→</span></button>}
            </section>
          ) : (
            <>
              <section className="progress-overview">
                <div><p className="eyebrow">Local interpreting history</p><h2>Listen for the pattern.</h2><p>Content and delivery remain separate practice estimates. Incomplete transcript evidence is shown as incomplete, never as a precise official score.</p></div>
                {(() => { const completeScores = interpretingSessions.map((session) => session.feedback.overallScore).filter((score): score is number => score !== undefined); return <div className="progress-overview__score"><strong>{completeScores.length > 0 ? average(completeScores) : '—'}</strong><span>{completeScores.length > 0 ? 'average complete estimate' : 'no complete estimate'}</span></div> })()}
              </section>
              <section className="progress-stat-grid">
                <article className="progress-stat"><span className="eyebrow">Takes</span><strong>{interpretingSessions.length}</strong><span>saved locally</span></article>
                <article className="progress-stat"><span className="eyebrow">Complete content</span><strong>{interpretingSessions.filter((session) => session.feedback.contentScoreStatus === 'complete').length}</strong><span>with verified transcripts</span></article>
                <article className="progress-stat"><span className="eyebrow">Directions</span><strong>{new Set(interpretingSessions.map((session) => `${session.sourceLanguage}-${session.targetLanguage}`)).size}</strong><span>practised so far</span></article>
              </section>
              <section className="progress-panels">
                <article className="progress-card"><div className="progress-card__heading"><div><p className="eyebrow">Take history</p><h3>Saved interpreting takes</h3></div><span className="section-heading__note">Newest first</span></div><div className="trend-list">{interpretingSessions.map((session) => <div className="interpreting-history-item" key={session.id}><div className="trend-row"><div className="trend-row__label"><span>{getLanguage(session.sourceLanguage).nativeLabel} → {getLanguage(session.targetLanguage).nativeLabel}</span><small>{formatDate(session.createdAt)} · {session.interpretingMode}</small></div><div className="trend-row__track"><span style={{ width: `${session.feedback.overallScore ?? 0}%` }} /></div><strong>{session.evaluator === 'manual' ? 'Self-review' : session.feedback.overallScore === undefined ? 'No score' : `${session.feedback.overallScore}/100`}<small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>{session.feedback.overallScore === undefined ? 'Saved locally' : 'Practice estimate'}</small></strong></div><InterpretingHistoryActions session={session} onOpen={onOpenInterpretingSession} onDelete={onDeleteInterpretingSession} /></div>)}</div></article>
                <article className="progress-card"><div className="progress-card__heading"><div><p className="eyebrow">Delivery trend</p><h3>Delivery estimate averages</h3></div></div>{interpretingSessions.some((session) => session.feedback.deliveryScores) ? <div className="skill-list">{(['fluency', 'pacing', 'hesitation'] as const).map((dimension) => { const values = interpretingSessions.map((session) => session.feedback.deliveryScores?.[dimension]).filter((value): value is number => value !== undefined); const value = average(values); return <div className="skill-row" key={dimension}><div><span>{dimension[0].toUpperCase() + dimension.slice(1)}</span><strong>{value}</strong></div><div className="trend-row__track"><span style={{ width: `${value}%` }} /></div></div> })}</div> : <p>Delivery estimates are unavailable because no complete, supported audio evidence has been saved.</p>}<small>These are practice estimates. Local audio measures are heuristics; cloud analysis only uses learner audio attached after one-time task consent. Neither is pronunciation certification.</small></article>
              </section>
              <section className="progress-panels"><article className="progress-card progress-card--note" style={{ width: '100%' }}><span className="progress-card__mark">✦</span><h3>Interpreting evidence notice</h3><p>Local audio-analysis measures are heuristics. A cloud delivery estimate is based on learner audio only when attached after one-time task consent. Recognition-uncertain evidence remains separate for transcript review and does not become a learner-error annotation.</p></article></section>
            </>
          )}
        </>
      )}

      {activeTab === 'exams' && (
        <>
          {examResults.length === 0 ? (
            <section className="progress-empty">
              <p>{examHistoryStatus === 'failed' ? 'Exam history could not be read; saved results may still exist on this device.' : examHistoryStatus === 'loading' ? 'Checking this device for saved exam results…' : 'No exam simulations completed yet.'}</p>
              {examHistoryStatus === 'failed' && onRetryExamHistory && <button className="button button--quiet" type="button" onClick={onRetryExamHistory}>Retry exam history</button>}
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
                  <span className="eyebrow">Met Benchmark</span>
                  <strong>
                    {examResults.filter((r) => r.totalScore >= r.passBenchmark).length}
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
                        <button
                          className="trend-row trend-row--button"
                          key={result.id}
                          type="button"
                          onClick={() => onOpenExamResult?.(result)}
                          disabled={!onOpenExamResult}
                          aria-label={`Open report for ${result.examTitle}`}
                        >
                          <div className="trend-row__label">
                            <span>{result.examTitle}</span>
                            <small>
                              {formatDate(result.completedAt)} · Practice estimate · <span className={`pill ${badgeClass}`}>{result.estimatedStatus}</span>
                            </small>
                          </div>
                          <strong>
                            {result.totalScore} / {result.maxScore} pts ({result.percentage}%) · Practice estimate
                          </strong>
                        </button>
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

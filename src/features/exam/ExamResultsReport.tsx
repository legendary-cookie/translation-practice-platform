import { t } from '../../i18n'
import { exportJson } from '../../native/export-json'
import { useState } from 'react'
import type { ConsolidatedExamResult, ScoreDimension } from '../../domain/types'
import { getLanguage } from '../../domain/languages'
import {
  CATTI_THRESHOLD_NOTICE,
  PRACTICE_ESTIMATE_DISCLAIMER,
  PLATFORM_AUTHORED_RUBRIC_NOTICE,
  PROVISIONAL_DRAFT_LABEL,
  PROVISIONAL_DRAFT_NOTICE,
} from '../../domain/exam'

export type ExamResultsReportProps = {
  result: ConsolidatedExamResult
  onRetake: () => void
  onBackToDashboard: () => void
}

const dimensionLabels: Record<ScoreDimension, string> = {
  accuracy: 'Accuracy and meaning',
  terminology: 'Terminology',
  grammar: 'Grammar',
  fluency: 'Fluency',
  taskStyle: 'Task style and register',
}

const dimensionsList: ScoreDimension[] = [
  'accuracy',
  'terminology',
  'grammar',
  'fluency',
  'taskStyle',
]

export function ExamResultsReport({
  result,
  onRetake,
  onBackToDashboard,
}: ExamResultsReportProps) {
  const [exportError, setExportError] = useState<string>()
  const [expandedPassageIds, setExpandedPassageIds] = useState<Record<string, boolean>>(() => {
    // Default open first passage of each section
    const initial: Record<string, boolean> = {}
    result.sectionResults.forEach((sec) => {
      if (sec.passageFeedbacks[0]) {
        initial[sec.passageFeedbacks[0].passageId] = true
      }
    })
    return initial
  })

  const togglePassage = (passageId: string) => {
    setExpandedPassageIds((prev) => ({ ...prev, [passageId]: !prev[passageId] }))
  }

  const handleExportJson = async () => {
    setExportError(undefined)
    try { await exportJson(result, `exam-practice-report-${result.profileId}-${result.completedAt.slice(0, 10)}.json`) }
    catch { setExportError('The exam report could not be exported. Your saved result is still on this device.') }
  }

  const statusLabel =
    result.estimatedStatus === 'above-benchmark'
      ? 'Above Benchmark'
      : result.estimatedStatus === 'near-benchmark'
      ? 'Near Benchmark'
      : 'Below Benchmark'

  const statusColorClass =
    result.estimatedStatus === 'above-benchmark'
      ? 'pill--success'
      : result.estimatedStatus === 'near-benchmark'
      ? 'pill--warning'
      : 'pill--muted'

  return (
    <div className="exam-results-page">
      {/* Mandatory Practice Estimate Disclaimer Banner */}
      <section className="notice-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
        <strong>{t("✦ Practice Assessment Only: ")}</strong>
        <span>{t(PRACTICE_ESTIMATE_DISCLAIMER)}</span>
      </section>

      {result.authorityNote && (
        <section className="notice-banner" role="note" style={{ marginBottom: '1.5rem' }}>
          <strong>{t("Profile authority: ")}</strong>
          <span>{result.authorityNote}</span>
        </section>
      )}

      {result.isProvisional && (
        <section
          className="notice-banner notice-banner--warning"
          role="note"
          style={{ marginBottom: '1.5rem', backgroundColor: '#fef3c7', borderColor: '#f59e0b' }}
        >
          <strong>{t(PROVISIONAL_DRAFT_LABEL)}: </strong>
          <span>{t(PROVISIONAL_DRAFT_NOTICE)}</span>
        </section>
      )}

      {/* Topline Header & Score Overview */}
      <header className="progress-overview">
        <div>
          <p className="eyebrow">{t("Exam Simulation Report")}</p>
          <h2>{result.examTitle}</h2>
          <p className="muted-label">{t("Completed on ")}{new Date(result.completedAt).toLocaleString()}</p>
        </div>
        <div className="progress-overview__score">
          <strong>
            {result.totalScore}
            <span style={{ fontSize: '1.25rem', color: 'var(--muted)' }}> / {result.maxScore}</span>
          </strong>
          <span>
            {result.percentage}{t("% · Practice estimate · ")}<span className={`pill ${statusColorClass}`}>{t(statusLabel)}</span>
          </span>
        </div>
      </header>

      {/* Benchmark Comparison & Quick Stats */}
      <section className="progress-stat-grid">
        <article className="progress-stat">
          <span className="eyebrow">{t("Your Practice Estimate")}</span>
          <strong>{result.totalScore}{t(" pts")}</strong>
          <span>{t("out of ")}{result.maxScore}{t(" max")}</span>
        </article>
        <article className="progress-stat">
          <span className="eyebrow">{t("Practice Benchmark")}</span>
          <strong>{result.passBenchmark}{t(" pts")}</strong>
          <span>{result.benchmarkLabel ?? 'Practice benchmark estimate'}</span>
          <small style={{ display: 'block', marginTop: '0.35rem' }}>{t(result.benchmarkNote ?? CATTI_THRESHOLD_NOTICE)}</small>
        </article>
        <article className="progress-stat">
          <span className="eyebrow">{t("Estimated Status")}</span>
          <strong style={{ fontSize: '1.25rem' }}>{t(statusLabel)}</strong>
          <span>
            {result.totalScore >= result.passBenchmark ? t("Meets practice threshold") : t("Focus on highlighted areas")}
          </span>
        </article>
      </section>

      {/* Core Rubric Dimensions Breakdown */}
      <section className="progress-card" style={{ marginTop: '1.5rem' }}>
        <div className="progress-card__heading">
          <div>
            <p className="eyebrow">{t("Rubric Analysis")}</p>
            <h3>{t("Core Competency Breakdown")}</h3>
            <p className="muted-label" style={{ margin: '0.35rem 0 0' }}>{t(PLATFORM_AUTHORED_RUBRIC_NOTICE)}</p>
          </div>
          <span className="section-heading__note">{t("Average across answered passages")}</span>
        </div>
        <div className="skill-list">
          {dimensionsList.map((dimension) => {
            const score = result.consolidatedDimensions[dimension] ?? 0
            return (
              <div className="skill-row" key={dimension}>
                <div>
                  <span>{t(dimensionLabels[dimension])}</span>
                  <strong>{score} / 100</strong>
                </div>
                <div className="trend-row__track">
                  <span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section-by-Section Details & Passage Feedback */}
      <section style={{ marginTop: '2rem' }}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("Evidence & Annotations")}</p>
            <h2>{t("Section-by-Section Breakdown")}</h2>
          </div>
          <button className="button button--quiet" type="button" onClick={() => void handleExportJson()}>{t("Export Report (JSON) ↓")}</button>
          {exportError && <p role="alert">{t(exportError)}</p>}
        </div>

        {result.sectionResults.map((section, sIndex) => (
          <div
            key={section.sectionId}
            className="progress-card"
            style={{ marginTop: '1.25rem', padding: '1.25rem' }}
          >
            <div className="progress-card__heading" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
              <div>
                <span className="eyebrow">{t("Section ")}{sIndex + 1}</span>
                <h3 style={{ margin: '0.25rem 0' }}>{section.sectionTitle}</h3>
              </div>
              <div>
                <strong style={{ fontSize: '1.25rem' }}>
                  {section.score} / {section.maxPoints}{t(" pts")}</strong>
                <small className="muted-label" style={{ display: 'block', textAlign: 'right' }}>{t("Practice estimate")}</small>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {section.passageFeedbacks.map((passage) => {
                const isExpanded = expandedPassageIds[passage.passageId] ?? false
                const hasAnswer = passage.answer.trim().length > 0
                const sourceLanguage = passage.sourceLanguage ? getLanguage(passage.sourceLanguage) : undefined
                const targetLanguage = passage.targetLanguage ? getLanguage(passage.targetLanguage) : undefined

                return (
                  <div
                    key={passage.passageId}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '1rem',
                      backgroundColor: 'var(--surface-soft)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => togglePassage(passage.passageId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          togglePassage(passage.passageId)
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div>
                        <strong>{passage.passageTitle}</strong>
                        <span className="muted-label" style={{ marginLeft: '0.5rem' }}>
                          {hasAnswer ? t("Practice estimate: {0}/100", passage.feedback.overallScore) : t("Practice estimate: 0 pts")}
                        </span>
                      </div>
                      <span className="text-button">{isExpanded ? t("Hide Details ▲") : t("Show Details ▼")}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                        {/* Summary & Uncertainty */}
                        <div style={{ marginBottom: '1rem' }}>
                          <p><strong>{t("Evaluation Summary: ")}</strong>{passage.feedback.summary}</p>
                          {passage.feedback.uncertainty && (
                            <p className="muted-label"><em>{t("Note: ")}{passage.feedback.uncertainty}</em></p>
                          )}
                        </div>

                        {/* Candidate Answer */}
                        <div style={{ marginBottom: '1rem' }}>
                          <span className="eyebrow">{t("Your Submitted Translation")}</span>
                          <div
                            dir={targetLanguage?.direction ?? 'ltr'}
                            lang={passage.targetLanguage}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.75rem',
                              marginTop: '0.25rem',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                            }}
                          >
                            {hasAnswer ? passage.answer : <em>{t("(No translation entered)")}</em>}
                          </div>
                        </div>

                        {/* Strengths */}
                        {passage.feedback.strengths.length > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            <span className="eyebrow" style={{ color: '#166534' }}>{t("Strengths")}</span>
                            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                              {passage.feedback.strengths.map((strength, idx) => (
                                <li key={idx}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Issues & Annotations */}
                        {passage.feedback.issues.length > 0 && (
                          <div>
                            <span className="eyebrow" style={{ color: '#b45309' }}>{t("Revision Opportunities")}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                              {passage.feedback.issues.map((issue, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid var(--line)',
                                    borderLeft: '4px solid #b45309',
                                    borderRadius: '4px',
                                    padding: '0.75rem',
                                  }}
                                >
                                  <div>
                                    <span className="pill" style={{ textTransform: 'capitalize' }}>
                                      {t(issue.dimension)}
                                    </span>
                                  </div>
                                  {issue.sourceQuote && (
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                      <strong>{t("Source: ")}</strong>
                                      <span dir={sourceLanguage?.direction} lang={passage.sourceLanguage} style={{ backgroundColor: 'var(--surface-soft)', padding: '0.1rem 0.3rem' }}>
                                        {issue.sourceQuote}
                                      </span>
                                    </p>
                                  )}
                                  {issue.learnerQuote && (
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                      <strong>{t("Your version: ")}</strong>
                                      <span dir={targetLanguage?.direction} lang={passage.targetLanguage} style={{ backgroundColor: '#fee2e2', padding: '0.1rem 0.3rem' }}>
                                        {issue.learnerQuote}
                                      </span>
                                    </p>
                                  )}
                                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                                    {issue.explanation}
                                  </p>
                                  {issue.suggestion && (
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#15803d' }}>
                                      <strong>{t("Suggested revision: ")}</strong>
                                      {issue.suggestion}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Action Footer */}
      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
        <button className="button button--quiet" type="button" onClick={onBackToDashboard}>{t("Return to Home")}</button>
        <button className="button button--primary" type="button" onClick={onRetake}>{t("Take Another Exam Simulation")}</button>
      </footer>
    </div>
  )
}

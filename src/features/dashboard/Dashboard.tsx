import { DEFAULT_LOCAL_MODEL_ID } from '../../domain/types'
import { getLanguage } from '../../domain/languages'
import type { LocalModelProgress } from '../../ai/local-provider'
import type { ActiveExamRun, ConsolidatedExamResult, SessionRecord } from '../../domain/types'
import { formatSeconds } from '../../domain/exam'

export type DashboardPage = 'home' | 'practice' | 'exam' | 'progress' | 'settings'

export function Dashboard({
  localProgress,
  recentSessions,
  activeExamRun,
  recentExamResults = [],
  onNavigate,
  onStartInterpreting,
}: {
  localProgress: LocalModelProgress
  recentSessions: SessionRecord[]
  activeExamRun?: ActiveExamRun
  recentExamResults?: ConsolidatedExamResult[]
  onNavigate: (page: DashboardPage) => void
  onStartInterpreting?: () => void
}) {
  const localStatusLabel = localProgress.status === 'ready'
    ? 'Ready on this device'
    : localProgress.status === 'preparing'
      ? `${Math.round((localProgress.progress ?? 0) * 100)}% preparing`
      : localProgress.status === 'unavailable'
        ? 'Unavailable on this device'
        : 'Not prepared yet'

  return (
    <div className="page-content">
      {activeExamRun && (
        <section
          className="info-card info-card--accent"
          style={{ marginBottom: '1.5rem', borderLeft: '4px solid #0284c7' }}
          role="region"
          aria-label="Active Exam Recovery"
        >
          <div className="info-card__topline">
            <span className="eyebrow">Exam in progress</span>
            <span className="pill pill--warning">Resume available</span>
          </div>
          <h3>You have an unfinished examination attempt</h3>
          <p>
            Remaining time: <strong>{formatSeconds(activeExamRun.overallRemainingSeconds)}</strong>.
            All your drafted answers were saved safely on this device.
          </p>
          <button
            className="button button--primary"
            type="button"
            style={{ marginTop: '0.75rem' }}
            onClick={() => onNavigate('exam')}
          >
            Resume Exam Simulation ({formatSeconds(activeExamRun.overallRemainingSeconds)}) →
          </button>
        </section>
      )}

      <section className="hero-card">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>One thoughtful paragraph<br />at a time.</h2>
          <p className="hero-card__copy">Start with an original passage, make your best translation, and learn from evidence-based practice feedback.</p>
          <button className="button button--primary" type="button" onClick={() => onNavigate('practice')}>
            Start a practice session <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="hero-card__shape" aria-hidden="true">
          <span>译</span>
          <span>अ</span>
          <span>文</span>
        </div>
      </section>

      <section className="section-block" aria-labelledby="modes-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your mode</p>
            <h2 id="modes-heading">Practice that fits today.</h2>
          </div>
          <span className="section-heading__note">4 available now</span>
        </div>
        <div className="mode-grid">
          <button className="mode-card mode-card--active" type="button" onClick={() => onNavigate('practice')}>
            <span className="mode-card__icon">文</span>
            <span className="mode-card__content">
              <strong>Written translation</strong>
              <span>Build accuracy, meaning, and natural expression.</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={() => onNavigate('practice')}>
            <span className="mode-card__icon">▤</span>
            <span className="mode-card__content">
              <strong>News translation</strong>
              <span>Work with original, topic-tagged current-affairs style passages.</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={() => onNavigate('exam')}>
            <span className="mode-card__icon">◷</span>
            <span className="mode-card__content">
              <strong>Exam simulation</strong>
              <span>CATTI and named-university MTI timed practice with strict test conditions.</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={onStartInterpreting ?? (() => onNavigate('practice'))}>
            <span className="mode-card__icon">◌</span>
            <span className="mode-card__content">
              <strong>Interpreting</strong>
              <span>Listen, record, replay, and review delivery from local audio.</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </section>

      <section className="home-grid">
        <article className="info-card info-card--accent">
          <div className="info-card__topline"><span className="eyebrow">Evaluation</span><span className="status-badge">{localStatusLabel}</span></div>
          <h3>Local AI is optional.</h3>
          <p>Prepare {DEFAULT_LOCAL_MODEL_ID} in Settings for private, offline-capable practice. Cloud fallback always asks first.</p>
          <button className="text-button" type="button" onClick={() => onNavigate('settings')}>Review privacy settings <span aria-hidden="true">→</span></button>
        </article>
        <article className="info-card">
          <div className="info-card__topline"><span className="eyebrow">Your activity</span><span className="muted-label">{recentSessions.length ? `${recentSessions.length} saved session${recentSessions.length === 1 ? '' : 's'}` : 'No sessions yet'}</span></div>
          <h3>{recentSessions.length ? 'Keep your translation habit moving.' : 'Your first session starts here.'}</h3>
          {recentSessions.length ? (
            <div className="activity-list">
              {recentSessions.slice(0, 3).map((session) => (
                <div className="activity-row" key={session.id}>
                  <span>{getLanguage(session.sourceLanguage).nativeLabel} → {getLanguage(session.targetLanguage).nativeLabel}</span>
                  <strong>
                    {session.feedback.overallScore}/100
                    <small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>Practice estimate</small>
                  </strong>
                </div>
              ))}
            </div>
          ) : <p>Completed work, practice estimates, and dimension trends will appear in Progress.</p>}
          <button className="text-button" type="button" onClick={() => onNavigate(recentSessions.length ? 'progress' : 'practice')}>{recentSessions.length ? 'Open progress' : 'Start practicing'} <span aria-hidden="true">→</span></button>
        </article>
        {recentExamResults.length > 0 && (
          <article className="info-card">
            <div className="info-card__topline">
              <span className="eyebrow">Exam Simulation</span>
              <span className="muted-label">{recentExamResults.length} practice estimate{recentExamResults.length === 1 ? '' : 's'}</span>
            </div>
            <h3>Latest Mock Exam</h3>
            <div className="activity-row">
              <span>{recentExamResults[0].examTitle}</span>
              <strong>
                {recentExamResults[0].totalScore} / {recentExamResults[0].maxScore}
                <small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>Practice estimate</small>
              </strong>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('exam')}>
              Open exam catalog <span aria-hidden="true">→</span>
            </button>
          </article>
        )}
      </section>
    </div>
  )
}

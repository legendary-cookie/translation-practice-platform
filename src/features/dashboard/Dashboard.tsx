import { t } from '../../i18n'
import { PersonalizedPractice } from './PersonalizedPractice'
import type { WrittenDraft } from '../../domain/learning'
import { WelcomeCard } from './WelcomeCard'
import { getLanguage } from '../../domain/languages'
import type { LocalModelProgress } from '../../ai/local-provider'
import type { ActiveExamRun, ConsolidatedExamResult, Exercise, SessionRecord } from '../../domain/types'
import { formatSeconds } from '../../domain/exam'
import { useRecoveryCountdown } from '../exam/use-recovery-countdown'
import type { SessionHistoryStatus } from '../practice/session-history'

export type DashboardPage = 'home' | 'practice' | 'exam' | 'progress' | 'settings'

export function Dashboard({
  savedDraft,
  onContinueDraft,
  onRecommendedPractice,
  localProgress,
  recentSessions,
  sessionHistoryStatus = 'ready',
  activeExamRun,
  recentExamResults = [],
  onNavigate,
  onStartInterpreting,
  onStartNews,
}: {
  savedDraft?: WrittenDraft
  onContinueDraft?: () => void
  onRecommendedPractice?: (exercise: Exercise) => void
  localProgress: LocalModelProgress
  recentSessions: SessionRecord[]
  sessionHistoryStatus?: SessionHistoryStatus
  activeExamRun?: ActiveExamRun
  recentExamResults?: ConsolidatedExamResult[]
  onNavigate: (page: DashboardPage) => void
  onStartInterpreting?: () => void
  onStartNews?: () => void
}) {
  const activeExamRemainingSeconds = useRecoveryCountdown(activeExamRun)
  const localStatusLabel = localProgress.status === 'ready'
    ? 'Ready on this device'
    : localProgress.status === 'preparing'
      ? t('{0}% preparing', Math.round((localProgress.progress ?? 0) * 100))
      : localProgress.status === 'unavailable'
        ? 'Unavailable on this device'
        : 'Not prepared yet'

  return (
    <div className="page-content">
      <WelcomeCard onStart={() => onNavigate('practice')} />
      {savedDraft && <section className="continue-card"><div><p className="eyebrow">{t("Continue where you left off")}</p><h2>{savedDraft.exercise.title}</h2><p>{getLanguage(savedDraft.exercise.sourceLanguage).nativeLabel} → {getLanguage(savedDraft.exercise.targetLanguage).nativeLabel} · {savedDraft.answer.length}{t(" characters in draft")}</p></div><button className="button button--primary" type="button" onClick={onContinueDraft}>{t("Continue translation →")}</button></section>}
      {activeExamRun && (
        <section
          className="info-card info-card--accent"
          style={{ marginBottom: '1.5rem', borderLeft: '4px solid #175ac0' }}
          role="region"
          aria-label={t("Active Exam Recovery")}
        >
          <div className="info-card__topline">
            <span className="eyebrow">{t("Exam in progress")}</span>
            <span className="pill pill--warning">{t("Resume available")}</span>
          </div>
          <h3>{t("You have an unfinished examination attempt")}</h3>
          <p>{t("Remaining time: ")}<strong>{formatSeconds(activeExamRemainingSeconds ?? activeExamRun.overallRemainingSeconds)}</strong>{t(". All your drafted answers were saved safely on this device.")}</p>
          <button
            className="button button--primary"
            type="button"
            style={{ marginTop: '0.75rem' }}
            onClick={() => onNavigate('exam')}
          >{t("Resume Exam Simulation (")}{formatSeconds(activeExamRemainingSeconds ?? activeExamRun.overallRemainingSeconds)}) →
          </button>
        </section>
      )}

      <section className="hero-card">
        <div>
          <p className="eyebrow">{t("Ready when you are")}</p>
          <h2>{t("One thoughtful paragraph")}<br />{t("at a time.")}</h2>
          <p className="hero-card__copy">{t("Start with an original passage, make your best translation, and learn from evidence-based practice feedback.")}</p>
          <button className="button button--primary" type="button" onClick={() => onNavigate('practice')}>{t("Start a practice session ")}<span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="hero-card__shape" aria-hidden="true">
          <span>译</span>
          <span>अ</span>
          <span>文</span>
        </div>
      </section>

      {onRecommendedPractice && <PersonalizedPractice sessions={recentSessions} onStart={onRecommendedPractice} onReview={() => onNavigate('progress')} />}
      <section className="section-block" aria-labelledby="modes-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("Choose your mode")}</p>
            <h2 id="modes-heading">{t("Practice that fits today.")}</h2>
          </div>
          <span className="section-heading__note">{t("4 available now")}</span>
        </div>
        <div className="mode-grid">
          <button className="mode-card mode-card--active" type="button" onClick={() => onNavigate('practice')}>
            <span className="mode-card__icon">文</span>
            <span className="mode-card__content">
              <strong>{t("Written translation")}</strong>
              <span>{t("Build accuracy, meaning, and natural expression.")}</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={onStartNews ?? (() => onNavigate('practice'))}>
            <span className="mode-card__icon">▤</span>
            <span className="mode-card__content">
              <strong>{t("News translation")}</strong>
              <span>{t("Work with original, topic-tagged current-affairs style passages.")}</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={() => onNavigate('exam')}>
            <span className="mode-card__icon">◷</span>
            <span className="mode-card__content">
              <strong>{t("Exam simulation")}</strong>
              <span>{t("CATTI and named-university MTI timed practice with strict test conditions.")}</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
          <button className="mode-card mode-card--active" type="button" onClick={onStartInterpreting ?? (() => onNavigate('practice'))}>
            <span className="mode-card__icon">◌</span>
            <span className="mode-card__content">
              <strong>{t("Interpreting")}</strong>
              <span>{t("Listen, record, replay, and review delivery from local audio.")}</span>
            </span>
            <span className="mode-card__arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </section>

      <section className="home-grid">
        <article className="info-card info-card--accent">
          <div className="info-card__topline"><span className="eyebrow">{t("Evaluation")}</span><span className="status-badge">{t(localStatusLabel)}</span></div>
          <h3>{t("Local AI is optional.")}</h3>
          <p>{t("Prepare a local model in Settings for private, offline-capable practice. Cloud fallback always asks first.")}</p>
          <button className="text-button" type="button" onClick={() => onNavigate('settings')}>{t("Review privacy settings ")}<span aria-hidden="true">→</span></button>
        </article>
        <article className="info-card">
          <div className="info-card__topline"><span className="eyebrow">{t("Your activity")}</span><span className="muted-label">{recentSessions.length ? t("{0} saved session{1}", recentSessions.length, recentSessions.length === 1 ? '' : 's') : sessionHistoryStatus === 'loading' ? t("Checking local history") : sessionHistoryStatus === 'failed' ? t("History unavailable") : t("No sessions yet")}</span></div>
          <h3>{recentSessions.length ? t("Keep your translation habit moving.") : sessionHistoryStatus === 'failed' ? t("Saved activity could not be loaded.") : sessionHistoryStatus === 'loading' ? t("Checking your saved activity.") : t("Your first session starts here.")}</h3>
          {recentSessions.length ? (
            <div className="activity-list">
              {recentSessions.slice(0, 3).map((session) => (
                <div className="activity-row" key={session.id}>
                  <span>{getLanguage(session.sourceLanguage).nativeLabel} → {getLanguage(session.targetLanguage).nativeLabel}</span>
                  <strong>
                    {session.feedback.overallScore}/100
                    <small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>{t("Practice estimate")}</small>
                  </strong>
                </div>
              ))}
            </div>
          ) : <p>{sessionHistoryStatus === 'failed' ? t("Local history could not be read; saved work may still be present on this device.") : sessionHistoryStatus === 'loading' ? t("Saved sessions are being checked on this device.") : t("Completed work, practice estimates, and dimension trends will appear in Progress.")}</p>}
          <button className="text-button" type="button" onClick={() => onNavigate(recentSessions.length || sessionHistoryStatus !== 'ready' ? 'progress' : 'practice')}>{recentSessions.length || sessionHistoryStatus !== 'ready' ? t("Open progress") : t("Start practicing")} <span aria-hidden="true">→</span></button>
        </article>
        {recentExamResults.length > 0 && (
          <article className="info-card">
            <div className="info-card__topline">
              <span className="eyebrow">{t("Exam Simulation")}</span>
              <span className="muted-label">{recentExamResults.length}{t(" practice estimate")}{recentExamResults.length === 1 ? '' : 's'}</span>
            </div>
            <h3>{t("Latest Mock Exam")}</h3>
            <div className="activity-row">
              <span>{recentExamResults[0].examTitle}</span>
              <strong>
                {recentExamResults[0].totalScore} / {recentExamResults[0].maxScore}
                <small className="muted-label" style={{ display: 'block', fontSize: '0.65rem' }}>{t("Practice estimate")}</small>
              </strong>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('exam')}>{t("Open exam catalog ")}<span aria-hidden="true">→</span>
            </button>
          </article>
        )}
      </section>
    </div>
  )
}

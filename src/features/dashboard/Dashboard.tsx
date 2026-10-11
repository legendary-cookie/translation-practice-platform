import { useEffect, useState, useSyncExternalStore } from 'react'
import { getLocalModelState, subscribeLocalModel } from '../../ai/provider'
import { getLanguage } from '../../domain/languages'
import { dimensionLabels } from '../../domain/scoring'
import type { PracticeMode, SessionRecord } from '../../domain/types'
import { database } from '../../storage/database'
import { Icon } from '../../App'
import '../practice/practice.css'

export function Dashboard({ onStartPractice, onContinuePractice, onOpenSettings, currentTitle, historyVersion }: {
  onStartPractice: (mode: PracticeMode) => void
  onContinuePractice: () => void
  onOpenSettings: () => void
  currentTitle?: string
  historyVersion: number
}) {
  const local = useSyncExternalStore(subscribeLocalModel, getLocalModelState)
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void database.listSessions().then((items) => { if (active) { setSessions(items); setError('') } }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : 'Could not load local history.') })
    return () => { active = false }
  }, [historyVersion])

  return <>
    <section className="welcome-panel"><div><p className="eyebrow">Your translation workspace</p><h1>Make room for<br />better translations.</h1><p className="intro">Practise a passage, examine your choices, and build confidence one revision at a time.</p><button className="button primary" onClick={currentTitle ? onContinuePractice : () => onStartPractice('written')}>{currentTitle ? 'Continue your practice' : 'Start written practice'} <Icon name="arrow" /></button></div><div className="translation-mark" aria-hidden="true"><span>译</span><span className="mark-rule" /><span>A</span><p>Meaning. In your words.</p></div></section>
    {currentTitle && <aside className="continue-panel"><div><h2>Pick up where you left off</h2><p>{currentTitle} · Your draft is held in this open page.</p></div><button className="button secondary" onClick={onContinuePractice}>Continue practice</button></aside>}
    <section aria-labelledby="modes-heading"><div className="section-heading"><h2 id="modes-heading">Choose your practice</h2><span>CATTI / MTI preparation</span></div><div className="mode-grid">
      <button className="mode-card available" onClick={() => onStartPractice('written')}><span className="mode-icon"><Icon name="written" /></span><span className="mode-copy"><strong>Written translation</strong><span>Work carefully through meaning, terminology, and expression.</span><span className="card-link">Open practice <Icon name="arrow" /></span></span></button>
      <button className="mode-card available" onClick={() => onStartPractice('news')}><span className="mode-icon"><Icon name="news" /></span><span className="mode-copy"><strong>News translation</strong><span>Practise concise reporting and a clear, consistent register.</span><span className="card-link">Open practice <Icon name="arrow" /></span></span></button>
      <article className="mode-card planned"><span className="mode-icon"><Icon name="audio" /></span><div className="mode-copy"><strong>Interpreting <span className="badge">Planned</span></strong><span>Audio, recording, and delivery feedback in a future release.</span></div></article>
      <article className="mode-card planned"><span className="mode-icon"><Icon name="exam" /></span><div className="mode-copy"><strong>Exam simulation <span className="badge">Planned</span></strong><span>Timed exam profiles and consolidated feedback are planned.</span></div></article>
    </div></section>
    <div className="dashboard-details"><aside className="dashboard-card"><h2>Local AI status</h2><p className="estimate-label">{local.status === 'ready' ? 'Model loaded · quality uncalibrated' : 'Manual review available'}</p><p role="status">{local.message}</p>{['checking', 'downloading'].includes(local.status) && <progress aria-label="Local model preparation" value={local.progress} max={1} />}<p className="settings-help">Feedback uses a model only after you prepare it. Local-only sends no practice text to a remote AI service. Cloud feedback requires your approval for each task.</p><button className="button secondary" onClick={onOpenSettings}>Privacy & data</button></aside>
      <section className="dashboard-card" aria-labelledby="activity-heading"><h2 id="activity-heading">Recent skill activity</h2>
        {error ? <p className="settings-error" role="alert">{error} Practice remains available; history cannot be read right now.</p> : !sessions ? <p role="status">Loading local activity…</p> : !sessions.length ? <p>Save a completed assessment to begin your local learning record. Manual reviews and drafts do not receive scores.</p> : <ul className="activity-list">{sessions.slice(0, 3).map((session) => <li key={session.id}><strong><bdi>{getLanguage(session.sourceLanguage).label} → {getLanguage(session.targetLanguage).label}</bdi></strong><span>{session.mode === 'news' ? 'News translation' : 'Written translation'} · <time dateTime={session.createdAt}>{new Date(session.createdAt).toLocaleDateString()}</time></span><span>{session.feedback.issues.length ? `Revision areas: ${[...new Set(session.feedback.issues.map((issue) => dimensionLabels[issue.dimension]))].join(', ')}` : 'No evidence-backed issues reported; review uncertainty.'}</span></li>)}</ul>}
      </section></div>
    <aside className="device-note"><span className="status-dot" /><div><strong>A workspace on your device</strong><p>No account required. Saved practice history belongs to this browser and device; it does not sync between devices. AI scores are practice estimates.</p></div></aside>
  </>
}

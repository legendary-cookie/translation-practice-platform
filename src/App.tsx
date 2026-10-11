import { useState } from 'react'

export type AppPage = 'home' | 'practice' | 'progress' | 'settings'
type ShellMode = 'written' | 'news'
type IconName = AppPage | 'written' | 'news' | 'audio' | 'exam' | 'arrow'

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: 'M3 10 12 3l9 7v10H3V10Zm6 10v-7h6v7',
    practice: 'm15 4 5 5M4 20l4-1L20 7l-4-4L4 15v5Z',
    progress: 'M4 20V10m8 10V4m8 16v-7M2 20h20',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    written: 'M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8m-8 4h6',
    news: 'M4 4h16v16H4V4Zm4 4h8m-8 4h3m2 0h3m-8 4h3m2 0h3',
    audio: 'M4 14v-4a8 8 0 0 1 16 0v4M4 12h3v7H4v-7Zm13 0h3v7h-3v-7Z',
    exam: 'M8 4H5v17h14V4h-3M8 2h8v5H8V2Zm1 10h6m-6 4h6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

const navigation: { page: AppPage; label: string }[] = [
  { page: 'home', label: 'Home' },
  { page: 'practice', label: 'Practice' },
  { page: 'progress', label: 'Progress' },
  { page: 'settings', label: 'Privacy & data' },
]

function Navigation({ page, onPageChange }: { page: AppPage; onPageChange: (page: AppPage) => void }) {
  return <nav className="navigation" aria-label="Main navigation">
    {navigation.map((item) => <button key={item.page} type="button" aria-current={page === item.page ? 'page' : undefined} className={page === item.page ? 'nav-item active' : 'nav-item'} onClick={() => onPageChange(item.page)}><Icon name={item.page} /><span>{item.label}</span></button>)}
  </nav>
}

function FoundationHome({ onStartPractice }: { onStartPractice: (mode: ShellMode) => void }) {
  return <>
    <section className="welcome-panel">
      <div><p className="eyebrow">Your translation workspace</p><h1>Make room for<br />better translations.</h1><p className="intro">Practise a passage, examine your choices, and build confidence one revision at a time.</p><button className="button primary" onClick={() => onStartPractice('written')}>Start written practice <Icon name="arrow" /></button></div>
      <div className="translation-mark" aria-hidden="true"><span>译</span><span className="mark-rule" /><span>A</span><p>Meaning. In your words.</p></div>
    </section>
    <section aria-labelledby="modes-heading"><div className="section-heading"><h2 id="modes-heading">Choose your practice</h2><span>CATTI / MTI preparation</span></div>
      <div className="mode-grid">
        <button className="mode-card available" onClick={() => onStartPractice('written')}><span className="mode-icon"><Icon name="written" /></span><span className="mode-copy"><strong>Written translation</strong><span>Work carefully through meaning, terminology, and expression.</span><span className="card-link">Open practice <Icon name="arrow" /></span></span></button>
        <button className="mode-card available" onClick={() => onStartPractice('news')}><span className="mode-icon"><Icon name="news" /></span><span className="mode-copy"><strong>News translation</strong><span>Practise concise reporting and a clear, consistent register.</span><span className="card-link">Open practice <Icon name="arrow" /></span></span></button>
        <article className="mode-card planned"><span className="mode-icon"><Icon name="audio" /></span><div className="mode-copy"><strong>Interpreting <span className="badge">Planned</span></strong><span>Audio, recording, and delivery feedback in a future release.</span></div></article>
        <article className="mode-card planned"><span className="mode-icon"><Icon name="exam" /></span><div className="mode-copy"><strong>Exam simulation <span className="badge">Planned</span></strong><span>Timed exam profiles and consolidated feedback are planned.</span></div></article>
      </div>
    </section>
    <aside className="device-note"><span className="status-dot" /><div><strong>A workspace on your device</strong><p>No account required. Practice history belongs to this browser and device; it does not sync between devices.</p></div></aside>
  </>
}

export default function App() {
  const [page, setPage] = useState<AppPage>('home')
  const [mode, setMode] = useState<ShellMode>('written')
  function startPractice(nextMode: ShellMode) { setMode(nextMode); setPage('practice') }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('home') }}><span className="brand-symbol" lang="zh">译</span><span>Translation<br /><strong>Studio</strong></span></a><Navigation page={page} onPageChange={setPage} /><div className="sidebar-note"><span className="eyebrow">Learn with intention</span><p>Chinese ↔ English, Russian, French, Hindi, Spanish & Arabic</p></div></aside>
    <div className="main-column"><header className="topbar"><span className="mobile-brand">Translation Studio</span><span className="desktop-label">Independent practice · CATTI / MTI</span><span className="local-label"><span className="status-dot" /> Local workspace</span></header>
      <main id="main-content" tabIndex={-1}>
        {page === 'home' && <FoundationHome onStartPractice={startPractice} />}
        {page === 'practice' && <section className="page-panel"><p className="eyebrow">Practice</p><h1>{mode === 'written' ? 'Written translation' : 'News translation'}</h1><p>Choose a Chinese-centered direction across seven languages. The exercise setup and translation workspace will be connected in the next implementation step.</p><div className="button-row"><button className={mode === 'written' ? 'button primary' : 'button secondary'} onClick={() => setMode('written')}>Written translation</button><button className={mode === 'news' ? 'button primary' : 'button secondary'} onClick={() => setMode('news')}>News translation</button></div><p className="muted">AI scores will be practice estimates, never official CATTI / MTI results.</p></section>}
        {page === 'progress' && <section className="page-panel"><p className="eyebrow">Your learning record</p><h1>Progress starts with a passage.</h1><p>Your completed sessions and skill summaries will appear here once local history is connected.</p><button className="button primary" onClick={() => startPractice('written')}>Open practice <Icon name="arrow" /></button></section>}
        {page === 'settings' && <section className="page-panel"><p className="eyebrow">Privacy & data</p><h1>Your words, your choice.</h1><p>On-device evaluation and local history controls will be connected here. Cloud evaluation will require explicit consent for each task.</p><p className="muted">Browser storage stays on this device. Local AI availability depends on your device and downloaded model.</p></section>}
      </main>
      <footer className="app-footer">Practice feedback supports learning. It is not an official exam assessment.</footer>
    </div>
  </div>
}

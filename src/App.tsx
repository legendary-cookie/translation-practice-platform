import { useState } from 'react'

type Page = 'home' | 'practice' | 'progress' | 'settings'

type NavigationItem = {
  id: Page
  label: string
  icon: string
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'practice', label: 'Practice', icon: '✎' },
  { id: 'progress', label: 'Progress', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const pageCopy: Record<Page, { eyebrow: string; title: string; description: string }> = {
  home: {
    eyebrow: 'Your study space',
    title: 'Translate with intention.',
    description: 'Build a steady practice habit with feedback that stays on your device.',
  },
  practice: {
    eyebrow: 'Practice desk',
    title: 'Make a translation pass.',
    description: 'Choose a direction, read the source, and write your own version.',
  },
  progress: {
    eyebrow: 'Local history',
    title: 'See the work you have done.',
    description: 'Your practice history will grow here as you complete sessions.',
  },
  settings: {
    eyebrow: 'Privacy and setup',
    title: 'Keep your practice yours.',
    description: 'Choose how evaluation runs and manage the data saved in this browser.',
  },
}

function Navigation({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
  return (
    <nav className="navigation" aria-label="Primary navigation">
      <div className="brand-mark" aria-label="Lingo Practice">
        <span className="brand-mark__symbol">文</span>
        <span className="brand-mark__name">Lingo Practice</span>
      </div>
      <div className="navigation__items">
        {navigationItems.map((item) => (
          <button
            className={`navigation__item ${currentPage === item.id ? 'navigation__item--active' : ''}`}
            key={item.id}
            type="button"
            aria-current={currentPage === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="navigation__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="navigation__footer">
        <span className="status-dot" aria-hidden="true" />
        <span>Local-first mode</span>
      </div>
    </nav>
  )
}

function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <div className="page-content">
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
          <span className="section-heading__note">2 available now</span>
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
          <div className="mode-card mode-card--planned">
            <span className="mode-card__icon">◌</span>
            <span className="mode-card__content">
              <strong>Interpreting</strong>
              <span>Planned mode · audio and delivery practice.</span>
            </span>
            <span className="pill">Planned</span>
          </div>
          <div className="mode-card mode-card--planned">
            <span className="mode-card__icon">◷</span>
            <span className="mode-card__content">
              <strong>Exam simulation</strong>
              <span>Planned mode · versioned timed profiles.</span>
            </span>
            <span className="pill">Planned</span>
          </div>
        </div>
      </section>

      <section className="home-grid">
        <article className="info-card info-card--accent">
          <div className="info-card__topline"><span className="eyebrow">Evaluation</span><span className="status-badge">On device</span></div>
          <h3>Local AI is optional.</h3>
          <p>Prepare the local model in Settings for private, offline-capable practice. Cloud fallback always asks first.</p>
          <button className="text-button" type="button" onClick={() => onNavigate('settings')}>Review privacy settings <span aria-hidden="true">→</span></button>
        </article>
        <article className="info-card">
          <div className="info-card__topline"><span className="eyebrow">Your activity</span><span className="muted-label">No sessions yet</span></div>
          <h3>Your first session starts here.</h3>
          <p>Completed work, practice estimates, and dimension trends will appear in Progress.</p>
          <button className="text-button" type="button" onClick={() => onNavigate('progress')}>Open progress <span aria-hidden="true">→</span></button>
        </article>
      </section>
    </div>
  )
}

function PlaceholderPage({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const copy = pageCopy[page]
  return (
    <div className="page-content">
      <section className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">{page === 'practice' ? '文' : page === 'progress' ? '↗' : '⚙'}</span>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
        {page === 'practice' && <button className="button button--primary" type="button" onClick={() => onNavigate('home')}>Back to modes</button>}
      </section>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const copy = pageCopy[currentPage]

  return (
    <div className="app-shell">
      <aside className="sidebar"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
          </div>
          <div className="topbar__meta"><span className="status-dot" aria-hidden="true" /> <span>Saved on this device</span></div>
        </header>
        {currentPage === 'home' ? <HomePage onNavigate={setCurrentPage} /> : <PlaceholderPage page={currentPage} onNavigate={setCurrentPage} />}
      </main>
      <div className="mobile-navigation"><Navigation currentPage={currentPage} onNavigate={setCurrentPage} /></div>
    </div>
  )
}

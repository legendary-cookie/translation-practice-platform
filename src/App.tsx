import { useRef, useState } from 'react'
import { Dashboard } from './features/dashboard/Dashboard'
import { PracticeSetup } from './features/practice/PracticeSetup'
import type { PracticeConfiguration } from './features/practice/PracticeSetup'
import { TranslationWorkspace } from './features/practice/TranslationWorkspace'
import { clearPendingConsent, resetEvaluationSession } from './ai/provider'
import { ProgressPage } from './features/progress/ProgressPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { database } from './storage/database'

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

function Navigation({ page, onPageChange, disabled }: { page: AppPage; onPageChange: (page: AppPage) => void; disabled: boolean }) {
  return <nav className="navigation" aria-label="Main navigation">
    {navigation.map((item) => <button key={item.page} type="button" disabled={disabled} aria-current={page === item.page ? 'page' : undefined} className={page === item.page ? 'nav-item active' : 'nav-item'} onClick={() => onPageChange(item.page)}><Icon name={item.page} /><span>{item.label}</span></button>)}
  </nav>
}

export default function App() {
  const [page, setPage] = useState<AppPage>('home')
  const [mode, setMode] = useState<ShellMode>('written')
  const [configuration, setConfiguration] = useState<PracticeConfiguration | null>(null)
  const [sessionNumber, setSessionNumber] = useState(0)
  const [showSetup, setShowSetup] = useState(true)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [evaluationBusy, setEvaluationBusy] = useState(false)
  const [savingBusy, setSavingBusy] = useState(false)
  const [providerBusy, setProviderBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const evaluationLock = useRef(false)
  const savingLock = useRef(false)
  const providerLock = useRef(false)
  const deletionLock = useRef(false)
  function changePage(nextPage: AppPage) { if (deletionLock.current) return; clearPendingConsent(); setPage(nextPage) }
  function startPractice(nextMode: ShellMode) { if (deletionLock.current) return; clearPendingConsent(); setMode(nextMode); setShowSetup(true); setPage('practice') }
  function continuePractice() { if (deletionLock.current) return; setShowSetup(false); setPage('practice') }
  function beginPractice(next: PracticeConfiguration) {
    if (evaluationLock.current || savingLock.current || deletionLock.current) return
    if (configuration && !window.confirm('Start a new passage? The current answer and any unsaved feedback will be cleared. Saved history stays on this device.')) return
    clearPendingConsent(); setConfiguration(next); setSessionNumber((value) => value + 1); setShowSetup(false)
  }
  async function deleteLocalData() {
    if (evaluationLock.current || savingLock.current || providerLock.current || deletionLock.current) throw new Error('Wait for evaluation and saves to finish before deleting local data.')
    deletionLock.current = true; setDeleting(true)
    try {
      await database.clearData()
      resetEvaluationSession()
      setConfiguration(null); setSessionNumber((value) => value + 1)
      setHistoryVersion((value) => value + 1); setSettingsVersion((value) => value + 1); setMode('written'); setShowSetup(true)
    } finally { deletionLock.current = false; setDeleting(false) }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#" aria-disabled={deleting || undefined} onClick={(event) => { event.preventDefault(); changePage('home') }}><span className="brand-symbol" lang="zh">译</span><span>Translation<br /><strong>Studio</strong></span></a><Navigation page={page} onPageChange={changePage} disabled={deleting} /><div className="sidebar-note"><span className="eyebrow">Learn with intention</span><p>Chinese ↔ English, Russian, French, Hindi, Spanish & Arabic</p></div></aside>
    <div className="main-column"><header className="topbar"><span className="mobile-brand">Translation Studio</span><span className="desktop-label">Independent practice · CATTI / MTI</span><span className="local-label"><span className="status-dot" /> Local workspace</span></header>
      <main id="main-content" tabIndex={-1}>
        {page === 'home' && <Dashboard onStartPractice={startPractice} onContinuePractice={continuePractice} onOpenSettings={() => changePage('settings')} currentTitle={configuration?.exercise.title} historyVersion={historyVersion} />}
        {page === 'practice' && (showSetup || !configuration) && <><PracticeSetup mode={mode} onModeChange={setMode} onStart={beginPractice} onOpenSettings={() => changePage('settings')} evaluationBusy={evaluationBusy || savingBusy} />{configuration && <button type="button" className="button secondary" style={{ marginTop: 20 }} onClick={continuePractice}>Return to current passage</button>}</>}
        {configuration && <div hidden={page !== 'practice' || showSetup}><TranslationWorkspace key={sessionNumber} configuration={configuration} active={page === 'practice' && !showSetup} onOpenSettings={() => changePage('settings')} onSaved={() => setHistoryVersion((value) => value + 1)} onBusyChange={(busy) => { evaluationLock.current = busy; setEvaluationBusy(busy) }} onSavingChange={(busy) => { savingLock.current = busy; setSavingBusy(busy) }} /></div>}
        {page === 'progress' && <ProgressPage historyVersion={historyVersion} onStartPractice={() => startPractice('written')} />}
        {page === 'settings' && <SettingsPage dataVersion={settingsVersion} evaluationBusy={evaluationBusy} savingBusy={savingBusy} providerBusy={providerBusy} deleting={deleting} onProviderBusyChange={(busy) => { providerLock.current = busy; setProviderBusy(busy) }} onDelete={deleteLocalData} />}
      </main>
      <footer className="app-footer">Practice feedback supports learning. It is not an official exam assessment.</footer>
    </div>
  </div>
}

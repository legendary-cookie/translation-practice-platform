import { useEffect, useState } from 'react'
import { CHINESE_DIRECTIONS } from '../../domain/languages'

export type WorkspacePreferences = { theme: 'system' | 'light' | 'dark'; fontSize: number; lineHeight: number; goal: string; directionId: string; experience: 'all' | 'beginner' | 'intermediate' | 'advanced'; welcomed: boolean }
const KEY = 'lingo-workspace-preferences-v1'
const EVENT = 'lingo-preferences-change'
export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = { theme: 'system', fontSize: 18, lineHeight: 1.9, goal: 'Everyday practice', directionId: CHINESE_DIRECTIONS[0].id, experience: 'all', welcomed: false }

export function readWorkspacePreferences(): WorkspacePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      theme: ['light', 'dark', 'system'].includes(stored.theme) ? stored.theme : 'system',
      fontSize: [16, 18, 20, 24].includes(stored.fontSize) ? stored.fontSize : 18,
      lineHeight: [1.6, 1.9, 2.2].includes(stored.lineHeight) ? stored.lineHeight : 1.9,
      goal: ['Everyday practice', 'CATTI preparation', 'MTI preparation'].includes(stored.goal) ? stored.goal : DEFAULT_WORKSPACE_PREFERENCES.goal,
      directionId: CHINESE_DIRECTIONS.some((direction) => direction.id === stored.directionId) ? stored.directionId : DEFAULT_WORKSPACE_PREFERENCES.directionId,
      experience: ['all', 'beginner', 'intermediate', 'advanced'].includes(stored.experience) ? stored.experience : 'all',
      welcomed: stored.welcomed === true,
    }
  } catch { return DEFAULT_WORKSPACE_PREFERENCES }
}

export function clearWorkspacePreferences() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState(readWorkspacePreferences)
  const [error, setError] = useState<string>()
  useEffect(() => {
    const sync = () => setPreferences(readWorkspacePreferences())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  function update(change: Partial<WorkspacePreferences>) {
    const next = { ...readWorkspacePreferences(), ...change }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      setPreferences(next)
      setError(undefined)
      window.dispatchEvent(new Event(EVENT))
    } catch { setError('This browser could not save the preference. Enable local storage and try again.') }
  }
  return { preferences, update, error }
}

export function AppearanceSettings() {
  const { preferences, update, error } = useWorkspacePreferences()
  return <section className="settings-card"><p className="eyebrow">Your workspace</p><h3>Appearance and reading</h3><div className="setup-fields">
    <label className="field-label">Theme<select value={preferences.theme} onChange={(event) => update({ theme: event.target.value as WorkspacePreferences['theme'] })}><option value="system">Follow device</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label className="field-label">Editor text size<select value={preferences.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })}>{[16, 18, 20, 24].map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
    <label className="field-label">Line spacing<select value={preferences.lineHeight} onChange={(event) => update({ lineHeight: Number(event.target.value) })}><option value="1.6">Compact</option><option value="1.9">Comfortable</option><option value="2.2">Spacious</option></select></label>
    <label className="field-label">Learning goal<select value={preferences.goal} onChange={(event) => update({ goal: event.target.value })}><option>Everyday practice</option><option>CATTI preparation</option><option>MTI preparation</option></select></label>
<label className="field-label">Practice level<select value={preferences.experience} onChange={(event) => update({ experience: event.target.value as WorkspacePreferences['experience'] })}><option value="all">Explore all levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    <label className="field-label">Default language direction<select value={preferences.directionId} onChange={(event) => update({ directionId: event.target.value })}>{CHINESE_DIRECTIONS.map((direction) => <option key={direction.id} value={direction.id}>{direction.label}</option>)}</select></label>
  </div><p className="settings-card__copy">Saved on this device. Keyboard: Ctrl/⌘ + Enter submits written practice. Your browser provides native undo and redo. Interface language: English; passages support seven languages.</p>{error && <p role="alert" className="settings-error">{error}</p>}</section>
}

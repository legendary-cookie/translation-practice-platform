import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AppSettings } from '../../domain/types'
import { database } from '../../storage/database'
import { cloudEndpoint } from '../../ai/cloud-provider'
import { clearPendingConsent, getLocalModelState, getSessionKey, prepareLocalModel, setSessionKey, subscribeLocalModel } from '../../ai/provider'
import './settings.css'

export function ProviderSettings({ onSettingsChange, onBusyChange, locked = false }: { onSettingsChange?: (settings: AppSettings) => void; onBusyChange?: (busy: boolean) => void; locked?: boolean }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [key, setKey] = useState(getSessionKey)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const state = useSyncExternalStore(subscribeLocalModel, getLocalModelState)
  useEffect(() => {
    if (locked) return
    let active = true
    void database.getSettings().then((value) => { if (active) setSettings(value) }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : 'Could not load preferences.') })
    return () => { active = false }
  }, [locked])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!settings || saving || locked) return
    onBusyChange?.(true)
    setSaving(true); setError(''); setNotice('')
    try {
      const next: AppSettings = { privacyMode: settings.privacyMode, localModelId: settings.localModelId }
      const baseUrl = settings.cloudBaseUrl?.trim()
      const model = settings.cloudModel?.trim()
      if (baseUrl || model) {
        if (!baseUrl || !model) throw new Error('Enter both a cloud base URL and model, or clear both fields.')
        cloudEndpoint({ baseUrl, model })
        next.cloudBaseUrl = baseUrl; next.cloudModel = model
      }
      await database.saveSettings(next)
      setSessionKey(key)
      clearPendingConsent()
      setSettings(next)
      onSettingsChange?.(next)
      setNotice('Preferences saved on this device. The API key is kept only in this page session and disappears on reload.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save preferences.') }
    finally { onBusyChange?.(false); setSaving(false) }
  }

  return <section className="provider-settings" aria-labelledby="provider-heading">
    <h2 id="provider-heading">Evaluation & privacy</h2>
    <p>AI feedback is an uncalibrated practice estimate. Quality varies by language and device; you can always review your answer manually.</p>
    {error && <p className="settings-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!settings ? <p role="status">Loading device preferences…</p> : <form onSubmit={save}>
      <fieldset disabled={saving || locked}><legend>Where evaluation happens</legend>
        <label className="settings-option"><input type="radio" name="privacy-mode" checked={settings.privacyMode === 'local-only'} onChange={() => setSettings({ ...settings, privacyMode: 'local-only' })} /><span><strong>Local only</strong><br />Evaluation sends no text to a remote AI service. If local AI cannot run, use manual review.</span></label>
        <label className="settings-option"><input type="radio" name="privacy-mode" checked={settings.privacyMode === 'local-first'} onChange={() => setSettings({ ...settings, privacyMode: 'local-first' })} /><span><strong>Local first, optional cloud</strong><br />A ready local model is preferred. Each cloud request requires approval of the exact passage, answer, and destination.</span></label>
      </fieldset>
      <div className="model-status"><h3>On-device model · Qwen3 1.7B</h3><p role="status">{state.message}</p>
        {state.status === 'downloading' && <progress aria-label="Model preparation progress" value={state.progress} max={1} />}
        <p className="settings-help">Weights cache: {state.cached === null ? 'not checked' : state.cached ? 'found in this browser' : 'not confirmed'}. Cached weights do not guarantee all runtime assets or device support. This model needs approximately 2 GB of GPU memory; first preparation downloads large assets from MLC / Hugging Face.</p>
        <button type="button" className="button secondary" disabled={locked || ['checking', 'downloading', 'ready'].includes(state.status)} onClick={() => { setError(''); void prepareLocalModel().catch((error: unknown) => setError(error instanceof Error ? error.message : 'Could not prepare local AI.')) }}>{state.status === 'ready' ? 'Local model ready' : state.status === 'error' ? 'Retry model preparation' : 'Download / prepare local model'}</button>
        <p className="settings-help">This button permits model asset downloads, including in local-only mode. Practice text stays on this device. Evaluation never starts an asset download.</p>
      </div>
      <fieldset disabled={saving || locked || settings.privacyMode === 'local-only'}><legend>Optional cloud evaluator</legend>
        <label>OpenAI-compatible base URL<input type="url" placeholder="https://your-provider.example/v1" value={settings.cloudBaseUrl ?? ''} onChange={(event) => setSettings({ ...settings, cloudBaseUrl: event.target.value })} autoComplete="off" spellCheck={false} /></label>
        <label>Model name<input value={settings.cloudModel ?? ''} onChange={(event) => setSettings({ ...settings, cloudModel: event.target.value })} autoComplete="off" spellCheck={false} maxLength={200} /></label>
        <label>API key · this page session only<input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <p className="settings-help">Use HTTPS, or HTTP on localhost. Enter a base URL ending before /chat/completions. The endpoint must allow browser requests (CORS) and JSON responses. The key is never stored in browser storage, exports, or practice history. Reloading clears it.</p>
      </fieldset>
      <div className="button-row"><button className="button primary" disabled={saving || locked}>{saving ? 'Saving…' : 'Save evaluation preferences'}</button><button className="button secondary" disabled={saving || locked} type="button" onClick={() => { setKey(''); setSessionKey(''); setNotice('Session key cleared.') }}>Clear session key</button></div>
    </form>}
  </section>
}

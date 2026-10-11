import { useRef, useState } from 'react'
import { database } from '../../storage/database'
import { ProviderSettings } from './ProviderSettings'
import './settings.css'

export function SettingsPage({ dataVersion, evaluationBusy, savingBusy, providerBusy, deleting, onProviderBusyChange, onDelete }: {
  dataVersion: number
  evaluationBusy: boolean
  savingBusy: boolean
  providerBusy: boolean
  deleting: boolean
  onProviderBusyChange: (busy: boolean) => void
  onDelete: () => Promise<void>
}) {
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const operation = useRef(false)
  const blocked = evaluationBusy || savingBusy || providerBusy || deleting || exporting

  async function exportData() {
    if (operation.current || deleting) return
    operation.current = true; setExporting(true); setError(''); setNotice('')
    let url: string | undefined
    try {
      const data = await database.exportData()
      url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = `translation-studio-${data.exportedAt.slice(0, 10)}.json`
      document.body.append(link); link.click(); link.remove()
      setNotice(`JSON download requested with ${data.sessions.length} saved assessments and device preferences. Your browser controls the save location.`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not export local data. Try again.') }
    finally {
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000) }
      operation.current = false; setExporting(false)
    }
  }

  async function deleteData() {
    if (blocked || operation.current) return
    if (!window.confirm('Delete all local practice data? This permanently removes saved translations, feedback, and preferences from this browser. It also discards the open draft and unsaved feedback, clears the session API key and cloud consent, and releases the local model from memory. Downloaded model assets may remain cached separately. Existing JSON downloads and data already sent to a cloud provider are not deleted. This cannot be undone.')) return
    operation.current = true; setError(''); setNotice('')
    try {
      await onDelete()
      setNotice('Local practice history and preferences deleted. The open draft, unsaved feedback, session key, and consent were cleared. Local-only defaults are restored. Downloaded WebLLM model assets may remain cached separately in your browser.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete local data. Your data has not been confirmed deleted; try again.') }
    finally { operation.current = false }
  }

  return <section className="settings-page" aria-labelledby="settings-heading">
    <header><p className="eyebrow">Privacy & data</p><h1 id="settings-heading">Your words, your choice.</h1><p>Saved translations, feedback, and preferences stay in this browser profile on this device. There is no account or cross-device synchronization. Unsaved drafts last only while this page is open.</p><p className="settings-help">Optional cloud evaluation asks you to approve the exact passage, answer, and destination for every request. A provider may retain text you send under its own policy; deleting this device's data cannot remove that copy.</p></header>
    <ProviderSettings key={dataVersion} locked={deleting || providerBusy} onBusyChange={onProviderBusyChange} />
    <section className="data-controls" aria-labelledby="data-heading"><h2 id="data-heading">Manage this device's data</h2><p>Export a versioned JSON copy of saved translations, feedback, and preferences. It contains your practice text and configured provider address/model; API keys and the open draft are excluded. Keep downloaded copies somewhere you trust.</p><button type="button" className="button secondary" disabled={exporting || deleting} onClick={() => { void exportData() }}>{exporting ? 'Preparing JSON…' : 'Download data as JSON'}</button>
      <div className="delete-data"><h3>Delete local practice data</h3><p>Remove all saved sessions and preferences, discard the current draft and unsaved feedback, clear the session key and pending consent, and release the loaded model. A confirmation is required.</p><p className="settings-help" id="delete-help">Downloaded WebLLM model assets may remain cached separately. To remove them too, use your browser's site data controls. JSON files you downloaded remain on disk.</p>{evaluationBusy ? <p role="status" id="delete-blocked">Wait for evaluation to finish before deleting. This keeps a pending result from restoring deleted history.</p> : savingBusy || providerBusy ? <p role="status" id="delete-blocked">Wait for the current save to finish before deleting, so it cannot restore deleted data.</p> : null}<button type="button" className="button danger" disabled={blocked} aria-describedby={`delete-help${evaluationBusy || savingBusy || providerBusy ? ' delete-blocked' : ''}`} onClick={() => { void deleteData() }}>{deleting ? 'Deleting local data…' : 'Delete local practice data'}</button></div>
      {error && <p className="settings-error" role="alert">{error}</p>}{notice && <p role="status" className="data-notice">{notice}</p>}
    </section>
  </section>
}

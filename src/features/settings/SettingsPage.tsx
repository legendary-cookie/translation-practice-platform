import { t } from '../../i18n'
import { exportJson } from '../../native/export-json'
import { StorageOverview } from './StorageOverview'
import { readWorkspacePreferences, AppearanceSettings } from './AppearanceSettings'
import { useEffect, useState } from 'react'
import { hadLocalModelReady, type LocalModelProgress } from '../../ai/local-provider'
import type { CapabilityAssessment } from '../../ai/capability'
import type { LocalProviderLike } from '../../ai/provider'
import type { EvaluationMode, StoredSettings } from '../../domain/types'
import type { SessionHistoryStatus } from '../practice/session-history'
import { DEFAULT_LOCAL_MODEL_ID } from '../../domain/types'
import { database } from '../../storage/database'
import { CloudSettingsForm, type CloudSettingsDraft } from './CloudSettingsForm'
import { ModelCapabilityStatus } from './ModelCapabilityStatus'

export function SettingsPage({
  cloudDraft,
  capability,
  localProgress,
  localProvider,
  onCloudDraftChange,
  onDeleteData,
  onEvaluationModeChange,
  settingsHydrationStatus,
  onRetrySettings,
  onPrepareLocal,
  onRecheckCapability,
  isCheckingCapability,
  settings,
  sessionCount,
  interpretingSessionCount,
  examResultCount,
  writtenHistoryStatus,
  interpretingHistoryStatus,
  examHistoryStatus,
  onRetryHistory,
  onSaveCloudPreferences,
}: {
  cloudDraft: CloudSettingsDraft
  capability: CapabilityAssessment
  localProgress: LocalModelProgress
  localProvider: LocalProviderLike
  onCloudDraftChange: (draft: CloudSettingsDraft) => void
  onDeleteData: () => Promise<void>
  onEvaluationModeChange: (mode: EvaluationMode) => Promise<void>
  settingsHydrationStatus: SessionHistoryStatus
  onRetrySettings: () => void
  onPrepareLocal: () => Promise<void>
  onRecheckCapability: () => void
  isCheckingCapability: boolean
  settings: StoredSettings
  sessionCount: number
  interpretingSessionCount: number
  examResultCount: number
  writtenHistoryStatus: SessionHistoryStatus
  interpretingHistoryStatus: SessionHistoryStatus
  examHistoryStatus: SessionHistoryStatus
  onRetryHistory: () => Promise<void>
  onSaveCloudPreferences: (baseUrl: string, model: string, supportsAudio: boolean) => Promise<void>
}) {
  const [isCached, setIsCached] = useState<boolean | undefined>()
  const [isCheckingCache, setIsCheckingCache] = useState(false)
  const [message, setMessage] = useState<string | undefined>()
  const [settingsError, setSettingsError] = useState<string | undefined>()
  const [cloudSaveError, setCloudSaveError] = useState<string | undefined>()
  const [dataActionError, setDataActionError] = useState<string | undefined>()
  const [isSavingCloudPreferences, setIsSavingCloudPreferences] = useState(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [isDeletingData, setIsDeletingData] = useState(false)

  async function handleEvaluationModeChange(mode: EvaluationMode) {
    setSettingsError(undefined)
    setMessage(undefined)
    try {
      await onEvaluationModeChange(mode)
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : ''
      setSettingsError(`The evaluation preference could not be saved locally${reason}.`)
    }
  }

  async function handleSaveCloudPreferences() {
    setCloudSaveError(undefined)
    setMessage(undefined)
    setIsSavingCloudPreferences(true)
    try {
      await onSaveCloudPreferences(cloudDraft.baseUrl, cloudDraft.model, cloudDraft.supportsAudio)
      setMessage('Cloud endpoint preference saved locally. The key was not saved.')
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : ''
      setCloudSaveError(`Cloud endpoint preference could not be saved locally${reason}. The key was not saved.`)
    } finally {
      setIsSavingCloudPreferences(false)
    }
  }

  async function checkCache() {
    setIsCheckingCache(true)
    setIsCached(await localProvider.isCached())
    setIsCheckingCache(false)
  }

  useEffect(() => {
    void checkCache()
  }, [localProvider, localProgress.status])

  async function handlePrepareLocal() {
    setMessage(undefined)
    if (capability.localModel.status !== 'available') {
      setMessage(capability.localModel.reason)
      return
    }
    await onPrepareLocal()
    await checkCache()
  }

  async function handleExport() {
    setDataActionError(undefined)
    setMessage(undefined)
    try {
      const payload = { ...await database.exportData(), workspacePreferences: readWorkspacePreferences() }
      const saved = await exportJson(payload, `lingo-practice-${new Date().toISOString().slice(0, 10)}.json`)
      setMessage(saved ? 'A JSON export containing only local records is ready.' : 'Export cancelled. Your local records are unchanged.')
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : ''
      setDataActionError(`The local archive could not be created${reason}. No export file was produced.`)
    }
  }

  async function confirmDelete() {
    setDataActionError(undefined)
    setMessage(undefined)
    setIsDeletingData(true)
    try {
      await onDeleteData()
      setIsDeletePending(false)
      setMessage('Local sessions and settings have been deleted from this browser.')
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : ''
      setDataActionError(`Local data could not be deleted${reason}. The records may still be stored in this browser.`)
    } finally {
      setIsDeletingData(false)
    }
  }

  const statusLabel = localProgress.status === 'ready'
    ? 'Ready'
    : localProgress.status === 'preparing'
      ? t('{0}% preparing', Math.round((localProgress.progress ?? 0) * 100))
      : localProgress.status === 'unavailable'
        ? 'Unavailable'
        : 'Not prepared'

  const cacheWasEvicted = hadLocalModelReady() && isCached === false && localProgress.status !== 'preparing'
  const cacheLabel = isCheckingCache
    ? 'Checking…'
    : cacheWasEvicted
      ? 'Missing after previous success'
      : isCached === true
        ? 'Model assets cached'
        : isCached === false
          ? 'Not cached yet'
          : 'Unknown'
  const historyCount = (count: number, status: SessionHistoryStatus, label: string) =>
    status === 'failed' ? t('{0} unavailable', t(label)) : status === 'loading' ? t('{0} checking…', t(label)) : t('{0} {1}', count, t(label))
  const historyCounts = [
    historyCount(sessionCount, writtenHistoryStatus, 'written'),
    historyCount(interpretingSessionCount, interpretingHistoryStatus, 'audio'),
    historyCount(examResultCount, examHistoryStatus, 'exams'),
  ].join(' · ')
  const historyUnavailable = [writtenHistoryStatus, interpretingHistoryStatus, examHistoryStatus].some((status) => status === 'failed')

  return (
    <div className="settings-page">
      <AppearanceSettings />
      <section className="settings-intro"><p className="eyebrow">{t("Privacy and setup")}</p><h2>{t("Make the boundary visible.")}</h2><p>{t("Practice data stays in this browser. Choose whether evaluation can use a cloud endpoint, then approve each cloud task on its own terms.")}</p></section>
      {settingsHydrationStatus === 'failed' && <section className="settings-card" role="alert"><p className="settings-error">{t("Saved settings could not be read. Your existing preferences have not been overwritten; retry before changing or saving evaluation settings.")}</p><button className="button button--quiet" type="button" onClick={onRetrySettings}>{t("Retry loading settings")}</button></section>}
      {settingsHydrationStatus === 'loading' && <p role="status">{t("Loading saved settings from this browser…")}</p>}
      <section className="settings-card"><div className="settings-card__heading"><div><p className="eyebrow">{t("Evaluation mode")}</p><h3>{t("Decide where feedback can run.")}</h3></div><span className="settings-card__badge">{t("No account")}</span></div><div className="mode-choice-grid"><label className={`mode-choice ${settings.evaluationMode === 'local-only' ? 'mode-choice--selected' : ''}`}><input type="radio" name="evaluation-mode" value="local-only" checked={settings.evaluationMode === 'local-only'} disabled={settingsHydrationStatus !== 'ready'} onChange={() => void handleEvaluationModeChange('local-only')} /><span><strong>{t("Local-only")}</strong><small>{t("No practice content is sent to an AI service. If the model is unavailable, keep the task for manual review.")}</small></span></label><label className={`mode-choice ${settings.evaluationMode === 'local-first-cloud-fallback' ? 'mode-choice--selected' : ''}`}><input type="radio" name="evaluation-mode" value="local-first-cloud-fallback" checked={settings.evaluationMode === 'local-first-cloud-fallback'} disabled={settingsHydrationStatus !== 'ready'} onChange={() => void handleEvaluationModeChange('local-first-cloud-fallback')} /><span><strong>{t("Local-first with cloud fallback")}</strong><small>{t("Try the local model first. If it cannot run, show the exact task and ask for one-time consent before cloud evaluation.")}</small></span></label></div>{settingsError && <p className="settings-error" role="alert">{t(settingsError)}</p>}</section>
      <section className="settings-card"><div className="settings-card__heading"><div><p className="eyebrow">{t("On-device evaluator")}</p><h3>{DEFAULT_LOCAL_MODEL_ID}</h3></div><span className={'settings-card__status settings-card__status--' + localProgress.status} role="status" aria-live="polite">{t(statusLabel)}</span></div><ModelCapabilityStatus capability={capability} /><p className="settings-card__copy">{t("WebLLM runs this model in a worker so generation does not block the interface. The first preparation may download model assets; after caching, supported devices can evaluate without sending practice content remotely.")}</p><div className="model-status-grid"><div><span>{t("Cache state")}</span><strong>{t(cacheLabel)}</strong></div><div><span>{t("Last status")}</span><strong>{t(localProgress.text ?? statusLabel)}</strong></div></div>{cacheWasEvicted && <p className="settings-error" role="alert">{t("The browser no longer has the model assets from your last successful preparation. This is consistent with cache eviction or cleared site data; local inference is unavailable until you prepare the model again.")}</p>}{localProgress.error && <p className="settings-error" role="alert">{t(localProgress.error)}</p>}<div className="settings-actions"><button className="button button--quiet" type="button" onClick={onRecheckCapability} disabled={isCheckingCapability}>{isCheckingCapability ? t("Checking device…") : t("Recheck device capability")}</button><button className="button button--primary" type="button" onClick={() => void handlePrepareLocal()} disabled={isCheckingCapability || localProgress.status === 'preparing' || capability.localModel.status !== 'available'}>{capability.localModel.status !== 'available' ? t("Local model unavailable") : localProgress.status === 'unavailable' ? t("Retry local model") : localProgress.status === 'ready' ? t("Prepare again") : t("Prepare local model")} <span aria-hidden="true">→</span></button></div></section>
      <section className="settings-card"><div className="settings-card__heading"><div><p className="eyebrow">{t("Cloud fallback")}</p><h3>{t("Use your own OpenAI-compatible endpoint.")}</h3></div><span className="settings-card__badge">{t("Opt in per task")}</span></div><CloudSettingsForm value={cloudDraft} onChange={onCloudDraftChange} /><button className="button button--quiet" type="button" onClick={() => void handleSaveCloudPreferences()} disabled={isSavingCloudPreferences || settingsHydrationStatus !== 'ready'}>{isSavingCloudPreferences ? t("Saving locally…") : t("Save endpoint preference")}</button>{cloudSaveError && <p className="settings-error" role="alert">{t(cloudSaveError)}</p>}<p className="settings-card__copy settings-card__copy--small">{t("Before any written or audio request, the consent step shows the exact payload. Interpreting audio is offered only for an endpoint you explicitly marked as audio-capable; the service worker does not cache evaluation requests or responses.")}</p></section>
      <section className="settings-card settings-card--data"><StorageOverview /><div className="settings-card__heading"><div><p className="eyebrow">{t("Local data")}</p><h3>{t("Your browser is the storage boundary.")}</h3></div><span className="settings-card__badge">{historyCounts}</span></div><p className="settings-card__copy">{t("Sessions, settings, recordings, and progress are stored on this browser/device only. Export includes short recording data; deletion clears the recording store as well as written data.")}</p>{historyUnavailable && <p role="alert" className="settings-error">{t("Some local counts are unavailable because a history read failed. Existing records have not been deleted.")}</p>}{[writtenHistoryStatus, interpretingHistoryStatus, examHistoryStatus].some((status) => status === 'failed') && <button className="button button--quiet" type="button" onClick={() => void onRetryHistory()}>{t("Retry local history reads")}</button>}<div className="settings-actions"><button className="button button--quiet" type="button" onClick={() => void handleExport()}>{t("Export local JSON")}</button><button className="button button--danger" type="button" onClick={() => setIsDeletePending(true)}>{t("Delete local data")}</button></div>{isDeletePending && <div className="delete-confirmation" role="alertdialog" aria-labelledby="delete-heading" aria-describedby="delete-copy"><strong id="delete-heading">{t("Delete all local sessions and settings?")}</strong><p id="delete-copy">{t("This permanently deletes the data from this browser. Export files are reference-only and cannot be imported to restore data.")}</p><div className="settings-actions"><button className="button button--quiet" type="button" onClick={() => setIsDeletePending(false)} disabled={isDeletingData}>{t("Keep local data")}</button><button className="button button--danger" type="button" onClick={() => void confirmDelete()} disabled={isDeletingData}>{isDeletingData ? t("Deleting…") : t("Confirm deletion")}</button></div></div>}{dataActionError && <p className="settings-error" role="alert">{t(dataActionError)}</p>}{message && <p className="form-message" role="status">{t(message)}</p>}</section>
    </div>
  )
}

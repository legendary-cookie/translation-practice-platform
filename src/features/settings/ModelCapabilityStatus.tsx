import { t } from '../../i18n'
import type { CapabilityAssessment } from '../../ai/capability'
import { formatMemorySignal, formatStorageSignal, formatTierLabel } from '../../ai/capability'

export function ModelCapabilityStatus({ capability }: { capability: CapabilityAssessment }) {
  const webGpuLabel = capability.webGpu.status === 'available'
    ? 'Available'
    : capability.webGpu.status === 'checking'
      ? 'Checking'
      : 'Unavailable'
  const localLabel = capability.localModel.status === 'available'
    ? 'Offer after provider warm-up'
    : capability.localModel.status === 'restricted'
      ? 'Restricted until device validation'
      : 'Unavailable on this device'

  return (
    <section className="capability-status" aria-labelledby="capability-status-heading">
      <div className="capability-status__heading">
        <div>
          <p className="eyebrow">{t("Detected capability")}</p>
          <h3 id="capability-status-heading">{t(formatTierLabel(capability.tier))}</h3>
        </div>
        <span className={'capability-status__badge capability-status__badge--' + capability.tier.toLowerCase()}>{t(capability.deviceLabel)}</span>
      </div>
      <p className="settings-card__copy">{t(capability.localModel.reason)}</p>
      <dl className="capability-status__grid">
        <div><dt>{t("WebGPU")}</dt><dd>{t(webGpuLabel)}</dd></div>
        <div><dt>{t("Memory signal")}</dt><dd>{t(formatMemorySignal(capability))}</dd></div>
        <div><dt>{t("Storage")}</dt><dd>{t(formatStorageSignal(capability))}</dd></div>
        <div><dt>{t("Current task gate")}</dt><dd>{t(localLabel)}</dd></div>
      </dl>
      <p className="capability-status__note">{t("Local-only mode never sends practice content to the cloud. If local inference is unavailable, keep the task for manual review; cloud mode can ask for explicit consent for that one task.")}</p>
      <p className="capability-status__warning">{t("Hindi↔Chinese and Arabic↔Chinese local critique stays blocked until native-language quality checks validate this model. A listed language is not a quality guarantee.")}</p>
    </section>
  )
}

export function DirectionQualityNotice({ capability }: { capability: CapabilityAssessment }) {
  return (
    <aside className="direction-quality-notice" role="note">
      <strong>{t("Direction quality gate")}</strong>
      <p>{capability.tier}{t(" is detected for this device. Local Qwen3-1.7B critique is not offered for Hindi↔Chinese or Arabic↔Chinese yet; choose another direction for local feedback, or use manual review or explicit cloud consent.")}</p>
    </aside>
  )
}

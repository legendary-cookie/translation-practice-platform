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
          <p className="eyebrow">Detected capability</p>
          <h3 id="capability-status-heading">{formatTierLabel(capability.tier)}</h3>
        </div>
        <span className={'capability-status__badge capability-status__badge--' + capability.tier.toLowerCase()}>{capability.deviceLabel}</span>
      </div>
      <p className="settings-card__copy">{capability.localModel.reason}</p>
      <dl className="capability-status__grid">
        <div><dt>WebGPU</dt><dd>{webGpuLabel}</dd></div>
        <div><dt>Memory signal</dt><dd>{formatMemorySignal(capability)}</dd></div>
        <div><dt>Storage</dt><dd>{formatStorageSignal(capability)}</dd></div>
        <div><dt>Current task gate</dt><dd>{localLabel}</dd></div>
      </dl>
      <p className="capability-status__note">Local-only mode never sends practice content to the cloud. If local inference is unavailable, keep the task for manual review; cloud mode can ask for explicit consent for that one task.</p>
      <p className="capability-status__warning">Hindi↔Chinese and Arabic↔Chinese local critique stays blocked until native-language quality checks validate this model. A listed language is not a quality guarantee.</p>
    </section>
  )
}

export function DirectionQualityNotice({ capability }: { capability: CapabilityAssessment }) {
  return (
    <aside className="direction-quality-notice" role="note">
      <strong>Direction quality gate</strong>
      <p>{capability.tier} is detected for this device. Local Qwen3-1.7B critique is not offered for Hindi↔Chinese or Arabic↔Chinese yet; choose another direction for local feedback, or use manual review or explicit cloud consent.</p>
    </aside>
  )
}

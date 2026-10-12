export type CloudSettingsDraft = {
  baseUrl: string
  model: string
  apiKey: string
  supportsAudio: boolean
}

export function CloudSettingsForm({
  value,
  onChange,
}: {
  value: CloudSettingsDraft
  onChange: (value: CloudSettingsDraft) => void
}) {
  return (
    <div className="settings-form" aria-label="Cloud evaluation settings">
      <label className="field-label" htmlFor="cloud-base-url">
        OpenAI-compatible endpoint
        <input
          id="cloud-base-url"
          type="url"
          autoComplete="off"
          placeholder="https://example.com/v1"
          value={value.baseUrl}
          onChange={(event) => onChange({ ...value, baseUrl: event.target.value })}
        />
      </label>
      <label className="field-label" htmlFor="cloud-model">
        Cloud model name
        <input
          id="cloud-model"
          type="text"
          autoComplete="off"
          placeholder="translation-evaluator"
          value={value.model}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
        />
      </label>
      <label className="field-label" htmlFor="cloud-api-key">
        Session-only API key
        <input
          id="cloud-api-key"
          type="password"
          autoComplete="new-password"
          placeholder="Entered only when you choose cloud evaluation"
          value={value.apiKey}
          onChange={(event) => onChange({ ...value, apiKey: event.target.value })}
        />
      </label>
      <p className="field-help">The endpoint and model preference are stored locally. The key stays in memory for this tab and is never written to IndexedDB or exported.</p>
      <label className="mode-choice" htmlFor="cloud-audio-capable"><input id="cloud-audio-capable" type="checkbox" checked={value.supportsAudio} onChange={(event) => onChange({ ...value, supportsAudio: event.target.checked })} /><span><strong>I verified this endpoint accepts audio input</strong><small>Only then can an interpreting task offer a consent preview. The app never sends audio automatically.</small></span></label>
    </div>
  )
}

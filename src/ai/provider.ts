import type { EvaluationInput, EvaluationRouteResult, LocalModelState, TranslationFeedback } from '../domain/types'
import { database } from '../storage/database'
import { cloudEndpoint, cloudRequestBody, createCloudProvider } from './cloud-provider'
import { validateEvaluationInput } from './evaluation-prompt'
import { createLocalProvider } from './local-provider'

export interface EvaluationProvider {
  evaluate(input: EvaluationInput, apiKey?: string): Promise<TranslationFeedback>
}
export type { EvaluationRouteResult } from '../domain/types'

const listeners = new Set<() => void>()
const localProvider = createLocalProvider(undefined, () => { for (const listener of listeners) listener() })
let sessionKey = ''
let pendingConsent: string | undefined
let cloudBusy = false

export function getLocalModelState(): LocalModelState { return localProvider.getState() }
export function subscribeLocalModel(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } }
export function prepareLocalModel(): Promise<void> { return localProvider.prepare() }
export function setSessionKey(key: string): void { sessionKey = key; pendingConsent = undefined }
export function getSessionKey(): string { return sessionKey }
export function clearPendingConsent(): void { pendingConsent = undefined }
export function resetEvaluationSession(): void { sessionKey = ''; pendingConsent = undefined; localProvider.dispose() }

export async function routeEvaluation(input: EvaluationInput, options: { cloudConsent: boolean; sessionKey?: string }): Promise<EvaluationRouteResult> {
  try {
    // Snapshot once: later draft edits cannot alter a displayed/consented payload.
    const snapshot = structuredClone(input)
    validateEvaluationInput(snapshot)
    let settings = await database.getSettings()
    let localReason = getLocalModelState().message
    if (getLocalModelState().status === 'ready') {
      try {
        const feedback = await localProvider.evaluate(snapshot)
        pendingConsent = undefined
        return { status: 'complete', feedback }
      } catch (error) { localReason = error instanceof Error ? error.message : 'Local AI could not evaluate this answer.' }
      settings = await database.getSettings()
    }
    if (settings.privacyMode === 'local-only') {
      pendingConsent = undefined
      return { status: 'unavailable', reason: `${localReason} Local-only mode prevents cloud evaluation. Keep your answer for manual review or prepare local AI in Privacy & data.` }
    }
    if (!settings.cloudBaseUrl || !settings.cloudModel) {
      pendingConsent = undefined
      return { status: 'unavailable', reason: `${localReason} Configure an optional cloud endpoint and model in Privacy & data, or review manually.` }
    }
    const config = { baseUrl: settings.cloudBaseUrl, model: settings.cloudModel }
    const endpoint = cloudEndpoint(config)
    const body = cloudRequestBody(snapshot, config)
    const payloadSummary = `Destination: ${endpoint}\n\nExact request body (also includes the tutor rubric and language/style metadata):\n${JSON.stringify(body, null, 2)}\n\nYour session key is sent only as an authorization header. This endpoint may retain the submitted text under its own policy.`
    const consentIdentity = JSON.stringify({ endpoint, body })
    if (!options.cloudConsent || pendingConsent !== consentIdentity) {
      pendingConsent = consentIdentity
      return { status: 'needs-consent', input: snapshot, payloadSummary }
    }
    // Consent is consumed before the request; every retry needs a fresh preview.
    pendingConsent = undefined
    if (cloudBusy) return { status: 'unavailable', reason: 'Another cloud evaluation is in progress. Please wait before submitting again.' }
    const key = options.sessionKey ?? sessionKey
    if (!key.trim()) return { status: 'unavailable', reason: 'Enter a session-only API key in Privacy & data, then submit again to review the cloud payload.' }
    // Recheck stored privacy/configuration immediately before dispatch.
    const latest = await database.getSettings()
    if (latest.privacyMode !== 'local-first' || latest.cloudBaseUrl !== config.baseUrl || latest.cloudModel !== config.model) return { status: 'unavailable', reason: 'Privacy or provider settings changed. Submit again to review the new evaluation destination.' }
    if (cloudBusy) return { status: 'unavailable', reason: 'Another cloud evaluation is in progress. Please wait before submitting again.' }
    cloudBusy = true
    try { return { status: 'complete', feedback: await createCloudProvider(config).evaluate(snapshot, key) } }
    finally { cloudBusy = false }
  } catch (error) {
    pendingConsent = undefined
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Evaluation is unavailable. Your answer remains available for manual review.' }
  }
}

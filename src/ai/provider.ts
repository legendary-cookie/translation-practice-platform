import type { EvaluationFeedback, EvaluationMode, EvaluationRequest, InterpretingEvaluationInput, InterpretingExercise, InterpretingFeedback, Exercise, LanguageCode, TranslationFeedback } from '../domain/types'
import { getLocalEvaluationDecision, type CapabilityAssessment } from './capability'

export interface EvaluationProvider {
  evaluate(input: EvaluationRequest): Promise<EvaluationFeedback>
}

export type LocalProviderLike = EvaluationProvider & {
  prepare(): Promise<void>
  getStatus(): 'not-prepared' | 'preparing' | 'ready' | 'unavailable'
  getErrorMessage(): string | undefined
  isCached(): Promise<boolean>
  isReady(): boolean
  dispose(): void
}

export type CloudConsentRequest = {
  exercise: Exercise | InterpretingExercise
  sourceText?: string
  learnerAnswer?: string
  payloadPreview: {
    providerUrl: string
    model: string
    parts: Array<{
      kind: 'source-transcript' | 'learner-transcript' | 'learner-audio' | 'delivery-metrics'
      label: string
      language?: LanguageCode
      text?: string
      mimeType?: string
      durationMs?: number
      byteLength?: number
      previewUrl?: string
    }>
  }
  revokePreview?: () => void
  confirm: () => Promise<EvaluationFeedback>
}

export type EvaluationResult =
  | { status: 'evaluated'; feedback: EvaluationFeedback; provider: 'local' | 'cloud' }
  | { status: 'needs-consent'; request: CloudConsentRequest; reason: string }
  | { status: 'unavailable'; reason: string }

export function isTranslationFeedback(feedback: EvaluationFeedback): feedback is TranslationFeedback {
  return 'dimensions' in feedback
}

export function isInterpretingFeedback(feedback: EvaluationFeedback): feedback is InterpretingFeedback {
  return 'contentScoreStatus' in feedback
}

export type EvaluationRouter = {
  evaluate(input: EvaluationRequest): Promise<EvaluationResult>
}

export type EvaluationRouterDependencies = {
  getMode: () => EvaluationMode
  getLocalProvider: () => LocalProviderLike | undefined
  getCloudProvider: () => CloudProviderLike | undefined
  getCapability: () => CapabilityAssessment
}

export type CloudProviderLike = EvaluationProvider & {
  getConsentDetails(): { providerUrl: string; model: string; supportsAudio: boolean }
  prepareAudioPayloads(input: InterpretingEvaluationInput): Promise<ReadonlyMap<string, Blob>>
  evaluate(input: EvaluationRequest, preparedAudioPayloads?: ReadonlyMap<string, Blob>): Promise<EvaluationFeedback>
}

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderUnavailableError'
  }
}

export function parseJsonResponse(content: string): unknown {
  const withoutThinking = content.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
  const withoutFence = withoutThinking.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(withoutFence) as unknown
  } catch {
    throw new Error('The evaluator returned malformed JSON.')
  }
}

export function createEvaluationRouter(dependencies: EvaluationRouterDependencies): EvaluationRouter {
  return {
    async evaluate(input) {
      const localProvider = dependencies.getLocalProvider()
      const capabilityDecision = getLocalEvaluationDecision(dependencies.getCapability(), input)
      let localFailure: string | undefined = capabilityDecision.allowed ? undefined : capabilityDecision.reason

      if (capabilityDecision.allowed && localProvider?.isReady()) {
        try {
          return { status: 'evaluated', provider: 'local', feedback: await localProvider.evaluate(input) }
        } catch (error) {
          localFailure = error instanceof Error ? error.message : 'The local evaluator failed.'
        }
      } else if (capabilityDecision.allowed && localProvider) {
        const status = localProvider.getStatus()
        localFailure = localProvider.getErrorMessage() ?? (status === 'preparing'
          ? 'The local model is still preparing.'
          : 'The local model is not ready on this device.')
      } else if (capabilityDecision.allowed) {
        localFailure = 'The local evaluator has not been prepared.'
      }

      if (dependencies.getMode() === 'local-only') {
        return { status: 'unavailable', reason: `${localFailure} Local-only mode will not send practice content to a cloud service.` }
      }

      const cloudProvider = dependencies.getCloudProvider()
      if (!cloudProvider) {
        return { status: 'unavailable', reason: `${localFailure} Configure a cloud endpoint before choosing cloud fallback.` }
      }

      const cloudDetails = cloudProvider.getConsentDetails()
      if (!('learnerAnswer' in input) && !cloudDetails.supportsAudio) {
        return { status: 'unavailable', reason: `${localFailure} The configured cloud endpoint is not marked as audio-capable, so the learner audio remains local.` }
      }

      let preparedAudioPayloads: ReadonlyMap<string, Blob> | undefined
      if (!('learnerAnswer' in input)) {
        try {
          preparedAudioPayloads = await cloudProvider.prepareAudioPayloads(input)
          if (input.recordings.some((recording) => !preparedAudioPayloads?.has(recording.id))) {
            return { status: 'unavailable', reason: `${localFailure} The outgoing audio could not be represented exactly in the consent preview, so no cloud request was made.` }
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Audio preview preparation failed.'
          return { status: 'unavailable', reason: `${localFailure} ${reason} The original recordings remain local.` }
        }
      }

      const previewUrls: string[] = []
      const parts: CloudConsentRequest['payloadPreview']['parts'] = 'learnerAnswer' in input
        ? [
            { kind: 'source-transcript', label: 'Exact source passage', text: input.exercise.sourceText },
            { kind: 'learner-transcript', label: 'Exact learner answer', text: input.learnerAnswer },
          ]
        : [
            { kind: 'source-transcript', label: 'Exact source segment transcripts', language: input.exercise.sourceLanguage, text: input.exercise.segments.map((segment) => `${segment.id}: ${segment.transcript}`).join('\n') },
            { kind: 'learner-transcript', label: 'Learner transcripts with recognition status', language: input.exercise.targetLanguage, text: input.responseSegments.map((segment) => `${segment.id} (${segment.recognitionStatus}): ${segment.transcript || '[empty]'}`).join('\n') },
            ...input.recordings.map((recording) => {
              const outgoingBlob = preparedAudioPayloads?.get(recording.id)
              if (!outgoingBlob) {
                throw new Error(`No prepared audio payload exists for recording ${recording.id}.`)
              }
              const previewUrl = URL.createObjectURL(outgoingBlob)
              previewUrls.push(previewUrl)
              const outgoingDurationMs = Math.round(Math.max(0, outgoingBlob.size - 44) / 32)
              return { kind: 'learner-audio' as const, label: `Learner audio WAV · converted locally from ${recording.mimeType} · ${recording.id}`, mimeType: outgoingBlob.type, durationMs: outgoingDurationMs, byteLength: outgoingBlob.size, previewUrl }
            }),
            { kind: 'delivery-metrics', label: 'Local delivery metrics', text: JSON.stringify(input.deliveryAnalysis) },
          ]

      return {
        status: 'needs-consent',
        reason: localFailure ?? 'Local evaluation is unavailable.',
        request: {
          exercise: input.exercise,
          sourceText: 'learnerAnswer' in input ? input.exercise.sourceText : undefined,
          learnerAnswer: 'learnerAnswer' in input ? input.learnerAnswer : undefined,
          payloadPreview: { providerUrl: cloudDetails.providerUrl, model: cloudDetails.model, parts },
          revokePreview: previewUrls.length > 0 ? () => previewUrls.forEach((url) => URL.revokeObjectURL(url)) : undefined,
          confirm: () => cloudProvider.evaluate(input, preparedAudioPayloads),
        },
      }
    },
  }
}

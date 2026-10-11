import type { EvaluationInput, EvaluationMode, TranslationFeedback } from '../domain/types'
import { getLocalEvaluationDecision, type CapabilityAssessment } from './capability'

export interface EvaluationProvider {
  evaluate(input: EvaluationInput): Promise<TranslationFeedback>
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
  sourceText: string
  learnerAnswer: string
  confirm: () => Promise<TranslationFeedback>
}

export type EvaluationResult =
  | { status: 'evaluated'; feedback: TranslationFeedback; provider: 'local' | 'cloud' }
  | { status: 'needs-consent'; request: CloudConsentRequest; reason: string }
  | { status: 'unavailable'; reason: string }

export type EvaluationRouter = {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>
}

export type EvaluationRouterDependencies = {
  getMode: () => EvaluationMode
  getLocalProvider: () => LocalProviderLike | undefined
  getCloudProvider: () => EvaluationProvider | undefined
  getCapability: () => CapabilityAssessment
}

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderUnavailableError'
  }
}

export function parseJsonResponse(content: string): unknown {
  const withoutFence = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
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

      return {
        status: 'needs-consent',
        reason: localFailure ?? 'Local evaluation is unavailable.',
        request: {
          sourceText: input.exercise.sourceText,
          learnerAnswer: input.learnerAnswer,
          confirm: () => cloudProvider.evaluate(input),
        },
      }
    },
  }
}

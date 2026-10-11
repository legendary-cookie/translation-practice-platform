import {
  CreateWebWorkerMLCEngine,
  hasModelInCache,
  prebuiltAppConfig,
  type WebWorkerMLCEngine,
} from '@mlc-ai/web-llm'
import { validateFeedback } from '../domain/scoring'
import { DEFAULT_LOCAL_MODEL_ID, type EvaluationInput, type TranslationFeedback } from '../domain/types'
import { buildEvaluationPrompt, evaluationSystemPrompt } from './evaluation-prompt'
import { parseJsonResponse, ProviderUnavailableError, type EvaluationProvider, type LocalProviderLike } from './provider'

export type LocalModelProgress = {
  status: 'not-prepared' | 'preparing' | 'ready' | 'unavailable'
  progress?: number
  text?: string
  error?: string
}

export type LocalModelProgressCallback = (progress: LocalModelProgress) => void

function createWorker(): Worker {
  return new Worker(new URL('./local-worker.ts', import.meta.url), { type: 'module' })
}

function extractContent(response: { choices: Array<{ message: { content: string | null } }> }): string {
  const content = response.choices[0]?.message.content
  if (!content) {
    throw new Error('The local evaluator returned an empty response.')
  }
  return content
}

export function createLocalProvider(
  modelId: typeof DEFAULT_LOCAL_MODEL_ID = DEFAULT_LOCAL_MODEL_ID,
  onProgress?: LocalModelProgressCallback,
): LocalProviderLike {
  let status: LocalModelProgress['status'] = 'not-prepared'
  let errorMessage: string | undefined
  let worker: Worker | undefined
  let enginePromise: Promise<WebWorkerMLCEngine> | undefined

  const report = (progress: LocalModelProgress) => {
    status = progress.status
    if (progress.error) {
      errorMessage = progress.error
    }
    onProgress?.(progress)
  }

  const provider: LocalProviderLike = {
    async prepare() {
      if (status === 'ready') {
        return
      }
      if (status === 'preparing' && enginePromise) {
        await enginePromise
        return
      }

      worker?.terminate()
      worker = createWorker()
      errorMessage = undefined
      report({ status: 'preparing', progress: 0, text: 'Starting the local model worker…' })
      enginePromise = CreateWebWorkerMLCEngine(worker, modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback: (progress) => report({ status: 'preparing', progress: progress.progress, text: progress.text }),
      })

      try {
        await enginePromise
        report({ status: 'ready', progress: 1, text: 'Local model ready.' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The local model could not be prepared.'
        enginePromise = undefined
        report({ status: 'unavailable', error: message, text: 'Local model preparation failed.' })
        throw new ProviderUnavailableError(message)
      }
    },

    async evaluate(input: EvaluationInput): Promise<TranslationFeedback> {
      if (status !== 'ready' || !enginePromise) {
        throw new ProviderUnavailableError(errorMessage ?? 'The local model is not ready.')
      }
      const engine = await enginePromise
      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: evaluationSystemPrompt },
          { role: 'user', content: buildEvaluationPrompt(input) },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        extra_body: { enable_thinking: false },
      })
      if (Symbol.asyncIterator in Object(response)) {
        throw new Error('The local evaluator returned a streaming response unexpectedly.')
      }
      const raw = parseJsonResponse(extractContent(response as { choices: Array<{ message: { content: string | null } }> }))
      return validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
    },

    getStatus() {
      return status
    },

    getErrorMessage() {
      return errorMessage
    },

    async isCached() {
      try {
        return await hasModelInCache(modelId, prebuiltAppConfig)
      } catch {
        return false
      }
    },

    isReady() {
      return status === 'ready'
    },

    dispose() {
      worker?.terminate()
      worker = undefined
      enginePromise = undefined
      status = 'not-prepared'
      errorMessage = undefined
    },
  }

  return provider
}

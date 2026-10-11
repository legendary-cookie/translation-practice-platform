import { validateFeedback } from '../domain/scoring'
import type { EvaluationInput, TranslationFeedback } from '../domain/types'
import { buildEvaluationPrompt, evaluationSystemPrompt } from './evaluation-prompt'
import { parseJsonResponse, type EvaluationProvider } from './provider'

export type CloudProviderConfig = {
  baseUrl: string
  model: string
  apiKey: string
}

type CloudResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

const CLOUD_EVALUATION_TIMEOUT_MS = 120_000
const CLOUD_EVALUATION_TIMEOUT_MESSAGE = 'Cloud evaluation timed out after 120 seconds. No score was generated; review this task manually or retry with explicit cloud consent.'

function getCompletionEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('Cloud endpoint must be a valid http:// or https:// URL.')
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const isLocalHttp = parsed.protocol === 'http:' && (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  )

  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('Cloud endpoints must use HTTPS; HTTP is allowed only for localhost or loopback addresses.')
  }

  return `${normalized}/chat/completions`
}

function getContent(payload: unknown): string {
  const response = payload as CloudResponse
  const content = response.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('The cloud evaluator returned no message content.')
  }
  return content
}

export function createCloudProvider(config: CloudProviderConfig): EvaluationProvider {
  const endpoint = getCompletionEndpoint(config.baseUrl)
  const model = config.model.trim()
  const apiKey = config.apiKey

  if (!model) {
    throw new Error('A cloud model name is required.')
  }
  if (!apiKey.trim()) {
    throw new Error('A cloud API key is required for this session.')
  }

  return {
    async evaluate(input: EvaluationInput): Promise<TranslationFeedback> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CLOUD_EVALUATION_TIMEOUT_MS)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: evaluationSystemPrompt },
              { role: 'user', content: buildEvaluationPrompt(input) },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Cloud evaluation failed with HTTP ${response.status}.`)
        }

        const raw = parseJsonResponse(getContent(await response.json() as unknown))
        return validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(CLOUD_EVALUATION_TIMEOUT_MESSAGE)
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    },
  }
}

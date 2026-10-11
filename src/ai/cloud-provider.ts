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

function getCompletionEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('Cloud endpoint must begin with http:// or https://.')
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
      })

      if (!response.ok) {
        throw new Error(`Cloud evaluation failed with HTTP ${response.status}.`)
      }

      const raw = parseJsonResponse(getContent(await response.json() as unknown))
      return validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
    },
  }
}

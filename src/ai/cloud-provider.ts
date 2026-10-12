import { validateFeedback, validateInterpretingFeedback } from '../domain/scoring'
import type { EvaluationFeedback, EvaluationRequest } from '../domain/types'
import { buildEvaluationPrompt, evaluationSystemPrompt } from './evaluation-prompt'
import { parseJsonResponse, type CloudProviderLike } from './provider'

export type CloudProviderConfig = {
  baseUrl: string
  model: string
  apiKey: string
  supportsAudio?: boolean
}

type CloudResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

export const CLOUD_EVALUATION_TIMEOUT_MS = 60_000

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

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function audioFormat(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.toLowerCase()
  return subtype === 'mpeg' ? 'mp3' : subtype || 'webm'
}

async function buildCloudRequestBody(
  input: EvaluationRequest,
  model: string,
): Promise<Record<string, unknown>> {
  if ('learnerAnswer' in input) {
    return {
      model,
      messages: [
        { role: 'system', content: evaluationSystemPrompt },
        { role: 'user', content: buildEvaluationPrompt(input) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }
  }

  const audioParts = await Promise.all(input.recordings.map(async (recording) => ({
    type: 'input_audio',
    input_audio: {
      data: await blobToBase64(recording.blob),
      format: audioFormat(recording.mimeType),
    },
  })))
  return {
    model,
    messages: [
      { role: 'system', content: evaluationSystemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildEvaluationPrompt(input) },
          ...audioParts,
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  }
}

export function createCloudProvider(config: CloudProviderConfig): CloudProviderLike {
  const endpoint = getCompletionEndpoint(config.baseUrl)
  const model = config.model.trim()
  const apiKey = config.apiKey
  const supportsAudio = config.supportsAudio === true

  if (!model) {
    throw new Error('A cloud model name is required.')
  }
  if (!apiKey.trim()) {
    throw new Error('A cloud API key is required for this session.')
  }

  return {
    getConsentDetails() {
      return { providerUrl: endpoint, model, supportsAudio }
    },

    async evaluate(input: EvaluationRequest): Promise<EvaluationFeedback> {
      if (!('learnerAnswer' in input) && !supportsAudio) {
        throw new Error('The configured cloud endpoint has not been verified for audio input. Keep the recording local or configure an audio-capable endpoint explicitly.')
      }
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
          body: JSON.stringify(await buildCloudRequestBody(input, model)),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Cloud evaluation failed with HTTP ${response.status}.`)
        }

        const raw = parseJsonResponse(getContent(await response.json() as unknown))
        return 'learnerAnswer' in input
          ? validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
          : validateInterpretingFeedback(raw, input)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Cloud evaluation timed out after ${CLOUD_EVALUATION_TIMEOUT_MS / 1000} seconds. Check the endpoint and try again.`)
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    },
  }
}

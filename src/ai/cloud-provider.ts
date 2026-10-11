import type { EvaluationInput } from '../domain/types'
import type { EvaluationProvider } from './provider'
import { evaluationMessages, parseFeedback } from './evaluation-prompt'

export interface CloudConfig { baseUrl: string; model: string }

export function cloudEndpoint(config: CloudConfig): string {
  const url = new URL(config.baseUrl)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS base URL without embedded credentials, query parameters, or fragments. HTTP is supported only on localhost.')
  }
  if (!config.model.trim() || config.model.length > 200) throw new Error('Enter a cloud model name of at most 200 characters.')
  url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`
  return url.href
}

export function cloudRequestBody(input: EvaluationInput, config: CloudConfig) {
  return { model: config.model.trim(), messages: evaluationMessages(input), temperature: 0.2, max_tokens: 1800, stream: false, response_format: { type: 'json_object' } }
}

export function createCloudProvider(config: CloudConfig): EvaluationProvider {
  const endpoint = cloudEndpoint(config)
  return {
    async evaluate(input, apiKey) {
      if (!apiKey?.trim()) throw new Error('Enter a session-only API key in Privacy & data before using cloud evaluation.')
      const body = cloudRequestBody(input, config)
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 90000)
      try {
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
        })
        if (!response.ok) throw new Error(`Cloud evaluation failed (HTTP ${response.status}). Check the endpoint, model, and session key; no scores were saved.`)
        const payload: unknown = await response.json()
        const choices = typeof payload === 'object' && payload !== null && 'choices' in payload ? payload.choices : undefined
        if (!Array.isArray(choices) || !choices.length) throw new Error('The endpoint returned no completion. No scores were saved.')
        const first: unknown = choices[0]
        if (typeof first !== 'object' || first === null || !('message' in first) || !('finish_reason' in first) || first.finish_reason !== 'stop') throw new Error('The cloud response was incomplete or refused. No scores were saved.')
        const message = first.message
        return parseFeedback(typeof message === 'object' && message !== null && 'content' in message ? message.content : undefined, input)
      } catch (error) {
        if (controller.signal.aborted) throw new Error('Cloud evaluation timed out. Your answer is still available for manual review.')
        if (error instanceof TypeError) throw new Error('Could not reach the cloud endpoint. Check its URL, browser CORS support, and your connection.')
        throw error
      } finally { window.clearTimeout(timeout) }
    },
  }
}

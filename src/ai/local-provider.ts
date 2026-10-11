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

export const LOCAL_MODEL_CACHE_EVICTED_MESSAGE = 'The local model cache is missing. Your browser may have evicted the downloaded model; prepare it again before retrying local evaluation.'
const LOCAL_MODEL_READY_MARKER = 'lingo-practice-local-model-ready'
type DiagnosticMode = 'unconstrained' | 'json' | 'json-prompt'
type StreamChunk = {
  choices: Array<{
    delta?: { content?: string | null }
    finish_reason?: string | null
  }>
}

function logLocalEvent(event: string, details: Record<string, unknown> = {}): void {
  if (import.meta.env.DEV) {
    console.info(`[local-provider] ${event} ${JSON.stringify(details)}`)
  }
}

function requestedDiagnosticMode(): DiagnosticMode | undefined {
  if (!import.meta.env.DEV || typeof location === 'undefined') {
    return undefined
  }
  const value = new URLSearchParams(location.search).get('localDiagnostic')
  return value === 'unconstrained' || value === 'json' || value === 'json-prompt' ? value : undefined
}

async function collectStream(stream: AsyncIterable<StreamChunk>, phase: string): Promise<string> {
  const startedAt = performance.now()
  let content = ''
  let chunks = 0
  let finishReason: string | null | undefined
  for await (const chunk of stream) {
    chunks += 1
    const delta = chunk.choices[0]?.delta?.content ?? ''
    content += delta
    finishReason = chunk.choices[0]?.finish_reason ?? finishReason
    logLocalEvent(phase + '.chunk', {
      chunks,
      deltaCharacters: delta.length,
      totalCharacters: content.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      finishReason,
    })
  }
  logLocalEvent(phase + '.complete', {
    chunks,
    characters: content.length,
    elapsedMs: Math.round(performance.now() - startedAt),
    finishReason,
  })
  return content
}

async function runRequestedDiagnostic(engine: WebWorkerMLCEngine, mode: DiagnosticMode): Promise<void> {
  const startedAt = performance.now()
  logLocalEvent('diagnostic.start', { mode })
  try {
    const stream = await engine.chat.completions.create(mode === 'json' || mode === 'json-prompt'
      ? {
          messages: [
            { role: 'system', content: 'Return only a JSON object.' },
            { role: 'user', content: 'Return exactly {"ok":true}.' },
          ],
          max_tokens: 32,
          temperature: 0,
          stream: true,
          ...(mode === 'json' ? { response_format: { type: 'json_object' as const } } : {}),
          extra_body: { enable_thinking: false },
        }
      : {
          messages: [{ role: 'user', content: 'Reply with exactly the word OK.' }],
          max_tokens: 8,
          temperature: 0,
          stream: true,
          extra_body: { enable_thinking: false },
        })
    const content = await collectStream(stream as AsyncIterable<StreamChunk>, 'diagnostic.' + mode)
    logLocalEvent('diagnostic.success', { mode, characters: content.length, elapsedMs: Math.round(performance.now() - startedAt) })
  } catch (error) {
    logLocalEvent('diagnostic.error', {
      mode,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function hadLocalModelReady(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODEL_READY_MARKER) === 'true'
  } catch {
    return false
  }
}

export function forgetLocalModelReady(): void {
  try {
    localStorage.removeItem(LOCAL_MODEL_READY_MARKER)
  } catch {
    return
  }
}

function createWorker(): Worker {
  return new Worker(new URL('./local-worker.ts', import.meta.url), { type: 'module' })
}

type WorkerProtocolMessage = {
  kind?: string
  uuid?: string
  content?: unknown
}

function summarizeWorkerMessage(message: WorkerProtocolMessage): Record<string, unknown> {
  const content = message.content
  const contentRecord = content && typeof content === 'object' ? content as Record<string, unknown> : undefined
  const request = contentRecord?.request && typeof contentRecord.request === 'object'
    ? contentRecord.request as Record<string, unknown>
    : undefined
  const responseFormat = request?.response_format && typeof request.response_format === 'object'
    ? request.response_format as Record<string, unknown>
    : undefined
  return {
    kind: message.kind,
    uuid: message.uuid,
    requestStream: request?.stream,
    responseFormat: responseFormat?.type,
    progress: contentRecord?.progress,
    progressText: contentRecord?.text,
    choices: Array.isArray(contentRecord?.choices) ? contentRecord.choices.length : undefined,
    finishReason: Array.isArray(contentRecord?.choices)
      ? (contentRecord.choices[0] as Record<string, unknown> | undefined)?.finish_reason
      : undefined,
    contentType: typeof content,
  }
}

function instrumentWorker(worker: Worker): void {
  const originalPostMessage = worker.postMessage.bind(worker)
  worker.postMessage = ((message: WorkerProtocolMessage, transfer?: Transferable[]) => {
    logLocalEvent('worker.outbound', summarizeWorkerMessage(message))
    originalPostMessage(message, transfer ?? [])
  }) as Worker['postMessage']
  worker.addEventListener('message', (event) => {
    logLocalEvent('worker.inbound', summarizeWorkerMessage(event.data as WorkerProtocolMessage))
  })
  worker.addEventListener('error', (event) => {
    logLocalEvent('worker.error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })
  worker.addEventListener('messageerror', () => {
    logLocalEvent('worker.message-error')
  })
}

export function createLocalProvider(
  modelId: typeof DEFAULT_LOCAL_MODEL_ID = DEFAULT_LOCAL_MODEL_ID,
  onProgress?: LocalModelProgressCallback,
): LocalProviderLike {
  let status: LocalModelProgress['status'] = 'not-prepared'
  let errorMessage: string | undefined
  let worker: Worker | undefined
  let enginePromise: Promise<WebWorkerMLCEngine> | undefined
  let diagnosticStarted = false

  const startRequestedDiagnostic = async (engine: WebWorkerMLCEngine) => {
    const mode = requestedDiagnosticMode()
    if (!mode || diagnosticStarted) {
      return
    }
    diagnosticStarted = true
    await runRequestedDiagnostic(engine, mode)
  }

  const report = (progress: LocalModelProgress) => {
    status = progress.status
    if (progress.error) {
      errorMessage = progress.error
    }
    if (progress.status === 'ready') {
      try {
        localStorage.setItem(LOCAL_MODEL_READY_MARKER, 'true')
      } catch {
        errorMessage = undefined
      }
    }
    onProgress?.(progress)
  }

  const provider: LocalProviderLike = {
    async prepare() {
      logLocalEvent('prepare.start', { status })
      if (status === 'ready') {
        if (await provider.isCached()) {
          if (enginePromise) {
            void startRequestedDiagnostic(await enginePromise)
          }
          logLocalEvent('prepare.cached-ready')
          return
        }
        status = 'not-prepared'
        errorMessage = LOCAL_MODEL_CACHE_EVICTED_MESSAGE
      }
      if (status === 'preparing' && enginePromise) {
        await enginePromise
        return
      }

      worker?.terminate()
      worker = createWorker()
      instrumentWorker(worker)
      logLocalEvent('prepare.worker-created')
      errorMessage = undefined
      report({ status: 'preparing', progress: 0, text: 'Starting the local model worker…' })
      enginePromise = CreateWebWorkerMLCEngine(worker, modelId, {
        appConfig: prebuiltAppConfig,
        initProgressCallback: (progress) => report({ status: 'preparing', progress: progress.progress, text: progress.text }),
      })

      try {
        await enginePromise
        report({ status: 'ready', progress: 1, text: 'Local model ready.' })
        logLocalEvent('prepare.engine-ready')
        void startRequestedDiagnostic(await enginePromise)
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
      if (!(await provider.isCached())) {
        report({ status: 'unavailable', error: LOCAL_MODEL_CACHE_EVICTED_MESSAGE, text: 'The local model cache is missing.' })
        throw new ProviderUnavailableError(LOCAL_MODEL_CACHE_EVICTED_MESSAGE)
      }
      const engine = await enginePromise
      const evaluationStartedAt = performance.now()
      logLocalEvent('evaluation.start', {
        sourceCharacters: input.exercise.sourceText.length,
        answerCharacters: input.learnerAnswer.length,
        maxTokens: 900,
        responseFormat: 'prompt-only-json',
      })
      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: evaluationSystemPrompt },
          { role: 'user', content: buildEvaluationPrompt(input) },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 900,
        stream: true,
        extra_body: { enable_thinking: false },
      })
      logLocalEvent('evaluation.stream-opened', { elapsedMs: Math.round(performance.now() - evaluationStartedAt) })
      const generated = await collectStream(response as AsyncIterable<StreamChunk>, 'evaluation')
      let raw: unknown
      try {
        raw = parseJsonResponse(generated)
      } catch (error) {
        logLocalEvent('evaluation.parse-error', {
          characters: generated.length,
          hasThinkingWrapper: /^\s*<think>[\s\S]*?<\/think>/i.test(generated),
          startsWithBrace: generated.trimStart().startsWith('{'),
          endsWithBrace: generated.trimEnd().endsWith('}'),
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
      const feedback = validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
      logLocalEvent('evaluation.validated', { elapsedMs: Math.round(performance.now() - evaluationStartedAt) })
      return feedback
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

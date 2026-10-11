import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type { EvaluationInput, LocalModelState } from '../domain/types'
import type { EvaluationProvider } from './provider'
import { evaluationMessages, parseFeedback } from './evaluation-prompt'

export const localModelId = 'Qwen3-1.7B-q4f16_1-MLC'
export interface LocalProvider extends EvaluationProvider {
  prepare(): Promise<void>
  dispose(): void
  getState(): LocalModelState
}

export function createLocalProvider(modelId = localModelId, onProgress?: (state: LocalModelState) => void): LocalProvider {
  let state: LocalModelState = { status: 'idle', progress: 0, message: 'Not prepared on this page.', cached: null }
  let engine: WebWorkerMLCEngine | undefined
  let worker: Worker | undefined
  let busy = false
  let preparation: Promise<void> | undefined
  let generation = 0
  let rejectWorker: ((error: Error) => void) | undefined
  function update(next: Partial<LocalModelState>) { state = { ...state, ...next }; onProgress?.(state) }
  function stop() { worker?.terminate(); worker = undefined; engine = undefined }
  async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
    let timeout: number | undefined
    const failure = new Promise<never>((_resolve, reject) => {
      rejectWorker = reject
      timeout = window.setTimeout(() => reject(new Error('Local AI timed out. Prepare the model again, or review manually.')), milliseconds)
    })
    try { return await Promise.race([operation, failure]) } finally { window.clearTimeout(timeout); rejectWorker = undefined }
  }
  return {
    getState: () => state,
    dispose() { generation++; rejectWorker?.(new Error('Local model was stopped.')); stop(); update({ status: 'idle', progress: 0, message: 'Model released from memory.' }) },
    prepare() {
      if (preparation) return preparation
      if (state.status === 'ready') return Promise.resolve()
      const preparingGeneration = generation
      function checkActive() { if (preparingGeneration !== generation) throw new Error('Local model preparation was cancelled.') }
      preparation = (async () => {
        update({ status: 'checking', progress: 0, message: 'Checking WebGPU and model cache…' })
        try {
          if (modelId !== localModelId) throw new Error('This release supports only Qwen3 1.7B for local evaluation.')
          if (!window.isSecureContext || !('gpu' in navigator)) throw new Error('Local AI requires WebGPU in a secure browser context. Your answer can still be reviewed manually.')
          const gpu = navigator.gpu as { requestAdapter(): Promise<{ features: { has(feature: string): boolean } } | null> }
          const adapter = await gpu.requestAdapter()
          checkActive()
          if (!adapter || !adapter.features.has('shader-f16')) throw new Error('This device does not expose the WebGPU features needed by this model. Manual review remains available.')
          const webllm = await import('@mlc-ai/web-llm')
          checkActive()
          const cached = await webllm.hasModelInCache(modelId).catch(() => false)
          checkActive()
          update({ status: 'downloading', cached, message: cached ? 'Cached model weights found; loading runtime assets…' : 'Downloading model assets. Keep this page open…' })
          worker = new Worker(new URL('./local-worker.ts', import.meta.url), { type: 'module' })
          worker.addEventListener('error', (event) => { event.preventDefault(); rejectWorker?.(new Error('The local model worker failed. Prepare it again or review manually.')); stop(); update({ status: 'error', message: 'The local model worker failed. Prepare it again or review manually.' }) })
          engine = await bounded(webllm.CreateWebWorkerMLCEngine(worker, modelId, {
            logLevel: 'SILENT',
            initProgressCallback: (report) => update({ progress: Math.min(1, Math.max(0, report.progress)), message: report.text }),
          }), 600000)
          const cacheConfirmed = await webllm.hasModelInCache(modelId).catch(() => false)
          checkActive()
          update({ status: 'ready', progress: 1, cached: cacheConfirmed, message: 'Model loaded on this device. Assessment quality varies by language and passage.' })
        } catch (error) {
          stop()
          if (preparingGeneration === generation) update({ status: 'error', message: error instanceof Error ? error.message : 'Could not prepare local AI. Try again or review manually.' })
          throw error
        }
      })().finally(() => { preparation = undefined })
      return preparation
    },
    async evaluate(input: EvaluationInput) {
      const messages = evaluationMessages(input)
      if (!engine || state.status !== 'ready') throw new Error(state.message || 'Prepare the local model before evaluating.')
      if (busy) throw new Error('Local AI is already evaluating another answer. Please wait.')
      // The pinned model has a 4,096-token context. Token density varies by script;
      // reject long text conservatively and let runtime context errors surface.
      if (input.exercise.sourceText.length + input.learnerAnswer.length > 4000) throw new Error('This passage and answer are too long for the local model. Review manually or use a consented cloud evaluator.')
      const evaluationGeneration = generation
      busy = true
      try {
        const completion = await bounded(engine.chat.completions.create({ messages, temperature: 0.2, max_tokens: 1500, stream: false, response_format: { type: 'json_object' }, extra_body: { enable_thinking: false } }), 180000)
        if (completion.choices[0]?.finish_reason !== 'stop') throw new Error('Local feedback was incomplete. No scores were saved; try a shorter answer or review manually.')
        return parseFeedback(completion.choices[0]?.message.content, input)
      } catch (error) {
        stop()
        if (evaluationGeneration === generation) update({ status: 'error', message: 'Local evaluation failed. Prepare the model again to retry; manual review remains available.' })
        throw error
      } finally { busy = false }
    },
  }
}

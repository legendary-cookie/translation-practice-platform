export class LocalEvaluationCancelledError extends Error {
  constructor(message = 'Local evaluation was cancelled because the active practice task changed.') {
    super(message)
    this.name = 'LocalEvaluationCancelledError'
  }
}

export type LocalEvaluationAttempt = {
  readonly id: number
  readonly signal: AbortSignal
  isCurrent(): boolean
  throwIfCancelled(): void
  finish(): void
}

type ActiveAttempt = {
  id: number
  controller: AbortController
  onCancel?: (error: LocalEvaluationCancelledError) => void
}

export function createLocalEvaluationLifecycle() {
  let nextId = 0
  let active: ActiveAttempt | undefined

  return {
    begin(onCancel?: (error: LocalEvaluationCancelledError) => void): LocalEvaluationAttempt | undefined {
      if (active) return undefined
      const current: ActiveAttempt = { id: ++nextId, controller: new AbortController(), onCancel }
      active = current
      return {
        id: current.id,
        signal: current.controller.signal,
        isCurrent: () => active === current,
        throwIfCancelled() {
          if (!current.controller.signal.aborted) return
          const reason = current.controller.signal.reason
          throw reason instanceof LocalEvaluationCancelledError ? reason : new LocalEvaluationCancelledError()
        },
        finish() {
          if (active === current) active = undefined
        },
      }
    },

    cancelActive(message?: string): boolean {
      const current = active
      if (!current) return false
      active = undefined
      const error = new LocalEvaluationCancelledError(message)
      current.controller.abort(error)
      current.onCancel?.(error)
      return true
    },
  }
}

export type LocalEngineIdentity = { generation: number; worker: object | undefined }

export function isLocalEngineGenerationCurrent(expected: LocalEngineIdentity, current: LocalEngineIdentity): boolean {
  return expected.generation === current.generation && expected.worker === current.worker
}

export function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void operation.catch(() => undefined)
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new LocalEvaluationCancelledError())
  }
  let onAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new LocalEvaluationCancelledError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  return Promise.race([operation, cancelled]).finally(() => {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  })
}

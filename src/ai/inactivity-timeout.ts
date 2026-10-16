export type InactivityDeadline = {
  reset(): void
  cancel(): void
  wrap<T>(operation: Promise<T>): Promise<T>
}

export function createInactivityDeadline(
  timeoutMs: number,
  onTimeout: () => void,
  message: string,
): InactivityDeadline {
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectTimeout: ((error: Error) => void) | undefined
  let expired = false
  let closed = false
  const timeout = new Promise<never>((_, reject) => { rejectTimeout = reject })

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const cancel = () => {
    closed = true
    clearTimer()
  }
  const reset = () => {
    if (expired || closed) return
    clearTimer()
    timer = setTimeout(() => {
      expired = true
      try {
        onTimeout()
      } catch {
        // A cleanup callback must not prevent the bounded operation from rejecting.
      }
      rejectTimeout?.(new Error(message))
    }, timeoutMs)
  }
  reset()

  return {
    reset,
    cancel,
    wrap<T>(operation: Promise<T>): Promise<T> {
      return Promise.race([operation, timeout]).finally(cancel)
    },
  }
}

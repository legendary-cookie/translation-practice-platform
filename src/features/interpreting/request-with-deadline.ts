export async function requestWithDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T> | T,
  timeoutMs: number,
  timeoutMessage: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  let removeParentAbort: () => void = () => undefined

  const interrupted = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(timeoutMessage)
      reject(error)
      controller.abort(error)
    }, timeoutMs)

    if (parentSignal) {
      const abortFromParent = () => {
        const error = parentSignal.reason instanceof Error
          ? parentSignal.reason
          : new DOMException('The request was canceled.', 'AbortError')
        reject(error)
        controller.abort(error)
      }
      if (parentSignal.aborted) abortFromParent()
      else {
        parentSignal.addEventListener('abort', abortFromParent, { once: true })
        removeParentAbort = () => parentSignal.removeEventListener('abort', abortFromParent)
      }
    }
  })

  const request = Promise.resolve().then(() => operation(controller.signal))
  try {
    return await Promise.race([request, interrupted])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    removeParentAbort()
  }
}

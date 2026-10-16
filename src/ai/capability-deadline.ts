/** Resolve a capability probe to a safe fallback if a browser API never settles. */
export function withCapabilityDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      try {
        resolve(onTimeout())
      } catch (error) {
        reject(error)
      }
    }, timeoutMs)
  })

  return Promise.race([operation, deadline]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  })
}

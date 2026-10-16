export type InterpretingSessionOpenAttempt = {
  openGeneration: number
  dataGeneration: number
}

export type InterpretingSessionOpenState = {
  openGeneration: number
  dataGeneration: number
  page: string
}

export type InterpretingSessionOpenRequest = {
  sessionId: string
  requestGeneration: number
}

export function createInterpretingSessionOpenGuard() {
  let generation = 0
  const latestRequests = new Map<string, number>()
  const deletingSessionCounts = new Map<string, number>()

  return {
    beginOpen(sessionId: string): InterpretingSessionOpenRequest | undefined {
      if ((deletingSessionCounts.get(sessionId) ?? 0) > 0) return undefined
      generation += 1
      latestRequests.set(sessionId, generation)
      return { sessionId, requestGeneration: generation }
    },
    beginDelete(sessionId: string): void {
      deletingSessionCounts.set(sessionId, (deletingSessionCounts.get(sessionId) ?? 0) + 1)
      generation += 1
      latestRequests.set(sessionId, generation)
    },
    finishDelete(sessionId: string): void {
      const pendingDeletes = deletingSessionCounts.get(sessionId) ?? 0
      if (pendingDeletes > 1) {
        deletingSessionCounts.set(sessionId, pendingDeletes - 1)
        return
      }
      deletingSessionCounts.delete(sessionId)
      generation += 1
      latestRequests.delete(sessionId)
    },
    isCurrent(request: InterpretingSessionOpenRequest | undefined): request is InterpretingSessionOpenRequest {
      return request !== undefined
        && (deletingSessionCounts.get(request.sessionId) ?? 0) === 0
        && latestRequests.get(request.sessionId) === request.requestGeneration
    },
  }
}

export function isInterpretingOpenCurrent(
  attempt: InterpretingSessionOpenAttempt,
  current: InterpretingSessionOpenState,
): boolean {
  return attempt.openGeneration === current.openGeneration
    && attempt.dataGeneration === current.dataGeneration
    && current.page === 'progress'
}

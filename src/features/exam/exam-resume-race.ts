export type ExamResumeAttempt = {
  runId: string
  generation: number
}

export function createExamResumeRequestGuard() {
  const latestByRun = new Map<string, number>()

  return {
    begin(runId: string): ExamResumeAttempt {
      const generation = (latestByRun.get(runId) ?? 0) + 1
      latestByRun.set(runId, generation)
      return { runId, generation }
    },
    invalidateForDiscard(runId: string): void {
      latestByRun.set(runId, (latestByRun.get(runId) ?? 0) + 1)
    },
    isCurrent(attempt: ExamResumeAttempt): boolean {
      return latestByRun.get(attempt.runId) === attempt.generation
    },
  }
}

export async function claimExamRunForResumeIfCurrent<TLock, TRun>(options: {
  acquireLock: () => Promise<TLock>
  claimRun: () => Promise<TRun>
  isCurrent: () => boolean
  releaseLock: (lock: TLock) => void
}): Promise<{ status: 'stale' } | { status: 'claimed'; lock: TLock; run: TRun }> {
  let lock: TLock | undefined
  let lockReleased = false
  const releaseAcquiredLock = () => {
    if (lock === undefined || lockReleased) return
    lockReleased = true
    options.releaseLock(lock)
  }

  try {
    lock = await options.acquireLock()
    if (!options.isCurrent()) {
      releaseAcquiredLock()
      return { status: 'stale' }
    }

    const run = await options.claimRun()
    if (!options.isCurrent()) {
      releaseAcquiredLock()
      return { status: 'stale' }
    }

    return { status: 'claimed', lock, run }
  } catch (error) {
    releaseAcquiredLock()
    throw error
  }
}

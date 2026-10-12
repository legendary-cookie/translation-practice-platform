export const EXAM_RUN_RECOVERY_KEY_PREFIX = 'lingo-practice-exam-run-recovery-v1:'
export const EXAM_RUN_TOMBSTONE_KEY_PREFIX = 'lingo-practice-exam-run-discarded-v1:'

export class ExamRunDiscardedError extends Error {
  constructor(runId: string) {
    super(`Exam attempt ${runId} was discarded in another tab and cannot be saved again.`)
    this.name = 'ExamRunDiscardedError'
  }
}

export function examRunRecoveryKey(runId: string): string {
  return `${EXAM_RUN_RECOVERY_KEY_PREFIX}${runId}`
}

export function examRunTombstoneKey(runId: string): string {
  return `${EXAM_RUN_TOMBSTONE_KEY_PREFIX}${runId}`
}

export function isExamRunDiscarded(storage: Pick<Storage, 'getItem'>, runId: string): boolean {
  return storage.getItem(examRunTombstoneKey(runId)) !== null
}

export async function assertExamRunNotDiscarded(
  storage: Pick<Storage, 'getItem'>,
  runId: string,
): Promise<void> {
  if (isExamRunDiscarded(storage, runId)) throw new ExamRunDiscardedError(runId)
}

export async function discardExamRunWithTombstone(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  runId: string,
  deleteRun: () => Promise<void>,
): Promise<void> {
  const tombstoneKey = examRunTombstoneKey(runId)
  const recoveryKey = examRunRecoveryKey(runId)
  const previousTombstone = storage.getItem(tombstoneKey)
  const recoverySnapshot = storage.getItem(recoveryKey)
  storage.setItem(tombstoneKey, 'true')

  try {
    storage.removeItem(recoveryKey)
    await deleteRun()
  } catch (error) {
    try {
      if (previousTombstone === null) storage.removeItem(tombstoneKey)
      else storage.setItem(tombstoneKey, previousTombstone)
      if (recoverySnapshot !== null) storage.setItem(recoveryKey, recoverySnapshot)
    } catch {
      // If rollback itself is blocked, keep the tombstone fail-closed rather than
      // allowing an old tab to resurrect the attempt from its recovery journal.
    }
    throw error
  }
}

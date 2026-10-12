import type { ActiveExamRun, ConsolidatedExamResult } from '../domain/types'

export const EXAM_RUN_RECOVERY_KEY_PREFIX = 'lingo-practice-exam-run-recovery-v1:'
export const EXAM_RUN_TOMBSTONE_KEY_PREFIX = 'lingo-practice-exam-run-discarded-v1:'

export type ExamRunLifecycleStore = {
  getInProgressRuns(): Promise<ActiveExamRun[]>
  getCompletedRunIds(): Promise<string[]>
  getCompletedResult(runId: string): Promise<ConsolidatedExamResult | undefined>
  putRun(run: ActiveExamRun): Promise<unknown>
  putResult(result: ConsolidatedExamResult): Promise<unknown>
  deleteRun(runId: string): Promise<unknown>
}

export type ExamRunLifecycleTransaction = <T>(
  operation: (store: ExamRunLifecycleStore) => Promise<T>,
) => Promise<T>

export class ExamRunCompletedError extends Error {
  constructor(runId: string) {
    super(`Exam attempt ${runId} is already completed and cannot be saved again.`)
    this.name = 'ExamRunCompletedError'
  }
}

export class ExamRunSlotOccupiedError extends Error {
  constructor(runId: string) {
    super(`Exam attempt ${runId} is already the active local simulation.`)
    this.name = 'ExamRunSlotOccupiedError'
  }
}

export async function assertExamRunNotCompletedInTransaction(
  store: ExamRunLifecycleStore,
  runId: string,
): Promise<void> {
  if (await store.getCompletedResult(runId)) throw new ExamRunCompletedError(runId)
}

export async function assertExamRunNotCompleted(
  runId: string,
  transaction: ExamRunLifecycleTransaction,
): Promise<void> {
  await transaction((store) => assertExamRunNotCompletedInTransaction(store, runId))
}

export async function claimExamRunSlot(
  candidate: ActiveExamRun,
  transaction: ExamRunLifecycleTransaction,
  recoveryRuns: ActiveExamRun[] = [],
): Promise<{ run: ActiveExamRun; created: boolean }> {
  return transaction(async (store) => {
    const [persistedRuns, completedRunIds] = await Promise.all([
      store.getInProgressRuns(),
      store.getCompletedRunIds(),
    ])
    const completed = new Set(completedRunIds)
    const runsById = new Map<string, ActiveExamRun>()
    for (const run of [...persistedRuns, ...recoveryRuns]) {
      if (run.status !== 'in-progress' || completed.has(run.id)) continue
      const previous = runsById.get(run.id)
      if (!previous || Date.parse(run.lastSavedAt) >= Date.parse(previous.lastSavedAt)) {
        runsById.set(run.id, run)
      }
    }
    const activeRun = [...runsById.values()].sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))[0]
    if (activeRun) {
      const persisted = persistedRuns.find((run) => run.id === activeRun.id)
      if (!persisted || Date.parse(activeRun.lastSavedAt) > Date.parse(persisted.lastSavedAt)) {
        await store.putRun(activeRun)
      }
      return { run: activeRun, created: false }
    }

    await store.putRun(candidate)
    return { run: candidate, created: true }
  })
}

export async function assertExamRunSlotAvailableInTransaction(
  store: ExamRunLifecycleStore,
  runId: string,
): Promise<void> {
  const [inProgressRuns, completedRunIds] = await Promise.all([
    store.getInProgressRuns(),
    store.getCompletedRunIds(),
  ])
  const completed = new Set(completedRunIds)
  const activeRuns = inProgressRuns.filter((run) => !completed.has(run.id))
  if (activeRuns.some((run) => run.id === runId)) return
  if (activeRuns.length > 0) throw new ExamRunSlotOccupiedError(activeRuns[0].id)
}

export async function stageExamRunRecoveryAtomically(
  run: ActiveExamRun,
  transaction: ExamRunLifecycleTransaction,
  writeRecoverySnapshot: () => void,
): Promise<void> {
  await transaction(async (store) => {
    await assertExamRunNotCompletedInTransaction(store, run.id)
    await assertExamRunSlotAvailableInTransaction(store, run.id)
    writeRecoverySnapshot()
  })
}

export async function completeExamRunAtomically(
  runId: string,
  result: ConsolidatedExamResult,
  transaction: ExamRunLifecycleTransaction,
): Promise<ConsolidatedExamResult> {
  return transaction(async (store) => {
    const existingResult = await store.getCompletedResult(runId)
    const completedResult = existingResult ?? result
    if (!existingResult) await store.putResult(result)
    await store.deleteRun(runId)
    return completedResult
  })
}

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

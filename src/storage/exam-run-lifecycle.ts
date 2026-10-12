import type { ActiveExamRun, ConsolidatedExamResult } from '../domain/types'
import {
  EXAM_RUN_RECOVERY_KEY_PREFIX,
  EXAM_RUN_TOMBSTONE_KEY_PREFIX,
  clearExamRunEditorLease,
  ExamRunEditorLeaseLostError,
  ExamRunEditorRevisionError,
  examRunRecoveryKey,
  examRunTombstoneKey,
  reconcileExamRunRecoverySnapshot,
} from './exam-run-editor'

export { EXAM_RUN_RECOVERY_KEY_PREFIX, EXAM_RUN_TOMBSTONE_KEY_PREFIX, examRunRecoveryKey, examRunTombstoneKey }

export type ExamRunLifecycleStore = {
  getRun(runId: string): Promise<ActiveExamRun | undefined>
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
  onCreated?: (run: ActiveExamRun) => void,
): Promise<{ run: ActiveExamRun; created: boolean }> {
  return transaction(async (store) => {
    const [persistedRuns, completedRunIds] = await Promise.all([
      store.getInProgressRuns(),
      store.getCompletedRunIds(),
    ])
    const completed = new Set(completedRunIds)
    const runsById = new Map(persistedRuns
      .filter((run) => run.status === 'in-progress' && !completed.has(run.id))
      .map((run) => [run.id, run]))
    for (const snapshot of recoveryRuns) {
      if (snapshot.status !== 'in-progress' || completed.has(snapshot.id)) continue
      const persisted = runsById.get(snapshot.id)
      if (persisted) {
        const reconciled = reconcileExamRunRecoverySnapshot(persisted, [snapshot])
        if (reconciled && reconciled !== persisted) runsById.set(snapshot.id, reconciled)
      } else if (!snapshot.editorToken) {
        // Preserve legacy journal-only attempts created before editor leases existed.
        runsById.set(snapshot.id, snapshot)
      }
    }
    const activeRun = [...runsById.values()].sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))[0]
    if (activeRun) {
      const persisted = persistedRuns.find((run) => run.id === activeRun.id)
      if (!persisted || (activeRun.revision ?? 0) > (persisted.revision ?? 0)
        || Date.parse(activeRun.lastSavedAt) > Date.parse(persisted.lastSavedAt)) {
        await store.putRun(activeRun)
      }
      return { run: activeRun, created: false }
    }

    onCreated?.(candidate)
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
    const persisted = await store.getRun(run.id)
    if (run.editorToken
      ? !persisted || persisted.status !== 'in-progress' || persisted.editorToken !== run.editorToken
      : Boolean(persisted?.editorToken)) {
      throw new ExamRunEditorLeaseLostError(run.id)
    }
    if ((persisted?.revision ?? 0) > (run.revision ?? 0)) {
      throw new ExamRunEditorRevisionError(run.id)
    }
    writeRecoverySnapshot()
  })
}

export async function completeExamRunAtomically(
  runId: string,
  result: ConsolidatedExamResult,
  transaction: ExamRunLifecycleTransaction,
  editor?: { token: string; revision: number },
): Promise<ConsolidatedExamResult> {
  return transaction(async (store) => {
    if (editor) {
      const current = await store.getRun(runId)
      if (!current || current.status !== 'in-progress' || current.editorToken !== editor.token) {
        throw new ExamRunEditorLeaseLostError(runId)
      }
      if ((current.revision ?? 0) !== editor.revision) throw new ExamRunEditorRevisionError(runId)
    }
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
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>,
  runId: string,
  deleteRun: () => Promise<void>,
): Promise<void> {
  const tombstoneKey = examRunTombstoneKey(runId)
  const previousTombstone = storage.getItem(tombstoneKey)
  const recoveryPrefix = `${EXAM_RUN_RECOVERY_KEY_PREFIX}${runId}`
  const recoverySnapshots: Array<[string, string]> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key === recoveryPrefix || key?.startsWith(`${recoveryPrefix}:`)) {
      const value = storage.getItem(key)
      if (value !== null) recoverySnapshots.push([key, value])
    }
  }
  storage.setItem(tombstoneKey, 'true')

  try {
    for (const [key] of recoverySnapshots) storage.removeItem(key)
    await deleteRun()
    clearExamRunEditorLease(storage, runId)
  } catch (error) {
    try {
      if (previousTombstone === null) storage.removeItem(tombstoneKey)
      else storage.setItem(tombstoneKey, previousTombstone)
      for (const [key, value] of recoverySnapshots) storage.setItem(key, value)
    } catch {
      // If rollback itself is blocked, keep the tombstone fail-closed rather than
      // allowing an old tab to resurrect the attempt from its recovery journal.
    }
    throw error
  }
}

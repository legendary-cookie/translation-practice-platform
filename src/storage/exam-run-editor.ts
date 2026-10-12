import type { ActiveExamRun } from '../domain/types'

export const EXAM_RUN_RECOVERY_KEY_PREFIX = 'lingo-practice-exam-run-recovery-v1:'
export const EXAM_RUN_TOMBSTONE_KEY_PREFIX = 'lingo-practice-exam-run-discarded-v1:'
export const EXAM_RUN_EDITOR_KEY_PREFIX = 'lingo-practice-exam-run-editor-v1:'
export const EXAM_RUN_COMPLETION_KEY_PREFIX = 'lingo-practice-exam-run-completed-v1:'
export const EXAM_RUN_EDITOR_SESSION_TOKEN_KEY = 'lingo-practice-exam-editor-session-v1'
export const EXAM_RUN_EDITOR_TAB_LOCK_NAME = 'lingo-practice-exam-editor-tab-v1'
export const EXAM_RUN_EDITOR_LEASE_MS = 30_000
export const EXAM_RUN_EDITOR_HEARTBEAT_MS = 5_000

export type ExamRunEditorLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<T>,
  ): Promise<T>
}

export type ExamRunEditorTabLock = { release: () => void }

type EditorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

type EditorRunStore = {
  getRun(runId: string): Promise<ActiveExamRun | undefined>
  getCompletedResult(runId: string): Promise<unknown>
  putRun(run: ActiveExamRun): Promise<unknown>
}

export type EditorRunTransaction = <T>(operation: (store: EditorRunStore) => Promise<T>) => Promise<T>

export class ExamRunEditorOwnedError extends Error {
  constructor(runId: string) {
    super(`Exam attempt ${runId} is currently being edited in another tab.`)
    this.name = 'ExamRunEditorOwnedError'
  }
}

export class ExamRunEditorLeaseLostError extends Error {
  constructor(runId: string) {
    super(`This tab no longer owns exam attempt ${runId}; its changes were not written over the current owner's work.`)
    this.name = 'ExamRunEditorLeaseLostError'
  }
}

export class ExamRunEditorRevisionError extends Error {
  constructor(runId: string) {
    super(`A newer revision of exam attempt ${runId} is already stored.`)
    this.name = 'ExamRunEditorRevisionError'
  }
}

export class ExamRunRecoveryCheckpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExamRunRecoveryCheckpointError'
  }
}

export class ExamRunEditorLocksUnavailableError extends Error {
  constructor() {
    super('Safe exam editing requires browser Web Locks support. Use an updated browser to start or resume an exam; written and interpreting practice remain available.')
    this.name = 'ExamRunEditorLocksUnavailableError'
  }
}

export function examRunRecoveryKey(runId: string, editorToken?: string): string {
  const suffix = editorToken === undefined ? '' : `:${encodeURIComponent(editorToken)}`
  return `${EXAM_RUN_RECOVERY_KEY_PREFIX}${runId}${suffix}`
}

export function examRunTombstoneKey(runId: string): string {
  return `${EXAM_RUN_TOMBSTONE_KEY_PREFIX}${runId}`
}

export function editorLeaseKey(runId: string): string {
  return `${EXAM_RUN_EDITOR_KEY_PREFIX}${runId}`
}

export function examRunCompletionKey(runId: string): string {
  return `${EXAM_RUN_COMPLETION_KEY_PREFIX}${runId}`
}

export function createExamRunEditorToken(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function readOrCreateExamRunEditorToken(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const existing = storage.getItem(EXAM_RUN_EDITOR_SESSION_TOKEN_KEY)
  if (existing?.trim()) return existing
  const token = createExamRunEditorToken()
  storage.setItem(EXAM_RUN_EDITOR_SESSION_TOKEN_KEY, token)
  return token
}

export function acquireExamRunEditorTabLock(
  runId: string,
  lockManager: ExamRunEditorLockManager | undefined,
): Promise<ExamRunEditorTabLock> {
  if (!lockManager) return Promise.reject(new ExamRunEditorLocksUnavailableError())

  return new Promise((resolve, reject) => {
    let acquired = false
    let releaseLock: (() => void) | undefined
    const lockHeld = new Promise<void>((release) => { releaseLock = release })
    const request = lockManager.request(
      EXAM_RUN_EDITOR_TAB_LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) {
          reject(new ExamRunEditorOwnedError(runId))
          return
        }
        acquired = true
        let released = false
        resolve({
          release: () => {
            if (released) return
            released = true
            releaseLock?.()
          },
        })
        await lockHeld
      },
    )
    void request.catch((error) => {
      if (!acquired) reject(error)
    })
  })
}

function leaseExpiry(run: ActiveExamRun): number {
  return run.editorLeaseExpiresAt ? Date.parse(run.editorLeaseExpiresAt) : Number.NEGATIVE_INFINITY
}

function incrementRevision(run: ActiveExamRun): number {
  return Math.max(0, run.revision ?? 0) + 1
}

export async function claimExamRunEditor(
  runId: string,
  editorToken: string,
  transaction: EditorRunTransaction,
  nowMs = Date.now(),
  recoverySnapshots: ActiveExamRun[] = [],
  leaseMs = EXAM_RUN_EDITOR_LEASE_MS,
  onClaim?: (run: ActiveExamRun) => void,
): Promise<ActiveExamRun> {
  return transaction(async (store) => {
    if (await store.getCompletedResult(runId)) throw new ExamRunEditorLeaseLostError(runId)
    const persisted = await store.getRun(runId)
    if (!persisted || persisted.status !== 'in-progress') throw new ExamRunEditorLeaseLostError(runId)
    const current = reconcileExamRunRecoverySnapshot(persisted, recoverySnapshots)
    if (!current) throw new ExamRunEditorLeaseLostError(runId)
    if (current.editorToken && current.editorToken !== editorToken && leaseExpiry(current) > nowMs) {
      throw new ExamRunEditorOwnedError(runId)
    }

    const sameOwner = current.editorToken === editorToken
    const claimed: ActiveExamRun = {
      ...current,
      editorToken,
      editorLeaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
      revision: sameOwner ? Math.max(0, current.revision ?? 0) : incrementRevision(current),
    }
    onClaim?.(claimed)
    await store.putRun(claimed)
    return claimed
  })
}

export async function renewExamRunEditorLease(
  runId: string,
  editorToken: string,
  transaction: EditorRunTransaction,
  nowMs = Date.now(),
  leaseMs = EXAM_RUN_EDITOR_LEASE_MS,
  onRenew?: (run: ActiveExamRun) => void,
): Promise<ActiveExamRun> {
  return transaction(async (store) => {
    const current = await store.getRun(runId)
    if (!current || current.status !== 'in-progress' || current.editorToken !== editorToken) {
      throw new ExamRunEditorLeaseLostError(runId)
    }
    if (leaseExpiry(current) <= nowMs) throw new ExamRunEditorLeaseLostError(runId)
    const renewed = { ...current, editorLeaseExpiresAt: new Date(nowMs + leaseMs).toISOString() }
    onRenew?.(renewed)
    await store.putRun(renewed)
    return renewed
  })
}

export async function saveExamRunWithEditor(
  run: ActiveExamRun,
  transaction: EditorRunTransaction,
  nowMs = Date.now(),
  leaseMs = EXAM_RUN_EDITOR_LEASE_MS,
  onSave?: (run: ActiveExamRun) => void,
): Promise<ActiveExamRun> {
  return transaction(async (store) => {
    const current = await store.getRun(run.id)
    if (!current || current.status !== 'in-progress' || !run.editorToken || current.editorToken !== run.editorToken) {
      throw new ExamRunEditorLeaseLostError(run.id)
    }
    if (leaseExpiry(current) <= nowMs) throw new ExamRunEditorLeaseLostError(run.id)
    const currentRevision = Math.max(0, current.revision ?? 0)
    const incomingRevision = Math.max(0, run.revision ?? 0)
    if (incomingRevision < currentRevision) throw new ExamRunEditorRevisionError(run.id)
    if (incomingRevision === currentRevision) {
      const comparable = (candidate: ActiveExamRun) => {
        const { editorLeaseExpiresAt: _lease, ...rest } = candidate
        return JSON.stringify(rest)
      }
      if (comparable(run) !== comparable(current)) throw new ExamRunEditorRevisionError(run.id)
      return current
    }
    const saved = {
      ...run,
      editorLeaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
    }
    onSave?.(saved)
    await store.putRun(saved)
    return saved
  })
}

export async function releaseExamRunEditor(
  run: ActiveExamRun,
  transaction: EditorRunTransaction,
  onRelease?: (run: ActiveExamRun) => void,
): Promise<ActiveExamRun> {
  return transaction(async (store) => {
    const current = await store.getRun(run.id)
    if (!current || current.status !== 'in-progress' || !run.editorToken || current.editorToken !== run.editorToken) {
      throw new ExamRunEditorLeaseLostError(run.id)
    }
    const currentRevision = Math.max(0, current.revision ?? 0)
    const incomingRevision = Math.max(0, run.revision ?? 0)
    if (incomingRevision < currentRevision) throw new ExamRunEditorRevisionError(run.id)
    const released = {
      ...run,
      revision: incomingRevision,
      editorToken: undefined,
      editorLeaseExpiresAt: undefined,
    }
    onRelease?.(released)
    await store.putRun(released)
    return released
  })
}

export function reconcileExamRunRecoverySnapshot(
  persisted: ActiveExamRun,
  snapshots: ActiveExamRun[],
  options: { completed?: boolean; discarded?: boolean } = {},
): ActiveExamRun | undefined {
  if (options.completed || options.discarded || persisted.status !== 'in-progress') return undefined
  const matchingSnapshots = snapshots.filter((snapshot) => {
    if (snapshot.id !== persisted.id || snapshot.status !== 'in-progress') return false
    if (persisted.editorToken !== undefined) return snapshot.editorToken === persisted.editorToken
    return snapshot.editorToken === undefined
  })
  const newer = matchingSnapshots
    .filter((snapshot) => (snapshot.revision ?? 0) > (persisted.revision ?? 0))
    .sort((left, right) => (right.revision ?? 0) - (left.revision ?? 0))[0]
  if (newer) {
    return { ...newer, editorLeaseExpiresAt: persisted.editorLeaseExpiresAt ?? newer.editorLeaseExpiresAt }
  }
  if (persisted.editorToken === undefined) {
    const legacy = matchingSnapshots.find((snapshot) =>
      (snapshot.revision ?? 0) === (persisted.revision ?? 0)
      && Date.parse(snapshot.lastSavedAt) > Date.parse(persisted.lastSavedAt))
    if (legacy) return legacy
  }
  return persisted
}

export function publishExamRunEditorLease(storage: EditorStorage, run: ActiveExamRun): string {
  if (!run.editorToken || !run.editorLeaseExpiresAt) throw new ExamRunEditorLeaseLostError(run.id)
  const key = editorLeaseKey(run.id)
  storage.setItem(key, JSON.stringify({ editorToken: run.editorToken, expiresAt: run.editorLeaseExpiresAt }))
  return key
}

export function clearExamRunEditorLease(storage: EditorStorage, runId: string): void {
  storage.removeItem(editorLeaseKey(runId))
}

export function writeExamRunRecoveryCheckpointSynchronously(
  run: ActiveExamRun,
  options: {
    storage: EditorStorage
    nowMs?: number
    isDataEpochCurrent: () => boolean
  },
): string {
  const { storage } = options
  const nowMs = options.nowMs ?? Date.now()
  if (!options.isDataEpochCurrent()) {
    throw new ExamRunRecoveryCheckpointError('Local data changed in another tab; the exam recovery checkpoint was not written.')
  }
  if (!run.editorToken) throw new ExamRunEditorLeaseLostError(run.id)
  if (storage.getItem(examRunTombstoneKey(run.id)) !== null) throw new ExamRunRecoveryCheckpointError('This exam attempt was discarded and cannot be checkpointed.')
  if (storage.getItem(examRunCompletionKey(run.id)) !== null) throw new ExamRunRecoveryCheckpointError('This exam attempt is completed and cannot be checkpointed.')
  const serializedLease = storage.getItem(editorLeaseKey(run.id))
  let lease: { editorToken?: unknown; expiresAt?: unknown } | undefined
  try { lease = serializedLease ? JSON.parse(serializedLease) as typeof lease : undefined } catch { lease = undefined }
  if (lease?.editorToken !== run.editorToken || typeof lease.expiresAt !== 'string' || Date.parse(lease.expiresAt) <= nowMs) {
    throw new ExamRunEditorLeaseLostError(run.id)
  }

  const key = examRunRecoveryKey(run.id, run.editorToken)
  const existing = storage.getItem(key)
  if (existing) {
    let snapshot: ActiveExamRun | undefined
    try {
      snapshot = JSON.parse(existing) as ActiveExamRun
    } catch {
      // Replace a corrupt snapshot with the current in-memory run.
    }
    if (snapshot) {
      if ((snapshot.revision ?? 0) > (run.revision ?? 0)) return key
      if ((snapshot.revision ?? 0) === (run.revision ?? 0)) {
        const withoutLease = (candidate: ActiveExamRun) => {
          const { editorLeaseExpiresAt: _lease, ...rest } = candidate
          return JSON.stringify(rest)
        }
        if (withoutLease(snapshot) !== withoutLease(run)) {
          throw new ExamRunEditorRevisionError(run.id)
        }
        return key
      }
    }
  }
  storage.setItem(key, JSON.stringify(run))
  return key
}

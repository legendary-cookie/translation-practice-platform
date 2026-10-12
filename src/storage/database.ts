import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  ActiveExamRun,
  AudioRecordingRecord,
  ConsolidatedExamResult,
  ExamProfile,
  ExportData,
  InterpretingSessionRecord,
  SessionRecord,
  StoredSettings,
} from '../domain/types'
import { createActiveExamRun, isValidActiveRun } from '../domain/exam'
import { DEFAULT_EXAM_PROFILES, DEPRECATED_EXAM_PROFILE_IDS } from '../data/exam-profiles'
import { createDataWriteCoordinator, DATA_CLEARED_NOTICE } from './data-write-coordinator'
import {
  assertExamRunNotDiscarded,
  assertExamRunNotCompletedInTransaction,
  assertExamRunSlotAvailableInTransaction,
  claimExamRunSlot,
  completeExamRunAtomically,
  discardExamRunWithTombstone,
  EXAM_RUN_RECOVERY_KEY_PREFIX,
  EXAM_RUN_TOMBSTONE_KEY_PREFIX,
  isExamRunDiscarded,
  stageExamRunRecoveryAtomically,
  type ExamRunLifecycleStore,
} from './exam-run-lifecycle'
import {
  EXAM_RUN_COMPLETION_KEY_PREFIX,
  EXAM_RUN_EDITOR_KEY_PREFIX,
  EXAM_RUN_EDITOR_LEASE_MS,
  claimExamRunEditor,
  clearExamRunEditorLease,
  editorLeaseKey,
  examRunCompletionKey,
  examRunRecoveryKey,
  publishExamRunEditorLease,
  reconcileExamRunRecoverySnapshot,
  releaseExamRunEditor,
  renewExamRunEditorLease,
  saveExamRunWithEditor,
  writeExamRunRecoveryCheckpointSynchronously,
} from './exam-run-editor'

const DATABASE_NAME = 'lingo-practice-local'
const DATABASE_VERSION = 4
const SETTINGS_KEY = 'default'
const DATABASE_UPGRADE_BLOCKED_NOTICE = 'A local database upgrade is waiting for another Lingo Practice tab. Close older tabs to continue; saved records are not being deleted.'

const databaseNoticeListeners = new Set<(notice: string | undefined) => void>()
let currentDatabaseNotice: string | undefined

function publishDatabaseNotice(notice: string | undefined) {
  currentDatabaseNotice = notice
  databaseNoticeListeners.forEach((listener) => listener(notice))
}

export function subscribeToDatabaseNotice(listener: (notice: string | undefined) => void): () => void {
  databaseNoticeListeners.add(listener)
  listener(currentDatabaseNotice)
  return () => databaseNoticeListeners.delete(listener)
}

function getLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function readExamRunRecoverySnapshots(): ActiveExamRun[] {
  const storage = getLocalStorage()
  if (!storage) {
    return []
  }

  const snapshots: ActiveExamRun[] = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(EXAM_RUN_RECOVERY_KEY_PREFIX)) {
        continue
      }
      try {
        const serialized = storage.getItem(key)
        if (!serialized) {
          continue
        }
        const candidate: unknown = JSON.parse(serialized)
        if (isValidActiveRun(candidate)
          && candidate.status === 'in-progress'
          && Number.isFinite(Date.parse(candidate.lastSavedAt))
          && key === examRunRecoveryKey(candidate.id, candidate.editorToken)) {
          snapshots.push(candidate)
        }
      } catch {
        // Ignore one corrupt journal record without losing other recoverable runs.
      }
    }
  } catch {
    // Recovery snapshots are best-effort; IndexedDB remains the primary store.
  }
  return snapshots
}

function clearExamRunRecoverySnapshot(runId: string, persistedRun?: ActiveExamRun): void {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }
  try {
    const prefix = `${EXAM_RUN_RECOVERY_KEY_PREFIX}${runId}`
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === prefix || key?.startsWith(`${prefix}:`)) keys.push(key)
    }
    for (const key of keys) {
      const serialized = storage.getItem(key)
      if (!serialized) continue
      const pending: unknown = JSON.parse(serialized)
      if (!isValidActiveRun(pending)) {
        storage.removeItem(key)
        continue
      }
      if (persistedRun && pending.editorToken === persistedRun.editorToken
        && (pending.revision ?? 0) > (persistedRun.revision ?? 0)) continue
      if (!persistedRun || pending.editorToken === persistedRun.editorToken) storage.removeItem(key)
    }
  } catch {
    // Failure to retire a snapshot is safe: reads reconcile it against IndexedDB.
  }
}

function recoverySnapshotEntries(storage: Storage): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(EXAM_RUN_RECOVERY_KEY_PREFIX)
      || key?.startsWith(EXAM_RUN_TOMBSTONE_KEY_PREFIX)
      || key?.startsWith(EXAM_RUN_EDITOR_KEY_PREFIX)
      || key?.startsWith(EXAM_RUN_COMPLETION_KEY_PREFIX)) {
      const value = storage.getItem(key)
      if (value !== null) entries.push([key, value])
    }
  }
  return entries
}

function restoreExamRunRecoverySnapshots(storage: Storage, entries: Array<[string, string]>): void {
  for (const [key, value] of entries) storage.setItem(key, value)
}

function createExamRunLeaseMirrorMutation(storage: Storage, runId: string) {
  const key = editorLeaseKey(runId)
  let previous: string | null | undefined
  let expectedAfter: string | null | undefined
  const rememberPrevious = () => {
    if (previous === undefined) previous = storage.getItem(key)
  }
  return {
    publish(run: ActiveExamRun) {
      rememberPrevious()
      expectedAfter = JSON.stringify({ editorToken: run.editorToken, expiresAt: run.editorLeaseExpiresAt })
      storage.setItem(key, expectedAfter)
    },
    clear() {
      rememberPrevious()
      expectedAfter = null
      storage.removeItem(key)
    },
    restore() {
      if (previous === undefined || expectedAfter === undefined || storage.getItem(key) !== expectedAfter) return
      if (previous === null) storage.removeItem(key)
      else storage.setItem(key, previous)
    },
  }
}

export function clearExamRunRecoverySnapshotsStrict(storage: Storage, entries: Array<[string, string]>): void {
  try {
    for (const [key] of entries) storage.removeItem(key)
  } catch (error) {
    try { restoreExamRunRecoverySnapshots(storage, entries) } catch { /* IndexedDB remains authoritative if restoring a journal is blocked. */ }
    throw error
  }
}

function getRecoveryStorageForClear(): Storage {
  const storage = getLocalStorage()
  if (!storage) throw new Error('Local exam recovery storage is unavailable; data was not cleared.')
  return storage
}

const dataClearedListeners = new Set<(epoch: string) => void>()
let dataClearedChannel: BroadcastChannel | undefined

function publishDataCleared(epoch: string): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      dataClearedChannel ??= new BroadcastChannel(DATA_CLEARED_NOTICE)
      dataClearedChannel.postMessage({ epoch })
    }
  } catch { /* The storage event remains the fallback. */ }
  try { getLocalStorage()?.setItem(DATA_CLEARED_NOTICE, epoch) } catch { /* Epoch checks still reject stale writers. */ }
}

export function subscribeToDataCleared(listener: (epoch: string) => void): () => void {
  dataClearedListeners.add(listener)
  function onMessage(event: MessageEvent<{ epoch?: unknown }>) {
    if (typeof event.data?.epoch === 'string') listener(event.data.epoch)
  }
  function onStorage(event: StorageEvent) {
    if (event.key === DATA_CLEARED_NOTICE && event.newValue) listener(event.newValue)
  }
  let channel: BroadcastChannel | undefined
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      dataClearedChannel ??= new BroadcastChannel(DATA_CLEARED_NOTICE)
      channel = dataClearedChannel
      channel.addEventListener('message', onMessage)
    }
  } catch { /* Storage-event fallback remains active. */ }
  try { globalThis.addEventListener?.('storage', onStorage) } catch { /* Non-window runtime. */ }
  return () => {
    dataClearedListeners.delete(listener)
    channel?.removeEventListener('message', onMessage)
    try { globalThis.removeEventListener?.('storage', onStorage) } catch { /* Non-window runtime. */ }
  }
}

function mergeExamRunRecoverySnapshots(runs: ActiveExamRun[], completedRunIds: Set<string>): ActiveExamRun[] {
  const storage = getLocalStorage()
  const runsById = new Map(runs
    .filter((run) => !completedRunIds.has(run.id)
      && (!storage || (!isExamRunDiscarded(storage, run.id) && storage.getItem(examRunCompletionKey(run.id)) === null)))
    .map((run) => [run.id, run]))
  for (const snapshot of readExamRunRecoverySnapshots()) {
    if (completedRunIds.has(snapshot.id)
      || (storage && (isExamRunDiscarded(storage, snapshot.id) || storage.getItem(examRunCompletionKey(snapshot.id)) !== null))) {
      continue
    }
    const storedRun = runsById.get(snapshot.id)
    if (storedRun) {
      const reconciled = reconcileExamRunRecoverySnapshot(storedRun, [snapshot])
      if (reconciled && reconciled !== storedRun) runsById.set(snapshot.id, reconciled)
    } else if (!snapshot.editorToken) {
      // Only legacy, pre-lease snapshots may recover without their IDB row.
      runsById.set(snapshot.id, snapshot)
    }
  }
  return Array.from(runsById.values())
}

export const DEFAULT_SETTINGS: StoredSettings = {
  id: 'default',
  evaluationMode: 'local-only',
  cloudBaseUrl: '',
  cloudModel: '',
  cloudSupportsAudio: false,
  localModelStatus: 'not-prepared',
}

interface TranslationDatabaseSchema extends DBSchema {
  settings: {
    key: string
    value: StoredSettings
  }
  sessions: {
    key: string
    value: SessionRecord
    indexes: {
      'by-created-at': string
      'by-direction': string
    }
  }
  examProfiles: {
    key: string
    value: ExamProfile
  }
  examRuns: {
    key: string
    value: ActiveExamRun
    indexes: {
      'by-status': string
      'by-last-saved': string
    }
  }
  examResults: {
    key: string
    value: ConsolidatedExamResult
    indexes: {
      'by-completed-at': string
      'by-profile-id': string
      'by-run-id': string
    }
  }
  recordings: {
    key: string
    value: AudioRecordingRecord
    indexes: {
      'by-created-at': string
      'by-exercise-id': string
    }
  }
  interpretingSessions: {
    key: string
    value: InterpretingSessionRecord
    indexes: {
      'by-created-at': string
    }
  }
}

let databasePromise: Promise<IDBPDatabase<TranslationDatabaseSchema>> | undefined
const dataWriteCoordinator = createDataWriteCoordinator({ onCleared: publishDataCleared })

function withDataWrite<T>(operation: () => Promise<T>): Promise<T> {
  return dataWriteCoordinator.runWrite(operation)
}

async function withExamRunLifecycleTransaction<T>(
  operation: (store: ExamRunLifecycleStore) => Promise<T>,
): Promise<T> {
  const db = await getDatabase()
  const transaction = db.transaction(['examRuns', 'examResults'], 'readwrite')
  const runs = transaction.objectStore('examRuns')
  const results = transaction.objectStore('examResults')
  const store: ExamRunLifecycleStore = {
    getRun: (runId) => runs.get(runId),
    getInProgressRuns: () => runs.index('by-status').getAll('in-progress'),
    getCompletedRunIds: async () => (await results.getAll()).map((result) => result.runId),
    getCompletedResult: (runId) => results.index('by-run-id').get(runId),
    putRun: (run) => runs.put(run),
    putResult: (result) => results.put(result),
    deleteRun: (runId) => runs.delete(runId),
  }

  try {
    const value = await operation(store)
    await transaction.done
    return value
  } catch (error) {
    try { transaction.abort() } catch { /* The transaction may already be inactive. */ }
    try { await transaction.done } catch { /* Preserve the original failure. */ }
    throw error
  }
}

function getDatabase(): Promise<IDBPDatabase<TranslationDatabaseSchema>> {
  if (!databasePromise) {
    const opening = openDB<TranslationDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
      blocked(currentVersion, blockedVersion) {
        const requestedVersion = blockedVersion ?? DATABASE_VERSION
        publishDatabaseNotice(`${DATABASE_UPGRADE_BLOCKED_NOTICE} Version ${currentVersion} is blocking version ${requestedVersion}.`)
      },
      blocking() {
        const connection = databasePromise
        databasePromise = undefined
        void connection?.then((db) => db.close()).catch(() => undefined)
      },
      upgrade(database, _oldVersion, _newVersion, transaction) {
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings')
        }
        if (!database.objectStoreNames.contains('sessions')) {
          const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
          sessions.createIndex('by-created-at', 'createdAt')
          sessions.createIndex('by-direction', 'sourceLanguage')
        }
        if (!database.objectStoreNames.contains('examProfiles')) {
          database.createObjectStore('examProfiles', { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains('examRuns')) {
          const runs = database.createObjectStore('examRuns', { keyPath: 'id' })
          runs.createIndex('by-status', 'status')
          runs.createIndex('by-last-saved', 'lastSavedAt')
        }
        if (!database.objectStoreNames.contains('examResults')) {
          const results = database.createObjectStore('examResults', { keyPath: 'id' })
          results.createIndex('by-completed-at', 'completedAt')
          results.createIndex('by-profile-id', 'profileId')
        }
        const examResults = transaction.objectStore('examResults')
        if (examResults && !examResults.indexNames.contains('by-run-id')) {
          examResults.createIndex('by-run-id', 'runId')
        }
        if (!database.objectStoreNames.contains('recordings')) {
          const recordings = database.createObjectStore('recordings', { keyPath: 'id' })
          recordings.createIndex('by-created-at', 'createdAt')
          recordings.createIndex('by-exercise-id', 'exerciseId')
        }
        if (!database.objectStoreNames.contains('interpretingSessions')) {
          const sessions = database.createObjectStore('interpretingSessions', { keyPath: 'id' })
          sessions.createIndex('by-created-at', 'createdAt')
        }
      },
    })
    databasePromise = opening.then((db) => {
      publishDatabaseNotice(undefined)
      return db
    }).catch((error: unknown) => {
      databasePromise = undefined
      throw error
    })
  }
  return databasePromise
}

export const database = {
  async listSessions(): Promise<SessionRecord[]> {
    const db = await getDatabase()
    const sessions = await db.getAllFromIndex('sessions', 'by-created-at')
    return sessions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async saveSession(session: SessionRecord): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('sessions', session)
    })
  },

  async listInterpretingSessions(): Promise<InterpretingSessionRecord[]> {
    const db = await getDatabase()
    const sessions = await db.getAllFromIndex('interpretingSessions', 'by-created-at')
    return sessions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async saveInterpretingSession(session: InterpretingSessionRecord): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('interpretingSessions', session)
    })
  },

  async saveInterpretingSessionWithRecordings(
    session: InterpretingSessionRecord,
    recordings: AudioRecordingRecord[],
  ): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      const transaction = db.transaction(['recordings', 'interpretingSessions'], 'readwrite')
      const recordingWrites = recordings.map((recording) => transaction.objectStore('recordings').put(recording))
      recordingWrites.push(transaction.objectStore('interpretingSessions').put(session))
      await Promise.all(recordingWrites)
      await transaction.done
    })
  },

  async deleteInterpretingSession(id: string): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      const transaction = db.transaction(['recordings', 'interpretingSessions'], 'readwrite')
      const sessionStore = transaction.objectStore('interpretingSessions')
      const [session, sessions] = await Promise.all([sessionStore.get(id), sessionStore.getAll()])
      if (session) {
        const stillReferenced = new Set(sessions
          .filter((candidate) => candidate.id !== id)
          .flatMap((candidate) => [...candidate.recordingIds, ...(candidate.sourceRecordingId ? [candidate.sourceRecordingId] : [])]))
        const ownedRecordingIds = new Set([...session.recordingIds, ...(session.sourceRecordingId ? [session.sourceRecordingId] : [])])
        const deletions = [sessionStore.delete(id), ...Array.from(ownedRecordingIds)
          .filter((recordingId) => !stillReferenced.has(recordingId))
          .map((recordingId) => transaction.objectStore('recordings').delete(recordingId))]
        await Promise.all(deletions)
      }
      await transaction.done
    })
  },

  async listAudioRecordings(exerciseId?: string): Promise<AudioRecordingRecord[]> {
    const db = await getDatabase()
    const recordings = exerciseId
      ? await db.getAllFromIndex('recordings', 'by-exercise-id', exerciseId)
      : await db.getAllFromIndex('recordings', 'by-created-at')
    return recordings.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async getAudioRecording(id: string): Promise<AudioRecordingRecord | undefined> {
    const db = await getDatabase()
    return db.get('recordings', id)
  },

  async saveAudioRecording(recording: AudioRecordingRecord): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('recordings', recording)
    })
  },

  async deleteAudioRecording(id: string): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.delete('recordings', id)
    })
  },

  async getSettings(): Promise<StoredSettings> {
    const db = await getDatabase()
    const settings = await db.get('settings', SETTINGS_KEY)
    return settings ? { ...DEFAULT_SETTINGS, ...settings, cloudSupportsAudio: settings.cloudSupportsAudio ?? false } : { ...DEFAULT_SETTINGS }
  },

  async saveSettings(settings: StoredSettings): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('settings', { ...settings, id: SETTINGS_KEY }, SETTINGS_KEY)
    })
  },
  // Exam profiles
  async listExamProfiles(): Promise<ExamProfile[]> {
    return withDataWrite(async () => {
      const db = await getDatabase()
      const stored = await db.getAll('examProfiles')
      const deprecatedIds = new Set<string>(DEPRECATED_EXAM_PROFILE_IDS)
      const retained = stored.filter((profile) => !deprecatedIds.has(profile.id))

      for (const profile of stored) {
        if (deprecatedIds.has(profile.id)) await db.delete('examProfiles', profile.id)
      }

      const profilesById = new Map(retained.map((profile) => [profile.id, profile]))
      for (const profile of DEFAULT_EXAM_PROFILES) {
        const storedProfile = profilesById.get(profile.id)
        if (!storedProfile || storedProfile.version < profile.version || !storedProfile.rubricVersion) {
          await db.put('examProfiles', profile)
          profilesById.set(profile.id, profile)
        }
      }
      return Array.from(profilesById.values())
    })
  },

  async getExamProfile(id: string): Promise<ExamProfile | undefined> {
    const db = await getDatabase()
    const stored = await db.get('examProfiles', id)
    if (stored) {
      return stored
    }
    return DEFAULT_EXAM_PROFILES.find((profile) => profile.id === id)
  },

  async saveExamProfile(profile: ExamProfile): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('examProfiles', profile)
    })
  },

  // Active exam runs (crash recovery)
  async claimActiveExamRun(profile: ExamProfile, editorToken: string): Promise<{ run: ActiveExamRun; created: boolean }> {
    return withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; the exam attempt was not started.')
      const recoveryRuns = readExamRunRecoverySnapshots().filter((run) => !storage || !isExamRunDiscarded(storage, run.id))
      const now = Date.now()
      const candidate: ActiveExamRun = {
        ...createActiveExamRun(profile),
        editorToken,
        revision: 0,
        editorLeaseExpiresAt: new Date(now + EXAM_RUN_EDITOR_LEASE_MS).toISOString(),
      }
      const mirror = createExamRunLeaseMirrorMutation(storage, candidate.id)
      try {
        return await claimExamRunSlot(
          candidate,
          (operation) => withExamRunLifecycleTransaction(operation),
          recoveryRuns,
          (run) => mirror.publish(run),
        )
      } catch (error) {
        mirror.restore()
        throw error
      }
    })
  },

  async claimExamRunEditor(runId: string, editorToken: string): Promise<ActiveExamRun> {
    return withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; this exam attempt cannot be resumed safely.')
      const recoverySnapshots = readExamRunRecoverySnapshots().filter((run) => run.id === runId)
      const mirror = createExamRunLeaseMirrorMutation(storage, runId)
      try {
        return await claimExamRunEditor(
          runId,
          editorToken,
          (operation) => withExamRunLifecycleTransaction(async (store) => {
            await assertExamRunNotDiscarded(storage, runId)
            return operation(store)
          }),
          Date.now(),
          recoverySnapshots,
          EXAM_RUN_EDITOR_LEASE_MS,
          (run) => mirror.publish(run),
        )
      } catch (error) {
        mirror.restore()
        throw error
      }
    })
  },

  async renewExamRunEditorLease(runId: string, editorToken: string): Promise<ActiveExamRun> {
    return withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; the exam editing lease could not be renewed.')
      const mirror = createExamRunLeaseMirrorMutation(storage, runId)
      try {
        return await renewExamRunEditorLease(
          runId,
          editorToken,
          (operation) => withExamRunLifecycleTransaction(operation),
          Date.now(),
          EXAM_RUN_EDITOR_LEASE_MS,
          (run) => mirror.publish(run),
        )
      } catch (error) {
        mirror.restore()
        throw error
      }
    })
  },

  async getActiveExamRun(): Promise<ActiveExamRun | undefined> {
    const db = await getDatabase()
    const [inProgressRuns, results] = await Promise.all([
      db.getAllFromIndex('examRuns', 'by-status', 'in-progress'),
      db.getAll('examResults'),
    ])
    const completedRunIds = new Set(results.map((result) => result.runId))
    const recoverableRuns = mergeExamRunRecoverySnapshots(inProgressRuns, completedRunIds)
      .filter((run) => run.status === 'in-progress')
    if (!recoverableRuns.length) {
      return undefined
    }
    return recoverableRuns.sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))[0]
  },

  async getExamRun(id: string): Promise<ActiveExamRun | undefined> {
    const storage = getLocalStorage()
    if (storage && isExamRunDiscarded(storage, id)) return undefined
    const db = await getDatabase()
    return db.get('examRuns', id)
  },

  async listExamRuns(): Promise<ActiveExamRun[]> {
    const db = await getDatabase()
    const [runs, results] = await Promise.all([db.getAll('examRuns'), db.getAll('examResults')])
    const completedRunIds = new Set(results.map((result) => result.runId))
    return mergeExamRunRecoverySnapshots(runs, completedRunIds)
      .sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))
  },

  stageExamRunRecoverySync(run: ActiveExamRun): string {
    const storage = getLocalStorage()
    if (!storage) throw new Error('Browser recovery storage is unavailable; this exam change was not checkpointed.')
    return writeExamRunRecoveryCheckpointSynchronously(run, {
      storage,
      isDataEpochCurrent: () => {
        try { dataWriteCoordinator.assertCurrentEpoch(); return true } catch { return false }
      },
    })
  },

  async stageExamRunRecovery(run: ActiveExamRun): Promise<void> {
    this.stageExamRunRecoverySync(run)
    await withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable.')
      await withExamRunLifecycleTransaction(async (store) => {
        await assertExamRunNotDiscarded(storage, run.id)
        await stageExamRunRecoveryAtomically(run, (operation) => operation(store), () => undefined)
      })
    })
  },

  async saveExamRun(run: ActiveExamRun): Promise<void> {
    await withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; this exam attempt was not saved.')
      const mirror = createExamRunLeaseMirrorMutation(storage, run.id)
      try {
        const persisted = await withExamRunLifecycleTransaction(async (store) => {
          await assertExamRunNotDiscarded(storage, run.id)
          await assertExamRunNotCompletedInTransaction(store, run.id)
          await assertExamRunSlotAvailableInTransaction(store, run.id)
          return saveExamRunWithEditor(
            run,
            (operation) => operation(store),
            Date.now(),
            EXAM_RUN_EDITOR_LEASE_MS,
            (savedRun) => mirror.publish(savedRun),
          )
        })
        clearExamRunRecoverySnapshot(run.id, persisted)
      } catch (error) {
        mirror.restore()
        throw error
      }
    })
  },

  async releaseExamRunEditor(run: ActiveExamRun): Promise<ActiveExamRun> {
    return withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; the exam attempt was not released.')
      const mirror = createExamRunLeaseMirrorMutation(storage, run.id)
      try {
        const released = await releaseExamRunEditor(
          run,
          (operation) => withExamRunLifecycleTransaction(operation),
          () => mirror.clear(),
        )
        clearExamRunRecoverySnapshot(run.id)
        return released
      } catch (error) {
        mirror.restore()
        throw error
      }
    })
  },

  async deleteExamRun(id: string): Promise<void> {
    await dataWriteCoordinator.runExclusive(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; this exam attempt was not discarded.')
      const db = await getDatabase()
      await discardExamRunWithTombstone(storage, id, async () => {
        await db.delete('examRuns', id)
      })
    })
  },

  // Exam results
  async saveExamResult(result: ConsolidatedExamResult): Promise<void> {
    await withDataWrite(async () => {
      const db = await getDatabase()
      await db.put('examResults', result)
    })
  },

  async completeExamRun(runId: string, result: ConsolidatedExamResult, editorToken: string, revision: number): Promise<ConsolidatedExamResult> {
    return withDataWrite(async () => {
      const storage = getLocalStorage()
      if (!storage) throw new Error('Browser recovery storage is unavailable; the completed attempt could not be finalized safely.')
      const completedResult = await withExamRunLifecycleTransaction(async (store) => {
        await assertExamRunNotDiscarded(storage, runId)
        return completeExamRunAtomically(runId, result, (operation) => operation(store), { token: editorToken, revision })
      })
      try { storage.setItem(examRunCompletionKey(runId), 'true') } catch { /* IndexedDB completion rows still fence recovery. */ }
      try { clearExamRunEditorLease(storage, runId) } catch { /* The completed IDB result fences stale tabs. */ }
      clearExamRunRecoverySnapshot(runId)
      return completedResult
    })
  },

  async getExamResult(id: string): Promise<ConsolidatedExamResult | undefined> {
    const db = await getDatabase()
    return db.get('examResults', id)
  },

  async listExamResults(): Promise<ConsolidatedExamResult[]> {
    const db = await getDatabase()
    const results = await db.getAllFromIndex('examResults', 'by-completed-at')
    return results.sort((left, right) => right.completedAt.localeCompare(left.completedAt))
  },

  async exportData(): Promise<ExportData> {
    const [settings, sessions, interpretingSessions, recordings, examRuns, examResults, examProfiles] = await Promise.all([
      this.getSettings(),
      this.listSessions(),
      this.listInterpretingSessions(),
      this.listAudioRecordings(),
      this.listExamRuns(),
      this.listExamResults(),
      this.listExamProfiles(),
    ])
    const exportedRecordings = []
    for (const recording of recordings) {
      const bytes = new Uint8Array(await recording.blob.arrayBuffer())
      let binary = ''
      const chunkSize = 0x8000
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
      }
      exportedRecordings.push({
        ...recording,
        dataUrl: `data:${recording.mimeType || 'application/octet-stream'};base64,${btoa(binary)}`,
        blob: undefined,
      })
    }
    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      settings,
      sessions,
      interpretingSessions,
      recordings: exportedRecordings.map(({ blob: _blob, ...recording }) => recording),
      examRuns,
      examResults,
      examProfiles,
    }
  },

  async clearData(): Promise<void> {
    await dataWriteCoordinator.clearData(async () => {
      const storage = getRecoveryStorageForClear()
      const recoveryEntries = recoverySnapshotEntries(storage)
      try {
        clearExamRunRecoverySnapshotsStrict(storage, recoveryEntries)
        const db = await getDatabase()
        const storeNames: Array<'settings' | 'sessions' | 'examProfiles' | 'examRuns' | 'examResults' | 'recordings' | 'interpretingSessions'> = [
          'settings',
          'sessions',
          'examProfiles',
          'examRuns',
          'examResults',
          'recordings',
          'interpretingSessions',
        ]
        const transaction = db.transaction(storeNames, 'readwrite')
        await Promise.all([
          Promise.all(storeNames.map((name) => transaction.objectStore(name).clear())),
          transaction.done,
        ])
      } catch (error) {
        try { restoreExamRunRecoverySnapshots(storage, recoveryEntries) } catch { /* IDB recovery rows remain authoritative if journal restore is blocked. */ }
        throw error
      }
    })
  },

  assertCanClearData(): void {
    dataWriteCoordinator.assertCanClearData()
  },
}

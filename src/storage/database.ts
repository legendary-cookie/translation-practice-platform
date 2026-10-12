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
import { DEFAULT_EXAM_PROFILES, DEPRECATED_EXAM_PROFILE_IDS } from '../data/exam-profiles'

const DATABASE_NAME = 'lingo-practice-local'
const DATABASE_VERSION = 3
const SETTINGS_KEY = 'default'

export const DEFAULT_SETTINGS: StoredSettings = {
  id: 'default',
  evaluationMode: 'local-only',
  cloudBaseUrl: '',
  cloudModel: '',
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

function getDatabase(): Promise<IDBPDatabase<TranslationDatabaseSchema>> {
  databasePromise ??= openDB<TranslationDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
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
  return databasePromise
}

export const database = {
  async listSessions(): Promise<SessionRecord[]> {
    const db = await getDatabase()
    const sessions = await db.getAllFromIndex('sessions', 'by-created-at')
    return sessions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async saveSession(session: SessionRecord): Promise<void> {
    const db = await getDatabase()
    await db.put('sessions', session)
  },

  async listInterpretingSessions(): Promise<InterpretingSessionRecord[]> {
    const db = await getDatabase()
    const sessions = await db.getAllFromIndex('interpretingSessions', 'by-created-at')
    return sessions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async saveInterpretingSession(session: InterpretingSessionRecord): Promise<void> {
    const db = await getDatabase()
    await db.put('interpretingSessions', session)
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
    const db = await getDatabase()
    await db.put('recordings', recording)
  },

  async deleteAudioRecording(id: string): Promise<void> {
    const db = await getDatabase()
    await db.delete('recordings', id)
  },

  async getSettings(): Promise<StoredSettings> {
    const db = await getDatabase()
    const settings = await db.get('settings', SETTINGS_KEY)
    return settings ? { ...settings } : { ...DEFAULT_SETTINGS }
  },

  async saveSettings(settings: StoredSettings): Promise<void> {
    const db = await getDatabase()
    await db.put('settings', { ...settings, id: SETTINGS_KEY }, SETTINGS_KEY)
  },
  // Exam profiles
  async listExamProfiles(): Promise<ExamProfile[]> {
    const db = await getDatabase()
    const stored = await db.getAll('examProfiles')
    const deprecatedIds = new Set<string>(DEPRECATED_EXAM_PROFILE_IDS)
    const retained = stored.filter((profile) => !deprecatedIds.has(profile.id))

    for (const profile of stored) {
      if (deprecatedIds.has(profile.id)) {
        await db.delete('examProfiles', profile.id)
      }
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
    const db = await getDatabase()
    await db.put('examProfiles', profile)
  },

  // Active exam runs (crash recovery)
  async getActiveExamRun(): Promise<ActiveExamRun | undefined> {
    const db = await getDatabase()
    const inProgressRuns = await db.getAllFromIndex('examRuns', 'by-status', 'in-progress')
    if (!inProgressRuns.length) {
      return undefined
    }
    return inProgressRuns.sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))[0]
  },

  async getExamRun(id: string): Promise<ActiveExamRun | undefined> {
    const db = await getDatabase()
    return db.get('examRuns', id)
  },

  async listExamRuns(): Promise<ActiveExamRun[]> {
    const db = await getDatabase()
    const runs = await db.getAll('examRuns')
    return runs.sort((left, right) => right.lastSavedAt.localeCompare(left.lastSavedAt))
  },

  async saveExamRun(run: ActiveExamRun): Promise<void> {
    const db = await getDatabase()
    await db.put('examRuns', run)
  },

  async deleteExamRun(id: string): Promise<void> {
    const db = await getDatabase()
    await db.delete('examRuns', id)
  },

  // Exam results
  async saveExamResult(result: ConsolidatedExamResult): Promise<void> {
    const db = await getDatabase()
    await db.put('examResults', result)
  },

  async completeExamRun(runId: string, result: ConsolidatedExamResult): Promise<ConsolidatedExamResult> {
    const db = await getDatabase()
    const transaction = db.transaction(['examResults', 'examRuns'], 'readwrite')
    const existingResults = await transaction.objectStore('examResults').getAll()
    const existingResult = existingResults.find((storedResult) => storedResult.runId === runId)
    const completedResult = existingResult ?? result

    if (!existingResult) {
      await transaction.objectStore('examResults').put(result)
    }
    await transaction.objectStore('examRuns').delete(runId)
    await transaction.done
    return completedResult
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
    const exportedRecordings = await Promise.all(recordings.map(async (recording) => {
      const bytes = new Uint8Array(await recording.blob.arrayBuffer())
      let binary = ''
      const chunkSize = 0x8000
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
      }
      return {
        ...recording,
        dataUrl: `data:${recording.mimeType || 'application/octet-stream'};base64,${btoa(binary)}`,
        blob: undefined,
      }
    }))
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
    await Promise.all(storeNames.map((name) => transaction.objectStore(name).clear()))
    await transaction.done
  },
}

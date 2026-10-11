import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  ActiveExamRun,
  ConsolidatedExamResult,
  ExamProfile,
  ExportData,
  SessionRecord,
  StoredSettings,
} from '../domain/types'
import { DEFAULT_EXAM_PROFILES } from '../data/exam-profiles'

const DATABASE_NAME = 'lingo-practice-local'
const DATABASE_VERSION = 2
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
    if (stored.length > 0) {
      return stored
    }
    for (const profile of DEFAULT_EXAM_PROFILES) {
      await db.put('examProfiles', profile)
    }
    return DEFAULT_EXAM_PROFILES
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
    const [settings, sessions, examRuns, examResults, examProfiles] = await Promise.all([
      this.getSettings(),
      this.listSessions(),
      this.listExamRuns(),
      this.listExamResults(),
      this.listExamProfiles(),
    ])
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      sessions,
      examRuns,
      examResults,
      examProfiles,
    }
  },

  async clearData(): Promise<void> {
    const db = await getDatabase()
    const storeNames: Array<'settings' | 'sessions' | 'examProfiles' | 'examRuns' | 'examResults'> = [
      'settings',
      'sessions',
      'examProfiles',
      'examRuns',
      'examResults',
    ]
    const transaction = db.transaction(storeNames, 'readwrite')
    await Promise.all(storeNames.map((name) => transaction.objectStore(name).clear()))
    await transaction.done
  },
}

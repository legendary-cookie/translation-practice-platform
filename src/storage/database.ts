import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ExportData, SessionRecord, StoredSettings } from '../domain/types'

const DATABASE_NAME = 'lingo-practice-local'
const DATABASE_VERSION = 1
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

  async exportData(): Promise<ExportData> {
    const [settings, sessions] = await Promise.all([this.getSettings(), this.listSessions()])
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      sessions,
    }
  },

  async clearData(): Promise<void> {
    const db = await getDatabase()
    const transaction = db.transaction(['settings', 'sessions'], 'readwrite')
    await Promise.all([transaction.objectStore('settings').clear(), transaction.objectStore('sessions').clear()])
    await transaction.done
  },
}

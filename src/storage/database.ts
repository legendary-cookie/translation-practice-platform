import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { AppSettings, ExportBundle, SessionRecord } from '../domain/types'

interface PracticeDatabase extends DBSchema {
  settings: { key: string; value: AppSettings }
  sessions: { key: string; value: SessionRecord }
}

export const defaultSettings: Readonly<AppSettings> = {
  privacyMode: 'local-only',
  localModelId: 'Qwen3-1.7B-q4f16_1-MLC',
}

let connection: Promise<IDBPDatabase<PracticeDatabase>> | undefined

function connect(): Promise<IDBPDatabase<PracticeDatabase>> {
  if (!connection) {
    connection = openDB<PracticeDatabase>('translation-studio', 1, {
      upgrade(db) {
        db.createObjectStore('settings')
        db.createObjectStore('sessions', { keyPath: 'id' })
      },
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase).close()
        connection = undefined
      },
      terminated() { connection = undefined },
    }).catch((error: unknown) => {
      connection = undefined
      throw new Error('Local storage is unavailable. Enable browser storage and try again.', { cause: error })
    })
  }
  return connection
}

function persistedSettings(settings: AppSettings): AppSettings {
  if (!['local-only', 'local-first'].includes(settings.privacyMode)) throw new Error('Choose a valid privacy mode.')
  if (typeof settings.localModelId !== 'string' || !settings.localModelId.trim()) throw new Error('Choose a local model.')
  // Explicit fields prevent runtime extras, including API keys, from persisting.
  const result: AppSettings = { privacyMode: settings.privacyMode, localModelId: settings.localModelId }
  if (settings.cloudBaseUrl !== undefined) {
    const url = new URL(settings.cloudBaseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Cloud base URL must be HTTP(S) without credentials, query parameters, or a fragment.')
    }
    result.cloudBaseUrl = settings.cloudBaseUrl
  }
  if (settings.cloudModel !== undefined) {
    if (typeof settings.cloudModel !== 'string') throw new Error('Cloud model must be text.')
    result.cloudModel = settings.cloudModel
  }
  return result
}

function persistedSession(session: SessionRecord): SessionRecord {
  const { feedback } = session
  return {
    id: session.id, createdAt: session.createdAt, exerciseId: session.exerciseId,
    mode: session.mode, sourceLanguage: session.sourceLanguage, targetLanguage: session.targetLanguage,
    learnerAnswer: session.learnerAnswer, elapsedSeconds: session.elapsedSeconds,
    feedback: {
      summary: feedback.summary,
      dimensions: {
        accuracy: feedback.dimensions.accuracy, coverage: feedback.dimensions.coverage,
        terminology: feedback.dimensions.terminology, grammar: feedback.dimensions.grammar,
        fluency: feedback.dimensions.fluency,
      },
      strengths: [...feedback.strengths], uncertainty: [...feedback.uncertainty],
      issues: feedback.issues.map((issue) => ({
        dimension: issue.dimension, severity: issue.severity, sourceQuote: issue.sourceQuote,
        learnerQuote: issue.learnerQuote, explanation: issue.explanation, suggestion: issue.suggestion,
      })),
    },
  }
}

export const database = {
  async listSessions(): Promise<SessionRecord[]> {
    const sessions = await (await connect()).getAll('sessions')
    return sessions.map(persistedSession).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async saveSession(session: SessionRecord): Promise<void> {
    await (await connect()).put('sessions', persistedSession(session))
  },
  async getSettings(): Promise<AppSettings> {
    const settings = await (await connect()).get('settings', 'preferences')
    return settings ? persistedSettings(settings) : { ...defaultSettings }
  },
  async saveSettings(settings: AppSettings): Promise<void> {
    const safeSettings = persistedSettings(settings)
    await (await connect()).put('settings', safeSettings, 'preferences')
  },
  async exportData(): Promise<ExportBundle> {
    const db = await connect()
    const transaction = db.transaction(['settings', 'sessions'], 'readonly')
    const [settings, sessions] = await Promise.all([
      transaction.objectStore('settings').get('preferences'),
      transaction.objectStore('sessions').getAll(),
    ])
    await transaction.done
    return {
      version: 1, exportedAt: new Date().toISOString(),
      settings: settings ? persistedSettings(settings) : { ...defaultSettings },
      sessions: sessions.map(persistedSession).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  },
  async clearData(): Promise<void> {
    const transaction = (await connect()).transaction(['settings', 'sessions'], 'readwrite')
    await Promise.all([
      transaction.objectStore('settings').clear(), transaction.objectStore('sessions').clear(),
    ])
    await transaction.done
  },
}

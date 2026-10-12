import type { SessionRecord } from '../../domain/types'

export type SessionHistoryStatus = 'loading' | 'ready' | 'failed'

export function mergeRecentSessions(loaded: SessionRecord[], live: SessionRecord[]): SessionRecord[] {
  const merged = new Map<string, SessionRecord>()
  for (const session of loaded) merged.set(session.id, session)
  for (const session of live) merged.set(session.id, session)
  return [...merged.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function persistWrittenPracticeSession(input: {
  session: SessionRecord
  save: () => Promise<void>
  isDataGenerationCurrent: () => boolean
  isAttemptCurrent: () => boolean
  onPublishHistory: (session: SessionRecord) => void
  onSaveForCurrentAttempt: () => void
  onSaveFailure: (error: unknown) => void
}): Promise<void> {
  if (!input.isDataGenerationCurrent() || !input.isAttemptCurrent()) return

  try {
    await input.save()
  } catch (error) {
    if (input.isDataGenerationCurrent() && input.isAttemptCurrent()) {
      input.onSaveFailure(error)
    }
    return
  }

  if (!input.isDataGenerationCurrent()) return
  input.onPublishHistory(input.session)
  if (input.isAttemptCurrent()) {
    input.onSaveForCurrentAttempt()
  }
}

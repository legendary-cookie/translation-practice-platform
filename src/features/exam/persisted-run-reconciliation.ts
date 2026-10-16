import type { ActiveExamRun, ExamProfile } from '../../domain/types'
import { advanceSection, decrementTimers, isLastSection } from '../../domain/exam'

export function reconcilePersistedRun(
  run: ActiveExamRun,
  profile: ExamProfile,
  nowMs = Date.now(),
): ActiveExamRun {
  if (run.evaluationPausedAt) return run
  const savedAt = Date.parse(run.lastSavedAt)
  const elapsedSinceSave = Number.isFinite(savedAt)
    ? Math.max(0, Math.floor((nowMs - savedAt) / 1000))
    : 0
  if (elapsedSinceSave === 0) return run

  const { run: updatedRun, overallExpired } = decrementTimers(run, profile, elapsedSinceSave)
  let nextRun = updatedRun
  if (!overallExpired) {
    while (!isLastSection(nextRun, profile)) {
      const sectionId = profile.sections[nextRun.currentSectionIndex]?.id
      if (!sectionId || (nextRun.sectionRemainingSeconds[sectionId] ?? 0) > 0) break
      nextRun = advanceSection(nextRun, profile)
    }
  }
  return nextRun
}

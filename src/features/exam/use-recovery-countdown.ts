import { useEffect, useState } from 'react'
import type { ActiveExamRun } from '../../domain/types'

export function useRecoveryCountdown(run?: ActiveExamRun): number | undefined {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    if (!run || run.evaluationPausedAt) {
      return
    }
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [run?.id, run?.lastSavedAt, run?.evaluationPausedAt])

  if (!run || run.evaluationPausedAt) {
    return run?.overallRemainingSeconds
  }
  const savedAt = Date.parse(run.lastSavedAt)
  if (!Number.isFinite(savedAt)) {
    return run.overallRemainingSeconds
  }
  const elapsedSeconds = Math.max(0, Math.floor((now - savedAt) / 1000))
  return Math.max(0, run.overallRemainingSeconds - elapsedSeconds)
}

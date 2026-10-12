export type PausedElapsedClock = { startedAt: number; pausedAt: number }

export function pauseElapsedClock(startedAt: number, now: number): PausedElapsedClock {
  return { startedAt, pausedAt: now }
}

export function resumeElapsedClock(startedAt: number, pausedAt: number, now: number): number {
  return startedAt + Math.max(0, now - pausedAt)
}

export function elapsedSecondsAt(startedAt: number, now: number, pausedAt?: number): number {
  return Math.floor((Math.max(startedAt, pausedAt ?? now) - startedAt) / 1000)
}

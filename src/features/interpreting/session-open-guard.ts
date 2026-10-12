export type InterpretingSessionOpenAttempt = {
  openGeneration: number
  dataGeneration: number
}

export type InterpretingSessionOpenState = {
  openGeneration: number
  dataGeneration: number
  page: string
}

export function isInterpretingOpenCurrent(
  attempt: InterpretingSessionOpenAttempt,
  current: InterpretingSessionOpenState,
): boolean {
  return attempt.openGeneration === current.openGeneration
    && attempt.dataGeneration === current.dataGeneration
    && current.page === 'progress'
}

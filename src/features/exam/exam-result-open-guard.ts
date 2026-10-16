export type ExamResultOpenAttempt = {
  requestGeneration: number
  dataGeneration: number
}

export type ExamResultOpenState = ExamResultOpenAttempt & { page: string }

export function isExamResultOpenCurrent(attempt: ExamResultOpenAttempt, current: ExamResultOpenState): boolean {
  return attempt.requestGeneration === current.requestGeneration
    && attempt.dataGeneration === current.dataGeneration
    && current.page === 'progress'
}

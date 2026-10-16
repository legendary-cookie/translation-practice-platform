export type WrittenConsentBinding = {
  exercise: { id: string }
  answer: string
  request: {
    exercise: { id: string }
    learnerAnswer?: string
  }
}

export function isWrittenConsentBoundToSubmission(
  pending: WrittenConsentBinding,
  activeExerciseId: string | undefined,
): boolean {
  return activeExerciseId === pending.exercise.id
    && pending.request.exercise.id === pending.exercise.id
    && pending.request.learnerAnswer === pending.answer
}

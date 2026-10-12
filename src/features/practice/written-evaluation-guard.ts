export type WrittenEvaluationAttempt = {
  generation: number
  exerciseId: string
}

export function createWrittenEvaluationGuard() {
  let generation = 0
  let activeExerciseId: string | undefined

  return {
    activate(exerciseId: string | undefined) {
      generation += 1
      activeExerciseId = exerciseId
    },

    begin(exerciseId: string): WrittenEvaluationAttempt {
      generation += 1
      activeExerciseId = exerciseId
      return { generation, exerciseId }
    },

    invalidate() {
      generation += 1
    },

    isCurrent(attempt: WrittenEvaluationAttempt): boolean {
      return attempt.generation === generation && attempt.exerciseId === activeExerciseId
    },
  }
}

export async function runWrittenEvaluationAttempt<T>(input: {
  guard: Pick<ReturnType<typeof createWrittenEvaluationGuard>, 'isCurrent'>
  attempt: WrittenEvaluationAttempt
  evaluate: () => Promise<T>
  onResult: (result: T) => void | Promise<void>
  onError: (error: unknown) => void
  onFinally: () => void
}): Promise<void> {
  try {
    const result = await input.evaluate()
    if (input.guard.isCurrent(input.attempt)) {
      await input.onResult(result)
    }
  } catch (error) {
    if (input.guard.isCurrent(input.attempt)) {
      input.onError(error)
    }
  } finally {
    if (input.guard.isCurrent(input.attempt)) {
      input.onFinally()
    }
  }
}

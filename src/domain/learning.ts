import { LANGUAGE_CODES } from './languages'
import type { Exercise, LanguageCode } from './types'

export type WrittenDraft = {
  exercise: Exercise
  answer: string
  elapsedSeconds: number
  timeLimitSeconds?: number
  updatedAt: string
}

export type ReviewState = { repetitions: number; intervalDays: number; ease: number; dueAt: string }
export type LearningCard = {
  id: string
  kind: 'glossary' | 'mistake'
  source: string
  target: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  notes: string
  mastered?: boolean
  dimension?: import('./types').ScoreDimension
  learnerQuote?: string
  createdAt: string
  review: ReviewState
}

export function newReviewState(now = new Date()): ReviewState {
  return { repetitions: 0, intervalDays: 0, ease: 2.5, dueAt: now.toISOString() }
}

/** SM-2 with Again/Hard/Good/Easy mapped to quality 1/3/4/5. */
export function reviewCard(state: ReviewState, grade: 1 | 2 | 3 | 4, now = new Date()): ReviewState {
  const quality = [1, 3, 4, 5][grade - 1]
  const ease = Math.max(1.3, state.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const repetitions = quality < 3 ? 0 : state.repetitions + 1
  const intervalDays = quality < 3 ? 1 : state.repetitions === 0 ? 1 : state.repetitions === 1 ? 6 : Math.max(1, Math.round(state.intervalDays * state.ease))
  return { repetitions, intervalDays, ease, dueAt: new Date(now.getTime() + intervalDays * 86_400_000).toISOString() }
}

export function readWrittenDraft(value: unknown): WrittenDraft | undefined {
  if (!value || typeof value !== 'object') return undefined
  const draft = value as WrittenDraft
  if (!draft.exercise || typeof draft.exercise.id !== 'string' || typeof draft.exercise.sourceText !== 'string'
    || !Array.isArray(draft.exercise.glossary) || !draft.exercise.glossary.every((entry) => entry && typeof entry.term === 'string' && typeof entry.note === 'string')
    || !LANGUAGE_CODES.includes(draft.exercise.sourceLanguage) || !LANGUAGE_CODES.includes(draft.exercise.targetLanguage)
    || typeof draft.exercise.title !== 'string' || !['written', 'news'].includes(draft.exercise.mode) || typeof draft.answer !== 'string'
    || !Number.isFinite(draft.elapsedSeconds) || draft.elapsedSeconds < 0
    || !Number.isFinite(Date.parse(draft.updatedAt))
    || (draft.timeLimitSeconds !== undefined && (!Number.isFinite(draft.timeLimitSeconds) || draft.timeLimitSeconds <= 0))) return undefined
  return draft
}

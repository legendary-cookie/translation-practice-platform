import type { LanguageCode } from './languages'

export type PracticeMode = 'written' | 'news'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type ExerciseTag = 'general' | 'news'

export type GlossaryEntry = {
  term: string
  note: string
  targetHint?: string
}

export type Exercise = {
  id: string
  mode: PracticeMode
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  title: string
  topic: string
  difficulty: Difficulty
  sourceText: string
  glossary: GlossaryEntry[]
  tags: ExerciseTag[]
}

export type EvaluationInput = {
  exercise: Exercise
  learnerAnswer: string
  mode: PracticeMode
}

export type ScoreDimension = 'accuracy' | 'terminology' | 'grammar' | 'fluency' | 'taskStyle'

export type FeedbackDimensions = Record<ScoreDimension, number>

export type FeedbackAnnotation = {
  dimension: ScoreDimension
  sourceQuote: string
  learnerQuote: string
  explanation: string
  suggestion: string
}

export type TranslationFeedback = {
  summary: string
  overallScore: number
  dimensions: FeedbackDimensions
  strengths: string[]
  issues: FeedbackAnnotation[]
  alternatives: string[]
  uncertainty: string
}

export type SessionRecord = {
  id: string
  createdAt: string
  exerciseId: string
  mode: PracticeMode
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  answer: string
  feedback: TranslationFeedback
  elapsedSeconds: number
}

export type EvaluationMode = 'local-only' | 'local-first-cloud-fallback'

export type LocalModelStatus = 'not-prepared' | 'preparing' | 'ready' | 'unavailable'

export const DEFAULT_LOCAL_MODEL_ID = 'Qwen3-1.7B-q4f16_1-MLC'

export type StoredSettings = {
  id: 'default'
  evaluationMode: EvaluationMode
  cloudBaseUrl: string
  cloudModel: string
  localModelStatus: LocalModelStatus
}

export type ExportData = {
  version: 1
  exportedAt: string
  settings: StoredSettings
  sessions: SessionRecord[]
}

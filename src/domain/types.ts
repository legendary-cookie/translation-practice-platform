export type LanguageCode = 'zh' | 'en' | 'ru' | 'fr' | 'hi' | 'es' | 'ar'
export type PracticeMode = 'written' | 'news'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface Exercise {
  id: string
  mode: PracticeMode
  sourceLanguage: LanguageCode
  title: string
  topic: string
  difficulty: Difficulty
  sourceText: string
  glossary: { term: string; hint: string }[]
  style: 'general' | 'news'
  provenance: 'original'
  authoredAt: string
}

export interface EvaluationInput {
  exercise: Exercise
  targetLanguage: LanguageCode
  learnerAnswer: string
}

export type EvaluationRouteResult =
  | { status: 'complete'; feedback: TranslationFeedback }
  | { status: 'needs-consent'; input: EvaluationInput; payloadSummary: string }
  | { status: 'unavailable'; reason: string }

export interface LocalModelState {
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'error'
  progress: number
  message: string
  cached: boolean | null
}

export type EvaluationDimension = 'accuracy' | 'coverage' | 'terminology' | 'grammar' | 'fluency'

export interface FeedbackIssue {
  dimension: EvaluationDimension
  severity: 'major' | 'minor' | 'suggestion'
  sourceQuote: string
  learnerQuote: string
  explanation: string
  suggestion: string
}

export interface TranslationFeedback {
  summary: string
  dimensions: Record<EvaluationDimension, number>
  strengths: string[]
  issues: FeedbackIssue[]
  uncertainty: string[]
}

export interface SessionRecord {
  id: string
  createdAt: string
  exerciseId: string
  mode: PracticeMode
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  learnerAnswer: string
  feedback: TranslationFeedback
  elapsedSeconds: number
}

export interface AppSettings {
  privacyMode: 'local-only' | 'local-first'
  cloudBaseUrl?: string
  cloudModel?: string
  localModelId: string
}

export interface ExportBundle {
  version: 1
  exportedAt: string
  settings: AppSettings
  sessions: SessionRecord[]
}

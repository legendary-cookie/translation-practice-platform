import type { LanguageCode } from './languages'

export type { LanguageCode }

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

export type ExamType = 'CATTI' | 'MTI'

export type ExamLevel = 'Level 1' | 'Level 2' | 'Level 3' | 'MTI 357' | 'MTI 448'

export type ExamAidPolicy = {
  paperDictionaryAllowed: boolean
  onlineSearchAllowed: false
  glossaryAllowed: false
  notes: string
}

export type ExamPassage = {
  id: string
  title: string
  sourceText: string
  wordCount: number
  targetLanguage: LanguageCode
  recommendedPace?: string
  isProvisional?: boolean
}

export type ExamSectionConfig = {
  id: string
  title: string
  direction: string
  taskType: 'translation' | 'terminology' | 'proofreading'
  timeLimitMinutes: number
  maxPoints: number
  passages: ExamPassage[]
  isProvisional?: boolean
  provisionalNotes?: string
}

export type ExamBenchmarkType = 'fixed-60-percent' | 'administration-dependent' | 'national-line-estimate'

export type ExamProfileStatus = 'verified' | 'provisional_draft'

export type ExamProfileAuthority = 'official-syllabus-baseline' | 'named-university-admission-year'

export type ExamProvisionalDetails = {
  isStructureProvisional?: boolean
  isTimingProvisional?: boolean
  isBenchmarkProvisional?: boolean
  notes: string[]
}

export type ExamProfile = {
  id: string
  version: number
  examType: ExamType
  level: ExamLevel
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  title: string
  description: string
  totalDurationMinutes: number
  maxTotalPoints: number
  passBenchmarkPoints: number
  benchmarkType: ExamBenchmarkType
  sections: ExamSectionConfig[]
  allowedAids: ExamAidPolicy
  disclaimer: string
  status: ExamProfileStatus
  authority?: ExamProfileAuthority
  authoritySourceDate?: string
  authorityNote?: string
  benchmarkNote?: string
  provisionalDetails?: ExamProvisionalDetails
}

export type ActiveExamRun = {
  id: string
  profileId: string
  profileVersion: number
  status: 'in-progress' | 'completed' | 'abandoned'
  startedAt: string
  lastSavedAt: string
  currentSectionIndex: number
  overallRemainingSeconds: number
  sectionRemainingSeconds: Record<string, number>
  answers: Record<string, Record<string, string>>
}

export type PassageFeedbackItem = {
  passageId: string
  passageTitle: string
  feedback: TranslationFeedback
  answer: string
  sourceText: string
  /** Optional so reports can still open results saved before language metadata was added. */
  sourceLanguage?: LanguageCode
  targetLanguage?: LanguageCode
}

export type SectionResult = {
  sectionId: string
  sectionTitle: string
  score: number
  maxPoints: number
  passageFeedbacks: PassageFeedbackItem[]
}

export type EstimatedStatus = 'above-benchmark' | 'near-benchmark' | 'below-benchmark'

export type ConsolidatedExamResult = {
  id: string
  runId: string
  completedAt: string
  profileId: string
  profileVersion: number
  examTitle: string
  totalScore: number
  maxScore: number
  percentage: number
  passBenchmark: number
  estimatedStatus: EstimatedStatus
  sectionResults: SectionResult[]
  consolidatedDimensions: FeedbackDimensions
  disclaimer: string
  benchmarkLabel?: string
  benchmarkNote?: string
  authorityNote?: string
  isProvisional?: boolean
}

export type ExportData = {
  version: 2
  exportedAt: string
  settings: StoredSettings
  sessions: SessionRecord[]
  examRuns?: ActiveExamRun[]
  examResults?: ConsolidatedExamResult[]
  examProfiles?: ExamProfile[]
}


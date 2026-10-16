import type { LanguageCode } from './languages'

export type { LanguageCode }

export type WrittenPracticeMode = 'written' | 'news'
export type PracticeMode = WrittenPracticeMode | 'interpreting'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type ExerciseTag = 'general' | 'news'

export type GlossaryEntry = {
  term: string
  note: string
  targetHint?: string
}

export type Exercise = {
  id: string
  mode: WrittenPracticeMode
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  title: string
  topic: string
  difficulty: Difficulty
  sourceText: string
  glossary: GlossaryEntry[]
  tags: ExerciseTag[]
}

export type InterpretingMode = 'consecutive' | 'simultaneous'

export type AudioSegment = {
  id: string
  startMs: number
  endMs: number
  transcript: string
}

export type InterpretingExercise = {
  id: string
  mode: 'interpreting'
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  title: string
  topic: string
  difficulty: Difficulty
  audioUrl: string
  audioMimeType: string
  durationMs: number
  segments: AudioSegment[]
  glossary: GlossaryEntry[]
  tags: ExerciseTag[]
  rightsRecordId: string
  sourceTranscriptStatus?: 'authored' | 'missing'
  sourceAudioDisclosure?: string
}

export type InterpretingExerciseSnapshot = Omit<InterpretingExercise, 'audioUrl'>

export type EvaluationInput = {
  exercise: Exercise
  learnerAnswer: string
  mode: WrittenPracticeMode
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

export type RecognitionStatus = 'verified' | 'uncertain' | 'unavailable'
export type TranscriptSource = 'manual' | 'on-device'

export type InterpretingResponseSegment = {
  id: string
  sourceSegmentId: string
  recordingId?: string
  responseStartMs: number
  responseEndMs: number
  transcript: string
  transcriptSource: TranscriptSource
  recognitionStatus: RecognitionStatus
  recognitionConfidence?: number
}

export type DeliveryAnalysis = {
  recordingId?: string
  durationMs: number
  activeSpeechRatio: number
  pauseCount: number
  longestPauseMs: number
  wordsPerMinute?: number
  signalQuality?: number
  analysisConfidence: number
  method: string
}

export type AudioRecordingRecord = {
  id: string
  exerciseId: string
  segmentIds: string[]
  sessionId?: string
  createdAt: string
  mimeType: string
  durationMs: number
  byteLength: number
  blob: Blob
  kind?: 'response' | 'source-import' | 'source-bundled'
  fileName?: string
}

export type ExportedAudioRecording = Omit<AudioRecordingRecord, 'blob'> & {
  dataUrl: string
}

export type InterpretingEvaluationInput = {
  exercise: InterpretingExercise
  interpretingMode: InterpretingMode
  responseSegments: InterpretingResponseSegment[]
  recordings: AudioRecordingRecord[]
  deliveryAnalysis: DeliveryAnalysis[]
  sourceRecording?: AudioRecordingRecord
}

/** Ephemeral trust metadata produced only when a consented cloud request actually attaches these recordings. */
export type ConsentedCloudAudioEvidence = {
  providerUrl: string
  model: string
  taskConsentGranted: true
  attachedRecordingIds: readonly string[]
  audioAttachments: readonly {
    attachmentIndex: number
    recordingId: string
    responseSegments: readonly {
      responseSegmentId: string
      sourceSegmentId: string
      responseStartMs: number
      responseEndMs: number
    }[]
  }[]
}

export type InterpretingContentScores = {
  meaningTransfer: number
  omissions: number
  additionsMistranslations: number
  terminology: number
}

export type InterpretingDeliveryScores = {
  fluency: number
  pacing: number
  hesitation: number
}

export type InterpretingAnnotationCategory =
  | 'meaning-transfer'
  | 'omission'
  | 'addition-mistranslation'
  | 'terminology'
  | 'fluency'
  | 'pacing'
  | 'hesitation'

export type InterpretingEvidenceStatus = 'verified' | 'uncertain' | 'insufficient'

export type InterpretingAnnotation = {
  category: InterpretingAnnotationCategory
  sourceSegmentId: string
  responseSegmentId?: string
  sourceQuote?: string
  learnerQuote?: string
  explanation: string
  suggestion: string
  evidenceStatus: InterpretingEvidenceStatus
  recognitionConfidence?: number
  analysisConfidence?: number
}

export type InterpretingFeedback = {
  contentScores?: InterpretingContentScores
  contentScoreStatus: 'complete' | 'incomplete'
  deliveryScores?: InterpretingDeliveryScores
  deliveryScoreStatus?: 'complete' | 'incomplete'
  deliveryEvidenceSource?: 'local-analysis' | 'consented-cloud-audio'
  overallScore?: number
  summary: string
  strengths: string[]
  issues: InterpretingAnnotation[]
  uncertainEvidence: InterpretingAnnotation[]
  alternatives: string[]
  uncertainty: string
  recognitionConfidence?: number
  audioAnalysisConfidence?: number
}

export type EvaluationRequest = EvaluationInput | InterpretingEvaluationInput
export type EvaluationFeedback = TranslationFeedback | InterpretingFeedback

export type SessionRecord = {
  id: string
  createdAt: string
  exerciseId: string
  mode: WrittenPracticeMode
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  exerciseSnapshot?: Exercise
  answer: string
  feedback: TranslationFeedback
  elapsedSeconds: number
}

export type InterpretingSessionRecord = {
  id: string
  createdAt: string
  exerciseId: string
  mode: 'interpreting'
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  interpretingMode: InterpretingMode
  responseSegments: InterpretingResponseSegment[]
  recordingIds: string[]
  sourceRecordingId?: string
  sourceExercise?: InterpretingExerciseSnapshot
  exerciseSnapshotVersion?: 1
  deliveryAnalysis: DeliveryAnalysis[]
  feedback: InterpretingFeedback
  evaluator: 'local' | 'cloud' | 'manual'
}

export type EvaluationMode = 'local-only' | 'local-first-cloud-fallback'

export type LocalModelStatus = 'not-prepared' | 'preparing' | 'ready' | 'unavailable'

export const DEFAULT_LOCAL_MODEL_ID = 'Qwen3.5-4B-q4f16_1-MLC'

export type StoredSettings = {
  id: 'default'
  evaluationMode: EvaluationMode
  cloudBaseUrl: string
  cloudModel: string
  cloudSupportsAudio: boolean
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
  rubricVersion: string
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
  /** Set when an automatic expiry submission has been attempted, so a blocked evaluation can be retried explicitly. */
  submissionAttemptedAt?: string
  /** A manually submitted attempt is paused while feedback or consent is being resolved. */
  evaluationPausedAt?: string
  /** Per-tab editor lease; IndexedDB transactions are authoritative for ownership. */
  editorToken?: string
  /** Monotonic revision for answer, timer, and section mutations. */
  revision?: number
  /** Lease expiry mirrored in localStorage for synchronous crash checkpoints. */
  editorLeaseExpiresAt?: string
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
  /** Detached profile configuration captured at evaluation time for historical reproducibility. */
  profileSnapshot: ExamProfile
  rubricVersion: string
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
  version: 5
  exerciseCatalog?: Exercise[]
  feedbackRatings?: import('./profile').FeedbackRating[]
  writtenDraft?: import('./learning').WrittenDraft
  learningCards?: import('./learning').LearningCard[]
  exportedAt: string
  settings: StoredSettings
  sessions: SessionRecord[]
  interpretingSessions?: InterpretingSessionRecord[]
  recordings?: ExportedAudioRecording[]
  examRuns?: ActiveExamRun[]
  examResults?: ConsolidatedExamResult[]
  examProfiles?: ExamProfile[]
}


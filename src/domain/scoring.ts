import type {
  EstimatedStatus,
  ExamProfile,
  FeedbackAnnotation,
  FeedbackDimensions,
  InterpretingAnnotation,
  InterpretingAnnotationCategory,
  InterpretingEvaluationInput,
  InterpretingFeedback,
  InterpretingContentScores,
  InterpretingDeliveryScores,
  LanguageCode,
  PassageFeedbackItem,
  ScoreDimension,
  SectionResult,
  TranslationFeedback,
} from './types'

export function hasCompleteInterpretingDeliveryEvidence(
  input: Pick<InterpretingEvaluationInput, 'responseSegments' | 'recordings' | 'deliveryAnalysis'>,
): boolean {
  if (input.responseSegments.length === 0) return false
  const recordingsById = new Map(input.recordings.map((recording) => [recording.id, recording]))
  return input.responseSegments.every((segment) => {
    if (!segment.recordingId || !Number.isFinite(segment.responseStartMs) || !Number.isFinite(segment.responseEndMs)) {
      return false
    }
    const recording = recordingsById.get(segment.recordingId)
    const analysis = input.deliveryAnalysis.find((candidate) => candidate.recordingId === segment.recordingId)
    return Boolean(recording
      && recording.durationMs > 0
      && segment.responseStartMs >= 0
      && segment.responseEndMs > segment.responseStartMs
      && segment.responseEndMs <= recording.durationMs
      && analysis
      && analysis.analysisConfidence >= 0.5
      && !analysis.method.startsWith('local-web-audio-energy-')
      && analysis.method !== 'local-analysis-unavailable-v1')
  })
}
import { getEstimatedStatus } from './exam'

export type FeedbackValidationContext = {
  sourceText: string
  learnerAnswer: string
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedbackValidationError'
  }
}

const scoreDimensions: ScoreDimension[] = ['accuracy', 'terminology', 'grammar', 'fluency', 'taskStyle']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FeedbackValidationError(`Feedback is missing required field: ${fieldName}.`)
  }
  return value.trim()
}

function normalizeScore(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FeedbackValidationError(`Feedback has an invalid score for ${fieldName}.`)
  }
  if (value < 0 || value > 100) {
    throw new FeedbackValidationError(`Feedback score for ${fieldName} must be between 0 and 100.`)
  }
  return Math.round(value)
}

function normalizeDimensions(raw: Record<string, unknown>): FeedbackDimensions {
  const dimensionsValue = raw.dimensions ?? raw.scores
  if (!isRecord(dimensionsValue)) {
    throw new FeedbackValidationError('Feedback is missing the five dimension scores.')
  }

  return scoreDimensions.reduce<FeedbackDimensions>((dimensions, dimension) => {
    dimensions[dimension] = normalizeScore(dimensionsValue[dimension], dimension)
    return dimensions
  }, {} as FeedbackDimensions)
}

function normalizeStringList(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new FeedbackValidationError(`Feedback is missing required list: ${fieldName}.`)
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (isRecord(item) && typeof item.text === 'string') {
        return item.text.trim()
      }
      return ''
    })
    .filter((item) => item.length > 0)
}

function normalizeDimension(value: unknown): ScoreDimension {
  if (typeof value !== 'string' || !scoreDimensions.includes(value as ScoreDimension)) {
    throw new FeedbackValidationError('Feedback annotation has an invalid dimension.')
  }
  return value as ScoreDimension
}

function normalizeAnnotationQuote(
  value: Record<string, unknown>,
  primaryField: string,
  aliasField: string,
): string {
  const rawQuote = value[primaryField] !== undefined ? value[primaryField] : value[aliasField]
  if (rawQuote === undefined) {
    return ''
  }
  if (typeof rawQuote !== 'string') {
    throw new FeedbackValidationError(`Feedback annotation ${primaryField} must be text.`)
  }
  return rawQuote.trim()
}

function normalizeAnnotation(
  value: unknown,
  context: FeedbackValidationContext,
): FeedbackAnnotation {
  if (!isRecord(value)) {
    throw new FeedbackValidationError('Feedback annotation must be an object.')
  }

  const sourceQuote = normalizeAnnotationQuote(value, 'sourceQuote', 'sourceEvidence')
  const learnerQuote = normalizeAnnotationQuote(value, 'learnerQuote', 'answerQuote')

  if (!sourceQuote && !learnerQuote) {
    throw new FeedbackValidationError('Feedback annotation must include source or learner evidence.')
  }
  if (sourceQuote && !context.sourceText.includes(sourceQuote)) {
    throw new FeedbackValidationError('Feedback annotation source evidence must be copied literally from the source text.')
  }
  if (learnerQuote && !context.learnerAnswer.includes(learnerQuote)) {
    throw new FeedbackValidationError('Feedback annotation learner evidence must be copied literally from the learner answer.')
  }

  if (typeof value.explanation !== 'string' || value.explanation.trim().length === 0) {
    throw new FeedbackValidationError('Feedback annotation is missing an explanation.')
  }
  const rawSuggestion = value.suggestion !== undefined ? value.suggestion : value.revision
  if (typeof rawSuggestion !== 'string' || rawSuggestion.trim().length === 0) {
    throw new FeedbackValidationError('Feedback annotation is missing a suggested revision.')
  }

  return {
    dimension: normalizeDimension(value.dimension),
    sourceQuote,
    learnerQuote,
    explanation: value.explanation.trim(),
    suggestion: rawSuggestion.trim(),
  }
}

export function validateFeedback(raw: unknown, context: FeedbackValidationContext): TranslationFeedback {
  if (!isRecord(raw)) {
    throw new FeedbackValidationError('Feedback must be a JSON object.')
  }

  const dimensions = normalizeDimensions(raw)
  const strengths = normalizeStringList(raw.strengths, 'strengths')
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
  const uncertainty = requiredText(raw.uncertainty, 'uncertainty')
  const issueValues = Array.isArray(raw.issues) ? raw.issues : undefined

  if (!issueValues) {
    throw new FeedbackValidationError('Feedback is missing required list: issues.')
  }

  const issues = issueValues.map((issue) => normalizeAnnotation(issue, context))

  const suppliedOverall = raw.overallScore
  if (suppliedOverall !== undefined) {
    normalizeScore(suppliedOverall, 'overallScore')
  }
  // Keep the persisted/displayed total coherent with the validated rubric dimensions.
  const overallScore = Math.round(scoreDimensions.reduce((total, dimension) => total + dimensions[dimension], 0) / scoreDimensions.length)

  return {
    summary: requiredText(raw.summary, 'summary'),
    overallScore,
    dimensions,
    strengths,
    issues,
    alternatives,
    uncertainty,
  }
}

const interpretingCategories: InterpretingAnnotationCategory[] = [
  'meaning-transfer',
  'omission',
  'addition-mistranslation',
  'terminology',
  'fluency',
  'pacing',
  'hesitation',
]

export type InterpretingFeedbackValidationContext = Pick<InterpretingEvaluationInput, 'exercise' | 'responseSegments' | 'deliveryAnalysis' | 'recordings'>

function normalizeConfidence(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new FeedbackValidationError(`Interpreting feedback has an invalid confidence for ${fieldName}.`)
  }
  return Math.round(value * 100) / 100
}

function normalizeInterpretingCategory(value: unknown): InterpretingAnnotationCategory {
  if (typeof value !== 'string' || !interpretingCategories.includes(value as InterpretingAnnotationCategory)) {
    throw new FeedbackValidationError('Interpreting annotation has an invalid category.')
  }
  return value as InterpretingAnnotationCategory
}

function normalizeInterpretingAnnotation(
  value: unknown,
  context: InterpretingFeedbackValidationContext,
  expectedStatuses?: readonly ('uncertain' | 'insufficient')[],
): InterpretingAnnotation {
  if (!isRecord(value)) {
    throw new FeedbackValidationError('Interpreting annotation must be an object.')
  }

  const category = normalizeInterpretingCategory(value.category)
  const sourceSegmentId = requiredText(value.sourceSegmentId, 'sourceSegmentId')
  const sourceSegment = context.exercise.segments.find((segment) => segment.id === sourceSegmentId)
  if (!sourceSegment) {
    throw new FeedbackValidationError(`Interpreting annotation references unknown source segment: ${sourceSegmentId}.`)
  }

  const rawResponseSegmentId = value.responseSegmentId
  const responseSegmentId = rawResponseSegmentId === undefined ? undefined : requiredText(rawResponseSegmentId, 'responseSegmentId')
  const responseSegment = responseSegmentId
    ? context.responseSegments.find((segment) => segment.id === responseSegmentId)
    : undefined
  if (responseSegmentId && !responseSegment) {
    throw new FeedbackValidationError(`Interpreting annotation references unknown response segment: ${responseSegmentId}.`)
  }
  if (responseSegment && responseSegment.sourceSegmentId !== sourceSegmentId) {
    throw new FeedbackValidationError('Interpreting annotation response evidence must belong to the referenced source segment.')
  }

  const sourceQuote = value.sourceQuote === undefined ? undefined : requiredText(value.sourceQuote, 'sourceQuote')
  const learnerQuote = value.learnerQuote === undefined ? undefined : requiredText(value.learnerQuote, 'learnerQuote')
  if (sourceQuote && !sourceSegment.transcript.includes(sourceQuote)) {
    throw new FeedbackValidationError('Interpreting source evidence must be copied literally from the referenced segment.')
  }
  if (learnerQuote && (!responseSegment || !responseSegment.transcript.includes(learnerQuote))) {
    throw new FeedbackValidationError('Interpreting learner evidence must be copied literally from the referenced response.')
  }

  const rawStatus = value.evidenceStatus === undefined ? 'verified' : value.evidenceStatus
  if (rawStatus !== 'verified' && rawStatus !== 'uncertain' && rawStatus !== 'insufficient') {
    throw new FeedbackValidationError('Interpreting annotation has an invalid evidence status.')
  }
  if (expectedStatuses && (rawStatus === 'verified' || !expectedStatuses.includes(rawStatus as 'uncertain' | 'insufficient'))) {
    throw new FeedbackValidationError('Interpreting uncertain evidence has an inconsistent evidence status.')
  }

  const matchingAnalysis = responseSegment?.recordingId
    ? context.deliveryAnalysis.find((analysis) => analysis.recordingId === responseSegment.recordingId)
    : undefined
  const recognitionConfidence = responseSegment?.recognitionConfidence === undefined
    ? undefined
    : normalizeConfidence(responseSegment.recognitionConfidence, `responseSegments.${responseSegment.id}.recognitionConfidence`)
  const analysisConfidence = matchingAnalysis?.analysisConfidence === undefined
    ? undefined
    : normalizeConfidence(matchingAnalysis.analysisConfidence, `deliveryAnalysis.${responseSegment?.recordingId}.analysisConfidence`)
  // A low ASR estimate remains metadata, but explicit learner confirmation changes the evidence status.
  const unconfirmedRecognition = responseSegment !== undefined && responseSegment.recognitionStatus !== 'verified'
  const contentCategory = category === 'meaning-transfer' || category === 'omission' || category === 'addition-mistranslation' || category === 'terminology'
  const hasTranscriptEvidence = Boolean(responseSegment?.transcript.trim())
  const responseRecording = responseSegment?.recordingId
    ? context.recordings.find((recording) => recording.id === responseSegment.recordingId)
    : undefined
  const hasRecordingEvidence = responseRecording !== undefined
  const hasValidResponseRange = Boolean(responseSegment && responseRecording
    && responseRecording.durationMs > 0
    && Number.isFinite(responseSegment.responseStartMs)
    && Number.isFinite(responseSegment.responseEndMs)
    && responseSegment.responseStartMs >= 0
    && responseSegment.responseEndMs > responseSegment.responseStartMs
    && responseSegment.responseEndMs <= responseRecording.durationMs)
  const hasRecordedDeliveryEvidence = Boolean(hasRecordingEvidence && hasValidResponseRange && matchingAnalysis)
  const hasSourceTranscript = context.exercise.sourceTranscriptStatus !== 'missing'
  if (contentCategory && !sourceQuote && !learnerQuote) {
    throw new FeedbackValidationError('Content annotations must include literal source or learner text evidence.')
  }
  if (!contentCategory && (!responseSegment || !hasRecordedDeliveryEvidence)) {
    throw new FeedbackValidationError('Delivery annotations must reference a learner recording with local delivery analysis.')
  }
  let evidenceStatus: InterpretingAnnotation['evidenceStatus'] = rawStatus
  if (rawStatus === 'verified' && contentCategory) {
    if (!hasSourceTranscript || !responseSegment || !hasTranscriptEvidence) {
      evidenceStatus = 'insufficient'
    } else if (unconfirmedRecognition) {
      evidenceStatus = 'uncertain'
    }
  } else if (rawStatus === 'verified' && !contentCategory) {
    if (!hasRecordedDeliveryEvidence) {
      evidenceStatus = 'insufficient'
    } else if (analysisConfidence === undefined || analysisConfidence < 0.5) {
      evidenceStatus = 'uncertain'
    }
  }

  return {
    category,
    sourceSegmentId,
    responseSegmentId,
    sourceQuote,
    learnerQuote,
    explanation: requiredText(value.explanation, 'explanation'),
    suggestion: requiredText(value.suggestion ?? value.revision, 'suggestion'),
    evidenceStatus,
    recognitionConfidence,
    analysisConfidence,
  }
}

function normalizeInterpretingScores(raw: unknown, fieldName: string, fields: string[]): Record<string, number> {
  if (!isRecord(raw)) {
    throw new FeedbackValidationError(`Interpreting feedback is missing ${fieldName}.`)
  }
  return fields.reduce<Record<string, number>>((scores, field) => {
    scores[field] = normalizeScore(raw[field], `${fieldName}.${field}`)
    return scores
  }, {})
}

export function validateInterpretingFeedback(
  raw: unknown,
  context: InterpretingFeedbackValidationContext,
): InterpretingFeedback {
  if (!isRecord(raw)) {
    throw new FeedbackValidationError('Interpreting feedback must be a JSON object.')
  }
  if (!Array.isArray(raw.issues)) {
    throw new FeedbackValidationError('Interpreting feedback is missing required list: issues.')
  }

  const responseSegmentsById = new Map(context.responseSegments.map((segment) => [segment.id, segment]))
  const hasSourceTranscript = context.exercise.sourceTranscriptStatus !== 'missing'
  const allResponsesVerified = hasSourceTranscript && context.responseSegments.length > 0
    && context.responseSegments.every((segment) => segment.transcript.trim().length > 0 && segment.recognitionStatus === 'verified')
  const rawContentScores = raw.contentScores ?? raw.content
  const contentScoreValues = allResponsesVerified && rawContentScores !== undefined
    ? normalizeInterpretingScores(rawContentScores, 'contentScores', ['meaningTransfer', 'omissions', 'additionsMistranslations', 'terminology']) as InterpretingContentScores
    : undefined
  const contentScoreStatus: InterpretingFeedback['contentScoreStatus'] = allResponsesVerified && contentScoreValues ? 'complete' : 'incomplete'
  const hasReliableDeliveryEvidence = hasCompleteInterpretingDeliveryEvidence(context)
  const deliveryScores = hasReliableDeliveryEvidence
    ? normalizeInterpretingScores(raw.deliveryScores ?? raw.delivery, 'deliveryScores', ['fluency', 'pacing', 'hesitation']) as InterpretingDeliveryScores
    : undefined
  const deliveryScoreStatus: InterpretingFeedback['deliveryScoreStatus'] = deliveryScores ? 'complete' : 'incomplete'

  const normalizedAnnotations = raw.issues.map((issue) => normalizeInterpretingAnnotation(issue, context))
  const uncertainEvidence = Array.isArray(raw.uncertainEvidence)
    ? raw.uncertainEvidence.map((issue) => normalizeInterpretingAnnotation(issue, context, ['uncertain', 'insufficient']))
    : []
  const issues = normalizedAnnotations.filter((issue) => issue.evidenceStatus === 'verified')
  const movedUncertain = normalizedAnnotations.filter((issue) => issue.evidenceStatus !== 'verified')
  const allUncertainEvidence = [...uncertainEvidence, ...movedUncertain]

  for (const segment of context.responseSegments) {
    if (!responseSegmentsById.has(segment.id)) {
      throw new FeedbackValidationError(`Interpreting response segment is not internally addressable: ${segment.id}.`)
    }
  }

  const suppliedOverall = raw.overallScore
  if (suppliedOverall !== undefined) {
    normalizeScore(suppliedOverall, 'overallScore')
  }
  const overallScore = contentScoreStatus === 'complete' && contentScoreValues
    ? Math.round((contentScoreValues.meaningTransfer + contentScoreValues.omissions + contentScoreValues.additionsMistranslations + contentScoreValues.terminology) / 4)
    : undefined
  const recognitionValues = context.responseSegments.flatMap((segment) => segment.recognitionConfidence === undefined
    ? []
    : [normalizeConfidence(segment.recognitionConfidence, `responseSegments.${segment.id}.recognitionConfidence`)])
  const analysisValues = context.deliveryAnalysis.map((analysis) => normalizeConfidence(analysis.analysisConfidence, `deliveryAnalysis.${analysis.recordingId ?? 'unknown'}.analysisConfidence`))

  return {
    contentScores: contentScoreValues,
    contentScoreStatus,
    deliveryScores,
    deliveryScoreStatus,
    overallScore,
    summary: requiredText(raw.summary, 'summary'),
    strengths: normalizeStringList(raw.strengths, 'strengths'),
    issues,
    uncertainEvidence: allUncertainEvidence,
    alternatives: Array.isArray(raw.alternatives)
      ? raw.alternatives.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [],
    uncertainty: requiredText(raw.uncertainty, 'uncertainty'),
    recognitionConfidence: recognitionValues.length > 0 ? Math.round((recognitionValues.reduce((sum, value) => sum + value, 0) / recognitionValues.length) * 100) / 100 : undefined,
    audioAnalysisConfidence: analysisValues.length > 0 ? Math.round((analysisValues.reduce((sum, value) => sum + value, 0) / analysisValues.length) * 100) / 100 : undefined,
  }
}

export type SectionEvaluationInput = {
  sectionId: string
  sectionTitle: string
  maxPoints: number
  passages: Array<{
    passageId: string
    passageTitle: string
    sourceText: string
    sourceLanguage: LanguageCode
    targetLanguage: LanguageCode
    answer: string
    feedback: TranslationFeedback
  }>
}

export function aggregateExamScores(
  sections: SectionEvaluationInput[],
  profile: ExamProfile,
): {
  totalScore: number
  maxScore: number
  percentage: number
  estimatedStatus: EstimatedStatus
  sectionResults: SectionResult[]
  consolidatedDimensions: FeedbackDimensions
} {
  const sectionResults: SectionResult[] = []
  const allAnsweredDimensionWeights: Array<{ dimensions: FeedbackDimensions; weight: number }> = []

  for (const section of sections) {
    const passageCount = Math.max(1, section.passages.length)
    const passageMaxPoints = section.maxPoints / passageCount
    let sectionScore = 0
    const passageFeedbacks: PassageFeedbackItem[] = []

    for (const passage of section.passages) {
      const hasAnswer = passage.answer.trim().length > 0
      const passageScore = hasAnswer ? (passage.feedback.overallScore / 100) * passageMaxPoints : 0
      sectionScore += passageScore

      if (hasAnswer) {
        allAnsweredDimensionWeights.push({
          dimensions: passage.feedback.dimensions,
          weight: passageMaxPoints,
        })
      }

      passageFeedbacks.push({
        passageId: passage.passageId,
        passageTitle: passage.passageTitle,
        feedback: passage.feedback,
        answer: passage.answer,
        sourceText: passage.sourceText,
        sourceLanguage: passage.sourceLanguage,
        targetLanguage: passage.targetLanguage,
      })
    }

    sectionResults.push({
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      score: Math.round(sectionScore * 10) / 10,
      maxPoints: section.maxPoints,
      passageFeedbacks,
    })
  }

  const rawTotal = sectionResults.reduce((sum, item) => sum + item.score, 0)
  const totalScore = Math.min(profile.maxTotalPoints, Math.max(0, Math.round(rawTotal)))
  const maxScore = profile.maxTotalPoints
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const passBenchmarkPercent = maxScore > 0 ? Math.round((profile.passBenchmarkPoints / maxScore) * 100) : 0
  const estimatedStatus = getEstimatedStatus(percentage, passBenchmarkPercent)

  const totalAnsweredWeight = allAnsweredDimensionWeights.reduce((total, item) => total + item.weight, 0)
  const consolidatedDimensions = scoreDimensions.reduce<FeedbackDimensions>((acc, dimension) => {
    if (totalAnsweredWeight === 0) {
      acc[dimension] = 0
    } else {
      const weightedSum = allAnsweredDimensionWeights.reduce(
        (total, item) => total + item.dimensions[dimension] * item.weight,
        0,
      )
      acc[dimension] = Math.round(weightedSum / totalAnsweredWeight)
    }
    return acc
  }, {} as FeedbackDimensions)

  return {
    totalScore,
    maxScore,
    percentage,
    estimatedStatus,
    sectionResults,
    consolidatedDimensions,
  }
}


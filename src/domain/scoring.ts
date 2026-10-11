import type {
  EstimatedStatus,
  ExamProfile,
  FeedbackAnnotation,
  FeedbackDimensions,
  PassageFeedbackItem,
  ScoreDimension,
  SectionResult,
  TranslationFeedback,
} from './types'
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

function clampScore(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FeedbackValidationError(`Feedback has an invalid score for ${fieldName}.`)
  }
  return Math.round(Math.min(100, Math.max(0, value)))
}

function normalizeDimensions(raw: Record<string, unknown>): FeedbackDimensions {
  const dimensionsValue = raw.dimensions ?? raw.scores
  if (!isRecord(dimensionsValue)) {
    throw new FeedbackValidationError('Feedback is missing the five dimension scores.')
  }

  return scoreDimensions.reduce<FeedbackDimensions>((dimensions, dimension) => {
    dimensions[dimension] = clampScore(dimensionsValue[dimension], dimension)
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
  return typeof value === 'string' && scoreDimensions.includes(value as ScoreDimension)
    ? value as ScoreDimension
    : 'accuracy'
}

function normalizeAnnotation(
  value: unknown,
  context: FeedbackValidationContext,
): FeedbackAnnotation | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const sourceQuote = typeof value.sourceQuote === 'string'
    ? value.sourceQuote.trim()
    : typeof value.sourceEvidence === 'string'
      ? value.sourceEvidence.trim()
      : ''
  const learnerQuote = typeof value.learnerQuote === 'string'
    ? value.learnerQuote.trim()
    : typeof value.answerQuote === 'string'
      ? value.answerQuote.trim()
      : ''

  if (!sourceQuote && !learnerQuote) {
    return undefined
  }
  if ((sourceQuote && !context.sourceText.includes(sourceQuote)) || (learnerQuote && !context.learnerAnswer.includes(learnerQuote))) {
    return undefined
  }

  if (typeof value.explanation !== 'string' || value.explanation.trim().length === 0) {
    return undefined
  }
  const suggestion = typeof value.suggestion === 'string'
    ? value.suggestion
    : typeof value.revision === 'string'
      ? value.revision
      : ''
  if (!suggestion.trim()) {
    return undefined
  }

  return {
    dimension: normalizeDimension(value.dimension),
    sourceQuote,
    learnerQuote,
    explanation: value.explanation.trim(),
    suggestion: suggestion.trim(),
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

  const issues = issueValues
    .map((issue) => normalizeAnnotation(issue, context))
    .filter((issue): issue is FeedbackAnnotation => issue !== undefined)

  const suppliedOverall = raw.overallScore
  const overallScore = typeof suppliedOverall === 'number' && Number.isFinite(suppliedOverall)
    ? Math.round(Math.min(100, Math.max(0, suppliedOverall)))
    : Math.round(scoreDimensions.reduce((total, dimension) => total + dimensions[dimension], 0) / scoreDimensions.length)

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

export type SectionEvaluationInput = {
  sectionId: string
  sectionTitle: string
  maxPoints: number
  passages: Array<{
    passageId: string
    passageTitle: string
    sourceText: string
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
  const allAnsweredDimensions: FeedbackDimensions[] = []

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
        allAnsweredDimensions.push(passage.feedback.dimensions)
      }

      passageFeedbacks.push({
        passageId: passage.passageId,
        passageTitle: passage.passageTitle,
        feedback: passage.feedback,
        answer: passage.answer,
        sourceText: passage.sourceText,
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

  const consolidatedDimensions = scoreDimensions.reduce<FeedbackDimensions>((acc, dimension) => {
    if (allAnsweredDimensions.length === 0) {
      acc[dimension] = 0
    } else {
      const sum = allAnsweredDimensions.reduce((total, dim) => total + dim[dimension], 0)
      acc[dimension] = Math.round(sum / allAnsweredDimensions.length)
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


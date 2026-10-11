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

function validateScore(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FeedbackValidationError(`Feedback has an invalid score for ${fieldName}.`)
  }
  if (value < 0 || value > 100) {
    throw new FeedbackValidationError(`Feedback has an out-of-range score for ${fieldName}.`)
  }
  return Math.round(value)
}

function normalizeDimensions(raw: Record<string, unknown>): FeedbackDimensions {
  const dimensionsValue = raw.dimensions ?? raw.scores
  if (!isRecord(dimensionsValue)) {
    throw new FeedbackValidationError('Feedback is missing the five dimension scores.')
  }

  return scoreDimensions.reduce<FeedbackDimensions>((dimensions, dimension) => {
    dimensions[dimension] = validateScore(dimensionsValue[dimension], dimension)
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
  if (typeof value === 'string' && scoreDimensions.includes(value as ScoreDimension)) {
    return value as ScoreDimension
  }
  throw new FeedbackValidationError('Feedback contains an annotation with an invalid dimension.')
}

function normalizeAnnotation(
  value: unknown,
  context: FeedbackValidationContext,
): FeedbackAnnotation {
  if (!isRecord(value)) {
    throw new FeedbackValidationError('Feedback contains an invalid issue annotation.')
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
    throw new FeedbackValidationError('Feedback issue annotations must include quoted evidence.')
  }
  if ((sourceQuote && !context.sourceText.includes(sourceQuote)) || (learnerQuote && !context.learnerAnswer.includes(learnerQuote))) {
    throw new FeedbackValidationError('Feedback issue annotation contains evidence absent from the source or learner answer.')
  }

  if (typeof value.explanation !== 'string' || value.explanation.trim().length === 0) {
    throw new FeedbackValidationError('Feedback issue annotation is missing an explanation.')
  }
  const suggestion = typeof value.suggestion === 'string'
    ? value.suggestion
    : typeof value.revision === 'string'
      ? value.revision
      : ''
  if (!suggestion.trim()) {
    throw new FeedbackValidationError('Feedback issue annotation is missing a suggestion.')
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

  const issues = issueValues.map((issue) => normalizeAnnotation(issue, context))

  const overallScore = validateScore(raw.overallScore, 'overallScore')

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
  const weightedDimensions = scoreDimensions.reduce<Record<ScoreDimension, number>>((totals, dimension) => {
    totals[dimension] = 0
    return totals
  }, {} as Record<ScoreDimension, number>)
  let answeredPointWeight = 0

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
        answeredPointWeight += passageMaxPoints
        for (const dimension of scoreDimensions) {
          weightedDimensions[dimension] += passage.feedback.dimensions[dimension] * passageMaxPoints
        }
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
    if (answeredPointWeight === 0) {
      acc[dimension] = 0
    } else {
      acc[dimension] = Math.round(weightedDimensions[dimension] / answeredPointWeight)
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


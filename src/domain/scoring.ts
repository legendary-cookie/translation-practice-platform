import type { EvaluationDimension, EvaluationInput, FeedbackIssue, TranslationFeedback } from './types'

export const evaluationDimensions: readonly EvaluationDimension[] = ['accuracy', 'coverage', 'terminology', 'grammar', 'fluency']
export const dimensionLabels: Record<EvaluationDimension, string> = {
  accuracy: 'Accuracy', coverage: 'Omissions / additions', terminology: 'Terminology',
  grammar: 'Grammar', fluency: 'Fluency / register',
}

function fail(path: string, expected: string): never {
  throw new Error(`Invalid feedback: ${path} must be ${expected}.`)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'an object')
  return value as Record<string, unknown>
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > 10000 || (!allowEmpty && !value.trim())) fail(path, 'nonempty text of at most 10,000 characters')
  return value
}

function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > 30) fail(path, 'an array of at most 30 strings')
  return value.map((item, index) => string(item, `${path}[${index}]`))
}

export function validateFeedback(value: unknown, input: EvaluationInput): TranslationFeedback {
  const feedback = object(value, 'response')
  const rawDimensions = object(feedback.dimensions, 'dimensions')
  if (Object.keys(rawDimensions).some((key) => !evaluationDimensions.includes(key as EvaluationDimension))) fail('dimensions', 'only the five rubric dimensions')
  const dimensions = {} as Record<EvaluationDimension, number>
  for (const dimension of evaluationDimensions) {
    const score = rawDimensions[dimension]
    if (typeof score !== 'number' || !Number.isFinite(score)) fail(`dimensions.${dimension}`, 'a finite number')
    dimensions[dimension] = Math.min(100, Math.max(0, score))
  }
  if (!Array.isArray(feedback.issues) || feedback.issues.length > 40) fail('issues', 'an array of at most 40 issues')
  const issues = feedback.issues.map((value, index): FeedbackIssue => {
    const path = `issues[${index}]`
    const issue = object(value, path)
    if (!evaluationDimensions.includes(issue.dimension as EvaluationDimension)) fail(`${path}.dimension`, 'a rubric dimension')
    if (!['major', 'minor', 'suggestion'].includes(issue.severity as string)) fail(`${path}.severity`, 'major, minor, or suggestion')
    return {
      dimension: issue.dimension as EvaluationDimension,
      severity: issue.severity as FeedbackIssue['severity'],
      sourceQuote: string(issue.sourceQuote, `${path}.sourceQuote`, true),
      learnerQuote: string(issue.learnerQuote, `${path}.learnerQuote`, true),
      explanation: string(issue.explanation, `${path}.explanation`),
      suggestion: string(issue.suggestion, `${path}.suggestion`),
    }
  }).filter((issue) => {
    // An omission may have no learner span; an addition may have no source span.
    const hasSource = issue.sourceQuote.trim().length > 0
    const hasAnswer = issue.learnerQuote.trim().length > 0
    return (hasSource || hasAnswer)
      && (!hasSource || input.exercise.sourceText.includes(issue.sourceQuote))
      && (!hasAnswer || input.learnerAnswer.includes(issue.learnerQuote))
  })
  const uncertainty = strings(feedback.uncertainty, 'uncertainty').slice(0, 28)
  uncertainty.push('AI scores are uncalibrated practice estimates, not official CATTI / MTI assessments. Valid alternative translations may be missed.')
  if (issues.length !== feedback.issues.length) uncertainty.push('Some model annotations were discarded because their quoted evidence did not match the submitted text.')
  return {
    summary: string(feedback.summary, 'summary'), dimensions,
    strengths: strings(feedback.strengths, 'strengths'), issues,
    uncertainty: [...new Set(uncertainty)],
  }
}

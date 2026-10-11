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

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string')
  return value
}

function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'an array of strings')
  return value.map((item, index) => string(item, `${path}[${index}]`))
}

export function validateFeedback(value: unknown, input: EvaluationInput): TranslationFeedback {
  const feedback = object(value, 'response')
  const rawDimensions = object(feedback.dimensions, 'dimensions')
  const dimensions = {} as Record<EvaluationDimension, number>
  for (const dimension of evaluationDimensions) {
    const score = rawDimensions[dimension]
    if (typeof score !== 'number' || !Number.isFinite(score)) fail(`dimensions.${dimension}`, 'a finite number')
    dimensions[dimension] = Math.min(100, Math.max(0, score))
  }
  if (!Array.isArray(feedback.issues)) fail('issues', 'an array')
  const issues = feedback.issues.map((value, index): FeedbackIssue => {
    const path = `issues[${index}]`
    const issue = object(value, path)
    if (!evaluationDimensions.includes(issue.dimension as EvaluationDimension)) fail(`${path}.dimension`, 'a rubric dimension')
    if (!['major', 'minor', 'suggestion'].includes(issue.severity as string)) fail(`${path}.severity`, 'major, minor, or suggestion')
    return {
      dimension: issue.dimension as EvaluationDimension,
      severity: issue.severity as FeedbackIssue['severity'],
      sourceQuote: string(issue.sourceQuote, `${path}.sourceQuote`),
      learnerQuote: string(issue.learnerQuote, `${path}.learnerQuote`),
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
  return {
    summary: string(feedback.summary, 'summary'), dimensions,
    strengths: strings(feedback.strengths, 'strengths'), issues,
    uncertainty: strings(feedback.uncertainty, 'uncertainty'),
  }
}

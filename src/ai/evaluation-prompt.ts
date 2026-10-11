import { getLanguage } from '../domain/languages'
import type { EvaluationInput, ScoreDimension } from '../domain/types'

const dimensions: ScoreDimension[] = ['accuracy', 'terminology', 'grammar', 'fluency', 'taskStyle']

export const evaluationSystemPrompt = `You are a careful translation practice coach. Return only a JSON object, never Markdown and never a calibrated or official exam result. Give a practice estimate based on the source and learner answer. Accept multiple valid translations. Every sourceQuote must be copied literally from the source text, and every learnerQuote must be copied literally from the learner answer. Do not invent evidence. If evidence is insufficient, explain that in uncertainty.`

export function buildEvaluationPrompt(input: EvaluationInput): string {
  const sourceLanguage = getLanguage(input.exercise.sourceLanguage)
  const targetLanguage = getLanguage(input.exercise.targetLanguage)
  const dimensionList = dimensions.join(', ')

  return `Evaluate this ${input.mode} translation from ${sourceLanguage.label} to ${targetLanguage.label}.

Return this JSON shape:
{
  "summary": "short evidence-based summary",
  "overallScore": 0,
  "dimensions": {"accuracy": 0, "terminology": 0, "grammar": 0, "fluency": 0, "taskStyle": 0},
  "strengths": ["specific strength"],
  "issues": [{"dimension": "accuracy", "sourceQuote": "literal source text or empty", "learnerQuote": "literal learner text or empty", "explanation": "why it matters", "suggestion": "a concrete revision or alternative"}],
  "alternatives": ["another valid rendering when useful"],
  "uncertainty": "what the evaluator cannot confidently determine"
}

Use exactly these five dimension keys: ${dimensionList}. Keep all scores between 0 and 100. This is practice feedback only; do not call it a CATTI or MTI result.

SOURCE TEXT (${sourceLanguage.label}):
<<<SOURCE>>>
${input.exercise.sourceText}
<<<END SOURCE>>>

LEARNER ANSWER (${targetLanguage.label}):
<<<ANSWER>>>
${input.learnerAnswer}
<<<END ANSWER>>>
`
}

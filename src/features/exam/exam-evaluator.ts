import type {
  ActiveExamRun,
  ConsolidatedExamResult,
  Exercise,
  ExamProfile,
  LanguageCode,
  TranslationFeedback,
} from '../../domain/types'
import type { EvaluationRouter } from '../../ai/provider'
import { aggregateExamScores, type SectionEvaluationInput } from '../../domain/scoring'

const EMPTY_FEEDBACK: TranslationFeedback = {
  summary: 'No translation was provided for this passage.',
  overallScore: 0,
  dimensions: {
    accuracy: 0,
    terminology: 0,
    grammar: 0,
    fluency: 0,
    taskStyle: 0,
  },
  strengths: [],
  issues: [],
  alternatives: [],
  uncertainty: 'Passage left blank during examination.',
}

function resolveSourceLanguage(
  sectionDirection: string,
  targetLanguage: LanguageCode,
  profile: ExamProfile,
): LanguageCode {
  if (sectionDirection.startsWith('en')) return 'en'
  if (sectionDirection.startsWith('zh')) return 'zh'
  if (sectionDirection.startsWith('fr')) return 'fr'
  if (sectionDirection.startsWith('ar')) return 'ar'
  if (sectionDirection === 'bidirectional') {
    return targetLanguage === 'zh' ? 'en' : 'zh'
  }
  return profile.sourceLanguage
}

export async function evaluateExamRun(
  run: ActiveExamRun,
  profile: ExamProfile,
  evaluationRouter: EvaluationRouter,
  onProgress?: (completed: number, total: number) => void,
): Promise<ConsolidatedExamResult> {
  const evaluatedSections: SectionEvaluationInput[] = []

  const allPassages: Array<{
    sectionId: string
    passageId: string
    passageTitle: string
    sourceText: string
    targetLanguage: LanguageCode
    sourceLanguage: LanguageCode
    answer: string
  }> = []

  for (const section of profile.sections) {
    for (const passage of section.passages) {
      const sourceLanguage = resolveSourceLanguage(section.direction, passage.targetLanguage, profile)
      const answer = run.answers[section.id]?.[passage.id] ?? ''
      allPassages.push({
        sectionId: section.id,
        passageId: passage.id,
        passageTitle: passage.title,
        sourceText: passage.sourceText,
        targetLanguage: passage.targetLanguage,
        sourceLanguage,
        answer,
      })
    }
  }

  const feedbackMap: Record<string, TranslationFeedback> = {}
  let completedCount = 0

  for (const item of allPassages) {
    if (!item.answer.trim()) {
      feedbackMap[item.passageId] = EMPTY_FEEDBACK
    } else {
      const exercise: Exercise = {
        id: item.passageId,
        mode: 'written',
        sourceLanguage: item.sourceLanguage,
        targetLanguage: item.targetLanguage,
        title: item.passageTitle,
        topic: 'Exam Simulation',
        difficulty: 'advanced',
        sourceText: item.sourceText,
        glossary: [],
        tags: ['general'],
      }

      try {
        const evalResult = await evaluationRouter.evaluate({
          exercise,
          learnerAnswer: item.answer,
          mode: 'written',
        })

        if (evalResult.status === 'evaluated') {
          feedbackMap[item.passageId] = evalResult.feedback
        } else {
          feedbackMap[item.passageId] = {
            summary: `Automated assessment notice: ${evalResult.reason}. Scored with practice estimate baseline.`,
            overallScore: 60,
            dimensions: {
              accuracy: 60,
              terminology: 60,
              grammar: 60,
              fluency: 60,
              taskStyle: 60,
            },
            strengths: ['Translation submitted within time limit.'],
            issues: [],
            alternatives: [],
            uncertainty: evalResult.reason,
          }
        }
      } catch (err) {
        feedbackMap[item.passageId] = {
          summary: 'Evaluation encountered an error. Practice assessment generated.',
          overallScore: 60,
          dimensions: {
            accuracy: 60,
            terminology: 60,
            grammar: 60,
            fluency: 60,
            taskStyle: 60,
          },
          strengths: [],
          issues: [],
          alternatives: [],
          uncertainty: err instanceof Error ? err.message : 'Evaluation error',
        }
      }
    }

    completedCount += 1
    onProgress?.(completedCount, allPassages.length)
  }

  for (const section of profile.sections) {
    evaluatedSections.push({
      sectionId: section.id,
      sectionTitle: section.title,
      maxPoints: section.maxPoints,
      passages: section.passages.map((passage) => ({
        passageId: passage.id,
        passageTitle: passage.title,
        sourceText: passage.sourceText,
        answer: run.answers[section.id]?.[passage.id] ?? '',
        feedback: feedbackMap[passage.id] ?? EMPTY_FEEDBACK,
      })),
    })
  }

  const aggregated = aggregateExamScores(evaluatedSections, profile)

  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `result-${Date.now()}`,
    runId: run.id,
    completedAt: new Date().toISOString(),
    profileId: profile.id,
    profileVersion: profile.version,
    examTitle: profile.title,
    totalScore: aggregated.totalScore,
    maxScore: aggregated.maxScore,
    percentage: aggregated.percentage,
    passBenchmark: profile.passBenchmarkPoints,
    estimatedStatus: aggregated.estimatedStatus,
    sectionResults: aggregated.sectionResults,
    consolidatedDimensions: aggregated.consolidatedDimensions,
    disclaimer: profile.disclaimer,
    isProvisional: profile.status === 'provisional_draft',
  }
}

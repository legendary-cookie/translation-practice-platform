import type {
  ActiveExamRun,
  ConsolidatedExamResult,
  Exercise,
  ExamProfile,
  LanguageCode,
  TranslationFeedback,
} from '../../domain/types'
import type { CloudConsentRequest, EvaluationRouter } from '../../ai/provider'
import { aggregateExamScores, validateFeedback, type SectionEvaluationInput } from '../../domain/scoring'
import { snapshotExamProfile } from '../../domain/exam'

export type ExamEvaluationBlockStatus = 'needs-consent' | 'unavailable'

export class ExamEvaluationBlockedError extends Error {
  readonly status: ExamEvaluationBlockStatus
  readonly passageId: string
  readonly request?: CloudConsentRequest

  constructor({
    status,
    reason,
    passageId,
    request,
  }: {
    status: ExamEvaluationBlockStatus
    reason: string
    passageId: string
    request?: CloudConsentRequest
  }) {
    super(reason)
    this.name = 'ExamEvaluationBlockedError'
    this.status = status
    this.passageId = passageId
    this.request = request
  }
}

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
  if (sectionDirection.startsWith('ru')) return 'ru'
  if (sectionDirection.startsWith('es')) return 'es'
  if (sectionDirection.startsWith('ar')) return 'ar'
  if (sectionDirection === 'bidirectional') {
    return targetLanguage === 'zh' ? 'en' : 'zh'
  }
  return profile.sourceLanguage
}

function validateExamFeedback(
  feedback: unknown,
  sourceText: string,
  learnerAnswer: string,
): TranslationFeedback {
  return validateFeedback(feedback, { sourceText, learnerAnswer })
}

export async function evaluateExamRun(
  run: ActiveExamRun,
  profile: ExamProfile,
  evaluationRouter: EvaluationRouter,
  onProgress?: (completed: number, total: number) => void,
  approvedFeedback: Record<string, TranslationFeedback> = {},
): Promise<ConsolidatedExamResult> {
  const profileSnapshot = snapshotExamProfile(profile)
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

  for (const section of profileSnapshot.sections) {
    for (const passage of section.passages) {
      const sourceLanguage = resolveSourceLanguage(section.direction, passage.targetLanguage, profileSnapshot)
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
      feedbackMap[item.passageId] = validateExamFeedback(EMPTY_FEEDBACK, item.sourceText, item.answer)
    } else {
      const approved = approvedFeedback[item.passageId]
      if (approved) {
        feedbackMap[item.passageId] = validateExamFeedback(approved, item.sourceText, item.answer)
        completedCount += 1
        onProgress?.(completedCount, allPassages.length)
        continue
      }

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
          feedbackMap[item.passageId] = validateExamFeedback(evalResult.feedback, item.sourceText, item.answer)
        } else {
          throw new ExamEvaluationBlockedError({
            status: evalResult.status,
            reason: evalResult.reason,
            passageId: item.passageId,
            request: evalResult.status === 'needs-consent' ? evalResult.request : undefined,
          })
        }
      } catch (err) {
        if (err instanceof ExamEvaluationBlockedError) {
          throw err
        }
        throw new ExamEvaluationBlockedError({
          status: 'unavailable',
          reason: err instanceof Error ? err.message : 'Evaluation error',
          passageId: item.passageId,
        })
      }
    }

    completedCount += 1
    onProgress?.(completedCount, allPassages.length)
  }

  for (const section of profileSnapshot.sections) {
    evaluatedSections.push({
      sectionId: section.id,
      sectionTitle: section.title,
      maxPoints: section.maxPoints,
      passages: section.passages.map((passage) => ({
        passageId: passage.id,
        passageTitle: passage.title,
        sourceText: passage.sourceText,
        sourceLanguage: resolveSourceLanguage(section.direction, passage.targetLanguage, profileSnapshot),
        targetLanguage: passage.targetLanguage,
        answer: run.answers[section.id]?.[passage.id] ?? '',
        feedback: feedbackMap[passage.id] ?? EMPTY_FEEDBACK,
      })),
    })
  }

  const aggregated = aggregateExamScores(evaluatedSections, profileSnapshot)

  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `result-${Date.now()}`,
    runId: run.id,
    completedAt: new Date().toISOString(),
    profileId: profileSnapshot.id,
    profileVersion: profileSnapshot.version,
    profileSnapshot,
    rubricVersion: profileSnapshot.rubricVersion,
    examTitle: profileSnapshot.title,
    totalScore: aggregated.totalScore,
    maxScore: aggregated.maxScore,
    percentage: aggregated.percentage,
    passBenchmark: profileSnapshot.passBenchmarkPoints,
    estimatedStatus: aggregated.estimatedStatus,
    sectionResults: aggregated.sectionResults,
    consolidatedDimensions: aggregated.consolidatedDimensions,
    disclaimer: profileSnapshot.disclaimer,
    benchmarkLabel: 'Practice benchmark estimate',
    benchmarkNote: profileSnapshot.benchmarkNote,
    authorityNote: profileSnapshot.authorityNote,
    isProvisional: profileSnapshot.status === 'provisional_draft',
  }
}

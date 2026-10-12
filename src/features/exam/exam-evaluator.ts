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

export type ApprovedExamPassageFeedback = {
  sectionId: string
  passageId: string
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  answer: string
  feedback: TranslationFeedback
}

export type ApprovedExamFeedbackCheckpoint = {
  runId: string
  profileId: string
  profileVersion: number
  rubricVersion: string
  passages: Record<string, ApprovedExamPassageFeedback>
}

export class ExamEvaluationBlockedError extends Error {
  readonly status: ExamEvaluationBlockStatus
  readonly passageId: string
  readonly request?: CloudConsentRequest
  readonly approvedFeedback?: ApprovedExamFeedbackCheckpoint

  constructor({
    status,
    reason,
    passageId,
    request,
    approvedFeedback,
  }: {
    status: ExamEvaluationBlockStatus
    reason: string
    passageId: string
    request?: CloudConsentRequest
    approvedFeedback?: ApprovedExamFeedbackCheckpoint
  }) {
    super(reason)
    this.name = 'ExamEvaluationBlockedError'
    this.status = status
    this.passageId = passageId
    this.request = request
    this.approvedFeedback = approvedFeedback
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

type ExamPassageInput = {
  sectionId: string
  passageId: string
  passageTitle: string
  sourceText: string
  targetLanguage: LanguageCode
  sourceLanguage: LanguageCode
  answer: string
}

function listExamPassages(run: ActiveExamRun, profile: ExamProfile): ExamPassageInput[] {
  return profile.sections.flatMap((section) => section.passages.map((passage) => ({
    sectionId: section.id,
    passageId: passage.id,
    passageTitle: passage.title,
    sourceText: passage.sourceText,
    targetLanguage: passage.targetLanguage,
    sourceLanguage: resolveSourceLanguage(section.direction, passage.targetLanguage, profile),
    answer: run.answers[section.id]?.[passage.id] ?? '',
  })))
}

function checkpointMatchesRun(
  checkpoint: ApprovedExamFeedbackCheckpoint | undefined,
  run: ActiveExamRun,
  profile: ExamProfile,
): checkpoint is ApprovedExamFeedbackCheckpoint {
  return checkpoint !== undefined
    && checkpoint.runId === run.id
    && checkpoint.profileId === profile.id
    && checkpoint.profileVersion === profile.version
    && checkpoint.rubricVersion === profile.rubricVersion
}

function passageMatchesCheckpoint(
  approved: ApprovedExamPassageFeedback | undefined,
  item: ExamPassageInput,
): approved is ApprovedExamPassageFeedback {
  return approved !== undefined
    && approved.sectionId === item.sectionId
    && approved.passageId === item.passageId
    && approved.sourceText === item.sourceText
    && approved.sourceLanguage === item.sourceLanguage
    && approved.targetLanguage === item.targetLanguage
    && approved.answer === item.answer
}

function createFeedbackCheckpoint(
  run: ActiveExamRun,
  profile: ExamProfile,
  passages: ExamPassageInput[],
  feedbackMap: Record<string, TranslationFeedback>,
): ApprovedExamFeedbackCheckpoint {
  return {
    runId: run.id,
    profileId: profile.id,
    profileVersion: profile.version,
    rubricVersion: profile.rubricVersion,
    passages: Object.fromEntries(passages.flatMap((item) => {
      const feedback = feedbackMap[item.passageId]
      return feedback === undefined ? [] : [[item.passageId, {
        sectionId: item.sectionId,
        passageId: item.passageId,
        sourceText: item.sourceText,
        sourceLanguage: item.sourceLanguage,
        targetLanguage: item.targetLanguage,
        answer: item.answer,
        feedback,
      } satisfies ApprovedExamPassageFeedback]]
    })),
  }
}

/** Validate cloud-approved feedback and bind it to this exact run, profile, rubric, and passage input. */
export function approveExamPassageFeedback(
  existing: ApprovedExamFeedbackCheckpoint | undefined,
  run: ActiveExamRun,
  profile: ExamProfile,
  passageId: string,
  feedback: unknown,
): ApprovedExamFeedbackCheckpoint {
  const profileSnapshot = snapshotExamProfile(profile)
  const passages = listExamPassages(run, profileSnapshot)
  const item = passages.find((passage) => passage.passageId === passageId)
  if (!item || !item.answer.trim()) {
    throw new Error('The approved exam passage no longer has a matching answer.')
  }

  const reusable: Record<string, TranslationFeedback> = {}
  if (checkpointMatchesRun(existing, run, profileSnapshot)) {
    for (const candidate of passages) {
      const approved = existing.passages[candidate.passageId]
      if (!passageMatchesCheckpoint(approved, candidate)) continue
      try {
        reusable[candidate.passageId] = validateExamFeedback(approved.feedback, candidate.sourceText, candidate.answer)
      } catch {
        // A malformed/stale checkpoint is never trusted; it will be evaluated again.
      }
    }
  }

  reusable[passageId] = validateExamFeedback(feedback, item.sourceText, item.answer)
  return createFeedbackCheckpoint(run, profileSnapshot, passages, reusable)
}

export async function evaluateExamRun(
  run: ActiveExamRun,
  profile: ExamProfile,
  evaluationRouter: EvaluationRouter,
  onProgress?: (completed: number, total: number) => void,
  approvedFeedback?: ApprovedExamFeedbackCheckpoint,
): Promise<ConsolidatedExamResult> {
  const profileSnapshot = snapshotExamProfile(profile)
  const evaluatedSections: SectionEvaluationInput[] = []
  const allPassages = listExamPassages(run, profileSnapshot)
  const canReuseCheckpoint = checkpointMatchesRun(approvedFeedback, run, profileSnapshot)

  const feedbackMap: Record<string, TranslationFeedback> = {}
  let completedCount = 0

  for (const item of allPassages) {
    if (!item.answer.trim()) {
      feedbackMap[item.passageId] = validateExamFeedback(EMPTY_FEEDBACK, item.sourceText, item.answer)
    } else {
      const approved = canReuseCheckpoint ? approvedFeedback.passages[item.passageId] : undefined
      if (passageMatchesCheckpoint(approved, item)) {
        try {
          feedbackMap[item.passageId] = validateExamFeedback(approved.feedback, item.sourceText, item.answer)
          completedCount += 1
          onProgress?.(completedCount, allPassages.length)
          continue
        } catch {
          // Re-evaluate invalid checkpoint data rather than surfacing or persisting it.
        }
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
            approvedFeedback: createFeedbackCheckpoint(run, profileSnapshot, allPassages, feedbackMap),
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
          approvedFeedback: createFeedbackCheckpoint(run, profileSnapshot, allPassages, feedbackMap),
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

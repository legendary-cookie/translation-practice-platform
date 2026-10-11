import type {
  ActiveExamRun,
  ConsolidatedExamResult,
  EstimatedStatus,
  ExamProfile,
  FeedbackDimensions,
  LanguageCode,
  SectionResult,
} from './types'

export const PRACTICE_ESTIMATE_DISCLAIMER =
  'Practice Assessment Only: This score is an automated estimation generated for independent study. It is NOT an official CATTI or MTI examination result and has no official certification standing.'

export const EXAM_RUBRIC_VERSION = 'rubric-v1'
export const PRACTICE_ESTIMATE_LABEL = 'Practice Estimate · 模拟练习评估'
export const PLATFORM_AUTHORED_RUBRIC_NOTICE =
  'Rubric and dimension scores are a platform-authored practice model, not an official CATTI/MTI marker-consensus sheet or deduction table.'
export const CATTI_THRESHOLD_NOTICE =
  'The comparison below is a practice benchmark only. CATTI thresholds depend on administration, level, paper, and region; the 2024 separate-line exception was 58 rather than a universal 60.'
export const CLIPBOARD_POLICY_NOTICE =
  'Clipboard restriction is a platform simulation choice for this practice run, not an official universal CATTI rule.'
export const MATERIALS_POLICY_NOTICE =
  'This release uses platform-authored practice passages. It does not assert ownership of past CATTI papers; rights must be checked paper by paper before reuse.'
export const PROVISIONAL_DRAFT_LABEL = 'Provisional Draft · 待最终核实草案'
export const PROVISIONAL_DRAFT_NOTICE =
  'This exam profile contains provisional parameters pending authoritative confirmation. Always refer to your target institution or official examination announcements for official requirements.'

/**
 * Detach a result's profile from the mutable catalog object before persistence.
 * IndexedDB clones the returned result again, so later catalog upgrades cannot
 * rewrite the configuration used for this evaluation.
 */
export function snapshotExamProfile(profile: ExamProfile): ExamProfile {
  return structuredClone(profile)
}

export function createActiveExamRun(profile: ExamProfile): ActiveExamRun {
  const sectionRemainingSeconds: Record<string, number> = {}
  const answers: Record<string, Record<string, string>> = {}

  for (const section of profile.sections) {
    sectionRemainingSeconds[section.id] = Math.max(0, Math.round(section.timeLimitMinutes * 60))
    answers[section.id] = {}
    for (const passage of section.passages) {
      answers[section.id][passage.id] = ''
    }
  }

  const now = new Date().toISOString()
  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    profileId: profile.id,
    profileVersion: profile.version,
    status: 'in-progress',
    startedAt: now,
    lastSavedAt: now,
    currentSectionIndex: 0,
    overallRemainingSeconds: Math.max(0, Math.round(profile.totalDurationMinutes * 60)),
    sectionRemainingSeconds,
    answers,
  }
}

export function decrementTimers(
  run: ActiveExamRun,
  profile: ExamProfile,
  elapsedSeconds: number,
): { run: ActiveExamRun; sectionExpired: boolean; overallExpired: boolean } {
  const safeElapsed = Math.max(0, Math.round(elapsedSeconds))
  const overallRemainingSeconds = Math.max(0, run.overallRemainingSeconds - safeElapsed)

  const currentSection = profile.sections[run.currentSectionIndex]
  const currentSectionId = currentSection?.id ?? ''
  const prevSectionRemaining = run.sectionRemainingSeconds[currentSectionId] ?? 0
  const updatedSectionRemaining = Math.max(0, prevSectionRemaining - safeElapsed)

  const nextSectionRemainingSeconds = {
    ...run.sectionRemainingSeconds,
    [currentSectionId]: updatedSectionRemaining,
  }

  const updatedRun: ActiveExamRun = {
    ...run,
    overallRemainingSeconds,
    sectionRemainingSeconds: nextSectionRemainingSeconds,
    lastSavedAt: new Date().toISOString(),
  }

  return {
    run: updatedRun,
    sectionExpired: updatedSectionRemaining <= 0,
    overallExpired: overallRemainingSeconds <= 0,
  }
}

export function canAdvanceSection(run: ActiveExamRun, profile: ExamProfile): boolean {
  return run.currentSectionIndex < profile.sections.length - 1
}

export function isLastSection(run: ActiveExamRun, profile: ExamProfile): boolean {
  return run.currentSectionIndex >= profile.sections.length - 1
}

export function advanceSection(run: ActiveExamRun, profile: ExamProfile): ActiveExamRun {
  if (!canAdvanceSection(run, profile)) {
    return run
  }
  return {
    ...run,
    currentSectionIndex: run.currentSectionIndex + 1,
    lastSavedAt: new Date().toISOString(),
  }
}

export function countTextUnits(text: string, language: LanguageCode): number {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }
  if (language === 'zh') {
    // Count Chinese characters plus whitespace-separated latin/other words
    const cjkMatches = trimmed.match(/[\u4e00-\u9fa5]/g) ?? []
    const nonCjk = trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').trim()
    const nonCjkWords = nonCjk.length > 0 ? nonCjk.split(/\s+/).filter(Boolean).length : 0
    return cjkMatches.length + nonCjkWords
  }
  // Word count for spaced/alphabetic languages (en, fr, es, ru, ar, hi)
  return trimmed.split(/\s+/).filter(Boolean).length
}

export function getEstimatedStatus(percentage: number, passBenchmarkPercent: number): EstimatedStatus {
  if (percentage >= passBenchmarkPercent + 5) {
    return 'above-benchmark'
  }
  if (percentage >= passBenchmarkPercent - 5) {
    return 'near-benchmark'
  }
  return 'below-benchmark'
}

export function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export function isValidActiveRun(value: unknown): value is ActiveExamRun {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.profileId === 'string' &&
    typeof candidate.profileVersion === 'number' &&
    (candidate.status === 'in-progress' || candidate.status === 'completed' || candidate.status === 'abandoned') &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.lastSavedAt === 'string' &&
    typeof candidate.currentSectionIndex === 'number' &&
    typeof candidate.overallRemainingSeconds === 'number' &&
    typeof candidate.sectionRemainingSeconds === 'object' &&
    candidate.sectionRemainingSeconds !== null &&
    typeof candidate.answers === 'object' &&
    candidate.answers !== null
  )
}

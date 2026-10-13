import type { Exercise, ScoreDimension, SessionRecord } from './types'

export type FeedbackRating = { id: string; sessionId: string; issueIndex: number; rating: 'helpful' | 'incorrect'; updatedAt: string }
export const DIMENSION_LABELS: Record<ScoreDimension, string> = { accuracy: 'Accuracy and meaning', terminology: 'Terminology', grammar: 'Grammar', fluency: 'Fluency', taskStyle: 'Task style and register' }

export function buildLearnerProfile(sessions: SessionRecord[], ratings: FeedbackRating[]) {
  const ratingMap = new Map(ratings.map((rating) => [`${rating.sessionId}:${rating.issueIndex}`, rating.rating]))
  const issues: Record<ScoreDimension, number> = { accuracy: 0, terminology: 0, grammar: 0, fluency: 0, taskStyle: 0 }
  for (const session of sessions) session.feedback.issues.forEach((issue, index) => {
    if (ratingMap.get(`${session.id}:${index}`) !== 'incorrect') issues[issue.dimension] += 1
  })
  const ordered = (Object.keys(issues) as ScoreDimension[]).filter((dimension) => issues[dimension] > 0).sort((a, b) => issues[b] - issues[a])
  return { sessionCount: sessions.length, issues, focus: ordered[0], trendSupported: sessions.length >= 3 }
}

export function recommendCatalogPractice(sessions: SessionRecord[], ratings: FeedbackRating[], exercises: Exercise[]): { exercise: Exercise; reason: string } | undefined {
  const latest = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!latest) return undefined
  const profile = buildLearnerProfile(sessions.filter((session) => session.sourceLanguage === latest.sourceLanguage && session.targetLanguage === latest.targetLanguage), ratings)
  const counts = new Map<string, number>()
  for (const session of sessions) counts.set(session.exerciseId, (counts.get(session.exerciseId) ?? 0) + 1)
  const options = exercises.filter((exercise) => exercise.sourceLanguage === latest.sourceLanguage && exercise.targetLanguage === latest.targetLanguage && exercise.mode === latest.mode)
  const selected = options.sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || a.id.localeCompare(b.id))[0]
  if (!selected) return undefined
  const focus = profile.focus ? `${profile.issues[profile.focus]} saved ${DIMENSION_LABELS[profile.focus].toLowerCase()} issue(s) in this direction. Read with that focus; the passage is selected by practice frequency.` : 'Keep practicing your latest language direction with a less-practiced passage.'
  return { exercise: selected, reason: `${focus} ${profile.trendSupported ? 'Based on your local practice history.' : 'Early evidence only; complete more sessions before judging a trend.'}` }
}

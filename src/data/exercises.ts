import { CHINESE_DIRECTIONS } from '../domain/languages'
import type { Exercise, LanguageCode, WrittenPracticeMode } from '../domain/types'
import { getPracticePassages, passageSourceText, passageReferenceText } from './catti3'
import type { Catti3Passage } from './catti3'

/**
 * Accepted renderings are often stems ("urbani", "сортиров") so that the offline
 * checker tolerates inflection. For the glossary, show the full word as it is
 * used in the reference translation instead of the bare stem.
 */
export function glossaryHint(accepted: string[], reference: string): string | undefined {
  const first = accepted[0]
  if (!first) return undefined
  // Chinese has no word spacing, so expanding would swallow the rest of the clause; zh entries are full words already.
  if (/\p{Script=Han}/u.test(first)) return first
  const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = reference.match(new RegExp(`${escaped}[\\p{L}\\p{M}-]*`, 'iu'))
  return match ? match[0] : first
}

export function createPracticeExercise(passage: Catti3Passage, targetLanguage: LanguageCode, mode: WrittenPracticeMode): Exercise {
  const keyTerms = passage.keyTerms.map(term => ({ source: term.source, accepted: term.accepted[targetLanguage] ?? [] }))
  return {
    id: `${passage.id}-${mode}-${targetLanguage}`, mode, sourceLanguage: passage.sourceLanguage, targetLanguage,
    title: passage.title, topic: passage.topic, difficulty: 'intermediate',
    sourceText: passageSourceText(passage), referenceTranslation: passageReferenceText(passage, targetLanguage),
    paragraphs: passage.paragraphs.map(p => ({ source: p.source, reference: p.reference[targetLanguage] ?? '' })),
    keyTerms, glossary: keyTerms.map(term => ({ term: term.source, targetHint: glossaryHint(term.accepted, passageReferenceText(passage, targetLanguage)), note: '' })),
    tags: [mode === 'news' ? 'news' : 'general'],
  }
}
export const EXERCISES: Exercise[] = CHINESE_DIRECTIONS.flatMap(({ sourceLanguage, targetLanguage }) =>
  getPracticePassages(sourceLanguage, targetLanguage).flatMap(passage =>
    (['written', 'news'] as const).map(mode => createPracticeExercise(passage, targetLanguage, mode)),
  ),
)
export function getExercisesForDirection(source: LanguageCode, target: LanguageCode, mode: WrittenPracticeMode): Exercise[] {
  return EXERCISES.filter(e => e.sourceLanguage === source && e.targetLanguage === target && e.mode === mode)
}
export function getExerciseById(id: string): Exercise | undefined { return EXERCISES.find(e => e.id === id) }

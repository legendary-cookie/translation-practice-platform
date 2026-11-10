import { EN_PASSAGES } from './passages-en'
import { RU_PASSAGES } from './passages-ru'
import { ZH_PASSAGES } from './passages-zh'
import type { Catti3Language, Catti3Passage } from './types'

export * from './types'

export const CATTI3_PASSAGES: Catti3Passage[] = [...ZH_PASSAGES, ...EN_PASSAGES, ...RU_PASSAGES]

/**
 * Passage ids used by the two CATTI Level 3 exam profiles. Exam passages
 * (usage: 'exam') never appear on the Practice page.
 */
export const CATTI3_EXAM_PASSAGE_IDS = {
  'en-zh': {
    foreignToChinese: ['en-exam-1', 'en-exam-2'],
    chineseToForeign: ['zh-exam-en-1', 'zh-exam-en-2'],
  },
  'ru-zh': {
    foreignToChinese: ['ru-exam-1', 'ru-exam-2'],
    chineseToForeign: ['zh-exam-ru-1', 'zh-exam-ru-2'],
  },
} as const

export function getCatti3Passage(id: string): Catti3Passage {
  const passage = CATTI3_PASSAGES.find((candidate) => candidate.id === id)
  if (!passage) throw new Error(`Unknown CATTI 3 passage: ${id}`)
  return passage
}

export function getPracticePassages(source: Catti3Language, target: Catti3Language): Catti3Passage[] {
  return CATTI3_PASSAGES.filter(
    (passage) => passage.usage === 'practice' && passage.sourceLanguage === source && passage.targetLanguages.includes(target),
  )
}

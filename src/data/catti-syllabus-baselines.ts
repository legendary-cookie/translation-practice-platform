import type { LanguageCode } from '../domain/types'

export type CattiLevel2SyllabusBaseline = {
  language: Extract<LanguageCode, 'en' | 'fr' | 'ru' | 'es' | 'ar'>
  languageLabel: string
  foreignToChinese: string
  chineseToForeign: string
  foreignToChinesePoints: number
  chineseToForeignPoints: number
  durationMinutes: 180
  publishedOn: '2023-12-25'
}

/**
 * Dated syllabus references, not timeless administration promises. The
 * simulator's scores and rubric remain platform-authored practice estimates.
 */
export const CATTI_LEVEL_2_SYLLABUS_BASELINES: CattiLevel2SyllabusBaseline[] = [
  {
    language: 'en',
    languageLabel: 'English',
    foreignToChinese: 'about 900 English words',
    chineseToForeign: 'about 600 Chinese characters',
    foreignToChinesePoints: 50,
    chineseToForeignPoints: 50,
    durationMinutes: 180,
    publishedOn: '2023-12-25',
  },
  {
    language: 'fr',
    languageLabel: 'French',
    foreignToChinese: 'about 800 French words',
    chineseToForeign: 'about 500 Chinese characters',
    foreignToChinesePoints: 60,
    chineseToForeignPoints: 40,
    durationMinutes: 180,
    publishedOn: '2023-12-25',
  },
  {
    language: 'ru',
    languageLabel: 'Russian',
    foreignToChinese: 'about 800 Russian words',
    chineseToForeign: 'about 400 Chinese characters',
    foreignToChinesePoints: 60,
    chineseToForeignPoints: 40,
    durationMinutes: 180,
    publishedOn: '2023-12-25',
  },
  {
    language: 'es',
    languageLabel: 'Spanish',
    foreignToChinese: 'about 800 Spanish words',
    chineseToForeign: 'about 500 Chinese characters',
    foreignToChinesePoints: 60,
    chineseToForeignPoints: 40,
    durationMinutes: 180,
    publishedOn: '2023-12-25',
  },
  {
    language: 'ar',
    languageLabel: 'Arabic',
    foreignToChinese: 'about 700–800 Arabic words',
    chineseToForeign: 'about 400–500 Chinese characters',
    foreignToChinesePoints: 60,
    chineseToForeignPoints: 40,
    durationMinutes: 180,
    publishedOn: '2023-12-25',
  },
]

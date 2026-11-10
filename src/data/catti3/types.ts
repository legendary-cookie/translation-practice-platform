/**
 * Content model for CATTI Level 3 (三级笔译) practice material.
 *
 * Every passage is ORIGINAL platform-authored text written to mirror the
 * genre, length, register and paragraphing of CATTI Level 3 《笔译实务》
 * papers (news reports, government/white-paper style prose, culture and
 * popular-science features). No real exam paper or published reference
 * translation is reproduced.
 *
 * Each paragraph carries its own reference translation so the app can show
 * a paragraph-aligned 参考译文 and run offline checks without any AI.
 */

export type Catti3Language = 'zh' | 'en' | 'ru'

export type Catti3Genre = 'news' | 'report' | 'culture' | 'science' | 'economy' | 'society'

/**
 * A term the translation is expected to render. `accepted` lists acceptable
 * renderings per target language. Matching is case-insensitive substring
 * matching, so Russian entries are written as stems (e.g. 'сортиров') to
 * tolerate inflection, and English entries may be stems too (e.g. 'recycl').
 */
export type Catti3KeyTerm = {
  source: string
  accepted: Partial<Record<Catti3Language, string[]>>
  note?: string
}

export type Catti3Paragraph = {
  source: string
  /** Reference translation of this paragraph, keyed by target language. */
  reference: Partial<Record<Catti3Language, string>>
}

export type Catti3Passage = {
  id: string
  sourceLanguage: Catti3Language
  /** Target languages this passage has complete references for. */
  targetLanguages: Catti3Language[]
  title: string
  /** English topic label (translated in the UI via i18n). */
  topic: string
  genre: Catti3Genre
  /** 'practice' passages feed the Practice page; 'exam' passages feed exam profiles only. */
  usage: 'practice' | 'exam'
  paragraphs: Catti3Paragraph[]
  keyTerms: Catti3KeyTerm[]
}

export function passageSourceText(passage: Catti3Passage): string {
  return passage.paragraphs.map((paragraph) => paragraph.source).join('\n\n')
}

export function passageReferenceText(passage: Catti3Passage, target: Catti3Language): string {
  return passage.paragraphs.map((paragraph) => paragraph.reference[target] ?? '').join('\n\n')
}

/** CJK characters for Chinese, whitespace-separated words otherwise. */
export function passageLength(passage: Catti3Passage): number {
  const text = passageSourceText(passage)
  if (passage.sourceLanguage === 'zh') return (text.match(/[一-鿿]/g) ?? []).length
  return text.split(/\s+/).filter(Boolean).length
}

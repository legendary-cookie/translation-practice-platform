import type { ExamProfile } from '../domain/types'
import { EXAM_RUBRIC_VERSION, PRACTICE_ESTIMATE_DISCLAIMER } from '../domain/exam'
import { CATTI3_PASSAGES, CATTI3_EXAM_PASSAGE_IDS, passageLength, passageSourceText, passageReferenceText } from './catti3'
import type { Catti3Passage } from './catti3'

export function buildCatti3ExamProfiles(passages: readonly Catti3Passage[] = CATTI3_PASSAGES): ExamProfile[] {
  return (['en', 'ru'] as const).flatMap(language => {
    const ids = CATTI3_EXAM_PASSAGE_IDS[`${language}-zh`]
    const sections = [ids.foreignToChinese, ids.chineseToForeign].map((list, index) => {
      const target: 'zh' | 'en' | 'ru' = index === 0 ? 'zh' : language
      return {
        id: `catti-3-${language}-section-${index + 1}`,
        title: index === 0 ? (language === 'en' ? '英译汉' : '俄译汉') : (language === 'en' ? '汉译英' : '汉译俄'),
        direction: index === 0 ? `${language}-to-zh` : `zh-to-${language}`,
        taskType: 'translation' as const,
        timeLimitMinutes: language === 'en' ? 90 : index === 0 ? 100 : 80,
        maxPoints: language === 'en' ? 50 : index === 0 ? 60 : 40,
        passages: list.flatMap(id => {
          const p = passages.find(p => p.id === id && p.usage === 'exam' && p.sourceLanguage === (index === 0 ? language : 'zh') && p.targetLanguages.includes(target))
          return p ? [{ id: p.id, title: p.title, sourceText: passageSourceText(p), wordCount: passageLength(p), targetLanguage: target,
            referenceTranslation: passageReferenceText(p, target), paragraphs: p.paragraphs.map(row => ({ source: row.source, reference: row.reference[target] ?? '' })),
            keyTerms: p.keyTerms.map(term => ({ source: term.source, accepted: term.accepted[target] ?? [] })) }] : []
        }),
      }
    })
    if (sections.some(s => s.passages.length === 0)) return []
    return [{ id: `catti-3-practical-${language}-zh-v1`, version: 1, rubricVersion: EXAM_RUBRIC_VERSION,
      examType: 'CATTI', level: 'Level 3', sourceLanguage: language, targetLanguage: 'zh',
      title: `CATTI Level 3 · ${language === 'en' ? 'English' : 'Russian'} ↔ Chinese`,
      description: 'CATTI 3: two passages per part; about 600 foreign words and 400 Chinese characters total.',
      totalDurationMinutes: 180, maxTotalPoints: 100, passBenchmarkPoints: 60, benchmarkType: 'fixed-60-percent',
      status: 'provisional_draft', provisionalDetails: { isStructureProvisional: true, notes: [
        'The structure follows widely published CATTI Level 3 《笔译实务》 descriptions (180 minutes, two parts) and must be confirmed against the current catti.net.cn syllabus.',
        'Passages are original platform-authored texts in CATTI 3 style, not real exam papers.',
      ] }, sections, allowedAids: { paperDictionaryAllowed: true, onlineSearchAllowed: false, glossaryAllowed: false, notes: 'Two bilingual paper dictionaries allowed.' }, disclaimer: PRACTICE_ESTIMATE_DISCLAIMER }]
  })
}
export const DEFAULT_EXAM_PROFILES = buildCatti3ExamProfiles()
/** Stored profiles from earlier catalogs must not reintroduce removed exams or directions. */
export function isSupportedCatti3Profile(profile: ExamProfile): boolean {
  return profile.examType === 'CATTI' && profile.level === 'Level 3'
    && ['en', 'ru'].includes(profile.sourceLanguage) && profile.targetLanguage === 'zh'
    && profile.sections.length === 2 && profile.sections.every(section => section.passages.length > 0
      && [`${profile.sourceLanguage}-to-zh`, `zh-to-${profile.sourceLanguage}`].includes(section.direction)
      && section.passages.every(p => ['zh', profile.sourceLanguage].includes(p.targetLanguage)))
}
export async function initExamProfiles(api: { listExamProfiles: () => Promise<ExamProfile[]>; saveExamProfile: (p: ExamProfile) => Promise<void> }): Promise<ExamProfile[]> {
  for (const profile of DEFAULT_EXAM_PROFILES) await api.saveExamProfile(profile)
  return DEFAULT_EXAM_PROFILES
}

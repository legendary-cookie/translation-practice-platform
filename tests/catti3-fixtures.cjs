const { buildCatti3ExamProfiles } = require('../src/data/exam-profiles.ts')
function fixturePassages() {
  return ['en', 'ru'].flatMap(language => [0, 1].flatMap(i => [
    { id: `${language}-exam-${i + 1}`, sourceLanguage: language, targetLanguages: ['zh'], title: 'Synthetic foreign passage', topic: 'science', genre: 'science', usage: 'exam', paragraphs: [{ source: 'Source 15%.', reference: { zh: '参考译文15%。' } }], keyTerms: [] },
    { id: `zh-exam-${language}-${i + 1}`, sourceLanguage: 'zh', targetLanguages: [language], title: 'Synthetic Chinese passage', topic: 'science', genre: 'science', usage: 'exam', paragraphs: [{ source: '原文15%。', reference: { [language]: 'Reference 15%.' } }], keyTerms: [] },
  ]))
}
module.exports = { fixturePassages, profiles: () => buildCatti3ExamProfiles(fixturePassages()) }

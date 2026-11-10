const test = require('node:test')
const assert = require('node:assert/strict')
const { CHINESE_DIRECTIONS } = require('../src/domain/languages.ts')
const { createPracticeExercise } = require('../src/data/exercises.ts')
const EXERCISES = ['one', 'two'].map(id => createPracticeExercise({ id, sourceLanguage: 'zh', targetLanguages: ['en', 'ru'], title: 'Synthetic passage', topic: 'science', genre: 'science', usage: 'practice', paragraphs: [{ source: '原文', reference: { en: 'Reference text', ru: 'Перевод' } }], keyTerms: [{ source: '原文', accepted: { en: ['source'], ru: ['текст'] } }] }, 'en', 'written'))
const { buildLearnerProfile, recommendCatalogPractice } = require('../src/domain/profile.ts')

test('catalog has unique CATTI 3 exercises with paragraph references', () => {
  assert.equal(CHINESE_DIRECTIONS.length, 4)
  assert.equal(new Set(EXERCISES.map(e => e.id)).size, EXERCISES.length)
  for (const e of EXERCISES) {
    assert.equal(e.difficulty, 'intermediate')
    assert.ok(e.paragraphs.length > 0)
    assert.ok(e.paragraphs.every(p => p.source && p.reference))
    assert.equal(e.referenceTranslation, e.paragraphs.map(p => p.reference).join('\n\n'))
    assert.deepEqual(e.glossary.map(g => g.targetHint), e.keyTerms.map(k => k.accepted[0]))
  }
})

test('false-positive feedback is excluded from weakness counts without changing saved scores', () => {
  const session = { id: 's1', createdAt: '2026-01-01T00:00:00Z', sourceLanguage: 'zh', targetLanguage: 'en', mode: 'written', exerciseId: EXERCISES[0].id, feedback: { overallScore: 80, issues: [{ dimension: 'grammar' }, { dimension: 'terminology' }] } }
  const profile = buildLearnerProfile([session], [{ sessionId: 's1', issueIndex: 0, rating: 'incorrect' }])
  assert.equal(profile.issues.grammar, 0)
  assert.equal(profile.focus, 'terminology')
  assert.equal(profile.trendSupported, false)
  assert.equal(session.feedback.overallScore, 80)
  const recommendation = recommendCatalogPractice([session], [], EXERCISES)
  assert.notEqual(recommendation.exercise.id, session.exerciseId)
  assert.match(recommendation.reason, /Early evidence/)
  assert.equal(recommendCatalogPractice([], [], EXERCISES), undefined)
  assert.equal(buildLearnerProfile([], []).focus, undefined)
})

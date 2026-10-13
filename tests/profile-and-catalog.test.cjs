const test = require('node:test')
const assert = require('node:assert/strict')
const { CHINESE_DIRECTIONS } = require('../src/domain/languages.ts')
const { EXERCISES } = require('../src/data/exercises.ts')
const { buildLearnerProfile, recommendCatalogPractice } = require('../src/domain/profile.ts')

test('the recovered original catalog has four passages per mode in all twelve directions', () => {
  assert.equal(EXERCISES.length, 96)
  assert.equal(new Set(EXERCISES.map((exercise) => exercise.id)).size, 96)
  for (const direction of CHINESE_DIRECTIONS) for (const mode of ['written', 'news']) {
    const matches = EXERCISES.filter((exercise) => exercise.sourceLanguage === direction.sourceLanguage && exercise.targetLanguage === direction.targetLanguage && exercise.mode === mode)
    assert.equal(matches.length, 4)
    assert.ok(matches.some((exercise) => exercise.difficulty === 'beginner'))
    assert.ok(matches.some((exercise) => exercise.difficulty === 'advanced'))
    assert.ok(matches.every((exercise) => exercise.sourceText.length > 50 && exercise.glossary.length > 0))
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

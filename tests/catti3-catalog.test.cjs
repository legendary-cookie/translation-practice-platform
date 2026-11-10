const test = require('node:test')
const assert = require('node:assert/strict')
const { buildCatti3ExamProfiles } = require('../src/data/exam-profiles.ts')
const { fixturePassages } = require('./catti3-fixtures.cjs')
const { passageLength } = require('../src/data/catti3/types.ts')
const { readWorkspacePreferences } = require('../src/features/settings/AppearanceSettings.tsx')

test('exam construction skips missing ids and omits profiles with an empty section', () => {
  assert.deepEqual(buildCatti3ExamProfiles([]), [])
  const passages = fixturePassages()
  assert.equal(buildCatti3ExamProfiles(passages.filter(p => !p.id.startsWith('zh-exam-en'))).length, 1)
  const profiles = buildCatti3ExamProfiles(passages.filter(p => p.id !== 'en-exam-2'))
  assert.equal(profiles[0].sections[0].passages.length, 1)
  assert.equal(profiles.length, 2)
})
test('fixture profiles have CATTI 3 structures, references and computed counts', () => {
  const passages = fixturePassages(), profiles = buildCatti3ExamProfiles(passages)
  assert.deepEqual(profiles.map(p => p.id), ['catti-3-practical-en-zh-v1', 'catti-3-practical-ru-zh-v1'])
  for (const p of profiles) {
    assert.equal(p.status, 'provisional_draft')
    assert.equal(p.totalDurationMinutes, 180)
    assert.equal(p.maxTotalPoints, 100)
    assert.equal(p.passBenchmarkPoints, 60)
    assert.equal(p.level, 'Level 3')
    assert.equal(p.allowedAids.paperDictionaryAllowed, true)
    assert.match(p.provisionalDetails.notes.join(' '), /catti.net.cn/)
    assert.deepEqual(p.sections.map(s => s.passages.length), [2, 2])
    for (const passage of p.sections.flatMap(s => s.passages)) {
      assert.equal(passage.wordCount, passageLength(passages.find(p => p.id === passage.id)))
      assert.ok(passage.paragraphs[0].reference)
    }
  }
  assert.deepEqual(profiles[0].sections.map(s => [s.maxPoints, s.timeLimitMinutes]), [[50,90],[50,90]])
  assert.deepEqual(profiles[1].sections.map(s => [s.maxPoints, s.timeLimitMinutes]), [[60,100],[40,80]])
})
test('removed or invalid stored preferences fall back to CATTI preparation and zh-en', () => {
  const old = global.localStorage
  global.localStorage = { getItem: () => JSON.stringify({ directionId: 'zh-removed', goal: 'obsolete preparation', experience: 'retired' }) }
  try {
    const prefs = readWorkspacePreferences()
    assert.equal(prefs.directionId, 'zh-en')
    assert.equal(prefs.goal, 'CATTI preparation')
    assert.equal(prefs.experience, 'all')
  } finally { global.localStorage = old }
})

test('offline exam completion never invokes AI and preserves references in the snapshot', async () => {
  const { createActiveExamRun } = require('../src/domain/exam.ts')
  const { evaluateExamRun } = require('../src/features/exam/exam-evaluator.ts')
  const profile = buildCatti3ExamProfiles(fixturePassages())[0]
  const run = createActiveExamRun(profile)
  const passage = profile.sections[0].passages[0]
  run.answers[profile.sections[0].id][passage.id] = '参考译文15%。'
  const result = await evaluateExamRun(run, profile, { evaluate: () => { throw new Error('AI must not run') } }, undefined, undefined, true)
  assert.equal(result.evaluationKind, 'offline')
  assert.equal(result.sectionResults[0].passageFeedbacks[0].answer, '参考译文15%。')
  assert.equal(result.profileSnapshot.sections[0].passages[0].paragraphs[0].reference, '参考译文15%。')
  const { ExamResultsReport } = require('../src/features/exam/ExamResultsReport.tsx')
  const { renderToStaticMarkup } = require('react-dom/server')
  const React = require('react')
  const html = renderToStaticMarkup(React.createElement(ExamResultsReport, { result, onRetake() {}, onBackToDashboard() {} }))
  assert.match(html, /Offline report; no AI grade requested/)
  assert.match(html, /参考译文15%。/)
  assert.doesNotMatch(html, /Below Benchmark/)
  assert.doesNotMatch(html, /Core Competency Breakdown/)
})

test('stored catalog validation excludes obsolete profiles and incomplete sections', () => {
  const { isSupportedCatti3Profile } = require('../src/data/exam-profiles.ts')
  const profile = buildCatti3ExamProfiles(fixturePassages())[0]
  assert.ok(isSupportedCatti3Profile(profile))
  assert.equal(isSupportedCatti3Profile({ ...profile, level: 'obsolete' }), false)
  assert.equal(isSupportedCatti3Profile({ ...profile, sourceLanguage: 'removed' }), false)
  assert.equal(isSupportedCatti3Profile({ ...profile, sections: [{ ...profile.sections[0], passages: [] }, profile.sections[1]] }), false)
})

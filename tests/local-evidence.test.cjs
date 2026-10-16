const assert = require('node:assert/strict')
const test = require('node:test')
const { evidenceUnits, localWrittenSchema, resolveLocalEvidence } = require('../src/ai/local-evidence.ts')
const { validateFeedback } = require('../src/domain/scoring.ts')
const input = { mode: 'written', exercise: { sourceLanguage: 'zh', targetLanguage: 'en', sourceText: '六月开始，预算三百万元。需要培训。' }, learnerAnswer: 'It starts in June.' }
const valid = () => ({ summary: 'Only the start date is translated.', coverage: { S1: 'complete', S2: 'missing', S3: 'missing' }, dimensions: { accuracy: 40, terminology: 80, grammar: 100, fluency: 100, taskStyle: 100 }, strengths: [], issues: [{ dimension: 'accuracy', sourceId: 'S2', learnerId: 'A1', explanation: 'The budget was omitted.', suggestion: 'Add the budget of three million yuan.' }], alternatives: [], uncertainty: 'Practice estimate only.' })

test('local evidence catalogue contains unchanged literal clauses and deterministic IDs', () => {
  assert.deepEqual(evidenceUnits(input.exercise.sourceText, 'S'), { S1: '六月开始，', S2: '预算三百万元。', S3: '需要培训。' })
  for (const unit of Object.values(evidenceUnits(input.exercise.sourceText, 'S'))) assert.ok(input.exercise.sourceText.includes(unit))
})
test('schema restricts evidence IDs, coverage, dimensions and output size', () => {
  const schema = JSON.parse(localWrittenSchema(input))
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.properties.coverage.required, ['S1', 'S2', 'S3'])
  assert.deepEqual(schema.properties.issues.items.properties.sourceId.enum, ['', 'S1', 'S2', 'S3'])
  assert.equal(schema.properties.issues.maxItems, 2)
})
test('resolved evidence passes the unchanged domain literal-evidence validator', () => {
  const feedback = validateFeedback(resolveLocalEvidence(valid(), input), { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
  assert.equal(feedback.issues[0].sourceQuote, '预算三百万元。')
  assert.equal(feedback.issues[0].learnerQuote, input.learnerAnswer)
  assert.equal('coverage' in feedback, false)
})
test('invalid IDs, incomplete coverage and generated quotes fail closed', () => {
  const unknown = valid(); unknown.issues[0].sourceId = 'S99'
  assert.throws(() => resolveLocalEvidence(unknown, input), /Missing source clauses|existing evidence ID/)
  const incomplete = valid(); delete incomplete.coverage.S3
  assert.throws(() => resolveLocalEvidence(incomplete, input), /every source ID/)
  const invented = valid(); invented.issues[0].sourceQuote = 'invented evidence'
  assert.throws(() => resolveLocalEvidence(invented, input), /generated quotes/)
})
test('admitted missing coverage cannot silently retain a high accuracy score', () => {
  const inflated = valid(); inflated.dimensions.accuracy = 95
  assert.throws(() => resolveLocalEvidence(inflated, input), /accuracy below 60/)
  const noIssue = valid(); noIssue.issues = []
  assert.throws(() => resolveLocalEvidence(noIssue, input), /accuracy issue/)
})

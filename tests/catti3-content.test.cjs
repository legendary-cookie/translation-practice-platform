const test = require('node:test')
const assert = require('node:assert/strict')
const { CATTI3_PASSAGES, CATTI3_EXAM_PASSAGE_IDS, passageLength } = require('../src/data/catti3/index.ts')
const { checkTranslation } = require('../src/domain/offline-check.ts')

function checkWithReference(passage, target) {
  const paragraphs = passage.paragraphs.map((paragraph) => ({ source: paragraph.source, reference: paragraph.reference[target] }))
  return checkTranslation({
    sourceLanguage: passage.sourceLanguage,
    targetLanguage: target,
    paragraphs,
    keyTerms: passage.keyTerms.map((term) => ({ source: term.source, accepted: term.accepted[target] ?? [] })),
    translation: paragraphs.map((paragraph) => paragraph.reference).join('\n\n'),
  })
}

test('every CATTI 3 passage has a reference for each paragraph and target', () => {
  for (const passage of CATTI3_PASSAGES) {
    assert.ok(passage.paragraphs.length >= 4, `${passage.id} should have CATTI-style paragraphing`)
    for (const target of passage.targetLanguages) {
      for (const [index, paragraph] of passage.paragraphs.entries()) {
        assert.ok(paragraph.reference[target]?.trim(), `${passage.id} paragraph ${index + 1} lacks a ${target} reference`)
      }
      for (const term of passage.keyTerms) {
        assert.ok(term.accepted[target]?.length, `${passage.id} key term ${term.source} lacks ${target} renderings`)
      }
    }
  }
})

test('the reference translation passes every offline check for its own passage', () => {
  for (const passage of CATTI3_PASSAGES) {
    for (const target of passage.targetLanguages) {
      const result = checkWithReference(passage, target)
      const missingNumbers = result.numbers.filter((number) => !number.found).map((number) => number.source)
      const missingTerms = result.keyTerms.filter((term) => !term.found).map((term) => term.source)
      assert.deepEqual(missingNumbers, [], `${passage.id} → ${target}: numbers not matched`)
      assert.deepEqual(missingTerms, [], `${passage.id} → ${target}: key terms not matched`)
      assert.equal(result.paragraphAlignment.passed, true, `${passage.id} → ${target}: paragraphs`)
      assert.equal(result.length.status, 'within range', `${passage.id} → ${target}: length`)
      assert.equal(result.similarity, 100, `${passage.id} → ${target}: similarity`)
    }
  }
})

test('exam sections approach CATTI 3 length (about 600 words / 400 characters per section)', () => {
  for (const [pair, sections] of Object.entries(CATTI3_EXAM_PASSAGE_IDS)) {
    for (const [section, ids] of Object.entries(sections)) {
      const passages = ids.map((id) => CATTI3_PASSAGES.find((passage) => passage.id === id))
      assert.ok(passages.every(Boolean), `${pair} ${section} has every exam passage`)
      assert.ok(passages.every((passage) => passage.usage === 'exam'))
      const total = passages.reduce((sum, passage) => sum + passageLength(passage), 0)
      const [min, max] = section === 'chineseToForeign' ? [380, 550] : [420, 650]
      assert.ok(total >= min && total <= max, `${pair} ${section} length ${total} outside ${min}-${max}`)
    }
  }
})

test('number matching handles 万亿, decimal commas, shared-unit ranges and bare numbers rendered as percentages', () => {
  const run = (source, translation, targetLanguage = 'en', sourceLanguage = 'zh') => checkTranslation({
    sourceLanguage, targetLanguage, keyTerms: [], translation,
    paragraphs: [{ source, reference: translation }],
  }).numbers.map((number) => number.found)
  assert.deepEqual(run('2.49万亿元', '2.49 trillion yuan'), [true])
  assert.deepEqual(run('2.49万亿元，增长12.5%', '2,49 трлн юаней, рост на 12,5%', 'ru'), [true, true])
  assert.deepEqual(run('Возраст 25–30 миллионов лет', '2500万至3000万年', 'zh', 'ru'), [true, true])
  assert.deepEqual(run('around 70 to 80 percent', '70%到80%', 'zh', 'en'), [true, true])
  assert.deepEqual(run('1,864只', 'rose to 1,864'), [true])
  assert.deepEqual(run('15%', '15'), [false], 'a source percentage must stay a percentage')
})

test('glossary shows the full reference word instead of a matching stem', () => {
  const { glossaryHint, EXERCISES } = require('../src/data/exercises.ts')
  assert.equal(glossaryHint(['urbani'], 'As urbanization advances'), 'urbanization')
  assert.equal(glossaryHint(['сортиров'], 'Мусор сортируют на сортировочных станциях'), 'сортировочных')
  assert.equal(glossaryHint(['弱势群体'], '并使老年人等弱势群体面临更大的风险'), '弱势群体')
  assert.equal(glossaryHint([], 'anything'), undefined)
  for (const exercise of EXERCISES) {
    for (const entry of exercise.glossary) assert.ok(entry.targetHint, `${exercise.id} ${entry.term} has a hint`)
  }
})

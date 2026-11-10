const test = require('node:test')
const assert = require('node:assert/strict')
const { checkTranslation, roughSimilarity } = require('../src/domain/offline-check.ts')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')
const { OfflineCheckPanel } = require('../src/components/OfflineCheckPanel.tsx')
const base = (translation, extra = {}) => ({ sourceLanguage: 'zh', targetLanguage: 'en', paragraphs: [{ source: '城市投入2000万元，增长15%。', reference: 'The city invested 20 million yuan, an increase of 15 per cent.' }], keyTerms: [{ source: '投入', accepted: ['invest'] }], translation, ...extra })

test('matches Chinese scaling, percent expressions, and case-insensitive terms', () => {
  const r = checkTranslation(base('The city INVESTED 20 million yuan, an increase of 15 per cent.'))
  assert.ok(r.numbers.every(n => n.found))
  assert.ok(r.keyTerms[0].found)
  assert.equal(r.similarity, 100)
  assert.equal(r.length.status, 'within range')
})
test('matches Russian inflection through accepted stems and Russian number units', () => {
  const r = checkTranslation(base('В сортировочных центрах вложено 20 млн рублей, рост 15 процентов.', {
    targetLanguage: 'ru', keyTerms: [{ source: '分拣', accepted: ['сортиров'] }],
  }))
  assert.ok(r.keyTerms[0].found)
  assert.ok(r.numbers.every(n => n.found))
})
for (const number of ['100,000', '100 000', '100\u2009000', '100\u202f000', '100 тыс.', '0.1 million']) {
  test(`normalizes 10万 to ${number}`, () => {
    assert.ok(checkTranslation(base(number, { paragraphs: [{ source: '10万', reference: '100,000' }] })).numbers[0].found)
  })
}
test('normalizes 亿 and decimals in either source direction', () => {
  assert.ok(checkTranslation(base('250 million', { paragraphs: [{ source: '2.5亿', reference: '250 million' }] })).numbers[0].found)
  assert.ok(checkTranslation(base('2.5亿', { sourceLanguage: 'en', targetLanguage: 'zh', paragraphs: [{ source: '250 million', reference: '2.5亿' }] })).numbers[0].found)
  assert.ok(checkTranslation(base('12.5%', { paragraphs: [{ source: '12.5%', reference: '12.5 per cent' }] })).numbers[0].found)
})
test('does not confuse percentages with quantities or substring numbers', () => {
  const r = checkTranslation(base('115 2000', { paragraphs: [{ source: '15% 200', reference: '15% 200' }] }))
  assert.deepEqual(r.numbers.map(n => n.found), [false, false])
})
test('Chinese targets use Han-character length and plain accepted substrings', () => {
  const r = checkTranslation(base('建设绿色社区。', { sourceLanguage: 'en', targetLanguage: 'zh', paragraphs: [{ source: 'Build green communities.', reference: '建设绿色社区。' }], keyTerms: [{ source: 'green', accepted: ['绿色', '环保'] }] }))
  assert.equal(r.length.actual, 6)
  assert.equal(r.similarity, 100)
  assert.ok(r.keyTerms[0].found)
})
test('blank-line alignment and missing indexes preserve reference rows', () => {
  const paragraphs = [{ source: '甲', reference: 'First' }, { source: '乙', reference: 'Second' }, { source: '丙', reference: 'Third' }]
  const r = checkTranslation(base('First\n\nSecond', { paragraphs }))
  assert.deepEqual(r.paragraphAlignment, { expected: 3, actual: 2, passed: false, missingIndexes: [3] })
  assert.equal(r.paragraphs[2].translation, '')
  assert.equal(r.paragraphs[2].reference, 'Third')
  assert.equal(checkTranslation(base('First\nSecond\nThird', { paragraphs })).paragraphAlignment.passed, true)
})
test('blank lines take precedence over wrapped lines, and extra paragraphs are retained', () => {
  const r = checkTranslation(base('First line\ncontinued\n\nExtra'))
  assert.equal(r.paragraphAlignment.actual, 2)
  assert.equal(r.paragraphs[0].translation, 'First line\ncontinued')
  assert.equal(r.paragraphs[1].translation, 'Extra')
})
test('length flags omissions and padding against reference', () => {
  const extra = { paragraphs: [{ source: '原文', reference: 'one two three four five' }], keyTerms: [] }
  assert.equal(checkTranslation(base('one', extra)).length.status, 'possible omission')
  assert.equal(checkTranslation(base('one two three four five six seven eight nine', extra)).length.status, 'possible padding')
})
test('empty and whitespace-only translations fail all checks without throwing', () => {
  for (const translation of ['', ' \n\t ']) {
    const r = checkTranslation(base(translation))
    assert.ok(Object.values(r.checks).every(v => v === false))
    assert.ok(r.numbers.every(n => !n.found))
    assert.ok(r.keyTerms.every(t => !t.found))
    assert.equal(r.similarity, 0)
    assert.deepEqual(r.paragraphAlignment.missingIndexes, [1])
  }
  assert.doesNotThrow(() => checkTranslation(base('', { paragraphs: [], keyTerms: [] })))
})
test('character trigram F2 is bounded, rewards recall, and handles short references', () => {
  assert.equal(roughSimilarity('ab', 'ab'), 100)
  assert.equal(roughSimilarity('', 'abc'), 0)
  assert.equal(roughSimilarity('xyz', 'abc'), 0)
  assert.ok(roughSimilarity('abcdefghij extra', 'abcdefghij') > roughSimilarity('abc', 'abcdefghij'))
  assert.ok(roughSimilarity('some text', 'some changed text') < 100)
})
test('offline panel renders accessible column headings, reference and live summary without AI', () => {
  const html = renderToStaticMarkup(React.createElement(OfflineCheckPanel, { input: base('An attempt') }))
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /scope="col"/)
  assert.match(html, /Reference \(参考译文\)/)
  assert.match(html, /Show reference translation/)
  assert.match(html, /The city invested/)
})

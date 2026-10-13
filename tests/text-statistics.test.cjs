const test = require('node:test')
const assert = require('node:assert/strict')
const { countTextStatistics } = require('../src/features/practice/text-statistics.ts')

test('multilingual word counts separate punctuation and CJK words without requiring spaces', () => {
  assert.equal(countTextStatistics('你好，世界', 'zh').words, 2)
  assert.equal(countTextStatistics('Hello, world!', 'en').words, 2)
  assert.equal(countTextStatistics('مرحبا بالعالم', 'ar').words, 2)
  assert.equal(countTextStatistics('Привет мир', 'ru').words, 2)
  assert.equal(countTextStatistics('नमस्ते दुनिया', 'hi').words, 2)
  assert.equal(countTextStatistics('', 'en').words, 0)
})

test('character count ignores whitespace and does not double-count surrogate pairs', () => {
  assert.equal(countTextStatistics(' A\n文 😀 ', 'en').characters, 3)
})

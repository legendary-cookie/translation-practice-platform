const assert = require('node:assert/strict')
const test = require('node:test')
const { newReviewState, reviewCard, readWrittenDraft } = require('../src/domain/learning.ts')

test('SM-2 review progresses at known intervals and a failed recall resets repetitions', () => {
  const start = new Date('2026-01-01T12:00:00Z')
  const first = reviewCard(newReviewState(start), 3, start)
  assert.equal(first.intervalDays, 1)
  assert.equal(first.dueAt, '2026-01-02T12:00:00.000Z')
  const second = reviewCard(first, 3, new Date(first.dueAt))
  assert.equal(second.intervalDays, 6)
  const third = reviewCard(second, 3, new Date(second.dueAt))
  assert.equal(third.intervalDays, 15)
  const failed = reviewCard(third, 1, new Date(third.dueAt))
  assert.equal(failed.repetitions, 0)
  assert.equal(failed.intervalDays, 1)
  assert.equal(reviewCard(failed, 3, new Date(failed.dueAt)).intervalDays, 1)
  assert.equal(first.ease, 2.5)
  assert.equal(reviewCard(first, 4, start).ease, 2.6)
  assert.deepEqual(newReviewState(start), { repetitions: 0, intervalDays: 0, ease: 2.5, dueAt: start.toISOString() })
})

test('repeated hard recall never lowers the SM-2 ease below 1.3 or mutates the previous state', () => {
  let state = newReviewState(new Date('2026-01-01T00:00:00Z'))
  const original = { ...state }
  for (let i = 0; i < 30; i++) state = reviewCard(state, 2, new Date(state.dueAt))
  assert.equal(state.ease, 1.3)
  assert.equal(original.ease, 2.5)
  assert.ok(state.intervalDays > 0)
})

test('written recovery preserves exact multilingual answer and clock but rejects corrupt payloads', () => {
  const draft = { exercise: { id: 'original', sourceText: '原文', title: 'Original', sourceLanguage: 'zh', targetLanguage: 'ar', mode: 'written', glossary: [{ term: '原文', note: 'source text' }] }, answer: '  ترجمة\nहिन्दी 中文  ', elapsedSeconds: 12, timeLimitSeconds: 600, updatedAt: '2026-01-01T00:00:00Z' }
  assert.deepEqual(readWrittenDraft(draft), draft)
  assert.equal(readWrittenDraft({ ...draft, elapsedSeconds: -1 }), undefined)
  assert.equal(readWrittenDraft({ ...draft, answer: null }), undefined)
  assert.equal(readWrittenDraft({ ...draft, timeLimitSeconds: NaN }), undefined)
  assert.equal(readWrittenDraft({ ...draft, updatedAt: 'invalid' }), undefined)
  assert.equal(readWrittenDraft({ ...draft, exercise: { ...draft.exercise, targetLanguage: 'xx' } }), undefined)
  assert.equal(readWrittenDraft({ ...draft, exercise: { ...draft.exercise, glossary: [null] } }), undefined)
})

const assert = require('node:assert/strict')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const { ExamSectionWorkspace } = require('../src/features/exam/ExamSectionWorkspace.tsx')

const section = {
  id: 'section-one',
  title: 'Section One',
  direction: 'en-zh',
  taskType: 'translation',
  timeLimitMinutes: 5,
  maxPoints: 100,
  passages: [{ id: 'passage-one', title: 'Passage One', sourceText: 'Synthetic source.', wordCount: 2, targetLanguage: 'zh' }],
}

function renderSection({ isLastSection, isEditorReadOnly, isLocked }) {
  return renderToStaticMarkup(React.createElement(ExamSectionWorkspace, {
    section,
    answers: {},
    onAnswerChange() {},
    onNextSection() {},
    isLastSection,
    isEditorReadOnly,
    isLocked,
  }))
}

test('rendered Next Section and Final Submission buttons are disabled for an editor-readonly run', () => {
  const nextMarkup = renderSection({ isLastSection: false, isEditorReadOnly: true, isLocked: true })
  const submitMarkup = renderSection({ isLastSection: true, isEditorReadOnly: true, isLocked: true })

  assert.match(nextMarkup, /<button[^>]*disabled=""[^>]*>Next Section →<\/button>/)
  assert.match(submitMarkup, /<button[^>]*disabled=""[^>]*>Proceed to Final Submission<\/button>/)
})

test('ordinary timer lock leaves section navigation enabled so expiry and retry flows stay reachable', () => {
  const expiredSectionMarkup = renderSection({ isLastSection: false, isEditorReadOnly: false, isLocked: true })
  const expiredFinalMarkup = renderSection({ isLastSection: true, isEditorReadOnly: false, isLocked: true })

  assert.doesNotMatch(expiredSectionMarkup, /<button[^>]*disabled=""[^>]*>Next Section →<\/button>/)
  assert.doesNotMatch(expiredFinalMarkup, /<button[^>]*disabled=""[^>]*>Proceed to Final Submission<\/button>/)
})

test('actual transition gate blocks readonly nonfinal and final handlers without invoking mutations', () => {
  const { requestExamSectionTransition } = require('../src/features/exam/section-transition.ts')
  const effects = []
  for (const isLastSection of [false, true]) {
    const result = requestExamSectionTransition({
      isEditorReadOnly: true,
      submissionStarted: false,
      isLastSection,
      advance: () => effects.push('advance'),
      requestSubmitConfirmation: () => effects.push('submit-confirmation'),
    })
    assert.equal(result, 'blocked')
  }
  assert.equal(requestExamSectionTransition({
    isEditorReadOnly: false,
    submissionStarted: true,
    isLastSection: false,
    advance: () => effects.push('advance'),
    requestSubmitConfirmation: () => effects.push('submit-confirmation'),
  }), 'blocked')
  assert.deepEqual(effects, [])
})

test('writable next and final controls invoke their normal transition handlers', () => {
  const { requestExamSectionTransition } = require('../src/features/exam/section-transition.ts')
  const effects = []
  assert.equal(requestExamSectionTransition({
    isEditorReadOnly: false,
    submissionStarted: false,
    isLastSection: false,
    advance: () => effects.push('advance'),
    requestSubmitConfirmation: () => effects.push('submit-confirmation'),
  }), 'advanced')
  assert.equal(requestExamSectionTransition({
    isEditorReadOnly: false,
    submissionStarted: false,
    isLastSection: true,
    advance: () => effects.push('advance'),
    requestSubmitConfirmation: () => effects.push('submit-confirmation'),
  }), 'submit-confirmation')
  assert.deepEqual(effects, ['advance', 'submit-confirmation'])
})

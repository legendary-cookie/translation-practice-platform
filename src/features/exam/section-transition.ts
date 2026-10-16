export type ExamSectionTransition = 'blocked' | 'advanced' | 'submit-confirmation'

export function requestExamSectionTransition(input: {
  isEditorReadOnly: boolean
  submissionStarted: boolean
  isLastSection: boolean
  advance: () => void
  requestSubmitConfirmation: () => void
}): ExamSectionTransition {
  if (input.isEditorReadOnly || input.submissionStarted) return 'blocked'
  if (input.isLastSection) {
    input.requestSubmitConfirmation()
    return 'submit-confirmation'
  }
  input.advance()
  return 'advanced'
}

import { useEffect, useState } from 'react'
import type { ExamSectionConfig } from '../../domain/types'
import { CLIPBOARD_POLICY_NOTICE, countTextUnits } from '../../domain/exam'

export type ExamSectionWorkspaceProps = {
  section: ExamSectionConfig
  answers: Record<string, string>
  onAnswerChange: (passageId: string, text: string) => void
  onNextSection: () => void
  isLastSection: boolean
  isLocked?: boolean
}

export function ExamSectionWorkspace({
  section,
  answers,
  onAnswerChange,
  onNextSection,
  isLastSection,
  isLocked = false,
}: ExamSectionWorkspaceProps) {
  const [selectedPassageIndex, setSelectedPassageIndex] = useState(0)
  const [pasteNotice, setPasteNotice] = useState<string | undefined>()

  useEffect(() => {
    setSelectedPassageIndex(0)
  }, [section.id])

  const activePassage = section.passages[selectedPassageIndex] ?? section.passages[0]
  if (!activePassage) {
    return <div className="notice-banner">No passages configured for this section.</div>
  }

  const currentAnswer = answers[activePassage.id] ?? ''
  const currentCount = countTextUnits(currentAnswer, activePassage.targetLanguage)

  // Determine text direction
  const isSourceArabic = section.direction.startsWith('ar')
  const isTargetArabic = activePassage.targetLanguage === 'ar'

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // This is a product-level simulation choice, not an assertion about every CATTI client.
    event.preventDefault()
    setPasteNotice(`${CLIPBOARD_POLICY_NOTICE} Direct pasting remains blocked for this run.`)
    setTimeout(() => setPasteNotice(undefined), 4000)
  }

  return (
    <div className="exam-workspace-container">
      {/* Strict mode info banner */}
      <div className="exam-strict-banner" role="status">
        <span aria-hidden="true">🔒</span>
        <span>
          <strong>Strict test mode active:</strong> Reference glossaries and interactive AI assistance are disabled. Clipboard restriction is a platform simulation choice, not an official universal CATTI rule.
        </span>
      </div>

      {/* Multiple Passages Tabs */}
      {section.passages.length > 1 && (
        <div className="exam-passage-tabs" role="tablist" aria-label="Section passages">
          {section.passages.map((passage, index) => {
            const hasContent = (answers[passage.id] ?? '').trim().length > 0
            const isActive = index === selectedPassageIndex
            return (
              <button
                key={passage.id}
                role="tab"
                aria-selected={isActive}
                className={`exam-passage-tab ${isActive ? 'exam-passage-tab--active' : ''}`}
                type="button"
                onClick={() => setSelectedPassageIndex(index)}
              >
                <span>Passage {index + 1}</span>
                {hasContent && <span aria-label="completed" style={{ marginLeft: '0.35rem' }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Workspace (Split Pane) */}
      <div className="exam-workspace">
        {/* Left Pane: Source Text */}
        <section className="exam-source-pane" aria-labelledby="source-heading">
          <div className="exam-source-pane__header">
            <h3 id="source-heading" className="exam-source-pane__title">
              {activePassage.title}
            </h3>
            <span className="exam-source-pane__meta">
              {activePassage.wordCount} {section.direction.startsWith('zh') ? 'characters' : 'words'}
              {activePassage.recommendedPace && ` · ${activePassage.recommendedPace}`}
            </span>
          </div>
          <div
            className="exam-source-pane__body"
            dir={isSourceArabic ? 'rtl' : 'ltr'}
            onCopy={(e) => {
              e.preventDefault()
              setPasteNotice(CLIPBOARD_POLICY_NOTICE)
              setTimeout(() => setPasteNotice(undefined), 4000)
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {activePassage.sourceText}
          </div>
        </section>

        {/* Right Pane: Translation Editor */}
        <section className="exam-target-pane" aria-labelledby="target-heading">
          <div className="exam-target-pane__header">
            <label id="target-heading" htmlFor="exam-answer-input" className="exam-target-pane__label">
              Your Translation ({activePassage.targetLanguage.toUpperCase()})
            </label>
            <span className="exam-target-pane__counter">
              {currentCount} {activePassage.targetLanguage === 'zh' ? 'chars' : 'words'} entered
            </span>
          </div>

          <textarea
            id="exam-answer-input"
            className="exam-target-pane__textarea"
            dir={isTargetArabic ? 'rtl' : 'ltr'}
            value={currentAnswer}
            disabled={isLocked}
            onChange={(e) => onAnswerChange(activePassage.id, e.target.value)}
            onPaste={handlePaste}
            placeholder={
              isLocked
                ? 'Time for this section has expired. Inputs are locked.'
                : 'Type your translation here. Clipboard restriction is a platform simulation choice for this practice run...'
            }
          />

          {pasteNotice && (
            <p className="exam-target-pane__notice" role="alert">
              {pasteNotice}
            </p>
          )}

          {isLocked && (
            <p className="exam-target-pane__notice" role="alert">
              Section time expired. Translation inputs for this section are locked.
            </p>
          )}
        </section>
      </div>

      {/* Navigation Footer */}
      <footer className="exam-section-footer">
        <div>
          {section.passages.length > 1 && selectedPassageIndex > 0 && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setSelectedPassageIndex(selectedPassageIndex - 1)}
            >
              ← Previous Passage
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {section.passages.length > 1 && selectedPassageIndex < section.passages.length - 1 && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setSelectedPassageIndex(selectedPassageIndex + 1)}
            >
              Next Passage →
            </button>
          )}

          <button
            className="button button--primary"
            type="button"
            onClick={onNextSection}
          >
            {isLastSection ? 'Proceed to Final Submission' : 'Next Section →'}
          </button>
        </div>
      </footer>
    </div>
  )
}

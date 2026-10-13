import { useEffect, useId, useState } from 'react'
import { AccessibleModal } from '../../components/AccessibleModal'
import { database } from '../../storage/database'
import { newReviewState } from '../../domain/learning'
import type { FeedbackRating } from '../../domain/profile'
import type { Exercise, FeedbackAnnotation } from '../../domain/types'
import { getLanguage } from '../../domain/languages'

export function FeedbackActions({ sessionId, issueIndex, issue, exercise }: { sessionId?: string; issueIndex: number; issue: FeedbackAnnotation; exercise: Exercise }) {
  const [rating, setRating] = useState<FeedbackRating['rating']>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(issue.sourceQuote || issue.learnerQuote)
  const [target, setTarget] = useState(issue.suggestion)
  const headingId = useId()
  useEffect(() => {
    let current = true
    setRating(undefined)
    if (sessionId) void database.listFeedbackRatings().then((ratings) => { if (current) setRating(ratings.find((item) => item.id === `${sessionId}:${issueIndex}`)?.rating) }).catch(() => { if (current) setMessage('Saved feedback ratings could not be loaded.') })
    return () => { current = false }
  }, [sessionId, issueIndex])
  async function rate(value: FeedbackRating['rating']) {
    if (!sessionId || busy) return
    setBusy(true)
    try {
      const id = `${sessionId}:${issueIndex}`
      if (rating === value) { await database.deleteFeedbackRating(id); setRating(undefined) }
      else { await database.saveFeedbackRating({ id, sessionId, issueIndex, rating: value, updatedAt: new Date().toISOString() }); setRating(value) }
      setMessage('Your feedback rating was saved on this device.')
    } catch { setMessage('Your rating could not be saved. Try again when local storage is available.') }
    finally { setBusy(false) }
  }
  async function saveTerm() {
    if (!source.trim() || !target.trim()) { setMessage('Add both terms before saving.'); return }
    setBusy(true)
    try {
      await database.saveLearningCard({ id: crypto.randomUUID(), kind: 'glossary', source, target, sourceLanguage: issue.sourceQuote ? exercise.sourceLanguage : exercise.targetLanguage, targetLanguage: exercise.targetLanguage, notes: issue.explanation, createdAt: new Date().toISOString(), review: newReviewState() })
      setOpen(false); setMessage('Term saved in Progress → Glossary.')
    } catch { setMessage('The term could not be saved. Your edited terms remain in this dialog.') }
    finally { setBusy(false) }
  }
  return <div className="feedback-actions"><div className="settings-actions"><button className="button button--quiet" type="button" aria-pressed={rating === 'helpful'} disabled={!sessionId || busy} onClick={() => void rate('helpful')}>Helpful</button><button className="button button--quiet" type="button" aria-pressed={rating === 'incorrect'} disabled={!sessionId || busy} onClick={() => void rate('incorrect')}>Incorrect</button><button className="button button--quiet" type="button" onClick={() => setOpen(true)}>Save term to glossary</button></div>
    {!sessionId && <p className="muted-copy">Issue ratings require a successfully saved practice session.</p>}
    {rating === 'incorrect' && <p className="form-message">Marked as a false positive. Excluded from weakness tracking; your original estimate is retained.</p>}
    {message && !open && <p className="muted-copy" role="status">{message}</p>}
    <AccessibleModal open={open} labelledBy={headingId} onCancel={() => { if (!busy) setOpen(false) }}><h2 id={headingId}>Save a useful term</h2><p>Review the quoted evidence and suggestion. Edit them into the term pair you want to learn; AI suggestions need your judgment.</p><label className="field-label">Source term<input dir={getLanguage(issue.sourceQuote ? exercise.sourceLanguage : exercise.targetLanguage).direction} value={source} onChange={(event) => setSource(event.target.value)} /></label><label className="field-label">Target term<input dir={getLanguage(exercise.targetLanguage).direction} value={target} onChange={(event) => setTarget(event.target.value)} /></label>{message && <p role="status">{message}</p>}<div className="settings-actions"><button className="button button--quiet" data-modal-cancel type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={() => void saveTerm()}>Save term</button></div></AccessibleModal>
  </div>
}

import { useEffect, useRef } from 'react'
import { getLanguage } from '../../domain/languages'
import type { EvaluationRouteResult } from '../../domain/types'
import { clearPendingConsent } from '../../ai/provider'
import './settings.css'

type ConsentRequest = Extract<EvaluationRouteResult, { status: 'needs-consent' }>

export function CloudConsentDialog({ request, onConfirm, onCancel }: { request: ConsentRequest; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { input } = request
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close() } }, [])
  function cancel() { clearPendingConsent(); onCancel() }
  return <dialog ref={dialog} className="cloud-consent" aria-labelledby="cloud-consent-title" onCancel={(event) => { event.preventDefault(); cancel() }}>
    <h2 id="cloud-consent-title">Send this translation for cloud feedback?</h2>
    <p>Local evaluation is unavailable for this request. Approving sends the exact passage and answer below, language/style details, and a tutor rubric to your configured endpoint. It may retain this content under its own policy. This approval applies only to this request.</p>
    <h3>{input.exercise.title} · {getLanguage(input.exercise.sourceLanguage).label} → {getLanguage(input.targetLanguage).label}</h3>
    <h4>Exact source passage</h4><pre dir={getLanguage(input.exercise.sourceLanguage).direction} lang={input.exercise.sourceLanguage}>{input.exercise.sourceText}</pre>
    <h4>Exact submitted answer</h4><pre dir={getLanguage(input.targetLanguage).direction} lang={input.targetLanguage}>{input.learnerAnswer}</pre>
    <details open><summary>Destination and complete request preview</summary><pre>{request.payloadSummary}</pre></details>
    <div className="button-row"><button type="button" className="button secondary" autoFocus onClick={cancel}>Keep on this device</button><button type="button" className="button primary" onClick={onConfirm}>Send this answer</button></div>
  </dialog>
}

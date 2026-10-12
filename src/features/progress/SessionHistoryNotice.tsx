export function SessionHistoryNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="notice-banner notice-banner--warning" role="alert" aria-live="assertive" style={{ marginBottom: '1.5rem' }}>
      <span>Saved written practice history could not be loaded. Your local records have not been deleted; retry before treating history as empty.</span>
      <button className="button button--quiet" type="button" onClick={onRetry}>Retry local history</button>
    </section>
  )
}

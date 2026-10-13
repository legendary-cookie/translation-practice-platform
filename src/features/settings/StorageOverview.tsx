import { useEffect, useRef, useState } from 'react'
import { database, subscribeToDataCleared } from '../../storage/database'

type StorageSnapshot = { written: number; interpreting: number; exams: number; cards: number; ratings: number; audioBytes: number; originBytes?: number; originQuota?: number }
const formatBytes = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`

export function StorageOverview() {
  const generation = useRef(0)
  const [snapshot, setSnapshot] = useState<StorageSnapshot>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  async function refresh() {
    const request = ++generation.current
    setLoading(true)
    try {
      const [written, interpreting, exams, cards, ratings, audio, estimate] = await Promise.all([
        database.listSessions(), database.listInterpretingSessions(), database.listExamResults(), database.listLearningCards(), database.listFeedbackRatings(), database.listAudioRecordings(),
        navigator.storage?.estimate?.().catch(() => undefined),
      ])
      if (request !== generation.current) return
      setSnapshot({ written: written.length, interpreting: interpreting.length, exams: exams.length, cards: cards.length, ratings: ratings.length, audioBytes: audio.reduce((sum, recording) => sum + recording.blob.size, 0), originBytes: estimate?.usage, originQuota: estimate?.quota })
      setError(undefined)
    } catch { if (request === generation.current) setError('Storage totals could not be read. Saved records may still be present; retry the inspection.') }
    finally { if (request === generation.current) setLoading(false) }
  }
  useEffect(() => {
    void refresh()
    const unsubscribe = subscribeToDataCleared(() => { generation.current += 1; setSnapshot(undefined) })
    return () => { generation.current += 1; unsubscribe() }
  }, [])
  return <section className="storage-overview"><h3>Storage on this device</h3>{snapshot && <dl className="storage-grid"><div><dt>Written practice</dt><dd>{snapshot.written} sessions</dd></div><div><dt>Interpreting</dt><dd>{snapshot.interpreting} sessions · {formatBytes(snapshot.audioBytes)} audio</dd></div><div><dt>Exam results</dt><dd>{snapshot.exams}</dd></div><div><dt>Learning library</dt><dd>{snapshot.cards} cards · {snapshot.ratings} feedback ratings</dd></div>{snapshot.originBytes !== undefined && <div><dt>Estimated browser use</dt><dd>{formatBytes(snapshot.originBytes)}</dd></div>}{snapshot.originQuota !== undefined && <div><dt>Browser origin quota</dt><dd>{formatBytes(snapshot.originQuota)}</dd></div>}</dl>}<p className="muted-copy">Browser use includes cached app assets and optional models. The quota is a browser limit, not available disk space. Delete individual cards in the learning library or individual audio sessions in Progress.</p><button className="button button--quiet" type="button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Reading storage…' : 'Refresh storage totals'}</button>{error && <p className="settings-error" role="alert">{error}</p>}</section>
}

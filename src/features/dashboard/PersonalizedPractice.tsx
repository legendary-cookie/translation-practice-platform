import { useEffect, useState } from 'react'
import { EXERCISES } from '../../data/exercises'
import { database, subscribeToDataCleared } from '../../storage/database'
import { buildLearnerProfile, DIMENSION_LABELS, recommendCatalogPractice, type FeedbackRating } from '../../domain/profile'
import type { Exercise, SessionRecord } from '../../domain/types'

export function PersonalizedPractice({ sessions, onStart, onReview }: { sessions: SessionRecord[]; onStart: (exercise: Exercise) => void; onReview: () => void }) {
  const [ratings, setRatings] = useState<FeedbackRating[]>([])
  const [due, setDue] = useState<number>()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let current = true
    void Promise.all([database.listFeedbackRatings(), database.listLearningCards()]).then(([saved, cards]) => { if (current) { setRatings(saved); setDue(cards.filter((card) => !card.mastered && Date.parse(card.review.dueAt) <= Date.now()).length); setReady(true) } }).catch(() => { if (current) setReady(false) })
    const unsubscribe = subscribeToDataCleared(() => { current = false; setRatings([]); setDue(undefined); setReady(false) })
    return () => { current = false; unsubscribe() }
  }, [sessions])
  const recommendation = ready ? recommendCatalogPractice(sessions, ratings, EXERCISES) : undefined
  const profile = buildLearnerProfile(sessions, ratings)
  if (!recommendation && !due) return null
  return <section className="personalized-practice home-grid">{recommendation && <article className="info-card"><p className="eyebrow">A useful next step</p><h3>{recommendation.exercise.title}</h3><p>{recommendation.reason}</p>{profile.focus && <p className="muted-copy">Focus: {DIMENSION_LABELS[profile.focus]}. Mark incorrect feedback to refine these suggestions.</p>}<button className="text-button" type="button" onClick={() => onStart(recommendation.exercise)}>Practice this passage →</button></article>}{Boolean(due) && <article className="info-card info-card--accent"><p className="eyebrow">Spaced review</p><h3>{due} card{due === 1 ? '' : 's'} ready to revisit.</h3><p>Recall your terms and revision notes before revealing the answer.</p><button className="text-button" type="button" onClick={onReview}>Open your learning library →</button></article>}</section>
}

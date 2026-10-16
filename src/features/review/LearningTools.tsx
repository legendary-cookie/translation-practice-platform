import { t } from '../../i18n'
import { DIMENSION_LABELS } from '../../domain/profile'
import { useEffect, useRef, useState } from 'react'
import { database, subscribeToDataCleared } from '../../storage/database'
import { LANGUAGE_CATALOG, LANGUAGE_CODES, getLanguage } from '../../domain/languages'
import type { LanguageCode } from '../../domain/types'
import { newReviewState, reviewCard, type LearningCard } from '../../domain/learning'

export function LearningTools() {
  const generation = useRef(0)
  const [cards, setCards] = useState<LearningCard[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [tab, setTab] = useState<'glossary' | 'mistake' | 'review'>('glossary')
  const [search, setSearch] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('all')
  const [dimensionFilter, setDimensionFilter] = useState('all')
  const [drillCard, setDrillCard] = useState<LearningCard>()
  const [drillAnswer, setDrillAnswer] = useState('')
  const [drillRevealed, setDrillRevealed] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<LearningCard>()
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('zh')
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('en')
  const [revealed, setRevealed] = useState(false)
  const [now, setNow] = useState(Date.now())
  async function reload() {
    const epoch = generation.current
    setStatus('loading')
    try { const value = await database.listLearningCards(); if (epoch === generation.current) { setCards(value); setStatus('ready') } }
    catch { setStatus('failed'); setError('Learning cards could not be loaded. Existing cards have not been removed.') }
  }
  useEffect(() => {
    let alive = true
    const epoch = generation.current
    void database.listLearningCards().then((value) => { if (alive && epoch === generation.current) { setCards(value); setStatus('ready') } }).catch(() => { if (alive) setStatus('failed') })
    const unsubscribe = subscribeToDataCleared(() => { generation.current += 1; setCards([]); setEditing(undefined); setSource(''); setTarget(''); setNotes(''); setDrillCard(undefined); setStatus('ready') })
    return () => { alive = false; unsubscribe() }
  }, [])
  const due = cards.filter((card) => !card.mastered && Date.parse(card.review.dueAt) <= now).sort((a, b) => a.review.dueAt.localeCompare(b.review.dueAt))
  const current = due[0]
  const shown = cards.filter((card) => card.kind === tab && (filterLanguage === 'all' || card.sourceLanguage === filterLanguage || card.targetLanguage === filterLanguage) && (dimensionFilter === 'all' || card.dimension === dimensionFilter || tab === 'glossary') && `${card.source} ${card.target} ${card.notes}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  function resetForm() { setEditing(undefined); setSource(''); setTarget(''); setNotes('') }
  async function save() {
    if (!source.trim() || !target.trim()) { setError('Add both the source and your translation or revision.'); return }
    const epoch = generation.current
    setBusy(true); setError(undefined)
    const card: LearningCard = { ...editing, id: editing?.id ?? crypto.randomUUID(), kind: editing?.kind ?? (tab === 'mistake' ? 'mistake' : 'glossary'), source, target, notes, sourceLanguage, targetLanguage, createdAt: editing?.createdAt ?? new Date().toISOString(), review: editing?.review ?? newReviewState() }
    try { await database.saveLearningCard(card); if (epoch !== generation.current) return; setCards((items) => [...items.filter((item) => item.id !== card.id), card]); resetForm() }
    catch { setError('This card could not be saved. Your text remains in the form; try again.') }
    finally { setBusy(false) }
  }
  async function grade(value: 1 | 2 | 3 | 4) {
    if (!current || busy) return
    const epoch = generation.current
    setBusy(true); setError(undefined)
    const updated = { ...current, review: reviewCard(current.review, value) }
    try { await database.saveLearningCard(updated); if (epoch !== generation.current) return; setCards((items) => items.map((item) => item.id === updated.id ? updated : item)); setRevealed(false); setNow(Date.now()) }
    catch { setError('Your review could not be saved. The card is still due; try again.') }
    finally { setBusy(false) }
  }
  async function toggleMastered(card: LearningCard) {
    const epoch = generation.current
    setBusy(true)
    const updated = { ...card, mastered: !card.mastered }
    try { await database.saveLearningCard(updated); if (epoch === generation.current) setCards((items) => items.map((item) => item.id === card.id ? updated : item)) }
    catch { setError('This learning status could not be saved. Try again.') }
    finally { setBusy(false) }
  }
  async function remove(card: LearningCard) {
    if (!window.confirm(t('Delete this saved learning card?'))) return
    const epoch = generation.current
    setBusy(true)
    try { await database.deleteLearningCard(card.id); if (epoch !== generation.current) return; setCards((items) => items.filter((item) => item.id !== card.id)); if (editing?.id === card.id) resetForm() }
    catch { setError('The card could not be deleted. It remains saved on this device.') }
    finally { setBusy(false) }
  }
  return <section className="learning-tools settings-card" aria-labelledby="learning-heading"><div className="section-heading"><div><p className="eyebrow">{t("Your learning library")}</p><h2 id="learning-heading">{t("Keep useful language close.")}</h2></div><span className="muted-label">{t("Local only · ")}{cards.length}{t(" cards")}</span></div>
    <div className="segmented-control" role="group" aria-label={t("Learning tools")}>{(['glossary', 'mistake', 'review'] as const).map((item) => <button className="button button--quiet" type="button" key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setRevealed(false); setNow(Date.now()) }}>{item === 'glossary' ? t("Glossary") : item === 'mistake' ? t("Mistake notebook") : t("Review ({0} due)", due.length)}</button>)}</div>
    {status === 'loading' && <p role="status">{t("Reading your local cards…")}</p>}
    {status === 'failed' && <p role="alert">{t("Saved learning cards are unavailable. ")}<button className="button button--quiet" type="button" onClick={() => void reload()}>{t("Retry loading cards")}</button></p>}
    {status === 'ready' && tab === 'review' && <div className="review-desk" tabIndex={0} aria-label={t("Spaced review: Enter reveals; keys 1 to 4 grade the card")} onKeyDown={(event) => { if (!current || busy) return; if (!revealed && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setRevealed(true) } else if (revealed && ['1','2','3','4'].includes(event.key)) { event.preventDefault(); void grade(Number(event.key) as 1 | 2 | 3 | 4) } }}>{current ? <><p className="eyebrow">{due.length}{t(" due · recall the translation")}</p><h3 dir={getLanguage(current.sourceLanguage).direction} lang={current.sourceLanguage}>{current.source}</h3>{revealed ? <><p className="review-answer" dir={getLanguage(current.targetLanguage).direction} lang={current.targetLanguage}>{current.target}</p><p>{current.notes}</p><div className="review-grades">{(['Again', 'Hard', 'Good', 'Easy'] as const).map((label, index) => <button className="button button--quiet" type="button" disabled={busy} key={label} onClick={() => void grade((index + 1) as 1 | 2 | 3 | 4)}>{t(label)}<small>{reviewCard(current.review, (index + 1) as 1 | 2 | 3 | 4).intervalDays}{t(" day(s)")}</small></button>)}</div></> : <button className="button button--primary" type="button" onClick={() => setRevealed(true)}>{t("Reveal translation")}</button>}</> : <><h3>{t("You’re up to date.")}</h3><p>{cards.length ? t("Next review: {0}.", new Date(Math.min(...cards.map((card) => Date.parse(card.review.dueAt)))).toLocaleDateString()) : t("Save a term or revision note to start your review habit.")}</p></>}</div>}
    {status === 'ready' && tab !== 'review' && <><p className="muted-copy">{tab === 'glossary' ? t("Collect terms in any supported language. Review schedules use SM-2 and stay on this device.") : t("Keep corrections and the reason behind them. AI suggestions are practice guidance; edit them before relying on them.")}</p><div className="setup-fields"><label className="field-label">{t("Filter by language")}<select value={filterLanguage} onChange={(event) => setFilterLanguage(event.target.value)}><option value="all">{t("All languages")}</option>{LANGUAGE_CODES.map((code) => <option key={code} value={code}>{LANGUAGE_CATALOG[code].nativeLabel}</option>)}</select></label>{tab === 'mistake' && <label className="field-label">{t("Filter by skill")}<select value={dimensionFilter} onChange={(event) => setDimensionFilter(event.target.value)}><option value="all">{t("All skills")}</option>{Object.entries(DIMENSION_LABELS).map(([key,label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>}</div><div className="learning-grid"><form className="learning-form" onSubmit={(event) => { event.preventDefault(); void save() }}><h3>{editing ? t("Edit card") : tab === 'glossary' ? t("Add a term") : t("Add a revision note")}</h3><div className="setup-fields"><label className="field-label">{t("Source language")}<select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value as LanguageCode)}>{LANGUAGE_CODES.map((code) => LANGUAGE_CATALOG[code]).map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}</select></label><label className="field-label">{t("Target language")}<select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as LanguageCode)}>{LANGUAGE_CODES.map((code) => LANGUAGE_CATALOG[code]).map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}</select></label></div><label className="field-label">{t("Source")}<input value={source} dir={getLanguage(sourceLanguage).direction} lang={sourceLanguage} onChange={(event) => setSource(event.target.value)} required /></label><label className="field-label">{t("Translation or revision")}<textarea value={target} dir={getLanguage(targetLanguage).direction} lang={targetLanguage} onChange={(event) => setTarget(event.target.value)} required /></label><label className="field-label">{t("Your notes")}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="settings-actions"><button className="button button--primary" type="submit" disabled={busy}>{busy ? t("Saving…") : t("Save card")}</button>{editing && <button className="button button--quiet" type="button" onClick={resetForm}>{t("Cancel edit")}</button>}</div></form><div><label className="field-label">{t("Search saved cards")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{!shown.length && <p className="muted-copy">{search ? t("No cards match this search.") : t("Your saved cards will appear here.")}</p>}{shown.map((card) => <article className="learning-card" key={card.id}><h3 dir={getLanguage(card.sourceLanguage).direction} lang={card.sourceLanguage}>{card.source}</h3><p dir={getLanguage(card.targetLanguage).direction} lang={card.targetLanguage}>{card.target}</p><p className="muted-copy">{card.notes}</p><small>{card.mastered ? t("Mastered · excluded from due reviews") : t("Due {0}", new Date(card.review.dueAt).toLocaleDateString())}</small>{card.learnerQuote && <p className="muted-copy" dir={getLanguage(card.targetLanguage).direction}>{t("Previous answer: ")}{card.learnerQuote}</p>}<div className="settings-actions"><button className="button button--quiet" type="button" disabled={busy} onClick={() => { setEditing(card); setSource(card.source); setTarget(card.target); setNotes(card.notes); setSourceLanguage(card.sourceLanguage); setTargetLanguage(card.targetLanguage) }}>{t("Edit")}</button><button className="button button--quiet" type="button" disabled={busy} onClick={() => void remove(card)}>{t("Delete")}</button>{card.kind === 'mistake' && <><button className="button button--quiet" type="button" disabled={busy} onClick={() => void toggleMastered(card)}>{card.mastered ? t("Mark active") : t("Mark mastered")}</button><button className="button button--quiet" type="button" onClick={() => { setDrillCard(card); setDrillAnswer(''); setDrillRevealed(false) }}>{t("Practice this note")}</button></>}</div></article>)}</div></div></>}
    {drillCard && <section className="review-desk"><p className="eyebrow">{t("Local reconstruction practice")}</p><h3 dir={getLanguage(drillCard.sourceLanguage).direction} lang={drillCard.sourceLanguage}>{drillCard.source}</h3><label className="field-label">{t("Try a fresh revision")}<textarea dir={getLanguage(drillCard.targetLanguage).direction} lang={drillCard.targetLanguage} value={drillAnswer} onChange={(event) => setDrillAnswer(event.target.value)} /></label><p className="muted-copy">{t("This is a temporary self-review. No AI request or numeric score is produced; your saved note remains in the notebook.")}</p>{drillRevealed ? <><p className="review-answer" dir={getLanguage(drillCard.targetLanguage).direction}>{drillCard.target}</p><p>{drillCard.notes}</p></> : <button className="button button--primary" type="button" disabled={!drillAnswer.trim()} onClick={() => setDrillRevealed(true)}>{t("Reveal saved revision")}</button>}<button className="button button--quiet" type="button" onClick={() => setDrillCard(undefined)}>{t("Close self-review")}</button></section>}
    {error && <p className="settings-error" role="alert">{t(error)}</p>}
  </section>
}

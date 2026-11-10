import { useState } from 'react'
import type React from 'react'
import { t } from '../i18n'
import { checkTranslation } from '../domain/offline-check'
import type { OfflineCheckInput } from '../domain/offline-check'

export function OfflineCheckPanel({ input }: { input: OfflineCheckInput }) {
  const [showReference, setShowReference] = useState(true)
  const result = checkTranslation(input)
  const items = [...result.numbers.map(n => ({ label: n.source, found: n.found })), ...result.keyTerms.map(k => ({ label: k.source, found: k.found }))]
  const missing = items.filter(item => !item.found)
  const found = items.filter(item => item.found)
  return <section className="offline-check" aria-label={t('Offline check')}>
    <h3>{t('Offline check')}</h3>
    <p>{t('Rough similarity, not a grade. Other valid translations may differ from this reference.')}</p>
    <div className="offline-check__chips" aria-live="polite" role="status">
      <Chip ok={result.checks.paragraphs}>{t('Paragraphs')}: {result.paragraphAlignment.actual}/{result.paragraphAlignment.expected}</Chip>
      <Chip ok={result.checks.numbers}>{t('Numbers')}: {result.numbers.filter(n => n.found).length}/{result.numbers.length}</Chip>
      <Chip ok={result.checks.keyTerms}>{t('Key terms')}: {result.keyTerms.filter(k => k.found).length}/{result.keyTerms.length}</Chip>
      <Chip ok={result.checks.length}>{t('Length')}: {Math.round(result.length.ratio * 100)}% · {t(result.length.status)}</Chip>
      <span className="pill">{t('Rough similarity')}: {result.similarity}/100</span>
    </div>
    {!!result.paragraphAlignment.missingIndexes.length && <p className="offline-check__warning">{t('Missing paragraphs')}: {result.paragraphAlignment.missingIndexes.join(', ')}</p>}
    <div className="offline-check__lists">
      {!!missing.length && <div><h4>{t('Needs attention')}</h4><ul className="offline-check__list offline-check__list--missing">{missing.map((item, i) => <li key={i}><span>{item.label}</span> <strong>{t('Missing')}</strong></li>)}</ul></div>}
      {!!found.length && <div><h4>{t('Matched')}</h4><ul className="offline-check__list offline-check__list--found">{found.map((item, i) => <li key={i}><span>{item.label}</span> <strong>{t('Found')}</strong></li>)}</ul></div>}
    </div>
    <button className="button button--quiet offline-check__toggle" type="button" aria-pressed={showReference} onClick={() => setShowReference(!showReference)}>{showReference ? t('Hide reference translation') : t('Show reference translation')}</button>
    <table className="offline-check__table" role="table"><caption>{t('Paragraph comparison')}</caption><thead><tr role="row"><th scope="col" role="columnheader">{t('Source')}</th><th scope="col" role="columnheader">{t('Your translation')}</th>{showReference && <th scope="col" role="columnheader">{t('Reference (参考译文)')}</th>}</tr></thead><tbody>
      {result.paragraphs.map(row => <tr key={row.index} role="row"><td role="cell" data-label={t('Source')} lang={input.sourceLanguage}>{row.source}</td><td role="cell" data-label={t('Your translation')} lang={input.targetLanguage}>{row.translation || t('(No translation entered)')}<small>{t('Rough similarity')}: {row.similarity}/100</small></td>{showReference && <td role="cell" data-label={t('Reference (参考译文)')} lang={input.targetLanguage}>{row.reference}</td>}</tr>)}
    </tbody></table>
  </section>
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`pill offline-check__chip offline-check__chip--${ok ? 'ok' : 'warn'}`}><span aria-hidden="true">{ok ? '✓ ' : '! '}</span>{children}</span>
}

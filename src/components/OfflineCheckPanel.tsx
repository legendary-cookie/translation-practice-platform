import { useState } from 'react'
import { t } from '../i18n'
import { checkTranslation } from '../domain/offline-check'
import type { OfflineCheckInput } from '../domain/offline-check'

export function OfflineCheckPanel({ input }: { input: OfflineCheckInput }) {
  const [showReference, setShowReference] = useState(true)
  const result = checkTranslation(input)
  return <section className="offline-check" aria-label={t('Offline check')}>
    <h3>{t('Offline check')}</h3>
    <p>{t('Rough similarity, not a grade. Other valid translations may differ from this reference.')}</p>
    <div className="offline-check__chips" aria-live="polite" role="status">
      <span className="pill">{t('Paragraphs')}: {result.paragraphAlignment.actual}/{result.paragraphAlignment.expected}</span>
      <span className="pill">{t('Numbers')}: {result.numbers.filter(n => n.found).length}/{result.numbers.length}</span>
      <span className="pill">{t('Key terms')}: {result.keyTerms.filter(k => k.found).length}/{result.keyTerms.length}</span>
      <span className="pill">{t('Length')}: {Math.round(result.length.ratio * 100)}% · {t(result.length.status)}</span>
      <span className="pill">{t('Rough similarity')}: {result.similarity}/100</span>
    </div>
    {!!result.paragraphAlignment.missingIndexes.length && <p>{t('Missing paragraphs')}: {result.paragraphAlignment.missingIndexes.join(', ')}</p>}
    <ul>{result.numbers.map((n, i) => <li key={i}>{n.source}: {n.found ? t('Found') : t('Missing')}</li>)}{result.keyTerms.map((term, i) => <li key={`term-${i}`}>{term.source}: {term.found ? t('Found') : t('Missing')}</li>)}</ul>
    <button className="button button--quiet" type="button" aria-pressed={showReference} onClick={() => setShowReference(!showReference)}>{t('Show reference translation')}</button>
    <table className="offline-check__table" role="table"><caption>{t('Paragraph comparison')}</caption><thead><tr role="row"><th scope="col" role="columnheader">{t('Source')}</th><th scope="col" role="columnheader">{t('Your translation')}</th>{showReference && <th scope="col" role="columnheader">{t('Reference (参考译文)')}</th>}</tr></thead><tbody>
      {result.paragraphs.map(row => <tr key={row.index} role="row"><td role="cell" data-label={t('Source')} lang={input.sourceLanguage}>{row.source}</td><td role="cell" data-label={t('Your translation')} lang={input.targetLanguage}>{row.translation || t('(No translation entered)')}<small>{t('Rough similarity')}: {row.similarity}/100</small></td>{showReference && <td role="cell" data-label={t('Reference (参考译文)')} lang={input.targetLanguage}>{row.reference}</td>}</tr>)}
    </tbody></table>
  </section>
}

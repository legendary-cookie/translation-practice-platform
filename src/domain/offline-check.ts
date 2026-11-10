import type { LanguageCode } from './languages'

export type OfflineCheckInput = {
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  paragraphs: { source: string; reference: string }[]
  keyTerms: { source: string; accepted: string[] }[]
  translation: string
}
export type OfflineCheckResult = {
  empty: boolean
  paragraphAlignment: { expected: number; actual: number; passed: boolean; missingIndexes: number[] }
  paragraphs: { index: number; source: string; translation: string; reference: string; similarity: number }[]
  numbers: { source: string; value: number; percent: boolean; found: boolean }[]
  keyTerms: { source: string; accepted: string[]; found: boolean }[]
  length: { actual: number; reference: number; ratio: number; status: 'possible omission' | 'possible padding' | 'within range' }
  similarity: number
  checks: { paragraphs: boolean; numbers: boolean; keyTerms: boolean; length: boolean; closeness: boolean }
}

/** Digits and explicit units only: this deliberately does not infer written-out numbers. */
const INTEGER = String.raw`\d+(?:[ ,   ]\d{3}(?!\d))*`
const FRACTION = String.raw`(?:[.,]\d+)?`
const UNIT = String.raw`万亿|万|亿|trillion\b|billion\b|million\b|thousand\b|триллион[а-яё]*|миллиард[а-яё]*|миллион[а-яё]*|тысяч[а-яё]*|трлн\.?|млрд\.?|млн\.?|тыс\.?|%|％|per\s*cent\b|percent\b|процент[а-яё]*`
const NUMBER_PATTERN = new RegExp(`(${INTEGER})(${FRACTION})(?:\\s*(?:多|余)?\\s*(${UNIT}))?`, 'giu')
/** Text allowed between the two ends of a range such as "25–30 млн" or "70 to 80 percent". */
const RANGE_JOINER = /^\s*(?:–|—|-|~|～|to|до|至|到)\s*$/iu

function unitScale(unit: string): number {
  if (/万亿|trillion|трлн|триллион/u.test(unit)) return 1e12
  if (/亿/u.test(unit)) return 1e8
  if (/billion|млрд|миллиард/u.test(unit)) return 1e9
  if (/万/u.test(unit)) return 1e4
  if (/million|млн|миллион/u.test(unit)) return 1e6
  if (/thousand|тыс/u.test(unit)) return 1e3
  return 1
}

function numericTokens(text: string) {
  const normalized = text.normalize('NFKC')
  const raw = [...normalized.matchAll(NUMBER_PATTERN)].map((match) => ({
    source: match[0].trim(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    base: Number(`${match[1].replace(/[ ,   ]/gu, '')}${match[2] ? `.${match[2].slice(1)}` : ''}`),
    unit: (match[3] ?? '').toLowerCase(),
  }))
  // A bare number that opens a range inherits the unit written after the range's second number.
  for (let i = raw.length - 2; i >= 0; i--) {
    const next = raw[i + 1]
    if (!raw[i].unit && next.unit && RANGE_JOINER.test(normalized.slice(raw[i].end, next.start))) raw[i].unit = next.unit
  }
  return raw.map((token) => ({
    source: token.source,
    value: token.base * unitScale(token.unit),
    percent: /%|％|cent|процент/u.test(token.unit),
  }))
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-7, Math.abs(a) * 1e-9)
}
function grams(text: string): Map<string, number> {
  const chars = Array.from(text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ''))
  const result = new Map<string, number>()
  // Short strings retain a single gram so exact short references can still match.
  const size = Math.min(3, chars.length)
  if (!size) return result
  for (let i = 0; i <= chars.length - size; i++) {
    const gram = chars.slice(i, i + size).join('')
    result.set(gram, (result.get(gram) ?? 0) + 1)
  }
  return result
}
export function roughSimilarity(answer: string, reference: string): number {
  const a = grams(answer), r = grams(reference)
  let overlap = 0, totalA = 0, totalR = 0
  for (const [g, n] of a) { totalA += n; overlap += Math.min(n, r.get(g) ?? 0) }
  for (const n of r.values()) totalR += n
  if (!totalA || !totalR || !overlap) return 0
  const precision = overlap / totalA, recall = overlap / totalR
  return Math.round(1000 * 5 * precision * recall / (4 * precision + recall)) / 10
}
function length(text: string, language: LanguageCode): number {
  return language === 'zh' ? (text.match(/\p{Script=Han}/gu) ?? []).length : (text.match(/[\p{L}\p{N}]+(?:['’’-][\p{L}\p{N}]+)*/gu) ?? []).length
}
export function checkTranslation(input: OfflineCheckInput): OfflineCheckResult {
  const { translation, paragraphs, targetLanguage } = input
  const trimmed = translation.trim(), empty = !trimmed
  const parts = empty ? [] : trimmed.split(/\r?\n\s*\r?\n/u).length > 1
    ? trimmed.split(/\r?\n\s*\r?\n/u).map(s => s.trim()).filter(Boolean)
    : trimmed.split(/\r?\n/u).map(s => s.trim()).filter(Boolean)
  const referenceText = paragraphs.map(p => p.reference).join('\n\n')
  const translatedNumbers = numericTokens(translation)
  const numbers = numericTokens(paragraphs.map(p => p.source).join('\n\n')).map(token => ({ ...token,
    found: !empty && translatedNumbers.some(n => (token.percent ? n.percent : true) && sameNumber(n.value, token.value)),
  }))
  const lower = translation.toLowerCase()
  const keyTerms = input.keyTerms.map(term => ({ ...term, found: !empty && term.accepted.some(s => s.trim() && lower.includes(s.toLowerCase())) }))
  const actual = length(translation, targetLanguage), reference = length(referenceText, targetLanguage)
  const ratio = reference ? actual / reference : 0
  const status = ratio < 0.6 ? 'possible omission' : ratio > 1.6 ? 'possible padding' : 'within range'
  const similarity = roughSimilarity(translation, referenceText)
  const alignment = { expected: paragraphs.length, actual: parts.length, passed: !empty && parts.length === paragraphs.length,
    missingIndexes: paragraphs.flatMap((_, i) => parts[i] ? [] : [i + 1]) }
  return { empty, paragraphAlignment: alignment,
    paragraphs: Array.from({ length: Math.max(paragraphs.length, parts.length) }, (_, i) => ({ index: i + 1,
      source: paragraphs[i]?.source ?? '', reference: paragraphs[i]?.reference ?? '', translation: parts[i] ?? '',
      similarity: roughSimilarity(parts[i] ?? '', paragraphs[i]?.reference ?? ''),
    })), numbers, keyTerms, length: { actual, reference, ratio, status }, similarity,
    checks: { paragraphs: alignment.passed, numbers: !empty && numbers.every(n => n.found), keyTerms: !empty && keyTerms.every(t => t.found),
      length: !empty && status === 'within range', closeness: !empty && similarity > 0 },
  }
}

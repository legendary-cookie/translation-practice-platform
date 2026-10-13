export function countTextStatistics(text: string, locale: string) {
  const characters = Array.from(text.replace(/\s/gu, '')).length
  const words = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)).filter((part) => part.isWordLike).length
    : text.trim().split(/\s+/u).filter(Boolean).length
  return { words, characters }
}

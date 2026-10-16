export type LanguageCode = 'zh' | 'en' | 'ru' | 'fr' | 'hi' | 'es' | 'ar'

export type TextDirection = 'ltr' | 'rtl'

export type LanguageDefinition = {
  code: LanguageCode
  label: string
  nativeLabel: string
  script: string
  direction: TextDirection
  speechTag: string
}

export const LANGUAGE_CATALOG: Record<LanguageCode, LanguageDefinition> = {
  zh: { code: 'zh', label: 'Chinese', nativeLabel: '中文', script: 'Simplified Chinese', direction: 'ltr', speechTag: 'zh-CN' },
  en: { code: 'en', label: 'English', nativeLabel: 'English', script: 'Latin', direction: 'ltr', speechTag: 'en-US' },
  ru: { code: 'ru', label: 'Russian', nativeLabel: 'Русский', script: 'Cyrillic', direction: 'ltr', speechTag: 'ru-RU' },
  fr: { code: 'fr', label: 'French', nativeLabel: 'Français', script: 'Latin', direction: 'ltr', speechTag: 'fr-FR' },
  hi: { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', script: 'Devanagari', direction: 'ltr', speechTag: 'hi-IN' },
  es: { code: 'es', label: 'Spanish', nativeLabel: 'Español', script: 'Latin', direction: 'ltr', speechTag: 'es-ES' },
  ar: { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', script: 'Arabic', direction: 'rtl', speechTag: 'ar-SA' },
}

export const LANGUAGE_CODES = Object.keys(LANGUAGE_CATALOG) as LanguageCode[]

export type DirectionId = `${LanguageCode}-${LanguageCode}`

export type TranslationDirection = {
  id: DirectionId
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  label: string
}

const nonChineseLanguages: LanguageCode[] = ['en', 'ru', 'fr', 'hi', 'es', 'ar']

export const CHINESE_DIRECTIONS: TranslationDirection[] = nonChineseLanguages.flatMap((language) => [
  {
    id: `zh-${language}` as DirectionId,
    sourceLanguage: 'zh',
    targetLanguage: language,
    label: `Chinese → ${LANGUAGE_CATALOG[language].label}`,
  },
  {
    id: `${language}-zh` as DirectionId,
    sourceLanguage: language,
    targetLanguage: 'zh',
    label: `${LANGUAGE_CATALOG[language].label} → Chinese`,
  },
])

export function getLanguage(code: LanguageCode): LanguageDefinition {
  return LANGUAGE_CATALOG[code]
}

export function getDirection(sourceLanguage: LanguageCode, targetLanguage: LanguageCode): TranslationDirection | undefined {
  return CHINESE_DIRECTIONS.find((direction) => direction.sourceLanguage === sourceLanguage && direction.targetLanguage === targetLanguage)
}

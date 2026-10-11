import type { LanguageCode } from './types'

export type { LanguageCode } from './types'

export interface Language {
  code: LanguageCode
  label: string
  nativeLabel: string
  direction: 'ltr' | 'rtl'
  script: string
}

export const languages: readonly Language[] = [
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', direction: 'ltr', script: 'Han' },
  { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr', script: 'Latin' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', direction: 'ltr', script: 'Cyrillic' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', direction: 'ltr', script: 'Latin' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', direction: 'ltr', script: 'Devanagari' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', direction: 'ltr', script: 'Latin' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', direction: 'rtl', script: 'Arabic' },
]

export interface TranslationDirection {
  id: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  label: string
}

export const translationDirections: readonly TranslationDirection[] = languages
  .filter((language) => language.code !== 'zh')
  .flatMap((language) => [
    { id: `zh-${language.code}`, sourceLanguage: 'zh' as const, targetLanguage: language.code, label: `Chinese → ${language.label}` },
    { id: `${language.code}-zh`, sourceLanguage: language.code, targetLanguage: 'zh' as const, label: `${language.label} → Chinese` },
  ])

export function getLanguage(code: LanguageCode): Language {
  const language = languages.find((item) => item.code === code)
  if (!language) throw new Error(`Unsupported language: ${code}`)
  return language
}

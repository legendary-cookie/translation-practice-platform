import { useEffect, useSyncExternalStore } from 'react'
import { zhCN } from './zh-CN'

export type InterfaceLanguage = 'en' | 'zh-CN'
const preferenceKey = 'lingo-workspace-preferences-v1'
const preferenceEvent = 'lingo-preferences-change'
function readLanguage(): InterfaceLanguage {
  try {
    if (typeof window !== 'undefined' && JSON.parse(window.localStorage.getItem(preferenceKey) ?? '{}').interfaceLanguage === 'zh-CN') return 'zh-CN'
  } catch { /* Storage failure leaves the interface usable in English. */ }
  return 'en'
}
let currentLanguage = readLanguage()
function snapshot() { currentLanguage = readLanguage(); return currentLanguage }
function subscribe(notify: () => void) {
  const changed = () => { snapshot(); notify() }
  window.addEventListener(preferenceEvent, changed)
  window.addEventListener('storage', changed)
  return () => { window.removeEventListener(preferenceEvent, changed); window.removeEventListener('storage', changed) }
}

export function useInterfaceLanguage() {
  const language = useSyncExternalStore(subscribe, snapshot, () => 'en' as const)
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = 'ltr' }, [language])
  return language
}

/** Translate interface copy only. Exercise text, learner input and model evidence stay verbatim. */
export function translateInterface<T>(message: T, language: InterfaceLanguage, ...values: unknown[]): T {
  if (typeof message !== 'string') return message
  const key = message.trim()
  const translated = language === 'zh-CN'
    ? zhCN[key] ?? key.split(/(?<=[.!?])\s+(?=[A-Z])/u).map(part => zhCN[part] ?? part).join(' ')
    : key
  const formatted = translated.replace(/\{(\d+)\}/gu, (placeholder, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder)
  return `${message.match(/^\s*/u)?.[0] ?? ''}${formatted}${message.match(/\s*$/u)?.[0] ?? ''}` as T
}

export function t<T>(message: T, ...values: unknown[]): T {
  return translateInterface(message, currentLanguage, ...values)
}

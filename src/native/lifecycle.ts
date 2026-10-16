import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'

export const NATIVE_BACK_EVENT = 'lingo-native-back'

export function useNativeBack(action: () => boolean | void) {
  const latest = useRef(action)
  latest.current = action
  useEffect(() => {
    const handle = (event: Event) => {
      if (!event.defaultPrevented && latest.current() !== false) event.preventDefault()
    }
    window.addEventListener(NATIVE_BACK_EVENT, handle)
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handle)
  }, [])
}

export function useNativeLifecycle() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let disposed = false
    const back = NativeApp.addListener('backButton', () => {
      if (disposed) return
      const modal = document.querySelector('dialog[open]')
      if (modal) {
        modal.dispatchEvent(new Event('cancel', { cancelable: true }))
        return
      }
      const handled = !window.dispatchEvent(new Event(NATIVE_BACK_EVENT, { cancelable: true }))
      if (!handled) void NativeApp.minimizeApp()
    })
    return () => { disposed = true; void back.then(handle => handle.remove()) }
  }, [])
}

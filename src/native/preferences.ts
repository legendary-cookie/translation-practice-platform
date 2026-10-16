import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const WORKSPACE_PREFERENCE_KEY = 'lingo-workspace-preferences-v1'
let writes: Promise<void> = Promise.resolve()

export function persistNativeWorkspace(value: string | null): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve()
  // An empty native value marks an intentional reset. Removing the key would let
  // a stale WebView snapshot be mistaken for a first-install migration on restart.
  const operation = writes.catch(() => undefined).then(() => Preferences.set({ key: WORKSPACE_PREFERENCE_KEY, value: value ?? '{}' }))
  writes = operation
  return operation
}

/** Hydrate before React mounts so a stale WebView localStorage snapshot cannot win. */
export async function hydrateNativeWorkspace(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  const { value } = await Preferences.get({ key: WORKSPACE_PREFERENCE_KEY })
  if (value !== null) {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid saved workspace preferences.')
    localStorage.setItem(WORKSPACE_PREFERENCE_KEY, value)
  } else {
    const previous = localStorage.getItem(WORKSPACE_PREFERENCE_KEY)
    if (previous !== null) await persistNativeWorkspace(previous)
  }
}

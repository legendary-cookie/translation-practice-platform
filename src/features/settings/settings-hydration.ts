export type SettingsHydrationAttempt = {
  promise: Promise<boolean>
  complete: (loaded: boolean) => void
}

export function createSettingsHydrationAttempt(): SettingsHydrationAttempt {
  let complete: (loaded: boolean) => void = () => undefined
  const promise = new Promise<boolean>((resolve) => { complete = resolve })
  return { promise, complete }
}

export async function runAfterSettingsHydrated<T>(attempt: SettingsHydrationAttempt, action: () => Promise<T>): Promise<T> {
  const loaded = await attempt.promise
  if (!loaded) throw new Error('Saved settings could not be loaded. Retry loading settings before saving changes.')
  return action()
}

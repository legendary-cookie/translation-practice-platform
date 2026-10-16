import type { StoredSettings } from '../../domain/types'

export type LocalProgressGeneration = {
  providerEpoch: number
  dataGeneration: number
}

export function isLocalProgressGenerationCurrent(
  expected: LocalProgressGeneration,
  current: LocalProgressGeneration,
): boolean {
  return expected.providerEpoch === current.providerEpoch
    && expected.dataGeneration === current.dataGeneration
}

export function createLocalModelStatusSettingsUpdate(
  status: 'ready' | 'unavailable',
  expectedGeneration: LocalProgressGeneration,
  getCurrentGeneration: () => LocalProgressGeneration,
): (current: StoredSettings) => StoredSettings {
  return (current) => isLocalProgressGenerationCurrent(expectedGeneration, getCurrentGeneration())
    ? { ...current, localModelStatus: status }
    : current
}

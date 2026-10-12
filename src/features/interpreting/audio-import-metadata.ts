export const IMPORTED_AUDIO_METADATA_TIMEOUT_MS = 15_000

export type ImportedAudioMetadata = {
  objectUrl: string
  durationMs: number
}

export type ImportedAudioMetadataOptions = {
  timeoutMs?: number
  createAudio?: () => HTMLAudioElement
  createObjectURL?: (file: Blob) => string
  revokeObjectURL?: (url: string) => void
}

/**
 * Reads duration from a local object URL, always detaching the temporary media
 * element before releasing a failed URL. A successful URL is returned to the
 * caller, which then owns its lifetime as the imported source.
 */
export async function loadImportedAudioMetadata(
  file: Blob,
  options: ImportedAudioMetadataOptions = {},
): Promise<ImportedAudioMetadata> {
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
    ? options.timeoutMs as number
    : IMPORTED_AUDIO_METADATA_TIMEOUT_MS
  const createAudio = options.createAudio ?? (() => new Audio())
  const createObjectURL = options.createObjectURL ?? ((value: Blob) => URL.createObjectURL(value))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))

  let objectUrl: string | undefined
  let audio: HTMLAudioElement | undefined
  let durationMs: number | undefined
  let failed = false
  let failure: unknown

  try {
    objectUrl = createObjectURL(file)
    audio = createAudio()
    audio.preload = 'metadata'
    durationMs = await new Promise<number>((resolve, reject) => {
      let settled = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const finish = (complete: () => void) => {
        if (settled) return
        settled = true
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        audio?.removeEventListener('loadedmetadata', onLoadedMetadata)
        audio?.removeEventListener('error', onError)
        complete()
      }
      const onLoadedMetadata = () => {
        const metadataAudio = audio
        if (!metadataAudio || !Number.isFinite(metadataAudio.duration) || metadataAudio.duration <= 0) {
          finish(() => reject(new Error('The selected audio file has no readable duration.')))
          return
        }
        finish(() => resolve(Math.round(metadataAudio.duration * 1000)))
      }
      const onError = () => finish(() => reject(new Error('The selected audio file could not be decoded in this browser.')))

      audio?.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
      audio?.addEventListener('error', onError, { once: true })
      timeoutId = setTimeout(() => {
        finish(() => reject(new Error('Reading local audio metadata timed out. Choose the file again to retry.')))
      }, timeoutMs)
      if (!audio || !objectUrl) {
        finish(() => reject(new Error('The selected audio file could not be opened in this browser.')))
        return
      }
      audio.src = objectUrl
      audio.load()
    })
  } catch (error) {
    failed = true
    failure = error
  } finally {
    if (audio) {
      try { audio.pause() } catch { /* media cleanup is best-effort */ }
      try { audio.removeAttribute('src') } catch { /* media cleanup is best-effort */ }
      try { audio.load() } catch { /* media cleanup is best-effort */ }
    }
  }

  if (failed || !objectUrl || durationMs === undefined) {
    if (objectUrl) revokeObjectURL(objectUrl)
    if (failure instanceof Error) throw failure
    throw new Error('The selected audio file could not be imported. Choose the file again to retry.')
  }

  return { objectUrl, durationMs }
}

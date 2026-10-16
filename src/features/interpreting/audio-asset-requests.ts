import { requestWithDeadline } from './request-with-deadline'

export const PACKAGED_AUDIO_REQUEST_TIMEOUT_MS = 12_000

export async function fetchAudioBlobWithDeadline(
  url: string,
  options: {
    timeoutMs?: number
    fetcher?: typeof fetch
    parentSignal?: AbortSignal
  } = {},
): Promise<{ response: Response; blob: Blob }> {
  const fetcher = options.fetcher ?? fetch
  return requestWithDeadline(async (signal) => {
    const response = await fetcher(url, { cache: 'default', signal })
    if (!response.ok) throw new Error(`The audio asset request returned HTTP ${response.status}.`)
    const blob = await response.blob()
    if (blob.size === 0) throw new Error('The audio asset was empty and could not be saved.')
    return { response, blob }
  }, options.timeoutMs ?? PACKAGED_AUDIO_REQUEST_TIMEOUT_MS, 'The packaged audio request timed out. Retry the audio check or save.', options.parentSignal)
}

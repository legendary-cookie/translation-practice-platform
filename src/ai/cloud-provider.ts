import { validateFeedback, validateInterpretingFeedback } from '../domain/scoring'
import type { EvaluationFeedback, EvaluationRequest, InterpretingEvaluationInput } from '../domain/types'
import { buildEvaluationPrompt, evaluationSystemPrompt } from './evaluation-prompt'
import { parseJsonResponse, type CloudProviderLike } from './provider'

export type CloudProviderConfig = {
  baseUrl: string
  model: string
  apiKey: string
  supportsAudio?: boolean
}

type CloudResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

export const CLOUD_EVALUATION_TIMEOUT_MS = 60_000

function getCompletionEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('Cloud endpoint must be a valid http:// or https:// URL.')
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const isLocalHttp = parsed.protocol === 'http:' && (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  )

  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('Cloud endpoints must use HTTPS; HTTP is allowed only for localhost or loopback addresses.')
  }

  return `${normalized}/chat/completions`
}

function getContent(payload: unknown): string {
  const response = payload as CloudResponse
  const content = response.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('The cloud evaluator returned no message content.')
  }
  return content
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw createAbortError()
  }
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      signal.removeEventListener('abort', onAbort)
      callback()
    }
    const onAbort = () => {
      finish(() => reject(createAbortError()))
    }
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
    operation.then((value) => {
      finish(() => resolve(value))
    }, (error: unknown) => {
      finish(() => reject(error))
    })
  })
}

async function blobToBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  const bytes = new Uint8Array(await raceWithAbort(blob.arrayBuffer(), signal))
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    throwIfAborted(signal)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    if (index > 0 && index % (chunkSize * 16) === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  return btoa(binary)
}

async function blobToMonoWav(blob: Blob, signal: AbortSignal): Promise<Blob> {
  if (typeof AudioContext === 'undefined') {
    throw new Error('This browser cannot transcode the recording to WAV. Keep it local or use a compatible audio browser.')
  }
  const context = new AudioContext()
  let closePromise: Promise<void> | undefined
  const closeContext = () => {
    if (context.state === 'closed') {
      return Promise.resolve()
    }
    closePromise ??= context.close().catch(() => undefined)
    return closePromise
  }
  const closeOnAbort = () => { void closeContext() }
  signal.addEventListener('abort', closeOnAbort, { once: true })
  try {
    const encoded = await raceWithAbort(blob.arrayBuffer(), signal)
    const decoded = await raceWithAbort(context.decodeAudioData(encoded), signal)
    const sampleRate = 16000
    const sampleCount = Math.max(1, Math.ceil(decoded.duration * sampleRate))
    const wav = new ArrayBuffer(44 + sampleCount * 2)
    const view = new DataView(wav)
    const writeAscii = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index))
      }
    }
    writeAscii(0, 'RIFF')
    view.setUint32(4, wav.byteLength - 8, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeAscii(36, 'data')
    view.setUint32(40, sampleCount * 2, true)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel))
    for (let index = 0; index < sampleCount; index += 1) {
      if (index % 8192 === 0) {
        throwIfAborted(signal)
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      const sourceStart = Math.min(decoded.length - 1, Math.floor(index * decoded.sampleRate / sampleRate))
      const sourceEnd = Math.min(decoded.length, Math.max(sourceStart + 1, Math.floor((index + 1) * decoded.sampleRate / sampleRate)))
      let sampleTotal = 0
      let frameCount = 0
      for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
        sampleTotal += channels.reduce((sum, channel) => sum + channel[sourceIndex], 0) / channels.length
        frameCount += 1
      }
      const sample = sampleTotal / frameCount
      const clipped = Math.max(-1, Math.min(1, sample))
      view.setInt16(44 + index * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true)
    }
    return new Blob([wav], { type: 'audio/wav' })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    throw new Error('This recording could not be decoded for WAV conversion. The original stays on this device; try another browser or keep local-only mode.')
  } finally {
    signal.removeEventListener('abort', closeOnAbort)
    await Promise.race([
      closeContext(),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ])
  }
}

async function buildCloudRequestBody(
  input: EvaluationRequest,
  model: string,
  supportsAudio: boolean,
  signal: AbortSignal,
  preparedAudioPayloads?: ReadonlyMap<string, Blob>,
): Promise<Record<string, unknown>> {
  throwIfAborted(signal)
  if ('learnerAnswer' in input) {
    return {
      model,
      messages: [
        { role: 'system', content: evaluationSystemPrompt },
        { role: 'user', content: buildEvaluationPrompt(input) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }
  }

  const audioParts = await Promise.all(input.recordings.map(async (recording) => {
    const outgoingBlob = preparedAudioPayloads?.get(recording.id) ?? await blobToMonoWav(recording.blob, signal)
    return {
      type: 'input_audio',
      input_audio: {
        data: await blobToBase64(outgoingBlob, signal),
        format: 'wav',
      },
    }
  }))
  return {
    model,
    messages: [
      { role: 'system', content: evaluationSystemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildEvaluationPrompt(input, { attachedAudioAvailable: supportsAudio && input.recordings.length > 0 }) },
          ...audioParts,
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  }
}

export function createCloudProvider(config: CloudProviderConfig): CloudProviderLike {
  const endpoint = getCompletionEndpoint(config.baseUrl)
  const model = config.model.trim()
  const apiKey = config.apiKey
  const supportsAudio = config.supportsAudio === true

  if (!model) {
    throw new Error('A cloud model name is required.')
  }
  if (!apiKey.trim()) {
    throw new Error('A cloud API key is required for this session.')
  }

  return {
    getConsentDetails() {
      return { providerUrl: endpoint, model, supportsAudio }
    },

    async prepareAudioPayloads(input: InterpretingEvaluationInput): Promise<ReadonlyMap<string, Blob>> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CLOUD_EVALUATION_TIMEOUT_MS)
      try {
        const entries = await Promise.all(input.recordings.map(async (recording) => [
          recording.id,
          await blobToMonoWav(recording.blob, controller.signal),
        ] as const))
        return new Map(entries)
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw new Error(`Local audio preview conversion timed out after ${CLOUD_EVALUATION_TIMEOUT_MS / 1000} seconds. The recordings remain on this device.`)
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    },

    async evaluate(input: EvaluationRequest, preparedAudioPayloads?: ReadonlyMap<string, Blob>): Promise<EvaluationFeedback> {
      if (!('learnerAnswer' in input) && !supportsAudio) {
        throw new Error('The configured cloud endpoint has not been verified for audio input. Keep the recording local or configure an audio-capable endpoint explicitly.')
      }
      const controller = new AbortController()
      let timedOut = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new Error(`Cloud evaluation timed out after ${CLOUD_EVALUATION_TIMEOUT_MS / 1000} seconds. Check the endpoint and try again.`))
        }, CLOUD_EVALUATION_TIMEOUT_MS)
      })

      let completed = false
      try {
        const evaluation = (async () => {
          const body = await buildCloudRequestBody(input, model, supportsAudio, controller.signal, preparedAudioPayloads)
          throwIfAborted(controller.signal)
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })

          if (!response.ok) {
            throw new Error(`Cloud evaluation failed with HTTP ${response.status}.`)
          }

          const raw = parseJsonResponse(getContent(await response.json() as unknown))
          return 'learnerAnswer' in input
            ? validateFeedback(raw, { sourceText: input.exercise.sourceText, learnerAnswer: input.learnerAnswer })
            : validateInterpretingFeedback(raw, input)
        })()
        const feedback = await Promise.race([evaluation, timeout])
        completed = true
        return feedback
      } catch (error) {
        if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
          throw new Error(`Cloud evaluation timed out after ${CLOUD_EVALUATION_TIMEOUT_MS / 1000} seconds. Check the endpoint and try again.`)
        }
        throw error
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        if (!completed) {
          controller.abort()
        }
      }
    },
  }
}

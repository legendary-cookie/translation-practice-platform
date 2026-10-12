import type { DeliveryAnalysis } from '../domain/types'

export type LiveInputMonitor = {
  getLevel(): number
  dispose(): void
}

const AUDIO_ANALYSIS_TIMEOUT_MS = 15_000

export type AudioAnalysisOptions = {
  timeoutMs?: number
  createContext?: () => AudioContext
}

export function createFallbackAnalysis(durationMs: number): DeliveryAnalysis {
  return {
    durationMs,
    activeSpeechRatio: 0,
    pauseCount: 0,
    longestPauseMs: 0,
    analysisConfidence: 0.2,
    method: 'local-analysis-unavailable-v1',
  }
}

export function createLiveInputMonitor(stream: MediaStream): LiveInputMonitor | undefined {
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) {
    return undefined
  }
  const context = new AudioContextConstructor()
  let source: MediaStreamAudioSourceNode | undefined
  let analyser: AnalyserNode | undefined
  try {
    source = context.createMediaStreamSource(stream)
    analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
  } catch (error) {
    source?.disconnect()
    analyser?.disconnect()
    void context.close().catch(() => undefined)
    throw error
  }
  const activeSource = source
  const activeAnalyser = analyser
  const samples = new Uint8Array(activeAnalyser.fftSize)
  return {
    getLevel() {
      activeAnalyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const normalized = (sample - 128) / 128
        sum += normalized * normalized
      }
      return Math.min(1, Math.sqrt(sum / samples.length) * 3)
    },
    dispose() {
      activeSource.disconnect()
      activeAnalyser.disconnect()
      void context.close()
    },
  }
}

export async function analyzeRecording(blob: Blob, options: AudioAnalysisOptions = {}): Promise<DeliveryAnalysis> {
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor && !options.createContext) {
    throw new Error('Web Audio analysis is unavailable in this browser.')
  }
  const context = options.createContext?.() ?? new AudioContextConstructor!()
  let closeStarted = false
  const closeContext = () => {
    if (closeStarted) return
    closeStarted = true
    try {
      void Promise.resolve(context.close()).catch(() => undefined)
    } catch {
      // Decoder cleanup must not hold the analysis result open.
    }
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let analysisTimedOut = false
  const work = (async (): Promise<DeliveryAnalysis> => {
    const encodedAudio = await blob.arrayBuffer()
    if (analysisTimedOut) throw new Error('Local audio analysis timed out.')
    const buffer = await context.decodeAudioData(encodedAudio)
    if (analysisTimedOut) throw new Error('Local audio analysis timed out.')
    const channel = buffer.getChannelData(0)
    const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.02))
    const energies: number[] = []
    for (let offset = 0; offset < channel.length; offset += windowSize) {
      const end = Math.min(channel.length, offset + windowSize)
      let sum = 0
      for (let index = offset; index < end; index += 1) {
        sum += channel[index] * channel[index]
      }
      energies.push(Math.sqrt(sum / Math.max(1, end - offset)))
    }
    let peak = 0
    for (const sample of channel) {
      peak = Math.max(peak, Math.abs(sample))
    }
    const threshold = Math.max(0.015, peak * 0.08)
    const activeWindows = energies.filter((energy) => energy >= threshold).length
    let pauseCount = 0
    let longestPauseWindows = 0
    let currentPauseWindows = 0
    for (const energy of energies) {
      if (energy < threshold) {
        currentPauseWindows += 1
        longestPauseWindows = Math.max(longestPauseWindows, currentPauseWindows)
      } else if (currentPauseWindows > 0) {
        pauseCount += 1
        currentPauseWindows = 0
      }
    }
    if (currentPauseWindows > 0) {
      pauseCount += 1
    }
    const durationMs = Math.round(buffer.duration * 1000)
    return {
      durationMs,
      activeSpeechRatio: energies.length > 0 ? Math.round((activeWindows / energies.length) * 100) / 100 : 0,
      pauseCount,
      longestPauseMs: longestPauseWindows * 20,
      // Amplitude and envelope timing cannot distinguish speech from noise, clicks, or clipping.
      // Keep these metrics explicitly below the scoring threshold until speech evidence is qualified.
      analysisConfidence: 0.35,
      method: 'local-web-audio-energy-v2',
    }
  })()
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      analysisTimedOut = true
      closeContext()
      reject(new Error('Local audio analysis timed out. The recording was kept; retry or continue with limited-confidence self-review.'))
    }, options.timeoutMs ?? AUDIO_ANALYSIS_TIMEOUT_MS)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    closeContext()
  }
}

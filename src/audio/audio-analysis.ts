import type { DeliveryAnalysis } from '../domain/types'

export type LiveInputMonitor = {
  getLevel(): number
  dispose(): void
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

export async function analyzeRecording(blob: Blob): Promise<DeliveryAnalysis> {
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) {
    throw new Error('Web Audio analysis is unavailable in this browser.')
  }
  const context = new AudioContextConstructor()
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
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
      signalQuality: Math.round(Math.min(1, peak) * 100) / 100,
      analysisConfidence: channel.length > 0 && peak > 0.02 ? 0.75 : 0.35,
      method: 'local-web-audio-energy-v1',
    }
  } finally {
    await context.close()
  }
}

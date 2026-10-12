import type { AudioSegment, InterpretingExercise } from '../domain/types'

export type AudioPlayerListener = (state: {
  segmentId?: string
  currentTimeSeconds: number
  isPlaying: boolean
}) => void

export type AudioPlayer = {
  playSegment(segmentId: string): Promise<void>
  playAllSegments(): Promise<void>
  pause(): void
  seek(seconds: number): void
  setRepeat(enabled: boolean): void
  getCurrentTime(): number
  getCurrentSegmentId(): string | undefined
  subscribe(listener: AudioPlayerListener): () => void
  getElement(): HTMLAudioElement
  dispose(): void
}

function findSegment(exercise: InterpretingExercise, segmentId: string): AudioSegment {
  const segment = exercise.segments.find((candidate) => candidate.id === segmentId)
  if (!segment) {
    throw new Error('That audio segment is no longer available.')
  }
  return segment
}

export function createAudioPlayer(exercise: InterpretingExercise): AudioPlayer {
  const audio = new Audio(exercise.audioUrl)
  audio.preload = 'metadata'
  let currentSegment: AudioSegment | undefined
  let repeat = false
  const listeners = new Set<AudioPlayerListener>()

  const notify = () => {
    const state = {
      segmentId: currentSegment?.id,
      currentTimeSeconds: audio.currentTime,
      isPlaying: !audio.paused,
    }
    listeners.forEach((listener) => listener(state))
  }

  const handleTimeUpdate = () => {
    if (currentSegment && audio.currentTime * 1000 >= currentSegment.endMs) {
      if (repeat) {
        audio.currentTime = currentSegment.startMs / 1000
        void audio.play().catch(() => undefined)
      } else {
        audio.pause()
        audio.currentTime = currentSegment.endMs / 1000
      }
    }
    notify()
  }

  audio.addEventListener('timeupdate', handleTimeUpdate)
  audio.addEventListener('play', notify)
  audio.addEventListener('pause', notify)
  audio.addEventListener('ended', notify)

  return {
    async playSegment(segmentId) {
      const segment = findSegment(exercise, segmentId)
      currentSegment = segment
      audio.currentTime = segment.startMs / 1000
      await audio.play()
      notify()
    },

    async playAllSegments() {
      currentSegment = undefined
      audio.currentTime = 0
      await audio.play()
      notify()
    },

    pause() {
      audio.pause()
      notify()
    },

    seek(seconds) {
      const minimum = currentSegment ? currentSegment.startMs / 1000 : 0
      const maximum = currentSegment ? currentSegment.endMs / 1000 : exercise.durationMs / 1000
      audio.currentTime = Math.min(maximum, Math.max(minimum, seconds))
      notify()
    },

    setRepeat(enabled) {
      repeat = enabled
      notify()
    },

    getCurrentTime() {
      return audio.currentTime
    },

    getCurrentSegmentId() {
      return currentSegment?.id
    },

    subscribe(listener) {
      listeners.add(listener)
      listener({ segmentId: currentSegment?.id, currentTimeSeconds: audio.currentTime, isPlaying: !audio.paused })
      return () => listeners.delete(listener)
    },

    getElement() {
      return audio
    },

    dispose() {
      audio.pause()
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', notify)
      audio.removeEventListener('pause', notify)
      audio.removeEventListener('ended', notify)
      listeners.clear()
      audio.removeAttribute('src')
      audio.load()
    },
  }
}

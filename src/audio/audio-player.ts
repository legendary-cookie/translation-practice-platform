import type { AudioSegment, InterpretingExercise } from '../domain/types'

export type AudioPlayerListener = (state: {
  segmentId?: string
  currentTimeSeconds: number
  isPlaying: boolean
}) => void

export type AudioPlayer = {
  playSegment(segmentId: string): Promise<void>
  playAllSegments(): Promise<void>
  resume(): Promise<void>
  pause(): void
  seek(seconds: number): void
  setRepeat(enabled: boolean): void
  getCurrentTime(): number
  getCurrentSegmentId(): string | undefined
  hasPlayedSegmentToEnd(segmentId: string): boolean
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
  const audio = new Audio()
  audio.preload = 'auto'
  audio.setAttribute('aria-hidden', 'true')
  audio.tabIndex = -1
  audio.style.position = 'fixed'
  audio.style.width = '1px'
  audio.style.height = '1px'
  audio.style.opacity = '0'
  audio.style.pointerEvents = 'none'
  audio.style.overflow = 'hidden'
  document.body.appendChild(audio)
  audio.src = exercise.audioUrl
  audio.load()
  let currentSegment: AudioSegment | undefined
  let repeat = false
  let playbackAttempt = 0
  let playbackBaselineSeconds: number | undefined
  let isSeeking = false
  const listeners = new Set<AudioPlayerListener>()
  const playedRanges = new Map<string, Array<{ startSeconds: number; endSeconds: number }>>()

  const notify = () => {
    const state = {
      segmentId: currentSegment?.id,
      currentTimeSeconds: audio.currentTime,
      isPlaying: !audio.paused,
    }
    listeners.forEach((listener) => listener(state))
  }

  function recordPlayedRange(segment: AudioSegment, startSeconds: number, endSeconds: number) {
    const segmentStart = segment.startMs / 1000
    const segmentEnd = segment.endMs / 1000
    const nextRange = {
      startSeconds: Math.max(segmentStart, startSeconds),
      endSeconds: Math.min(segmentEnd, endSeconds),
    }
    if (nextRange.endSeconds <= nextRange.startSeconds) return

    const ranges = [...(playedRanges.get(segment.id) ?? []), nextRange]
      .sort((left, right) => left.startSeconds - right.startSeconds)
    const merged: Array<{ startSeconds: number; endSeconds: number }> = []
    for (const range of ranges) {
      const previous = merged.at(-1)
      if (!previous || range.startSeconds > previous.endSeconds + 0.025) {
        merged.push({ ...range })
      } else {
        previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds)
      }
    }
    playedRanges.set(segment.id, merged)
  }

  function recordPlaybackProgress(includePausedPosition = false) {
    if (isSeeking || (audio.paused && !includePausedPosition) || !currentSegment) {
      playbackBaselineSeconds = undefined
      return
    }
    const currentSeconds = Math.min(audio.currentTime, currentSegment.endMs / 1000)
    if (playbackBaselineSeconds !== undefined && currentSeconds > playbackBaselineSeconds) {
      recordPlayedRange(currentSegment, playbackBaselineSeconds, currentSeconds)
    }
    playbackBaselineSeconds = audio.currentTime
  }

  function playWithTimeout(): Promise<void> {
    const attempt = ++playbackAttempt
    let playback: Promise<void>
    try {
      playback = audio.play()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('The source clip could not be played.'))
    }
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const timeoutId = setTimeout(() => {
        settled = true
        if (attempt === playbackAttempt) {
          playbackAttempt += 1
          audio.pause()
          // Reset the media element to abort a pending play/load attempt before the UI offers retry.
          audio.load()
        }
        reject(new Error('The source clip did not start playing.'))
      }, 8000)
      playback.then(() => {
        if (settled) {
          // A play promise may resolve after pause/load interrupted the timed-out attempt.
          if (playbackAttempt === attempt + 1) {
            audio.pause()
          }
          return
        }
        clearTimeout(timeoutId)
        settled = true
        if (attempt !== playbackAttempt) {
          reject(new Error('The source clip playback was cancelled.'))
          return
        }
        resolve()
      }).catch((error: unknown) => {
        if (settled) return
        clearTimeout(timeoutId)
        settled = true
        reject(error instanceof Error ? error : new Error('The source clip could not be played.'))
      })
    })
  }

  const handleTimeUpdate = () => {
    recordPlaybackProgress()
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

  const handlePlay = () => {
    playbackBaselineSeconds = currentSegment ? audio.currentTime : undefined
    notify()
  }
  const handlePause = () => {
    recordPlaybackProgress(true)
    playbackBaselineSeconds = undefined
    notify()
  }
  const handleSeeking = () => {
    isSeeking = true
    playbackBaselineSeconds = undefined
  }
  const handleSeeked = () => {
    isSeeking = false
    playbackBaselineSeconds = currentSegment && !audio.paused ? audio.currentTime : undefined
  }

  audio.addEventListener('timeupdate', handleTimeUpdate)
  audio.addEventListener('play', handlePlay)
  audio.addEventListener('pause', handlePause)
  audio.addEventListener('seeking', handleSeeking)
  audio.addEventListener('seeked', handleSeeked)
  audio.addEventListener('ended', notify)

  return {
    async playSegment(segmentId) {
      const segment = findSegment(exercise, segmentId)
      currentSegment = segment
      audio.currentTime = segment.startMs / 1000
      await playWithTimeout()
      notify()
    },

    async playAllSegments() {
      currentSegment = undefined
      audio.currentTime = 0
      await playWithTimeout()
      notify()
    },

    async resume() {
      await playWithTimeout()
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

    hasPlayedSegmentToEnd(segmentId) {
      const segment = exercise.segments.find((candidate) => candidate.id === segmentId)
      if (!segment) return false
      const startSeconds = segment.startMs / 1000
      const endSeconds = segment.endMs / 1000
      const toleranceSeconds = 0.05
      return (playedRanges.get(segmentId) ?? []).some((range) =>
        range.startSeconds <= startSeconds + toleranceSeconds
        && range.endSeconds >= endSeconds - toleranceSeconds
        && range.endSeconds - range.startSeconds >= endSeconds - startSeconds - toleranceSeconds * 2)
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
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('seeking', handleSeeking)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('ended', notify)
      listeners.clear()
      audio.removeAttribute('src')
      audio.load()
      audio.remove()
    },
  }
}

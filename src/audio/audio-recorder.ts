import type { AudioRecordingRecord, InterpretingMode } from '../domain/types'
import { createLiveInputMonitor, type LiveInputMonitor } from './audio-analysis'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping' | 'error'

export type RecorderListener = (state: {
  status: RecorderState
  elapsedMs: number
  inputLevel: number
  error?: string
}) => void

export type ResponseRecorder = {
  requestPermission(): Promise<void>
  start(segmentId: string | undefined, mode: InterpretingMode): Promise<void>
  pause(): void
  resume(): void
  stop(): Promise<AudioRecordingRecord | undefined>
  getReplayUrl(recording: AudioRecordingRecord): string
  revokeReplayUrl(url: string): void
  subscribe(listener: RecorderListener): () => void
  dispose(): void
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']

function chooseMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined
  }
  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

function readableMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Microphone permission was not granted. Allow access for this local recording, then try again.'
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone was found. Connect a microphone and try again.'
    }
    if (error.name === 'NotReadableError') {
      return 'The microphone is busy or unavailable to this page. Close other recording apps and try again.'
    }
  }
  return error instanceof Error ? error.message : 'The microphone could not be opened.'
}

export function createResponseRecorder(exerciseId: string): ResponseRecorder {
  let stream: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  let chunks: Blob[] = []
  let startedAt = 0
  let segmentIds: string[] = []
  let listeners = new Set<RecorderListener>()
  let state: RecorderState = 'idle'
  let error: string | undefined
  let levelTimer: ReturnType<typeof setInterval> | undefined
  let liveMonitor: LiveInputMonitor | undefined
  const replayUrls = new Set<string>()

  const notify = () => {
    const elapsedMs = startedAt === 0 ? 0 : Math.max(0, Date.now() - startedAt)
    listeners.forEach((listener) => listener({ status: state, elapsedMs, inputLevel: state === 'recording' ? (liveMonitor?.getLevel() ?? 0) : 0, error }))
  }

  const releaseStream = () => {
    liveMonitor?.dispose()
    liveMonitor = undefined
    stream?.getTracks().forEach((track) => track.stop())
    stream = undefined
  }

  const clearLevelTimer = () => {
    if (levelTimer !== undefined) {
      clearInterval(levelTimer)
      levelTimer = undefined
    }
  }

  const openStream = async () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      throw new Error('Microphone recording requires HTTPS or localhost. The audio stays on this device.')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose microphone recording. You can still review the source transcript manually.')
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  }

  return {
    async requestPermission() {
      if (stream) {
        return
      }
      state = 'requesting'
      error = undefined
      notify()
      try {
        await openStream()
        state = 'idle'
        notify()
      } catch (caught) {
        state = 'error'
        error = readableMicrophoneError(caught)
        notify()
        throw new Error(error)
      }
    },

    async start(segmentId, mode) {
      if (typeof MediaRecorder === 'undefined') {
        state = 'error'
        error = 'This browser does not support MediaRecorder.'
        notify()
        throw new Error(error)
      }
      if (!stream) {
        await this.requestPermission()
      }
      if (!stream) {
        throw new Error('Microphone permission is required before recording.')
      }
      if (recorder && recorder.state !== 'inactive') {
        throw new Error('A recording is already in progress.')
      }
      chunks = []
      segmentIds = segmentId ? [segmentId] : []
      error = undefined
      const mimeType = chooseMimeType()
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      } catch (caught) {
        state = 'error'
        error = readableMicrophoneError(caught)
        notify()
        throw new Error(error)
      }
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      })
      recorder.addEventListener('error', (event) => {
        state = 'error'
        error = event.error?.message ?? 'The recording failed.'
        notify()
      })
      startedAt = Date.now()
      liveMonitor = createLiveInputMonitor(stream)
      state = 'recording'
      recorder.start()
      levelTimer = setInterval(notify, 250)
      notify()
      if (mode === 'simultaneous') {
        // The continuous take intentionally keeps segmentIds empty until the workspace adds its authored boundaries.
        segmentIds = []
      }
    },

    pause() {
      if (recorder?.state === 'recording') {
        recorder.pause()
        state = 'paused'
        notify()
      }
    },

    resume() {
      if (recorder?.state === 'paused') {
        recorder.resume()
        state = 'recording'
        notify()
      }
    },

    stop() {
      if (!recorder || recorder.state === 'inactive') {
        releaseStream()
        clearLevelTimer()
        state = 'idle'
        notify()
        return Promise.resolve(undefined)
      }
      state = 'stopping'
      notify()
      return new Promise((resolve, reject) => {
        const activeRecorder = recorder as MediaRecorder
        activeRecorder.addEventListener('stop', () => {
          const durationMs = Math.max(0, Date.now() - startedAt)
          const mimeType = activeRecorder.mimeType || chunks[0]?.type || 'audio/webm'
          const blob = new Blob(chunks, { type: mimeType })
          const result: AudioRecordingRecord = {
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `recording-${Date.now()}`,
            exerciseId,
            segmentIds: [...segmentIds],
            createdAt: new Date().toISOString(),
            mimeType,
            durationMs,
            byteLength: blob.size,
            blob,
          }
          recorder = undefined
          chunks = []
          releaseStream()
          clearLevelTimer()
          state = 'idle'
          notify()
          resolve(result)
        }, { once: true })
        activeRecorder.addEventListener('error', () => {
          clearLevelTimer()
          releaseStream()
          state = 'error'
          error = 'The recording could not be finalized.'
          notify()
          reject(new Error(error))
        }, { once: true })
        activeRecorder.stop()
      })
    },

    getReplayUrl(recording) {
      const url = URL.createObjectURL(recording.blob)
      replayUrls.add(url)
      return url
    },

    revokeReplayUrl(url) {
      if (replayUrls.delete(url)) {
        URL.revokeObjectURL(url)
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      listener({ status: state, elapsedMs: 0, inputLevel: 0, error })
      return () => listeners.delete(listener)
    },

    dispose() {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
      recorder = undefined
      releaseStream()
      clearLevelTimer()
      replayUrls.forEach((url) => URL.revokeObjectURL(url))
      replayUrls.clear()
      listeners.clear()
      chunks = []
      state = 'idle'
    },
  }
}

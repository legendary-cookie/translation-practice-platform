import type { AudioRecordingRecord, InterpretingMode } from '../domain/types'
import { createLiveInputMonitor, type LiveInputMonitor } from './audio-analysis'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping' | 'error'

export type RecorderCompletion = {
  recording: AudioRecordingRecord
  reason: 'explicit' | 'stream-ended'
}

export type RecorderListener = (state: {
  status: RecorderState
  elapsedMs: number
  inputLevel: number
  error?: string
}, completion?: RecorderCompletion) => void

export type ResponseRecorder = {
  requestPermission(): Promise<void>
  start(segmentId: string | undefined, mode: InterpretingMode): Promise<void>
  pause(): void
  resume(): void
  stop(): Promise<AudioRecordingRecord | undefined>
  getElapsedMs(): number
  getActiveTrack(): MediaStreamTrack | undefined
  getReplayUrl(recording: AudioRecordingRecord): string
  revokeReplayUrl(url: string): void
  subscribe(listener: RecorderListener): () => void
  dispose(): void
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
const MICROPHONE_PERMISSION_TIMEOUT_MS = 15_000
const FINALIZATION_TIMEOUT_MS = 5_000

export type ResponseRecorderOptions = {
  permissionTimeoutMs?: number
  finalizationTimeoutMs?: number
}

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

export function createResponseRecorder(exerciseId: string, options: ResponseRecorderOptions = {}): ResponseRecorder {
  type ActiveRecording = {
    activeRecorder: MediaRecorder
    promise: Promise<AudioRecordingRecord | undefined>
    resolve: (recording: AudioRecordingRecord | undefined) => void
    reject: (error: Error) => void
    finalized: boolean
    suppressCompletion: boolean
    finalizationTimer?: ReturnType<typeof setTimeout>
  }

  let stream: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  let activeRecording: ActiveRecording | undefined
  let chunks: Blob[] = []
  let activeStartedAt = 0
  let accumulatedDurationMs = 0
  let segmentIds: string[] = []
  let listeners = new Set<RecorderListener>()
  let state: RecorderState = 'idle'
  let error: string | undefined
  let levelTimer: ReturnType<typeof setInterval> | undefined
  let liveMonitor: LiveInputMonitor | undefined
  let permissionRequest: Promise<void> | undefined
  let permissionGeneration = 0
  let rejectPendingPermission: ((error: Error) => void) | undefined
  let startInProgress = false
  let disposed = false
  const replayUrls = new Set<string>()

  const notify = (completion?: RecorderCompletion) => {
    const elapsedMs = accumulatedDurationMs + (state === 'recording' && activeStartedAt > 0 ? Math.max(0, Date.now() - activeStartedAt) : 0)
    listeners.forEach((listener) => listener({ status: state, elapsedMs, inputLevel: state === 'recording' ? (liveMonitor?.getLevel() ?? 0) : 0, error }, completion))
  }

  const releaseStream = () => {
    try {
      liveMonitor?.dispose()
    } catch {
      // Microphone tracks still need to stop if the Web Audio monitor fails to disconnect.
    }
    liveMonitor = undefined
    stream?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // Release every remaining track even if one browser track has already ended.
      }
    })
    stream = undefined
  }

  const clearLevelTimer = () => {
    if (levelTimer !== undefined) {
      clearInterval(levelTimer)
      levelTimer = undefined
    }
  }

  const clearFinalizationTimer = (operation: ActiveRecording) => {
    if (operation.finalizationTimer !== undefined) {
      clearTimeout(operation.finalizationTimer)
      operation.finalizationTimer = undefined
    }
  }

  const failFinalization = (operation: ActiveRecording, message: string) => {
    if (operation.finalized) return
    operation.finalized = true
    clearFinalizationTimer(operation)
    activeStartedAt = 0
    accumulatedDurationMs = 0
    chunks = []
    if (recorder === operation.activeRecorder) recorder = undefined
    if (activeRecording === operation) activeRecording = undefined
    clearLevelTimer()
    releaseStream()
    state = 'error'
    error = message
    notify()
    operation.reject(new Error(message))
  }

  const armFinalizationDeadline = (operation: ActiveRecording) => {
    if (operation.finalized || operation.finalizationTimer !== undefined) return
    const timeoutMs = Math.max(0, options.finalizationTimeoutMs ?? FINALIZATION_TIMEOUT_MS)
    operation.finalizationTimer = setTimeout(() => {
      failFinalization(
        operation,
        `Recording stop did not finish within ${Math.ceil(timeoutMs / 1000)} seconds. The microphone was released; try recording again.`,
      )
    }, timeoutMs)
  }

  const openStream = async (generation: number): Promise<MediaStream> => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      throw new Error('Microphone recording requires HTTPS or localhost. The audio stays on this device.')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose microphone recording. You can still review the source transcript manually.')
    }
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let rejectCancellation: ((error: Error) => void) | undefined
    const cancelled = new Promise<never>((_, reject) => { rejectCancellation = reject })
    rejectPendingPermission = rejectCancellation
    const requestedStream = Promise.resolve()
      .then(() => {
        if (disposed || generation !== permissionGeneration) {
          throw new Error('This microphone request is no longer active.')
        }
        return navigator.mediaDevices.getUserMedia({ audio: true })
      })
      .then((openedStream) => {
        if (disposed || generation !== permissionGeneration) {
          openedStream.getTracks().forEach((track) => track.stop())
          throw new Error('This microphone request is no longer active. Any late stream was released.')
        }
        return openedStream
      })
    const timeoutMs = options.permissionTimeoutMs ?? MICROPHONE_PERMISSION_TIMEOUT_MS
    const timedOut = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (generation === permissionGeneration) permissionGeneration += 1
        reject(new Error(`Microphone permission did not respond within ${Math.ceil(timeoutMs / 1000)} seconds. Check browser permission and retry.`))
      }, timeoutMs)
    })
    try {
      return await Promise.race([requestedStream, cancelled, timedOut])
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      if (rejectPendingPermission === rejectCancellation) rejectPendingPermission = undefined
    }
  }

  return {
    async requestPermission() {
      if (stream) {
        return
      }
      state = 'requesting'
      error = undefined
      notify()
      if (permissionRequest) return permissionRequest
      const generation = ++permissionGeneration
      permissionRequest = (async () => {
        try {
          stream = await openStream(generation)
          state = 'idle'
          notify()
        } catch (caught) {
          const message = readableMicrophoneError(caught)
          if (!disposed) {
            state = 'error'
            error = message
            notify()
          }
          throw new Error(message)
        } finally {
          permissionRequest = undefined
        }
      })()
      return permissionRequest
    },

    async start(segmentId, mode) {
      if (startInProgress || state === 'requesting') {
        throw new Error('Microphone startup is already in progress.')
      }
      if (disposed) {
        throw new Error('This recording workspace has closed.')
      }
      startInProgress = true
      try {
        if (typeof MediaRecorder === 'undefined') {
          state = 'error'
          error = 'This browser does not support MediaRecorder.'
          notify()
          throw new Error(error)
        }
        if (!stream) {
          await this.requestPermission()
        }
        if (disposed) {
          throw new Error('This recording workspace has closed.')
        }
        if (!stream) {
          throw new Error('Microphone permission is required before recording.')
        }
        if (recorder && recorder.state !== 'inactive') {
          throw new Error('A recording is already in progress.')
        }
        if (activeRecording && !activeRecording.finalized) {
          throw new Error('The previous recording is still being finalized.')
        }
        chunks = []
        segmentIds = segmentId ? [segmentId] : []
        error = undefined
        try {
          const mimeType = chooseMimeType()
          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
          const activeRecorder = recorder
          let resolveFinalization: (recording: AudioRecordingRecord | undefined) => void = () => undefined
          let rejectFinalization: (error: Error) => void = () => undefined
          const completionPromise = new Promise<AudioRecordingRecord | undefined>((resolve, reject) => {
            resolveFinalization = resolve
            rejectFinalization = reject
          })
          void completionPromise.catch(() => undefined)
          const operation: ActiveRecording = {
            activeRecorder,
            promise: completionPromise,
            resolve: resolveFinalization,
            reject: rejectFinalization,
            finalized: false,
            suppressCompletion: false,
          }
          activeRecording = operation
          stream?.getAudioTracks().forEach((track) => {
            track.addEventListener?.('ended', () => armFinalizationDeadline(operation), { once: true })
          })
          activeRecorder.addEventListener('dataavailable', (event) => {
            if (!operation.finalized && event.data.size > 0) {
              chunks.push(event.data)
            }
          })
          activeRecorder.addEventListener('stop', () => {
            if (operation.finalized) return
            operation.finalized = true
            clearFinalizationTimer(operation)
            if (activeStartedAt > 0) {
              accumulatedDurationMs += Math.max(0, Date.now() - activeStartedAt)
            }
            activeStartedAt = 0
            const durationMs = accumulatedDurationMs
            const mimeType = activeRecorder.mimeType || chunks[0]?.type || 'audio/webm'
            const blob = new Blob(chunks, { type: mimeType })
            const recordingResult: AudioRecordingRecord | undefined = disposed || operation.suppressCompletion ? undefined : {
              id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `recording-${Date.now()}`,
              exerciseId,
              segmentIds: [...segmentIds],
              createdAt: new Date().toISOString(),
              mimeType,
              durationMs,
              byteLength: blob.size,
              blob,
            }
            const reason = state === 'stopping' ? 'explicit' : 'stream-ended'
            if (recorder === activeRecorder) recorder = undefined
            if (activeRecording === operation) activeRecording = undefined
            chunks = []
            activeStartedAt = 0
            accumulatedDurationMs = 0
            releaseStream()
            clearLevelTimer()
            state = 'idle'
            error = undefined
            if (recordingResult) {
              notify({ recording: recordingResult, reason })
            } else {
              notify()
            }
            operation.resolve(recordingResult)
          }, { once: true })
          activeRecorder.addEventListener('error', (event) => {
            if (operation.finalized) return
            operation.finalized = true
            clearFinalizationTimer(operation)
            activeStartedAt = 0
            accumulatedDurationMs = 0
            clearLevelTimer()
            releaseStream()
            state = 'error'
            error = event.error?.message ?? 'The recording failed.'
            if (recorder === activeRecorder) recorder = undefined
            if (activeRecording === operation) activeRecording = undefined
            notify()
            operation.reject(new Error(error))
          })
          accumulatedDurationMs = 0
          activeStartedAt = Date.now()
          liveMonitor = createLiveInputMonitor(stream)
          state = 'recording'
          activeRecorder.start()
          levelTimer = setInterval(notify, 250)
          notify()
          if (mode === 'simultaneous') {
            // The continuous take intentionally keeps segmentIds empty until the workspace adds its authored boundaries.
            segmentIds = []
          }
        } catch (caught) {
          if (activeRecording) {
            clearFinalizationTimer(activeRecording)
            activeRecording.finalized = true
            activeRecording.resolve(undefined)
            activeRecording = undefined
          }
          activeStartedAt = 0
          accumulatedDurationMs = 0
          clearLevelTimer()
          if (recorder && recorder.state !== 'inactive') {
            try {
              recorder.stop()
            } catch {
              // The stream is released below even when MediaRecorder cannot stop cleanly.
            }
          }
          recorder = undefined
          chunks = []
          releaseStream()
          state = 'error'
          error = readableMicrophoneError(caught)
          notify()
          throw new Error(error)
        }
      } finally {
        startInProgress = false
      }
    },

    pause() {
      if (recorder?.state === 'recording') {
        recorder.pause()
        accumulatedDurationMs += Math.max(0, Date.now() - activeStartedAt)
        activeStartedAt = 0
        state = 'paused'
        notify()
      }
    },

    resume() {
      if (recorder?.state === 'paused') {
        recorder.resume()
        activeStartedAt = Date.now()
        state = 'recording'
        notify()
      }
    },

    stop() {
      if (state === 'stopping' && activeRecording) return activeRecording.promise
      if (!recorder || recorder.state === 'inactive') {
        if (activeRecording) return activeRecording.promise
        releaseStream()
        clearLevelTimer()
        state = 'idle'
        notify()
        return Promise.resolve(undefined)
      }
      const operation = activeRecording
      if (!operation || operation.activeRecorder !== recorder) {
        return Promise.resolve(undefined)
      }
      if (recorder.state === 'recording' && activeStartedAt > 0) {
        accumulatedDurationMs += Math.max(0, Date.now() - activeStartedAt)
        activeStartedAt = 0
      }
      state = 'stopping'
      notify()
      armFinalizationDeadline(operation)
      try {
        operation.activeRecorder.stop()
      } catch (caught) {
        failFinalization(operation, readableMicrophoneError(caught))
      }
      return operation.promise
    },

    getElapsedMs() {
      return accumulatedDurationMs + (state === 'recording' && activeStartedAt > 0 ? Math.max(0, Date.now() - activeStartedAt) : 0)
    },

    getActiveTrack() {
      return stream?.getAudioTracks()[0]
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
      disposed = true
      permissionGeneration += 1
      rejectPendingPermission?.(new Error('This recording workspace has closed.'))
      rejectPendingPermission = undefined
      if (activeRecording) activeRecording.suppressCompletion = true
      if (recorder && recorder.state !== 'inactive') {
        if (activeRecording) armFinalizationDeadline(activeRecording)
        try {
          recorder.stop()
        } catch {
          // Stream tracks are stopped below even if finalizing the browser recorder fails.
        }
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

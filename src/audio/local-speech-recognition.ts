import type { RecognitionStatus } from '../domain/types'

type SpeechRecognitionAlternativeLike = {
  transcript: string
  confidence: number
}

type SpeechRecognitionResultLike = {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  processLocally?: boolean
  start(track?: MediaStreamTrack): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionStaticLike = SpeechRecognitionConstructor & {
  available?: (options: { langs: string[]; quality: 'dictation'; processLocally: true }) => Promise<boolean | 'available' | 'downloading' | 'downloadable' | 'unavailable'> | boolean | 'available' | 'downloading' | 'downloadable' | 'unavailable'
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean> | boolean
}

type RecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionStaticLike
  webkitSpeechRecognition?: SpeechRecognitionStaticLike
}

export type LocalRecognitionCapability = {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable'
  languageTag: string
  reason: string
}

export type LocalRecognitionResult = {
  transcript: string
  recognitionStatus: RecognitionStatus
  confidence?: number
  alternatives: string[]
  segmentId: string
}

function getConstructor(): SpeechRecognitionStaticLike | undefined {
  const recognitionWindow = window as RecognitionWindow
  return recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition
}

export async function getLocalRecognitionCapability(languageTag: string): Promise<LocalRecognitionCapability> {
  const constructor = getConstructor()
  if (!constructor) {
    return { status: 'unavailable', languageTag, reason: 'This browser does not expose speech recognition. Enter a transcript manually; no remote recognition will be used.' }
  }
  if (!constructor.available) {
    return { status: 'unavailable', languageTag, reason: 'This browser cannot verify an on-device language pack. Enter a transcript manually; the default speech service is not used.' }
  }
  try {
    const availability = await constructor.available({ langs: [languageTag], quality: 'dictation', processLocally: true })
    if (availability === true || availability === 'available') {
      return { status: 'available', languageTag, reason: 'On-device recognition is available for this language in this browser.' }
    }
    if (availability === 'downloading') {
      return { status: 'downloading', languageTag, reason: 'The on-device language pack is still downloading. Continue with the manual transcript path for now.' }
    }
    if (availability === 'downloadable') {
      return { status: 'downloadable', languageTag, reason: 'An on-device language pack may be available. Download it only after an explicit action; learner audio stays local.' }
    }
    if (availability === false) {
      return { status: 'unavailable', languageTag, reason: 'The browser did not confirm an installable on-device language pack. Enter a transcript manually; no remote recognition will be used.' }
    }
    return { status: 'unavailable', languageTag, reason: 'This language pack is unavailable for on-device recognition. Enter a transcript manually; no remote recognition will be used.' }
  } catch {
    return { status: 'unavailable', languageTag, reason: 'The browser could not verify an on-device language pack. Enter a transcript manually.' }
  }
}

export async function installLocalRecognitionLanguage(languageTag: string): Promise<LocalRecognitionCapability> {
  const constructor = getConstructor()
  if (!constructor?.install) {
    return getLocalRecognitionCapability(languageTag)
  }
  try {
    const installed = await constructor.install({ langs: [languageTag], processLocally: true })
    if (!installed) {
      return { status: 'unavailable', languageTag, reason: 'The browser did not install the requested local language pack.' }
    }
    return { status: 'available', languageTag, reason: 'On-device recognition language pack installed.' }
  } catch {
    return { status: 'unavailable', languageTag, reason: 'The local language pack could not be installed. Use the manual transcript path.' }
  }
}

export async function recognizeLocal(track: MediaStreamTrack, languageTag: string, segmentId: string): Promise<LocalRecognitionResult> {
  const constructor = getConstructor()
  if (!constructor) {
    throw new Error('On-device speech recognition is unavailable; enter a transcript manually.')
  }
  const capability = await getLocalRecognitionCapability(languageTag)
  if (capability.status !== 'available') {
    throw new Error(capability.reason)
  }
  const recognition = new constructor()
  recognition.lang = languageTag
  recognition.continuous = false
  recognition.interimResults = true
  recognition.processLocally = true

  return new Promise((resolve, reject) => {
    let finalTranscript = ''
    let bestConfidence: number | undefined
    const alternatives: string[] = []
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
          const alternative = result[alternativeIndex]
          if (alternative.transcript.trim() && !alternatives.includes(alternative.transcript.trim())) {
            alternatives.push(alternative.transcript.trim())
          }
          if (result.isFinal && alternativeIndex === 0) {
            finalTranscript += alternative.transcript
            bestConfidence = bestConfidence === undefined ? alternative.confidence : Math.min(bestConfidence, alternative.confidence)
          }
        }
      }
    }
    recognition.onerror = (event) => reject(new Error(event.error ? `On-device recognition failed: ${event.error}.` : 'On-device recognition failed.'))
    recognition.onend = () => resolve({
      transcript: finalTranscript.trim() || alternatives[0] || '',
      recognitionStatus: bestConfidence !== undefined && bestConfidence >= 0.65 ? 'verified' : 'uncertain',
      confidence: bestConfidence,
      alternatives,
      segmentId,
    })
    try {
      // The track overload is not present in every implementation. Never call the no-argument form,
      // because that can silently choose the browser's default remote recognition service.
      recognition.start(track)
    } catch (error) {
      reject(error instanceof Error ? error : new Error('The browser could not start local recognition for this track.'))
    }
  })
}

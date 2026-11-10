import type { AudioSegment, Difficulty, InterpretingExercise } from '../domain/types'
import type { LanguageCode } from '../domain/languages'

type SourceClip = {
  sourceLanguage: LanguageCode
  id: string
  title: string
  topic: string
  difficulty: Difficulty
  audioUrl: string
  durationMs: number
  rightsRecordId: string
  sourceAudioDisclosure?: string
  segments: AudioSegment[]
}

const sourceClips: SourceClip[] = [
  {
    sourceLanguage: 'zh',
    id: 'zh-community-garden',
    title: 'A garden after the parking lot',
    topic: 'Community and environment',
    difficulty: 'intermediate',
    audioUrl: '/audio/interpreting/zh-community-garden.wav',
    durationMs: 8795,
    rightsRecordId: 'audio.zh.community-garden.v1',
    segments: [
      { id: 'zh-community-garden-1', startMs: 0, endMs: 4200, transcript: '居民把闲置的停车场改成了社区花园。' },
      { id: 'zh-community-garden-2', startMs: 4200, endMs: 8795, transcript: '志愿者在周末向邻居开放。' },
    ],
  },
  {
    sourceLanguage: 'en',
    id: 'en-library',
    title: 'A library after dark',
    topic: 'Public services and learning',
    difficulty: 'intermediate',
    audioUrl: '/audio/interpreting/en-library.wav',
    durationMs: 8983,
    rightsRecordId: 'audio.en.library.v1',
    segments: [
      { id: 'en-library-1', startMs: 0, endMs: 4400, transcript: 'A neighborhood library stays open late for people with irregular work hours.' },
      { id: 'en-library-2', startMs: 4400, endMs: 8983, transcript: 'Volunteers offer quiet study tables.' },
    ],
  },
  {
    sourceLanguage: 'ru',
    id: 'ru-repair',
    title: 'A repair workshop',
    topic: 'Skills and local resilience',
    difficulty: 'intermediate',
    audioUrl: '/audio/interpreting/ru-repair.wav',
    durationMs: 10828,
    rightsRecordId: 'audio.ru.repair.v1',
    segments: [
      { id: 'ru-repair-1', startMs: 0, endMs: 5300, transcript: 'Жители приносят старые вещи в мастерскую ремонта.' },
      { id: 'ru-repair-2', startMs: 5300, endMs: 10828, transcript: 'Опытные мастера показывают, как найти неисправность.' },
    ],
  },
]

function validateSourceClip(clip: SourceClip): void {
  if (!clip.rightsRecordId.trim()
    || !clip.audioUrl.startsWith('/audio/interpreting/')
    || clip.audioUrl.includes('..')) {
    throw new Error(`Interpreting clip ${clip.id} is missing a same-origin rights record.`)
  }
  let previousEnd = 0
  for (const segment of clip.segments) {
    if (segment.startMs < previousEnd || segment.endMs <= segment.startMs || segment.endMs > clip.durationMs || !segment.transcript.trim()) {
      throw new Error(`Interpreting clip ${clip.id} has invalid segment boundaries.`)
    }
    previousEnd = segment.endMs
  }
  if (previousEnd !== clip.durationMs) {
    throw new Error(`Interpreting clip ${clip.id} does not cover its declared duration.`)
  }
}

sourceClips.forEach(validateSourceClip)

function toExercise(clip: SourceClip, targetLanguage: LanguageCode): InterpretingExercise {
  return {
    id: `${clip.id}-to-${targetLanguage}-interpreting`,
    mode: 'interpreting',
    sourceLanguage: clip.sourceLanguage,
    targetLanguage,
    title: clip.title,
    topic: clip.topic,
    difficulty: clip.difficulty,
    audioUrl: clip.audioUrl,
    audioMimeType: 'audio/wav',
    durationMs: clip.durationMs,
    segments: clip.segments,
    glossary: [],
    tags: ['general'],
    rightsRecordId: clip.rightsRecordId,
    sourceAudioDisclosure: clip.sourceAudioDisclosure,
  }
}

const chineseCenteredDirections: Array<[LanguageCode, LanguageCode]> = [
  ['zh', 'en'],
  ['zh', 'ru'],
  ['en', 'zh'],
  ['ru', 'zh'],
]

export const INTERPRETING_EXERCISES: InterpretingExercise[] = chineseCenteredDirections.flatMap(([sourceLanguage, targetLanguage]) => {
  const clip = sourceClips.find((candidate) => candidate.sourceLanguage === sourceLanguage)
  return clip ? [toExercise(clip, targetLanguage)] : []
})

export function getInterpretingExercisesForDirection(sourceLanguage: LanguageCode, targetLanguage: LanguageCode): InterpretingExercise[] {
  return INTERPRETING_EXERCISES.filter((exercise) => exercise.sourceLanguage === sourceLanguage
    && exercise.targetLanguage === targetLanguage
    && Boolean(exercise.rightsRecordId.trim())
    && exercise.audioUrl.startsWith('/audio/interpreting/'))
}

export function getInterpretingExerciseById(exerciseId: string): InterpretingExercise | undefined {
  return INTERPRETING_EXERCISES.find((exercise) => exercise.id === exerciseId)
}

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
  {
    sourceLanguage: 'fr',
    id: 'fr-rooftop',
    title: 'Rainwater on the rooftops',
    topic: 'Climate and city planning',
    difficulty: 'advanced',
    audioUrl: '/audio/interpreting/fr-rooftop.wav',
    durationMs: 8442,
    rightsRecordId: 'audio.fr.rooftop.v1',
    segments: [
      { id: 'fr-rooftop-1', startMs: 0, endMs: 4200, transcript: 'Les habitants récupèrent l’eau de pluie sur les toits.' },
      { id: 'fr-rooftop-2', startMs: 4200, endMs: 8442, transcript: 'Cette eau suffit pour arroser les plantations.' },
    ],
  },
  {
    sourceLanguage: 'hi',
    id: 'hi-seeds',
    title: 'A small seed library',
    topic: 'Food and local knowledge',
    difficulty: 'advanced',
    audioUrl: '/audio/interpreting/hi-seeds.wav',
    durationMs: 10871,
    rightsRecordId: 'audio.hi.seeds.v1',
    segments: [
      { id: 'hi-seeds-1', startMs: 0, endMs: 5200, transcript: 'किसानों ने स्थानीय बीजों की एक छोटी लाइब्रेरी शुरू की है।' },
      { id: 'hi-seeds-2', startMs: 5200, endMs: 10871, transcript: 'लोग अगले मौसम में बीजों को उधार ले जाते हैं।' },
    ],
  },
  {
    sourceLanguage: 'es',
    id: 'es-notebook',
    title: 'The neighborhood notebook',
    topic: 'Civic life and observation',
    difficulty: 'intermediate',
    audioUrl: '/audio/interpreting/es-notebook.wav',
    durationMs: 9827,
    rightsRecordId: 'audio.es.notebook.v1',
    segments: [
      { id: 'es-notebook-1', startMs: 0, endMs: 4800, transcript: 'Los vecinos anotan los problemas del barrio en un cuaderno.' },
      { id: 'es-notebook-2', startMs: 4800, endMs: 9827, transcript: 'Cada viernes, una voluntaria reúne las notas.' },
    ],
  },
  {
    sourceLanguage: 'ar',
    id: 'ar-map',
    title: 'An old coastal map',
    topic: 'Heritage and public memory',
    difficulty: 'advanced',
    audioUrl: '/audio/interpreting/ar-map.wav',
    durationMs: 11197,
    rightsRecordId: 'audio.ar.map.v1',
    segments: [
      { id: 'ar-map-1', startMs: 0, endMs: 5500, transcript: 'عثر الطلاب على خريطة قديمة في المركز الثقافي.' },
      { id: 'ar-map-2', startMs: 5500, endMs: 11197, transcript: 'قرروا تصويرها ومقارنتها بذاكرة الكبار.' },
    ],
  },
]

const knownRightsRecords = new Set(sourceClips.map((clip) => clip.rightsRecordId))

function validateSourceClip(clip: SourceClip): void {
  if (!knownRightsRecords.has(clip.rightsRecordId) || !clip.audioUrl.startsWith('/audio/interpreting/')) {
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
  }
}

const chineseCenteredDirections: Array<[LanguageCode, LanguageCode]> = [
  ['zh', 'en'],
  ['zh', 'ru'],
  ['zh', 'fr'],
  ['zh', 'hi'],
  ['zh', 'es'],
  ['zh', 'ar'],
  ['en', 'zh'],
  ['ru', 'zh'],
  ['fr', 'zh'],
  ['hi', 'zh'],
  ['es', 'zh'],
  ['ar', 'zh'],
]

export const INTERPRETING_EXERCISES: InterpretingExercise[] = chineseCenteredDirections.flatMap(([sourceLanguage, targetLanguage]) => {
  const clip = sourceClips.find((candidate) => candidate.sourceLanguage === sourceLanguage)
  return clip ? [toExercise(clip, targetLanguage)] : []
})

export function getInterpretingExercisesForDirection(sourceLanguage: LanguageCode, targetLanguage: LanguageCode): InterpretingExercise[] {
  return INTERPRETING_EXERCISES.filter((exercise) => exercise.sourceLanguage === sourceLanguage
    && exercise.targetLanguage === targetLanguage
    && knownRightsRecords.has(exercise.rightsRecordId)
    && exercise.audioUrl.startsWith('/audio/interpreting/'))
}

export function getInterpretingExerciseById(exerciseId: string): InterpretingExercise | undefined {
  return INTERPRETING_EXERCISES.find((exercise) => exercise.id === exerciseId)
}

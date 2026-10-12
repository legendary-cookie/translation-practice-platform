import type { Difficulty, Exercise, ExerciseTag, GlossaryEntry, WrittenPracticeMode } from '../domain/types'
import type { LanguageCode } from '../domain/languages'
import { CHINESE_DIRECTIONS } from '../domain/languages'

type SourcePassage = {
  id: string
  sourceLanguage: LanguageCode
  title: string
  topic: string
  difficulty: Difficulty
  sourceText: string
  glossary: GlossaryEntry[]
  tags: ExerciseTag[]
}

const sourcePassages: SourcePassage[] = [
  {
    id: 'zh-river-garden',
    sourceLanguage: 'zh',
    title: '河口边的社区花园',
    topic: 'Community and environment',
    difficulty: 'intermediate',
    sourceText: '在靠近河口的一座城市里，居民把一块闲置的停车场改成了社区花园。志愿者轮流照料蔬菜和香草，并在周末向邻居开放。这个小项目没有改变城市的面貌，却让不同年龄的人有了共同维护一块土地的理由。',
    glossary: [
      { term: '闲置', note: 'not currently in use', targetHint: 'vacant / unused' },
      { term: '轮流照料', note: 'take turns looking after something', targetHint: 'take turns caring for' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'en-night-library',
    sourceLanguage: 'en',
    title: 'A library after dark',
    topic: 'Public services and learning',
    difficulty: 'intermediate',
    sourceText: 'On Thursday evenings, a small neighborhood library keeps its doors open late for people who work irregular hours. Volunteers offer quiet study tables, help with digital forms, and host a short reading circle. The program is modest, but its regular visitors say the extra hour makes the library feel like a shared place rather than a building with fixed opening times.',
    glossary: [
      { term: 'irregular hours', note: 'a work schedule that changes or is not standard', targetHint: '非固定工时' },
      { term: 'shared place', note: 'a place used and cared for by a community', targetHint: '共同空间' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ru-repair-workshop',
    sourceLanguage: 'ru',
    title: 'Мастерская ремонта',
    topic: 'Skills and local resilience',
    difficulty: 'intermediate',
    sourceText: 'В старом трамвайном депо открылась небольшая мастерская ремонта. По субботам жители приносят туда лампы, велосипеды и бытовые приборы, которые жалко выбрасывать. Опытные мастера показывают, как найти неисправность и заменить простую деталь. Организаторы считают, что такая встреча экономит не только деньги, но и материалы.',
    glossary: [
      { term: 'депо', note: 'a place where trams or other vehicles are kept and maintained', targetHint: 'tram depot' },
      { term: 'неисправность', note: 'a fault or malfunction', targetHint: 'fault / defect' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'fr-rooftop-water',
    sourceLanguage: 'fr',
    title: 'L’eau sur les toits',
    topic: 'Climate and city planning',
    difficulty: 'advanced',
    sourceText: 'Dans un quartier dense, plusieurs immeubles ont installé de petits réservoirs sur leurs toits afin de récupérer l’eau de pluie. L’eau n’est pas potable, mais elle suffit pour arroser les plantations et nettoyer les parties communes. Le projet reste expérimental : les habitants observent les économies réalisées avant de décider s’il peut être étendu à d’autres bâtiments.',
    glossary: [
      { term: 'récupérer l’eau de pluie', note: 'collect rainwater for later use', targetHint: 'harvest rainwater' },
      { term: 'parties communes', note: 'shared areas of a building', targetHint: 'common areas' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'hi-seed-library',
    sourceLanguage: 'hi',
    title: 'बीजों की छोटी लाइब्रेरी',
    topic: 'Food and local knowledge',
    difficulty: 'advanced',
    sourceText: 'एक पहाड़ी कस्बे में किसानों ने बीजों की छोटी लाइब्रेरी शुरू की है। लोग स्थानीय सब्जियों और अनाज के बीज जमा करते हैं और अगली फसल के मौसम में उन्हें उधार ले जाते हैं। हर पैकेट के साथ बोने का समय और मिट्टी की जानकारी लिखी जाती है, ताकि पुराना ज्ञान रोज़मर्रा की खेती में काम आ सके।',
    glossary: [
      { term: 'उधार ले जाते हैं', note: 'borrow and take away for temporary use', targetHint: 'borrow' },
      { term: 'फसल का मौसम', note: 'the season when a crop is grown or harvested', targetHint: 'growing season' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'es-bus-stop-notebook',
    sourceLanguage: 'es',
    title: 'El cuaderno de la parada',
    topic: 'Civic life and observation',
    difficulty: 'intermediate',
    sourceText: 'En una parada de autobús, los vecinos colocaron un cuaderno para anotar pequeños problemas del barrio: una farola apagada, una acera rota o un árbol que necesita agua. Cada viernes, una voluntaria reúne las notas y las envía al ayuntamiento. No todas las peticiones reciben respuesta inmediata, pero el cuaderno ha convertido las quejas aisladas en una lista que se puede seguir.',
    glossary: [
      { term: 'farola', note: 'a street lamp', targetHint: 'streetlight' },
      { term: 'quejas aisladas', note: 'individual complaints with no shared record', targetHint: 'isolated complaints' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ar-coastal-map',
    sourceLanguage: 'ar',
    title: 'خريطة الساحل القديمة',
    topic: 'Heritage and public memory',
    difficulty: 'advanced',
    sourceText: 'في بلدة ساحلية، عثر طلاب على خريطة قديمة في صندوق مهمل داخل مركز ثقافي. لا تحدد الخريطة الشوارع بدقة، لكنها تسجل أسماء الآبار والممرات التي استخدمها الصيادون قبل توسع الميناء. قرر الطلاب تصويرها ومقارنة تفاصيلها بذاكرة كبار السن، ثم عرضوا النتائج في أمسية مفتوحة للسكان.',
    glossary: [
      { term: 'صندوق مهمل', note: 'a neglected or forgotten box', targetHint: 'neglected box' },
      { term: 'توسع الميناء', note: 'the expansion of the harbor', targetHint: 'harbor expansion' },
    ],
    tags: ['general', 'news'],
  },
]

function createExercise(passage: SourcePassage, targetLanguage: LanguageCode, mode: WrittenPracticeMode): Exercise {
  return {
    id: `${passage.id}-${mode}-${targetLanguage}`,
    mode,
    sourceLanguage: passage.sourceLanguage,
    targetLanguage,
    title: passage.title,
    topic: passage.topic,
    difficulty: passage.difficulty,
    sourceText: passage.sourceText,
    glossary: passage.glossary,
    tags: passage.tags,
  }
}

export const EXERCISES: Exercise[] = CHINESE_DIRECTIONS.flatMap((direction) => {
  const passage = sourcePassages.find((item) => item.sourceLanguage === direction.sourceLanguage)
  if (!passage) {
    return []
  }
  return (['written', 'news'] as WrittenPracticeMode[]).map((mode) => createExercise(passage, direction.targetLanguage, mode))
})

export function getExercisesForDirection(
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  mode: WrittenPracticeMode,
): Exercise[] {
  return EXERCISES.filter((exercise) => exercise.sourceLanguage === sourceLanguage && exercise.targetLanguage === targetLanguage && exercise.mode === mode)
}

export function getExerciseById(exerciseId: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === exerciseId)
}

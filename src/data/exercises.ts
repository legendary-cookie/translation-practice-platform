import type { Exercise, LanguageCode, PracticeMode } from '../domain/types'

// Original fictional reports, authored for this app; none describe real events.
const passages: Omit<Exercise, 'id' | 'mode' | 'style'>[] = [
  {
    sourceLanguage: 'zh', title: 'A library that lends tools', topic: 'Community', difficulty: 'intermediate',
    sourceText: '青河社区图书馆计划从下月起试行工具借用服务。居民可以免费借用简单的维修工具，但须参加一次安全说明会。负责人表示，这项服务旨在减少闲置物品，让更多家庭能够自行完成小修理。试行三个月后，图书馆将根据使用情况决定是否扩大服务。',
    glossary: [{ term: '试行', hint: 'A limited trial before a longer-term decision.' }, { term: '闲置物品', hint: 'Items that are owned but rarely used.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'en', title: 'A cooler route to school', topic: 'Environment', difficulty: 'intermediate',
    sourceText: 'A neighbourhood council plans to plant shade trees along the walking route to a primary school. Volunteers will help water the young trees during their first summer. The council says the project aims to make short journeys more comfortable, but warns that the trees will take several years to provide substantial shade. Residents will be invited to review the planting plan before work begins.',
    glossary: [{ term: 'substantial shade', hint: 'Enough shade to make a noticeable difference.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'ru', title: 'Repair before replacement', topic: 'Community', difficulty: 'intermediate',
    sourceText: 'В районном центре откроется мастерская, где жители смогут научиться ремонтировать небольшие бытовые вещи. На первых занятиях участники будут работать только с ручными инструментами. Организаторы рассчитывают сократить количество отходов и помочь соседям обмениваться опытом. Запись начнётся на следующей неделе, а участие будет бесплатным. После пробного месяца расписание пересмотрят с учётом пожеланий посетителей.',
    glossary: [{ term: 'бытовые вещи', hint: 'Everyday household items.' }, { term: 'с учётом', hint: 'Taking something into account.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'fr', title: 'A shared garden', topic: 'Environment', difficulty: 'intermediate',
    sourceText: 'Un jardin partagé ouvrira au printemps sur un terrain municipal jusque-là inutilisé. Les habitants pourront y cultiver des légumes, à condition de participer à l’entretien des espaces communs. La mairie fournira les premiers outils et installera un réservoir pour récupérer l’eau de pluie. Les organisateurs espèrent créer un lieu de rencontre, sans promettre que le jardin couvrira tous les besoins alimentaires du quartier.',
    glossary: [{ term: 'jardin partagé', hint: 'A garden maintained collectively by local residents.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'hi', title: 'Books closer to home', topic: 'Education', difficulty: 'intermediate',
    sourceText: 'नगर पुस्तकालय अगले महीने से दो मोहल्लों में चलती पुस्तक सेवा शुरू करेगा। हर शनिवार एक छोटी गाड़ी बच्चों और बड़ों के लिए किताबें लेकर आएगी। पाठक किताबें दो सप्ताह के लिए उधार ले सकेंगे। पुस्तकालय के अनुसार, यह प्रयोग उन लोगों तक पहुँचने के लिए है जो मुख्य भवन तक आसानी से नहीं जा सकते। तीन महीने बाद पाठकों की राय के आधार पर सेवा में बदलाव किए जाएंगे।',
    glossary: [{ term: 'उधार', hint: 'Borrowing with an obligation to return.' }, { term: 'प्रयोग', hint: 'A trial or pilot in this context.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'es', title: 'A quieter evening street', topic: 'Transport', difficulty: 'intermediate',
    sourceText: 'El ayuntamiento probará una zona peatonal junto al mercado durante cuatro domingos. Los vehículos de reparto podrán entrar antes de las diez de la mañana, y se mantendrá el acceso para los servicios de emergencia. La medida busca ofrecer más espacio a los vecinos sin interrumpir el abastecimiento de las tiendas. Al terminar la prueba, se recogerán opiniones de comerciantes y residentes antes de tomar una decisión definitiva.',
    glossary: [{ term: 'abastecimiento', hint: 'The supply of goods needed by the shops.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
  {
    sourceLanguage: 'ar', title: 'Learning to save water', topic: 'Environment', difficulty: 'intermediate',
    sourceText: 'سيطلق المركز المجتمعي ورشات مجانية لمساعدة الأسر على تقليل استهلاك المياه في المنزل. سيتعلم المشاركون طرق اكتشاف التسربات البسيطة ومتابعة الاستهلاك الشهري. وأوضح المنظمون أن الهدف هو تشجيع عادات عملية، لا مطالبة الناس بشراء أجهزة جديدة. ستبدأ الورشات الشهر المقبل، وسيُطلب من المشاركين تقديم ملاحظاتهم بعد ستة أسابيع لتحسين البرنامج.',
    glossary: [{ term: 'التسربات', hint: 'Leaks, here referring to water escaping unintentionally.' }],
    provenance: 'original', authoredAt: '2026-10-11',
  },
]

// The same seven passages support general translation and news-register practice.
export const exercises: Exercise[] = passages.flatMap((passage) =>
  (['written', 'news'] as const).map((mode) => ({
    ...passage, id: `${passage.sourceLanguage}-${mode}-01`, mode,
    style: mode === 'news' ? 'news' as const : 'general' as const,
  })),
)

export function getExercises(mode: PracticeMode, sourceLanguage: LanguageCode): Exercise[] {
  return exercises.filter((exercise) => exercise.mode === mode && exercise.sourceLanguage === sourceLanguage)
}

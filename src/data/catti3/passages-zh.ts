import type { Catti3Passage } from './types'

/** Chinese source passages (汉译英 / 汉译俄). Original, CATTI Level 3 style. */
export const ZH_PASSAGES: Catti3Passage[] = [
  {
    id: 'zh-water-saving-cities',
    sourceLanguage: 'zh',
    targetLanguages: ['en', 'ru'],
    title: '建设节水型城市',
    topic: 'Environment and resources',
    genre: 'report',
    usage: 'practice',
    paragraphs: [
      {
        source: '我国人均水资源量仅为世界平均水平的四分之一左右，水资源时空分布不均，是全球人均水资源最贫乏的国家之一。随着城镇化快速推进，城市用水需求持续增长，水资源短缺已成为制约经济社会发展的突出问题。',
        reference: {
          en: 'China’s per capita water resources are only about one quarter of the world average, and they are unevenly distributed in time and space, making China one of the most water-scarce countries in the world in per capita terms. As urbanization advances rapidly, urban demand for water keeps rising, and water shortages have become a prominent constraint on economic and social development.',
          ru: 'Объём водных ресурсов на душу населения в Китае составляет лишь около четверти среднемирового уровня, а сами ресурсы распределены неравномерно во времени и пространстве, поэтому Китай относится к числу стран с наименьшей в мире водообеспеченностью на душу населения. По мере быстрой урбанизации потребность городов в воде продолжает расти, и нехватка воды стала серьёзным фактором, сдерживающим социально-экономическое развитие.',
        },
      },
      {
        source: '建设节水型城市，是缓解城市缺水矛盾的重要举措。近年来，各地加快改造老旧供水管网，降低管网漏损率；推广节水器具，引导居民养成节约用水的习惯；同时大力发展再生水利用，将处理后的污水用于绿化灌溉、道路清扫和工业冷却。',
        reference: {
          en: 'Building water-saving cities is an important step in easing urban water shortages. In recent years, localities have accelerated the renovation of ageing water supply networks to reduce leakage; promoted water-saving appliances and encouraged residents to develop the habit of saving water; and vigorously expanded the use of reclaimed water, using treated wastewater for landscape irrigation, street cleaning and industrial cooling.',
          ru: 'Создание водосберегающих городов является важной мерой по смягчению проблемы нехватки воды в городах. В последние годы на местах ускорили модернизацию изношенных водопроводных сетей, чтобы сократить потери воды; распространяют водосберегающие приборы и приучают жителей бережно расходовать воду; а также активно развивают использование оборотной воды, направляя очищенные сточные воды на полив зелёных насаждений, уборку улиц и охлаждение промышленного оборудования.',
        },
      },
      {
        source: '以某北方城市为例，该市通过分区计量和智能监测，三年内将管网漏损率从15%降至9%，每年节约用水约2000万立方米，相当于10万户家庭一年的用水量。',
        reference: {
          en: 'Take one city in northern China as an example. Through district metering and smart monitoring, it cut its pipe network leakage rate from 15% to 9% within three years, saving about 20 million cubic metres of water a year, equivalent to the annual consumption of 100,000 households.',
          ru: 'Возьмём в качестве примера один из городов на севере Китая. Благодаря зональному учёту и интеллектуальному мониторингу за три года уровень потерь в водопроводной сети здесь снизился с 15% до 9%, что позволяет ежегодно экономить около 20 млн кубометров воды — столько за год потребляют 100 тыс. семей.',
        },
      },
      {
        source: '节约用水不仅是政府和企业的责任，也需要每一位市民的参与。只有全社会共同努力，才能实现水资源的可持续利用，为子孙后代留下碧水蓝天。',
        reference: {
          en: 'Saving water is not only the responsibility of governments and businesses; it also requires the participation of every citizen. Only through the joint efforts of the whole of society can water resources be used sustainably and clear waters and blue skies be passed on to future generations.',
          ru: 'Экономия воды — это обязанность не только государства и предприятий, но и каждого горожанина. Лишь совместными усилиями всего общества можно добиться устойчивого использования водных ресурсов и сохранить чистую воду и голубое небо для будущих поколений.',
        },
      },
    ],
    keyTerms: [
      { source: '人均水资源量', accepted: { en: ['per capita water'], ru: ['на душу населения'] } },
      { source: '城镇化', accepted: { en: ['urbani'], ru: ['урбанизац'] } },
      { source: '节水型城市', accepted: { en: ['water-saving cit', 'water-efficient cit'], ru: ['водосберегающ'] } },
      { source: '管网漏损率', accepted: { en: ['leakage'], ru: ['потер', 'утечк'] } },
      { source: '再生水', accepted: { en: ['reclaimed water', 'recycled water'], ru: ['оборотн', 'вторичн', 'очищенн'] } },
      { source: '可持续利用', accepted: { en: ['sustainab'], ru: ['устойчив'] } },
    ],
  },
]

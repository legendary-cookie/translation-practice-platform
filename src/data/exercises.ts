import type { Difficulty, Exercise, ExerciseTag, GlossaryEntry, WrittenPracticeMode } from '../domain/types'
import type { LanguageCode } from '../domain/languages'
import { CHINESE_DIRECTIONS } from '../domain/languages'

type SourcePassage = {
  id: string
  sourceLanguage: LanguageCode
  title: string
  newsDate: string
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
    newsDate: '2025-02-14',
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
    id: 'zh-clinic-appointments',
    sourceLanguage: 'zh',
    title: '社区诊所的预约墙',
    newsDate: '2025-06-03',
    topic: 'Public health and local services',
    difficulty: 'beginner',
    sourceText: '一间社区诊所把每天的预约名额写在门口的白板上。居民可以先查看剩余时段，再通过电话或现场登记。诊所工作人员说，这个简单的安排减少了排队时间，也让行动不便的人更容易找到合适的就诊时段。',
    glossary: [
      { term: '预约名额', note: 'the number of appointments available', targetHint: 'appointment slots' },
      { term: '现场登记', note: 'register in person at the site', targetHint: 'on-site registration' },
      { term: '行动不便', note: 'having limited mobility', targetHint: 'people with limited mobility' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'zh-shared-order-system',
    sourceLanguage: 'zh',
    title: '共享订单系统的试用',
    newsDate: '2025-06-21',
    topic: 'Economics and trade',
    difficulty: 'intermediate',
    sourceText: '某山区的合作社把几家小型加工厂接入同一套订单系统。系统不负责替厂商定价，只把原料需求、交货日期和库存变化放在同一张表里。合作社希望先用三个月的数据检验这套办法，再决定是否向周边乡镇开放。',
    glossary: [
      { term: '接入', note: 'connect to and begin using a shared system', targetHint: 'integrate with / connect to' },
      { term: '交货日期', note: 'the date by which goods must be delivered', targetHint: 'delivery date' },
      { term: '库存变化', note: 'changes in stock held', targetHint: 'inventory changes' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'zh-digital-archive-contract',
    sourceLanguage: 'zh',
    title: '数字档案采购的合同审查',
    newsDate: '2025-07-12',
    topic: 'Technology and legal contracts',
    difficulty: 'advanced',
    sourceText: '一项面向公共机构的数字档案采购计划进入合同审查阶段。评审小组要求供应商明确数据迁移的责任边界、服务中断时的补救措施以及项目结束后的删除程序。文件没有承诺立刻扩大预算，而是把后续付款与可核验的交付节点挂钩。',
    glossary: [
      { term: '责任边界', note: 'the limits of each party’s responsibility', targetHint: 'responsibility boundary' },
      { term: '补救措施', note: 'steps taken to correct or mitigate a failure', targetHint: 'remedial measures' },
      { term: '交付节点', note: 'a verifiable milestone for delivery', targetHint: 'delivery milestone' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'en-night-library',
    sourceLanguage: 'en',
    title: 'A library after dark',
    newsDate: '2025-03-06',
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
    id: 'en-clinic-appointments',
    sourceLanguage: 'en',
    title: 'The clinic’s appointment notice',
    newsDate: '2025-06-10',
    topic: 'Public health and local services',
    difficulty: 'beginner',
    sourceText: 'A neighborhood clinic has started posting its next-day appointment slots on a noticeboard outside the entrance. Residents can check the list before calling or visiting the desk. Staff say the small change helps people with limited mobility plan their trips and reduces the time spent waiting in line.',
    glossary: [
      { term: 'appointment slots', note: 'times available for scheduled visits', targetHint: '预约时段' },
      { term: 'noticeboard', note: 'a board used to display public notices', targetHint: '公告栏' },
      { term: 'limited mobility', note: 'difficulty moving around easily', targetHint: '行动不便' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'en-reusable-crates',
    sourceLanguage: 'en',
    title: 'Crates that come back',
    newsDate: '2025-06-28',
    topic: 'Economics and trade',
    difficulty: 'intermediate',
    sourceText: 'An inland growers’ cooperative is testing reusable crates for shipments to the regional market. The crates cost more to purchase, so the cooperative is tracking return rates, repair costs, and delays before making the system permanent. Its coordinator says the trial will be judged on the full delivery cycle, not on packaging prices alone.',
    glossary: [
      { term: 'reusable crates', note: 'strong containers designed to be used repeatedly', targetHint: '可重复使用的周转箱' },
      { term: 'return rates', note: 'the proportion of containers that come back', targetHint: '回收率' },
      { term: 'full delivery cycle', note: 'the complete process from dispatch to return', targetHint: '完整交付流程' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'en-archive-contract',
    sourceLanguage: 'en',
    title: 'A contract for the archive',
    newsDate: '2025-07-18',
    topic: 'Technology and legal contracts',
    difficulty: 'advanced',
    sourceText: 'A regional archive has issued a draft contract for moving its paper records into a searchable digital system. The draft assigns responsibility for data loss, requires a tested recovery procedure, and ties the final payment to an independently checkable handover. The archive says no supplier will be selected until the public comment period closes.',
    glossary: [
      { term: 'draft contract', note: 'a proposed contract that is not yet final', targetHint: '合同草案' },
      { term: 'recovery procedure', note: 'a tested process for restoring data or service', targetHint: '恢复程序' },
      { term: 'handover', note: 'the formal transfer of work, records, or control', targetHint: '交接' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ru-repair-workshop',
    sourceLanguage: 'ru',
    title: 'Мастерская ремонта',
    newsDate: '2025-03-22',
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
    id: 'ru-mosaic-workshop',
    sourceLanguage: 'ru',
    title: 'Вечер в мастерской мозаики',
    newsDate: '2025-06-05',
    topic: 'Culture and community',
    difficulty: 'beginner',
    sourceText: 'В районном доме культуры открылась вечерняя мастерская мозаики. Участники приносят небольшие эскизы, выбирают цветные кусочки и работают за одним длинным столом. Руководитель не обещает готовых картин за один вечер: важнее, чтобы люди научились обсуждать замысел и помогать друг другу.',
    glossary: [
      { term: 'дом культуры', note: 'a local cultural and community centre', targetHint: '文化中心' },
      { term: 'эскиз', note: 'a preliminary drawing or design', targetHint: '草图' },
      { term: 'замысел', note: 'the idea or intention behind a work', targetHint: '构思' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ru-heat-network-check',
    sourceLanguage: 'ru',
    title: 'Проверка старой тепловой сети',
    newsDate: '2025-06-26',
    topic: 'Environment and public infrastructure',
    difficulty: 'intermediate',
    sourceText: 'Региональная коммунальная служба начала проверять теплоизоляцию на участке старой тепловой сети. Работы проводят поэтапно, чтобы не прекращать подачу горячей воды во всём квартале. По предварительной оценке специалистов, ремонт может сократить потери тепла, но окончательный результат станет понятен только после зимнего сезона.',
    glossary: [
      { term: 'теплоизоляция', note: 'material or work that prevents heat from escaping', targetHint: '隔热' },
      { term: 'поэтапно', note: 'in separate stages rather than all at once', targetHint: '分阶段地' },
      { term: 'потери тепла', note: 'heat lost from a system', targetHint: '热量损失' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ru-platform-contract',
    sourceLanguage: 'ru',
    title: 'Раздел о сбоях в цифровом сервисе',
    newsDate: '2025-07-21',
    topic: 'Technology and legal contracts',
    difficulty: 'advanced',
    sourceText: 'В проект договора на обслуживание городской цифровой платформы внесли отдельный раздел о доступности данных. Подрядчик должен уведомлять заказчика о сбое, хранить резервные копии в течение согласованного срока и передавать документацию при расторжении договора. Юристы также предложили связать оплату с приемкой каждого этапа, а не с одной итоговой датой.',
    glossary: [
      { term: 'заказчик', note: 'the client or contracting party that commissions the work', targetHint: '委托方' },
      { term: 'резервная копия', note: 'a backup copy kept for recovery', targetHint: '备份' },
      { term: 'приемка этапа', note: 'formal acceptance of a project stage', targetHint: '阶段验收' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'fr-rooftop-water',
    sourceLanguage: 'fr',
    title: 'L’eau sur les toits',
    newsDate: '2025-04-09',
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
    id: 'fr-digital-counter',
    sourceLanguage: 'fr',
    title: 'Le guichet numérique de la médiathèque',
    newsDate: '2025-06-08',
    topic: 'Technology and public services',
    difficulty: 'beginner',
    sourceText: 'La médiathèque d’un quartier propose désormais un petit guichet numérique. Les habitants peuvent y remplir un formulaire, imprimer un document ou demander de l’aide pour créer un compte. Le service ne remplace pas l’accueil habituel : il offre simplement un premier accompagnement aux personnes qui hésitent à faire leurs démarches en ligne.',
    glossary: [
      { term: 'guichet numérique', note: 'a desk or service point for digital assistance', targetHint: '数字服务柜台' },
      { term: 'démarches en ligne', note: 'administrative or practical procedures completed online', targetHint: '线上办事' },
      { term: 'accompagnement', note: 'guided help provided during a process', targetHint: '辅导 / 协助' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'fr-reusable-crates',
    sourceLanguage: 'fr',
    title: 'Des caisses qui reviennent',
    newsDate: '2025-06-30',
    topic: 'Economics and trade',
    difficulty: 'intermediate',
    sourceText: 'Une coopérative de producteurs teste des caisses réutilisables pour livrer ses marchandises au marché régional. Elle suit le taux de retour, les frais de réparation et les retards avant de modifier son contrat de transport. Selon sa coordinatrice, le dispositif ne sera maintenu que s’il reste fiable sur l’ensemble du circuit, du chargement au retour des caisses.',
    glossary: [
      { term: 'caisses réutilisables', note: 'crates designed to be used repeatedly', targetHint: '可重复使用的周转箱' },
      { term: 'taux de retour', note: 'the proportion of containers returned', targetHint: '回收率' },
      { term: 'contrat de transport', note: 'an agreement covering the carriage of goods', targetHint: '运输合同' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'fr-review-clause',
    sourceLanguage: 'fr',
    title: 'Une clause de réexamen',
    newsDate: '2025-07-25',
    topic: 'Government policy and legal contracts',
    difficulty: 'advanced',
    sourceText: 'Dans un projet de règlement, une autorité régionale propose de réexaminer les aides accordées aux petites entreprises après dix-huit mois. Le texte prévoit des indicateurs publiés à l’avance, mais laisse ouverte la possibilité d’ajuster les montants si les coûts de l’énergie évoluent fortement. Les juristes demandent que cette clause précise aussi la procédure de recours.',
    glossary: [
      { term: 'réexaminer', note: 'review something again before making a decision', targetHint: '重新审查' },
      { term: 'indicateurs', note: 'measurable signs used to assess a policy or result', targetHint: '指标' },
      { term: 'procédure de recours', note: 'the process for challenging or appealing a decision', targetHint: '申诉程序' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'hi-seed-library',
    sourceLanguage: 'hi',
    title: 'बीजों की छोटी लाइब्रेरी',
    newsDate: '2025-04-18',
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
    id: 'hi-clinic-slips',
    sourceLanguage: 'hi',
    title: 'क्लिनिक की नई पर्ची व्यवस्था',
    newsDate: '2025-06-12',
    topic: 'Public health and local services',
    difficulty: 'beginner',
    sourceText: 'एक मोहल्ले के क्लिनिक ने अगले दिन की जांच के लिए उपलब्ध पर्चियों की सूची पहले से लगाने की व्यवस्था शुरू की है। लोग बाहर लगी सूची देखकर फोन कर सकते हैं या काउंटर पर अपना नाम लिखवा सकते हैं। कर्मचारियों के अनुसार, इससे प्रतीक्षा कम हुई है और बुजुर्गों को अपनी यात्रा की योजना बनाने में सुविधा मिलती है।',
    glossary: [
      { term: 'पर्ची', note: 'a slip or token used for an appointment or turn', targetHint: '预约单' },
      { term: 'प्रतीक्षा', note: 'the act or period of waiting', targetHint: '等待' },
      { term: 'नाम लिखवाना', note: 'have one’s name registered', targetHint: '登记姓名' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'hi-shared-order-register',
    sourceLanguage: 'hi',
    title: 'छोटे कारखानों की साझा सूची',
    newsDate: '2025-07-02',
    topic: 'Economics and trade',
    difficulty: 'intermediate',
    sourceText: 'एक औद्योगिक क्षेत्र की सहकारी समिति ने छोटे कारखानों के लिए साझा ऑर्डर रजिस्टर शुरू किया है। इसमें कच्चे माल की जरूरत, भेजने की तारीख और बचा हुआ भंडार एक ही जगह दर्ज किया जाता है। समिति पहले तीन महीने के आंकड़ों की समीक्षा करेगी और उसके बाद तय करेगी कि यह व्यवस्था आसपास के इलाकों तक बढ़ाई जाए या नहीं।',
    glossary: [
      { term: 'सहकारी समिति', note: 'an association owned and run cooperatively by its members', targetHint: '合作社' },
      { term: 'कच्चा माल', note: 'materials used to make a product', targetHint: '原材料' },
      { term: 'भंडार', note: 'stock or inventory held for use or sale', targetHint: '库存' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'hi-digital-archive-contract',
    sourceLanguage: 'hi',
    title: 'डिजिटल अभिलेखों का अनुबंध',
    newsDate: '2025-07-29',
    topic: 'Technology and legal contracts',
    difficulty: 'advanced',
    sourceText: 'एक क्षेत्रीय अभिलेखागार ने कागजी दस्तावेजों को खोज योग्य डिजिटल रिकॉर्ड में बदलने के लिए अनुबंध का मसौदा जारी किया है। मसौदे में डेटा खोने की जिम्मेदारी, आपात स्थिति में पुनर्प्राप्ति की जांच और काम पूरा होने पर दस्तावेज सौंपने की शर्तें शामिल हैं। अंतिम भुगतान को किसी एक तारीख से जोड़ने के बजाय हर चरण की स्वीकृति से जोड़ने का प्रस्ताव रखा गया है।',
    glossary: [
      { term: 'अनुबंध का मसौदा', note: 'a proposed contract that is not yet final', targetHint: '合同草案' },
      { term: 'पुनर्प्राप्ति', note: 'the recovery or restoration of data or service', targetHint: '恢复' },
      { term: 'चरण की स्वीकृति', note: 'formal acceptance of a project stage', targetHint: '阶段验收' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'es-bus-stop-notebook',
    sourceLanguage: 'es',
    title: 'El cuaderno de la parada',
    newsDate: '2025-05-07',
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
    id: 'es-clinic-appointments',
    sourceLanguage: 'es',
    title: 'La lista de la clínica',
    newsDate: '2025-06-15',
    topic: 'Public health and local services',
    difficulty: 'beginner',
    sourceText: 'Una clínica de barrio empezó a colocar en la entrada una lista con las citas disponibles para el día siguiente. Los vecinos pueden consultarla antes de llamar o acercarse al mostrador. El personal dice que el cambio reduce la espera y ayuda a las personas con movilidad limitada a organizar el viaje.',
    glossary: [
      { term: 'citas disponibles', note: 'appointments that can still be booked', targetHint: '可预约时段' },
      { term: 'mostrador', note: 'a service or reception counter', targetHint: '服务柜台' },
      { term: 'movilidad limitada', note: 'reduced ability to move around easily', targetHint: '行动不便' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'es-reusable-crates',
    sourceLanguage: 'es',
    title: 'Cajas que vuelven al almacén',
    newsDate: '2025-07-05',
    topic: 'Economics and environment',
    difficulty: 'intermediate',
    sourceText: 'Una cooperativa agrícola está probando cajas reutilizables para llevar sus productos al mercado regional. Antes de cambiar el contrato de transporte, registra cuántas cajas regresan, cuánto cuesta repararlas y qué retrasos se producen. La coordinadora advierte que el sistema solo funcionará si el circuito completo resulta previsible.',
    glossary: [
      { term: 'cajas reutilizables', note: 'containers designed to be used repeatedly', targetHint: '可重复使用的周转箱' },
      { term: 'contrato de transporte', note: 'an agreement covering the carriage of goods', targetHint: '运输合同' },
      { term: 'circuito completo', note: 'the whole process from dispatch through return', targetHint: '完整流程' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'es-regulation-clause',
    sourceLanguage: 'es',
    title: 'Una cláusula de revisión',
    newsDate: '2025-08-02',
    topic: 'Government policy and legal contracts',
    difficulty: 'advanced',
    sourceText: 'Un borrador de reglamento propone revisar cada dieciocho meses las ayudas concedidas a pequeños negocios. La autoridad regional quiere publicar los indicadores con antelación, pero también reservarse la posibilidad de ajustar las cantidades si cambian mucho los costes energéticos. Los asesores jurídicos han pedido que el texto detalle el procedimiento de reclamación.',
    glossary: [
      { term: 'borrador de reglamento', note: 'a proposed set of rules that is not yet final', targetHint: '法规草案' },
      { term: 'reservarse la posibilidad', note: 'keep the option open to do something later', targetHint: '保留……的可能性' },
      { term: 'procedimiento de reclamación', note: 'the process for making a formal complaint or claim', targetHint: '申诉程序' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ar-coastal-map',
    sourceLanguage: 'ar',
    title: 'خريطة الساحل القديمة',
    newsDate: '2025-05-16',
    topic: 'Heritage and public memory',
    difficulty: 'advanced',
    sourceText: 'في بلدة ساحلية، عثر طلاب على خريطة قديمة في صندوق مهمل داخل مركز ثقافي. لا تحدد الخريطة الشوارع بدقة، لكنها تسجل أسماء الآبار والممرات التي استخدمها الصيادون قبل توسع الميناء. قرر الطلاب تصويرها ومقارنة تفاصيلها بذاكرة كبار السن، ثم عرضوا النتائج في أمسية مفتوحة للسكان.',
    glossary: [
      { term: 'صندوق مهمل', note: 'a neglected or forgotten box', targetHint: 'neglected box' },
      { term: 'توسع الميناء', note: 'the expansion of the harbor', targetHint: 'harbor expansion' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ar-clinic-appointments',
    sourceLanguage: 'ar',
    title: 'قائمة مواعيد العيادة',
    newsDate: '2025-06-19',
    topic: 'Public health and local services',
    difficulty: 'beginner',
    sourceText: 'بدأت عيادة في أحد الأحياء بنشر قائمة بالمواعيد المتاحة لليوم التالي عند المدخل. يستطيع السكان الاطلاع على القائمة قبل الاتصال أو التوجه إلى مكتب الاستقبال. ويقول العاملون إن هذا التغيير البسيط يقلل وقت الانتظار ويساعد الأشخاص محدودي الحركة في تنظيم زيارتهم.',
    glossary: [
      { term: 'المواعيد المتاحة', note: 'appointment times that can still be booked', targetHint: '可预约时段' },
      { term: 'مكتب الاستقبال', note: 'the reception or front desk', targetHint: '接待处' },
      { term: 'محدودو الحركة', note: 'people with limited mobility', targetHint: '行动不便者' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ar-heritage-register',
    sourceLanguage: 'ar',
    title: 'سجل المباني القديمة',
    newsDate: '2025-07-09',
    topic: 'Culture and public memory',
    difficulty: 'intermediate',
    sourceText: 'شرع مركز ثقافي صغير في تسجيل أسماء المباني القديمة التي يمر بها السكان كل يوم. لا يكتفي الفريق بتصوير الواجهات، بل يسأل أصحاب المتاجر عن التغييرات التي طرأت على المكان ويقارن الروايات بالخرائط المتاحة. ويأمل المنظمون أن يتحول السجل إلى مادة تعليمية مفتوحة للمدارس.',
    glossary: [
      { term: 'طرأت على', note: 'came to affect or changed something over time', targetHint: '发生在……的变化' },
      { term: 'الروايات', note: 'accounts or narratives told by people', targetHint: '叙述' },
      { term: 'مادة تعليمية', note: 'material prepared for teaching or learning', targetHint: '教学材料' },
    ],
    tags: ['general', 'news'],
  },
  {
    id: 'ar-platform-contract',
    sourceLanguage: 'ar',
    title: 'بند المراجعة في العقد',
    newsDate: '2025-08-08',
    topic: 'Government policy and legal contracts',
    difficulty: 'advanced',
    sourceText: 'يتضمن مشروع عقد لإدارة منصة رقمية إقليمية بنداً يحدد مسؤولية الطرفين عند فقدان البيانات أو تعطل الخدمة. ويلزم النص المتعهد بإبلاغ الجهة المتعاقدة بالعطل، والاحتفاظ بنسخ احتياطية، وتسليم الوثائق عند انتهاء العقد. كما يقترح ربط الدفعة النهائية بقبول كل مرحلة يمكن التحقق من إنجازها، لا بموعد ختامي واحد.',
    glossary: [
      { term: 'مسؤولية الطرفين', note: 'the responsibility assigned to both parties', targetHint: '双方责任' },
      { term: 'نسخ احتياطية', note: 'copies kept for recovery if data is lost', targetHint: '备份' },
      { term: 'الجهة المتعاقدة', note: 'the authority or party entering into the contract', targetHint: '合同委托方' },
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
    title: mode === 'news' ? `${passage.newsDate} · ${passage.title}` : passage.title,
    topic: passage.topic,
    difficulty: passage.difficulty,
    sourceText: passage.sourceText,
    glossary: passage.glossary,
    tags: passage.tags,
  }
}

export const EXERCISES: Exercise[] = CHINESE_DIRECTIONS.flatMap((direction) => {
  return sourcePassages
    .filter((passage) => passage.sourceLanguage === direction.sourceLanguage)
    .flatMap((passage) => (['written', 'news'] as WrittenPracticeMode[]).map((mode) => createExercise(passage, direction.targetLanguage, mode)))
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

import type { ExamProfile } from '../domain/types'
import { EXAM_RUBRIC_VERSION, PRACTICE_ESTIMATE_DISCLAIMER } from '../domain/exam'

export const DEFAULT_EXAM_PROFILES: ExamProfile[] = [
  {
    id: 'catti-2-practical-en-zh-v1',
    version: 2,
    rubricVersion: EXAM_RUBRIC_VERSION,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (English <-> Chinese)',
    description:
      '2023-12-25 official syllabus baseline for CATTI English Level 2 《笔译实务》: 180 minutes, 2 English-to-Chinese passages (about 900 words total, 50 pts) and 2 Chinese-to-English passages (about 600 characters total, 50 pts).',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'administration-dependent',
    status: 'verified',
    authority: 'official-syllabus-baseline',
    authoritySourceDate: '2023-12-25',
    authorityNote:
      'Official ATICICG syllabus baseline published 2023-12-25. It is a dated reference, not a timeless guarantee about every later administration.',
    benchmarkNote:
      'Practice comparison only. CATTI thresholds depend on administration, level, paper, and region; the 2024 separate-line exception was 58 rather than a universal 60.',
    disclaimer: PRACTICE_ESTIMATE_DISCLAIMER,
    allowedAids: {
      paperDictionaryAllowed: true,
      onlineSearchAllowed: false,
      glossaryAllowed: false,
      notes:
        'In the official CATTI 《笔译实务》 computer-based examination, candidates are permitted up to two printed paper bilingual general dictionaries (one Foreign-Chinese, one Chinese-Foreign). Electronic dictionaries, specialized terminology books, and online lookups are strictly prohibited.',
    },
    sections: [
      {
        id: 'catti-2-en-zh-sec-1',
        title: 'Section 1: English-to-Chinese Translation (英译汉)',
        direction: 'en-to-zh',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 50,
        passages: [
          {
            id: 'catti-2-en-zh-p1',
            title: 'Passage 1: Multimodal Green Freight and Global Supply Chain Resiliency',
            wordCount: 478,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes (~500 words/hour)',
            sourceText: `Global supply networks are undergoing a profound architectural transformation as escalating geopolitical friction, climate-induced maritime disruptions, and stringent decarbonization mandates converge upon international transport corridors. Historically, maritime transport relied on protracted linear routes governed primarily by scale economics, prioritizing vessel capacity over adaptive redundancy. However, consecutive bottlenecks across vital maritime straits and volatile carbon tariff regimes have exposed the systemic fragility inherent in unhedged logistics planning.

In response, international logistics operators and multinational manufacturers are rapidly pivoting toward multimodal corridors that interlink high-speed rail lines, electrified inland barge networks, and automated coastal container terminals. This integrated approach diminishes reliance on single choke points while curtailing greenhouse gas emissions across cross-border freight corridors. By orchestrating dry-port connectivity with customs automation, regional trade hubs can clear transshipped cargo in hours rather than days, drastically compressing inventory buffer requirements.

Nevertheless, scaling multimodal networks across disparate customs jurisdictions presents formidable operational and legal friction. Rail track gauges, signaling architectures, and electronic cargo manifest standards often diverge sharply across international borders. Cargo consignments traversing land-sea junctions still face burdensome physical inspections and duplicated documentation, nullifying the temporal efficiencies unlocked by modern freight locomotives. Moreover, the capital expenditure needed to upgrade electrified freight corridors, construct intermodal transfer cranes, and deploy end-to-end telemetry systems strains both municipal budgets and private carrier balance sheets.

To reconcile these tensions, multilateral trade coalitions are exploring standardized digital consignment notes and harmonized border clearing frameworks. These protocols aim to facilitate seamless interchange between maritime carriers and rail operators without requiring repeated physical container inspections. When real-time environmental sensors and verified emission metrics are embedded directly into multimodal freight tracking, shippers gain transparent visibility into Scope 3 transport footprints. The long-term viability of international commerce will hinge on whether freight architecture can evolve from vulnerable, isolated shipping channels into an agile, decarbonized, and deeply resilient multimodal tapestry.

Beyond the transport links, authorities are investing in data platforms that combine vessel schedules, rail capacity, weather alerts, and customs status in an operational picture. Such visibility allows dispatchers to reroute containers before a storm closes a port, while manufacturers can adjust production plans without maintaining excessive emergency inventories. Yet digital coordination introduces its own risks. Different operators may use incompatible identifiers, outdated interfaces, or inconsistent rules for sharing commercially sensitive information. A resilient corridor therefore needs common data standards, clear access controls, and oversight as much as it needs tracks, terminals, and cranes. Training is another constraint: customs officials, freight planners, and small carriers must learn to interpret forecasts and operate new systems rather than receive another software installation. Public funding can help smaller firms join the network, but contracts should require measurable service reliability, transparent emissions reporting, and contingency plans for cyberattacks or prolonged power outages. These safeguards turn multimodal connectivity from a collection of projects into a coordinated public infrastructure capable of serving communities during both normal trade and disruption.`,
          },
          {
            id: 'catti-2-en-zh-p2',
            title: 'Passage 2: Offshore Wind Integration and Deep-Sea Power Grids',
            wordCount: 462,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes (~500 words/hour)',
            sourceText: `The global transition toward carbon-neutral electricity systems has spurred unprecedented investment in deep-water offshore wind generation. Unlike terrestrial wind farms, which frequently encounter land availability constraints and complex topological interference, marine turbines exploit consistent, high-velocity sea breezes situated far beyond coastal sightlines. Floating turbine platforms equipped with tension-leg moorings and semi-submersible hulls are unlocking vast deep-water maritime zones previously inaccessible to conventional seabed-fixed foundations.

However, harnessing deep-water wind kinetic energy and transmitting high-voltage electrical currents across vast ocean expanses poses severe electromechanical challenges. Marine atmospheric environments subject turbine blades and undersea nacelles to aggressive saline corrosion, catastrophic storm surges, and cyclic wave fatigue. Subsea dynamic export cables must endure continuous mechanical bending moments while maintaining pristine dielectric insulation under tremendous hydrostatic pressure. A single electrical failure or structural fatigue fracture occurring thirty miles offshore entails exorbitant offshore support vessel mobilization costs and prolonged generation downtime.

Furthermore, integrating colossal volumes of intermittent marine electricity into onshore terrestrial transmission grids demands sophisticated power electronics and grid stabilization infrastructure. High-Voltage Direct Current (HVDC) converter platforms situated in open waters convert fluctuating alternating current into ultra-low-loss direct current before pumping electricity along subsea cables toward coastal load centers. Onshore transmission operators must deploy multi-gigawatt utility-scale battery storage facilities, synchronous condensers, and predictive dispatch algorithms to prevent frequency oscillations caused by abrupt oceanic wind lulls.

Financial institutions and environmental regulators are also demanding comprehensive lifecycle ecological evaluations prior to granting seabed licensing concessions. Marine acoustic disturbances generated during pile anchoring can disrupt cetacean navigational corridors, while electromagnetic fields emitted by unburied high-voltage cables may alter benthic migratory behavior. Sustainable ocean energy development requires maritime engineers, grid planners, and marine conservation biologists to collaborate closely. Only through modular standardized converter engineering, environmentally sensitive seabed anchoring, and resilient transmission topologies can offshore wind mature into a cornerstone of deep decarbonization.

The technical challenge is matched by a governance challenge. Coastal communities want jobs and cleaner air, but they also demand that new corridors do not displace neighborhoods or shift noise and pollution onto less visible routes. Planners are therefore using digital twins and freight forecasts to compare alternative alignments with civic groups before construction begins. These tools can reveal where a new terminal would reduce congestion, where an electrified rail spur would protect farmland, and where a wetland restoration project could reduce flood risk for the logistics system. Operators must also prepare for equipment shortages, extreme heat, and changing trade patterns. A corridor designed only for today's cargo flows may become a stranded asset when shipping alliances, energy prices, or climate hazards change. Flexible contracts and modular terminals allow capacity to expand gradually while preserving options for future technologies. The strongest projects connect efficiency with social trust, treating resilience as a shared regional responsibility rather than an engineering target.`,
          },
        ],
      },
      {
        id: 'catti-2-zh-en-sec-2',
        title: 'Section 2: Chinese-to-English Translation (汉译英)',
        direction: 'zh-to-en',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 50,
        passages: [
          {
            id: 'catti-2-zh-en-p1',
            title: 'Passage 1: 乡村振兴与特色农业生态产业发展',
            wordCount: 312,
            targetLanguage: 'en',
            recommendedPace: 'Approx. 45 minutes (~300-400 chars/hour)',
            sourceText: `全面推进乡村振兴，不仅关乎农业农村现代化全局，更是破解城乡区域发展不平衡不充分的战略抓手。近年来，各地区依托绿水青山生态资源禀赋，因地制宜做强特色农业产业集群，推动品种培优、品质提升和品牌打造。通过深化农村集体产权制度改革，盘活闲置土地与乡土民居资源，广大乡村积极探索农业多功能拓展路径，催生出高山有机农产品、林下经济、民俗康养等一批高附加值新业态。与此同时，冷链物流网络向偏远田间地头纵深延伸，农村电商综合服务体系日益成熟，有力打通了生态农产品进城与高品质消费下乡的双向循环。生态农业不仅守护了乡土田园的秀丽风光，更让广大农民在全产业链增值收益中获得稳固持久的分红与就业机会，走出了一条生态效益与经济效益相得益彰的共富新路。`,
          },
          {
            id: 'catti-2-zh-en-p2',
            title: 'Passage 2: 数字化赋能古建筑活化与文化遗产保护',
            wordCount: 298,
            targetLanguage: 'en',
            recommendedPace: 'Approx. 45 minutes (~300-400 chars/hour)',
            sourceText: `古建筑与历史街区是承载中华优秀传统文化基因的重要物质载体，见证着历代营建技艺与营城智慧的薪火相传。在现代城市更新与微改造中，如何实现历史肌理的完整保护与时代活力的有机共生，是一道复杂的治理课题。借助毫米级激光三维扫描、无人机倾斜摄影和建筑信息模型等数字测绘手段，文物保护工作者得以对木构建筑群建立高精度的“数字孪生”档案，实现对梁架形变与微观裂隙的动态监测预警。虚拟现实与全息互动技术的融合应用，更让深藏于院落厅堂的历史故事走出古籍画卷，以生动可感的形式触达广大青年公众。文化遗产保护已由传统的被动抢救性修缮，全面转向主动性预防与数字活化利用的新阶段。`,
          },
        ],
      },
    ],
  },
  {
    id: 'catti-2-practical-fr-zh-v1',
    version: 2,
    rubricVersion: EXAM_RUBRIC_VERSION,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'fr',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (French <-> Chinese)',
    description:
      '2023-12-25 official syllabus baseline for CATTI French Level 2 《笔译实务》: 180 minutes, about 800 French words for French-to-Chinese (60 pts) and about 500 Chinese characters for Chinese-to-French (40 pts).',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'administration-dependent',
    status: 'verified',
    authority: 'official-syllabus-baseline',
    authoritySourceDate: '2023-12-25',
    authorityNote:
      'Official ATICICG syllabus baseline published 2023-12-25. It is a dated reference, not a timeless guarantee about every later administration; section timer splits and passages are platform-authored practice parameters.',
    benchmarkNote:
      'Practice comparison only. CATTI thresholds depend on administration, level, paper, and region; the 2024 separate-line exception was 58 rather than a universal 60.',
    disclaimer: PRACTICE_ESTIMATE_DISCLAIMER,
    allowedAids: {
      paperDictionaryAllowed: true,
      onlineSearchAllowed: false,
      glossaryAllowed: false,
      notes:
        'Official French Level 2 allows two printed paper bilingual general dictionaries (French-Chinese, Chinese-French). No electronic aids permitted.',
    },
    sections: [
      {
        id: 'catti-2-fr-zh-sec-1',
        title: 'Section 1: French-to-Chinese Translation (法译汉 60分)',
        direction: 'fr-to-zh',
        taskType: 'translation',
        timeLimitMinutes: 105,
        maxPoints: 60,
        passages: [
          {
            id: 'catti-2-fr-zh-p1',
            title: 'Passage 1: La préservation des écosystèmes marins et l’économie bleue',
            wordCount: 412,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 50 minutes',
            sourceText: `L'océan mondial constitue le poumon écologique de notre planète et le régulateur thermique central des équilibres climatiques globaux. Absorbant plus de quatre-vingt-dix pour cent de l'excédent thermique généré par l'effet de serre et séquestrant des milliards de tonnes de dioxyde de carbone, les écosystèmes océaniques subissent pourtant une pression anthropique sans précédent. L'acidification croissante des eaux côtières, la prolifération de microparticules plastiques et la surpêche industrielle menacent d'anéantir la biodiversité des récifs coralliens et de désorganiser les chaînes trophiques pélagiques. Face à cette dégradation alarmante, les nations maritimes s'orientent vers un nouveau modèle de développement : l'économie bleue durable. Ce paradigme novateur postule que la prospérité économique littorale ne saurait s'obtenir au détriment de l'intégrité biologique marine. Le déploiement d'aires marines protégées hautement surveillées, la conversion écologique des flottes de pêche artisanale et le développement raisonné de l'aquaculture multitrophique intégrée permettent de restaurer les stocks halieutiques tout en sécurisant les moyens de subsistance des communautés côtières. Par ailleurs, l'innovation biotechnologique marine offre des perspectives thérapeutiques et énergétiques considérables à travers la valorisation des microalgues et des enzymes marines extrémophiles. Concilier rigueur scientifique et souveraineté économique maritime représente désormais une priorité stratégique pour la gouvernance mondiale des océans.

            Les collectivités littorales doivent néanmoins inscrire ces mesures dans une planification de long terme, car la création d’une réserve ne suffit pas à elle seule à inverser les tendances observées. Des programmes de suivi associant océanographes, pêcheurs et habitants permettent de mesurer la température, la qualité de l’eau et l’évolution des espèces sentinelles. Ces données ouvertes facilitent l’alerte précoce et orientent les décisions lorsque des activités économiques menacent un habitat fragile. Elles aident aussi à répartir équitablement les efforts entre les ports, les entreprises de transformation et les consommateurs, afin que la transition ne pèse pas uniquement sur les travailleurs les plus dépendants des ressources marines. Dans plusieurs régions, des coopératives expérimentent la traçabilité numérique des captures, la réduction des déchets à bord et la restauration des herbiers qui servent de nurseries. Les financements publics et privés doivent accompagner ces initiatives par des objectifs mesurables, une formation professionnelle adaptée et des mécanismes de contrôle transparents. La coopération entre pays voisins demeure essentielle, puisque les courants, les poissons migrateurs et les pollutions ignorent les frontières administratives. En associant protection, innovation et justice sociale, l’économie bleue peut devenir un outil de résilience plutôt qu’un simple slogan de croissance. Cette responsabilité suppose des indicateurs publics, un financement stable et une participation citoyenne durable dans chaque territoire côtier concerné.`,
          },
          {
            id: 'catti-2-fr-zh-p2',
            title: 'Passage 2: L’essor de la mobilité ferroviaire et la décarbonation urbaine',
            wordCount: 394,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 50 minutes',
            sourceText: `La transition écologique des grandes métropoles européennes exige une refonte radicale des infrastructures de transport terrestre, traditionnellement dominées par l'automobile individuelle. Responsable d'une part substantielle des émissions de polluants atmosphériques et de particules fines, le trafic routier congestionne les artères urbaines et altère durablement la santé publique des résidents. En réponse, les autorités métropolitaines investissent massivement dans la modernisation des réseaux ferrés régionaux et l'extension des lignes de tramway à propulsion électrique. Le transport ferroviaire présente une efficacité énergétique inégalée et une empreinte carbone par passager-kilomètre considérablement inférieure à celle des autres modes motorisés. L'interconnexion fluide entre gares multimodales, pistes cyclables sécurisées et parcs de stationnement incitatifs encourage les usagers pendulaires à délaisser leur véhicule thermique. Toutefois, la massification du transport public sur rail requiert une maintenance préventive rigoureuse et des investissements substantiels dans la signalisation numérique automatisée. L'adoption d'horaires cadencés et la tarification solidaire contribuent à garantir l'accessibilité sociale de ces réseaux écologiques. C'est en repensant l'aménagement spatial autour des axes ferroviaires structurants que les villes contemporaines parviendront à concilier fluidité des déplacements et neutralité climatique durable.

            Cette transformation ne peut réussir sans une concertation constante avec les habitants et les salariés qui utilisent quotidiennement ces infrastructures. Les autorités doivent publier des données fiables sur la ponctualité, la fréquentation et la consommation énergétique afin de mesurer les progrès accomplis et de corriger rapidement les dysfonctionnements. La rénovation des gares offre aussi l’occasion de créer des espaces accessibles aux personnes à mobilité réduite, des services de proximité et des correspondances mieux signalées. Dans les quartiers périphériques, des lignes express et des pôles d’échanges bien desservis peuvent réduire la dépendance à la voiture sans imposer de trajet supplémentaire aux familles. La planification doit toutefois éviter de déplacer la congestion vers les communes voisines ou de faire monter les loyers autour des stations nouvelles. Des politiques de logement abordable, une desserte régulière le soir et une information multilingue sont nécessaires pour que la transition bénéficie à tous. Enfin, la formation de conducteurs, d’ingénieurs et de techniciens locaux garantit la continuité du service et crée des emplois qualifiés. Ainsi, le rail devient non seulement un moyen de décarboner les déplacements, mais aussi un instrument de cohésion territoriale et de résilience urbaine. Ces choix doivent rester réversibles, évalués régulièrement et coordonnés avec les politiques climatiques, sociales et économiques de chaque agglomération afin d’éviter les solutions coûteuses ou inégalitaires.`,
          },
        ],
      },
      {
        id: 'catti-2-zh-fr-sec-2',
        title: 'Section 2: Chinese-to-French Translation (汉译法 40分)',
        direction: 'zh-to-fr',
        taskType: 'translation',
        timeLimitMinutes: 75,
        maxPoints: 40,
        passages: [
          {
            id: 'catti-2-zh-fr-p1',
            title: 'Passage 1: 江南水乡古镇生态与文旅融合发展',
            wordCount: 262,
            targetLanguage: 'fr',
            recommendedPace: 'Approx. 35 minutes',
            sourceText: `江南水乡古镇是农耕文明与水利治理智慧结晶的生动缩影。粉墙黛瓦、小桥流水与临河街市，构成了江南独特的审美空间。在文旅融合背景下，水乡古镇摒弃了过度商业化扩张路线，转而注重水体生态治理与民居传统工艺的精细化修缮。通过清淤治水、活水入镇，恢复了古河道澄澈清灵的生态风貌。手工作坊与传统茶肆与现代化精品民宿有机共存，吸引了四方游客慢下脚步体验诗意水乡生活。生态美景与历史文脉的和谐交融，让古老水乡焕发出持久魅力。`,
          },
          {
            id: 'catti-2-zh-fr-p2',
            title: 'Passage 2: 非物质文化遗产的现代传承与创新表达',
            wordCount: 246,
            targetLanguage: 'fr',
            recommendedPace: 'Approx. 35 minutes',
            sourceText: `非物质文化遗产是中华优秀传统文化的活态传承，凝结着千百年来劳动人民的造物智慧与审美追求。近年来，刺绣、陶瓷烧制与剪纸等传统手工艺积极拥抱现代设计理念，将古典纹样与现代日常生活用品创意结合，赢得年轻一代消费者的青睐。非遗项目走进中小学课堂与社区工坊，培养了一大批热爱传统文化的新一代传承人。通过沉浸式数字展演与跨界合作，非遗不仅活在当下，更在创新创造中展现出勃勃生机。`,
          },
        ],
      },
    ],
  },
  {
    id: 'catti-2-practical-ar-zh-v1',
    version: 2,
    rubricVersion: EXAM_RUBRIC_VERSION,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'ar',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (Arabic <-> Chinese)',
    description:
      '2023-12-25 official syllabus baseline for CATTI Arabic Level 2 《笔译实务》: 180 minutes, about 700–800 Arabic words for Arabic-to-Chinese (60 pts) and about 400–500 Chinese characters for Chinese-to-Arabic (40 pts).',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'administration-dependent',
    status: 'verified',
    authority: 'official-syllabus-baseline',
    authoritySourceDate: '2023-12-25',
    authorityNote:
      'Official ATICICG syllabus baseline published 2023-12-25. It is a dated reference, not a timeless guarantee about every later administration; section timer splits and passages are platform-authored practice parameters. Arabic source and answer fields use RTL rendering.',
    benchmarkNote:
      'Practice comparison only. CATTI thresholds depend on administration, level, paper, and region; the 2024 separate-line exception was 58 rather than a universal 60.',
    disclaimer: PRACTICE_ESTIMATE_DISCLAIMER,
    allowedAids: {
      paperDictionaryAllowed: true,
      onlineSearchAllowed: false,
      glossaryAllowed: false,
      notes:
        'Official Arabic Level 2 allows two printed paper bilingual general dictionaries (Arabic-Chinese, Chinese-Arabic). No electronic aids permitted.',
    },
    sections: [
      {
        id: 'catti-2-ar-zh-sec-1',
        title: 'Section 1: Arabic-to-Chinese Translation (阿译汉 60分)',
        direction: 'ar-to-zh',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 60,
        passages: [
          {
            id: 'catti-2-ar-zh-p1',
            title: 'Passage 1: مكافحة التصحر واستصلاح الأراضي في المناطق الجافة',
            wordCount: 380,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `تعد ظاهرة التصحر وتدهور الأراضي الزراعية في البيئات الجافة وشبه الجافة من أخطر التحديات البيئية والاقتصادية التي تواجه العديد من الدول في عصرنا الراهن. يؤدي تآكل الغطاء النباتي الطبيعي وتكرار موجات الجفاف الشديد والرعي الجائر إلى تراجع خصوبة التربة وتوسع الكثبان الرملية المتحركة، مما يهدد الأمن الغذائي والاستقرار السكاني في المناطق الريفية الهشة. ولمواجهة هذه الأزمة المتفاقمة، تبنت العديد من الحكومات استراتيجيات رائدة لإعادة التأهيل البيئي تعتمد على الزراعة المستدامة وتقنيات الري الحديثة عالية الكفاءة. ومن خلال زراعة أحزمة خضراء من الأشجار المقاومة للملوحة والجفاف، واستخدام تقنيات تثبيت الرمال البيولوجية، تمكنت المشاريع البيئية من استعادة مساحات شاسعة من الأراضي المتدهورة والحد من العواصف الترابية المدمرة. إضافة إلى ذلك، يسهم استخدام محطات تحلية المياه بالطاقة الشمسية وشبكات الري بالتنقيط في توفير مياه الري دون استنزاف المياه الجوفية غير المتجددة. إن حماية البيئات الجافة لا تقتصر على الحفاظ على التنوع الحيوي فحسب، بل تمثل ركيزة أساسية لتحقيق التنمية المستدامة وتوفير فرص العمل المجتمعية في المناطق الصحراوية.

            ولا تقتصر معالجة التصحر على تنفيذ مشروعات هندسية منفصلة، بل تحتاج إلى إدارة متكاملة للموارد الطبيعية وإلى مشاركة السكان المحليين في تحديد الأولويات. فالمزارعون الذين يعيشون بالقرب من مصادر المياه أقدر على اختيار المحاصيل الملائمة للحرارة والملوحة، كما يستطيع الرعاة تنظيم حركة القطعان بما يمنح المراعي فترة كافية للتجدد. وتساعد محطات الرصد المناخي والخرائط الرقمية على التنبؤ بموجات الجفاف وتوجيه الإغاثة قبل نفاد المخزونات الغذائية. لذلك ينبغي إنشاء بنوك محلية للبذور، وتطوير خدمات إرشاد زراعي بلغات مفهومة، وتوفير قروض صغيرة تشجع الأسر على اعتماد وسائل إنتاج أقل استهلاكاً للماء. وتؤدي إعادة استخدام المياه المعالجة وحصاد مياه الأمطار إلى تخفيف الضغط على الآبار، بينما تتيح الطاقة الشمسية تشغيل المضخات دون زيادة كبيرة في تكاليف الوقود. كما أن إشراك الجامعات ومراكز البحث في تقييم التربة ومراقبة التنوع النباتي يوفر أساساً علمياً لتحديث الخطط. وتحتاج هذه السياسات إلى تمويل مستمر وتنسيق بين الوزارات والبلديات والمنظمات الأهلية، حتى لا تبقى الأحزمة الخضراء مبادرات مؤقتة تنتهي بانتهاء المشروع. إن نجاح استصلاح الأراضي يقاس بقدرة المجتمعات على حماية مكاسبها، وتحسين دخلها، وبناء مستقبل مستقر للأجيال القادمة. وتشارك المجالس المحلية في حماية الآبار والواحات، وتضع قواعد لاستخدام المياه خلال المواسم المطرية. كما تتيح برامج التأمين الزراعي تعويض الأسر عند فقدان المحصول، وتمنحها ثقة للاستثمار في معدات موفرة للماء. ويؤدي نشر التقارير عن النتائج إلى تعزيز المساءلة، وإلى نقل التجارب الناجحة بين القرى والمناطق المتجاورة، بما يدعم تعاوناً طويل الأمد بين المجتمع والجهات المسؤولة.`,
          },
          {
            id: 'catti-2-ar-zh-p2',
            title: 'Passage 2: التبادل الحضاري والثقافي على طريق الحرير التاريخي',
            wordCount: 400,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `شكل طريق الحرير التاريخي عبر العصور جسراً حيوياً للتواصل الإنساني والتلاقح الفكري بين الحضارات الشرقية والغربية. ولم تكن القوافل التجارية التي عبرت الواحات والصحاري تنقل الحرير والتوابل والمنسوجات الثمينة فحسب، بل حملت معها المعارف العلمية والترجمات الفلسفية والابتكارات التكنولوجية مثل صناعة الورق والطباعة. وقد شهدت المدن التاريخية الواقعة على طول المسار ازدهاراً ملحوظاً في حركة الترجمة والتبادل الأكاديمي، حيث التقى العلماء والفلكيون والأطباء لتبادل الخبرات وتدوين المخطوطات التي أثرت التراث الفكري البشري بأكمله. واليوم، تكتسب إحياء روح التبادل الثقافي أهمية متجددة في ظل العولمة المعاصرة، إذ تسعى الدول إلى تعزيز الحوار بين الثقافات وبناء شراكات وثيقة في مجالات التعليم والفنون والبحث العلمي. إن تعميق التفاهم المتبادل واحترام التنوع الحضاري هما السبيل الأمثل لترسيخ السلام العالمي وتعزيز التعاون الاقتصادي الشامل بين الشعوب.

وتساعد دراسة هذا التاريخ على فهم أن ازدهار المدن لم يكن نتيجة التجارة وحدها، بل ثمرة شبكات معقدة من الثقة والقواعد والخدمات التي وفرت الحماية للمسافرين. فقد أقيمت الخانات والآبار ومراكز البريد على مسافات متقاربة، وأصبحت الأسواق أماكن لتبادل السلع واللغات والعادات، بينما ساهم المترجمون في نقل المصطلحات والأفكار بين المجتمعات. وتوضح الوثائق الباقية أن النساء والحرفيين والمزارعين شاركوا أيضاً في هذه الحركة، فلم تكن القوافل شأناً يخص الحكام والتجار الكبار فقط. ومن خلال ترميم المواقع الأثرية وإنشاء مسارات ثقافية مشتركة تستطيع المدن الحديثة تحويل الذاكرة التاريخية إلى مورد تعليمي واقتصادي مستدام، شرط أن تحافظ على أصالة المكان وألا تختزل الثقافات في عروض سطحية.

ويتطلب التعاون الثقافي المعاصر إعداد مشاريع طويلة الأجل تشارك فيها المتاحف والجامعات والمنظمات المحلية. ويمكن للمعارض المتنقلة والبرامج التعليمية الرقمية أن تصل إلى الشباب في المناطق البعيدة، وأن تعرفهم بالمخطوطات واللغات والفنون التي نشأت على طرق التبادل القديمة. كما تتيح قواعد البيانات المفتوحة للباحثين مقارنة الروايات والقطع الأثرية، وتساعد على منع الاتجار غير المشروع بالممتلكات الثقافية. ويظل احترام ملكية المجتمعات لموروثها شرطاً أساسياً لأي شراكة دولية، إذ ينبغي أن تعود عائدات السياحة إلى حماية المواقع وتحسين حياة السكان.

            وعندما يجتمع الحوار التاريخي مع الابتكار التقني، يصبح طريق الحرير مساحة للتعلم المتبادل لا مجرد صورة رومانسية للماضي. إن حماية التراث مسؤولية مشتركة تتطلب قوانين واضحة، وتمويلاً شفافاً، وتدريباً متخصصاً في الترميم والترجمة وإدارة المتاحف. وبهذه الوسائل يمكن للأجيال الجديدة أن ترى في التنوع الثقافي مصدراً للإبداع والسلام، وأن تبني علاقات تقوم على المعرفة والاحترام بدلاً من العزلة وسوء الفهم. وتسهم برامج التبادل الطلابي وورش الترجمة في تحويل هذا التراث إلى تجربة حية، وتمنح المجتمعات الصغيرة صوتاً في صياغة صورتها أمام العالم. وتحمي حقوق أصحاب الحرف والقصص المحلية وتدعم اقتصاداً متوازناً يحترم البيئة ويشجع على التعلم المستمر.`,
          },
        ],
      },
      {
        id: 'catti-2-zh-ar-sec-2',
        title: 'Section 2: Chinese-to-Arabic Translation (汉译阿 40分)',
        direction: 'zh-to-ar',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 40,
        passages: [
          {
            id: 'catti-2-zh-ar-p1',
            title: 'Passage 1: 中国茶文化与传统制茶技艺的历史源流',
            wordCount: 200,
            targetLanguage: 'ar',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `中国茶文化源远流长，历经数千年的沉淀与演进，已深深融入中华民族的日常生活与精神追求之中。古人以茶会友、以茶修身，将和敬清寂的哲学理念赋予一片东方树叶。从绿茶的清雅、红茶的醇厚到乌龙茶的芬芳，传统制茶技艺凝聚着世代茶农对自然时令与火候工艺的深刻领悟。采茶、杀青、揉捻与烘焙等数十道工序环环相扣，造就了品类丰富、香气各异的茶中佳品。近年来，中国传统制茶技艺及其相关习俗成功列入人类非物质文化遗产代表作名录，茶文化正跨越山海走向世界，成为促进中外民心相通与文明互鉴的亮丽名片。`,
          },
          {
            id: 'catti-2-zh-ar-p2',
            title: 'Passage 2: 高铁技术与现代交通网络的创新突破',
            wordCount: 250,
            targetLanguage: 'ar',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `高速铁路作为现代综合交通枢纽的重要骨干，深刻重塑着区域经济地理格局与人们的出行方式。凭借自主创新研发，中国高铁攻克了高寒冻土、湿陷性黄土及复杂山区桥隧建设等一系列世界级工程技术难题，建成了世界上规模最大、运营速度最高的高铁网络。“千里江陵一日还”的诗意畅想已成为现代人触手可及的出行日常。高铁不仅大幅压缩了城市之间的时空距离，促进了人员、资金与技术要素的高效流动，更以其低碳绿色的显著优势为节能减排提供了有力支撑。`,
          },
        ],
      },
    ],
  },
]

// The former generic MTI 357 baseline is intentionally not shipped. MTI 357
// profiles require a named university and admission year because task counts
// and structures vary across admitting institutions.
export const DEPRECATED_EXAM_PROFILE_IDS = ['mti-357-foundation-en-zh-v1'] as const

export async function initExamProfiles(databaseApi: {
  listExamProfiles: () => Promise<ExamProfile[]>
  saveExamProfile: (profile: ExamProfile) => Promise<void>
}): Promise<ExamProfile[]> {
  const existing = await databaseApi.listExamProfiles()
  if (existing.length === 0) {
    for (const profile of DEFAULT_EXAM_PROFILES) {
      await databaseApi.saveExamProfile(profile)
    }
    return DEFAULT_EXAM_PROFILES
  }
  return existing
}

import type { ExamProfile } from '../domain/types'
import {
  PRACTICE_ESTIMATE_DISCLAIMER,
  PROVISIONAL_DRAFT_NOTICE,
} from '../domain/exam'

export const DEFAULT_EXAM_PROFILES: ExamProfile[] = [
  {
    id: 'catti-2-practical-en-zh-v1',
    version: 1,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (English <-> Chinese)',
    description:
      'Standard professional examination simulation for CATTI English Level 2 《笔译实务》. Comprises 2 English-to-Chinese passages (~940 words total) and 2 Chinese-to-English passages (~600 characters total).',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'fixed-60-percent',
    status: 'verified',
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

To reconcile these tensions, multilateral trade coalitions are exploring standardized digital consignment notes and harmonized border clearing frameworks. These protocols aim to facilitate seamless interchange between maritime carriers and rail operators without requiring repeated physical container inspections. When real-time environmental sensors and verified emission metrics are embedded directly into multimodal freight tracking, shippers gain transparent visibility into Scope 3 transport footprints. The long-term viability of international commerce will hinge on whether freight architecture can evolve from vulnerable, isolated shipping channels into an agile, decarbonized, and deeply resilient multimodal tapestry.`,
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

Financial institutions and environmental regulators are also demanding comprehensive lifecycle ecological evaluations prior to granting seabed licensing concessions. Marine acoustic disturbances generated during pile anchoring can disrupt cetacean navigational corridors, while electromagnetic fields emitted by unburied high-voltage cables may alter benthic migratory behavior. Sustainable ocean energy development requires maritime engineers, grid planners, and marine conservation biologists to collaborate closely. Only through modular standardized converter engineering, environmentally sensitive seabed anchoring, and resilient transmission topologies can offshore wind mature into a cornerstone of deep decarbonization.`,
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
    id: 'mti-357-foundation-en-zh-v1',
    version: 1,
    examType: 'MTI',
    level: 'MTI 357',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    title: 'MTI 357 English Translation Foundation Guidance Baseline',
    description:
      'National MTI Education Steering Committee guidance baseline simulation for Master of Translation and Interpreting Paper 357 《英语翻译基础》. Comprises Terminology Translation (30 terms, 30 points) and Passage Translation (120 points).',
    totalDurationMinutes: 180,
    maxTotalPoints: 150,
    passBenchmarkPoints: 80,
    benchmarkType: 'national-line-estimate',
    status: 'provisional_draft',
    provisionalDetails: {
      isStructureProvisional: true,
      isTimingProvisional: true,
      isBenchmarkProvisional: true,
      notes: [
        'MTI 357 papers are formulated autonomously by individual admitting universities (院校自主命题).',
        'Terminology counts (30 terms) and passage splits represent the National MTI Education Steering Committee Guidance Syllabus (教指委指导大纲标准模版), but specific universities vary (e.g. 20-40 terms, differing word limits).',
        'The 80-point pass threshold is a provisional estimate based on recent national graduate entrance minimum score lines (单科线 71-83分); individual university re-examination cutoffs (复试线) vary widely.',
      ],
    },
    disclaimer: `${PRACTICE_ESTIMATE_DISCLAIMER} ${PROVISIONAL_DRAFT_NOTICE}`,
    allowedAids: {
      paperDictionaryAllowed: false,
      onlineSearchAllowed: false,
      glossaryAllowed: false,
      notes:
        'Strictly closed-book (闭卷). No paper dictionaries, glossaries, or electronic devices of any kind are permitted in national graduate entrance examination halls.',
    },
    sections: [
      {
        id: 'mti-357-sec-1-terminology',
        title: 'Section 1: Terminology Translation (词语翻译)',
        direction: 'bidirectional',
        taskType: 'terminology',
        timeLimitMinutes: 35,
        maxPoints: 30,
        isProvisional: true,
        provisionalNotes:
          'Standard Steering Committee template: 15 English-to-Chinese terms (15 pts) and 15 Chinese-to-English terms (15 pts). Format and count may vary by admitting university.',
        passages: [
          {
            id: 'mti-357-term-e-c',
            title: 'Part A: English-to-Chinese Terminology (英译汉 15题)',
            wordCount: 15,
            targetLanguage: 'zh',
            recommendedPace: '15-18 minutes',
            isProvisional: true,
            sourceText: `Translate the following 15 terms/acronyms into Chinese (1 point each):
1. carbon neutrality
2. supply chain resilience
3. artificial general intelligence (AGI)
4. circular economy
5. global value chain
6. green finance
7. multilateralism
8. digital divide
9. clean energy transition
10. intellectual property rights
11. food security
12. biodiversity conservation
13. carbon border adjustment mechanism (CBAM)
14. cross-border e-commerce
15. algorithmic transparency`,
          },
          {
            id: 'mti-357-term-c-e',
            title: 'Part B: Chinese-to-English Terminology (汉译英 15题)',
            wordCount: 15,
            targetLanguage: 'en',
            recommendedPace: '15-18 minutes',
            isProvisional: true,
            sourceText: `Translate the following 15 terms into English (1 point each):
1. 新质生产力
2. 人类命运共同体
3. 乡村振兴
4. 绿水青山就是金山银山
5. 碳达峰碳中和
6. 一带一路倡议
7. 实体经济
8. 专精特新企业
9. 数字经济
10. 共同富裕
11. 高质量发展
12. 区域全面经济伙伴关系协定 (RCEP)
13. 全过程人民民主
14. 文化传承发展
15. 生态文明建设`,
          },
        ],
      },
      {
        id: 'mti-357-sec-2-en-zh',
        title: 'Section 2: English-to-Chinese Passage Translation (英译汉篇章)',
        direction: 'en-to-zh',
        taskType: 'translation',
        timeLimitMinutes: 70,
        maxPoints: 60,
        passages: [
          {
            id: 'mti-357-p-en-zh',
            title: 'Passage Translation: Artificial Intelligence Ethics and Algorithmic Governance',
            wordCount: 326,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 70 minutes',
            sourceText: `As foundation models and autonomous algorithmic systems permeate public administration, financial risk profiling, and medical diagnostic pathways, the imperative to establish verifiable ethical guardrails has transcended theoretical debate. Generative architectures are capable of synthesizing articulate narratives and orchestrating complex cognitive tasks, yet their internal reasoning pathways frequently remain opaque black boxes. When automated models inadvertently amplify historical statistical biases encoded in legacy training corpora, discriminatory outcomes can be systematized across lending decisions, judicial sentencing algorithms, and automated hiring pipelines.

Crucially, the rapid proliferation of synthetic media and cognitive automation challenges foundational doctrines of legal liability and human agency. In traditional jurisprudence, accountability resides with identifiable natural persons or corporate entities exercising demonstrable intent and oversight. By contrast, when an autonomous neural model produces hallucinated defamation or executes high-frequency trades triggering catastrophic market flash crashes, allocating moral culpability and economic redress becomes profoundly contentious. Technologists, legal scholars, and sovereign regulatory bodies increasingly debate whether developer oversight, deployment telemetry, or end-user instructions should bear primary liability.

To counter these systemic vulnerabilities, international regulatory standards are transitioning from voluntary corporate guidelines toward mandatory conformity assessments and algorithmic audits. Leading frameworks demand rigorous post-deployment monitoring, bias mitigation documentation, and explainability mechanisms for high-risk artificial intelligence applications. Machine learning engineers must prioritize dataset curation provenance and design adversarial testing protocols that stress-test models against deceptive prompts and catastrophic failure modes. Ultimately, technical innovation cannot be pursued in an institutional vacuum. Building trustworthy artificial intelligence requires aligning cutting-edge computational architectures with inviolable democratic values, fundamental human dignity, and robust public oversight.`,
          },
        ],
      },
      {
        id: 'mti-357-sec-3-zh-en',
        title: 'Section 3: Chinese-to-English Passage Translation (汉译英篇章)',
        direction: 'zh-to-en',
        taskType: 'translation',
        timeLimitMinutes: 75,
        maxPoints: 60,
        passages: [
          {
            id: 'mti-357-p-zh-en',
            title: 'Passage Translation: 紧凑型城市与宜居韧性社区建设',
            wordCount: 224,
            targetLanguage: 'en',
            recommendedPace: 'Approx. 75 minutes',
            sourceText: `现代城市发展正加速由外延式规模扩张向内涵式品质提升转变。在紧凑集约理念引领下，城市规划更加注重存量空间有机更新与公共服务均衡配置。打造集交通、商业、休闲与便民养老于一体的“十五分钟社区生活圈”，不仅大幅削减了市民长距离通勤的时间成本与碳排放，更重构了邻里互动与熟人社会的温情纽带。增强城市内生韧性同样要求完善地下综合管廊、雨水调蓄设施与应急避难场所，确保极端天气和突发灾害面前城市系统安全平稳运转。只有将精细化治理绣花功夫融入城市更新肌理，方能绘就生态宜居与人文关怀交相辉映的现代化城市新画卷。`,
          },
        ],
      },
    ],
  },
  {
    id: 'catti-2-practical-fr-zh-v1',
    version: 1,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'fr',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (French <-> Chinese Draft)',
    description:
      'Provisional profile draft for CATTI French Level 2 《笔译实务》. Features official ATICICG 60/40 point weighting (60 pts French-to-Chinese, 40 pts Chinese-to-French).',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'fixed-60-percent',
    status: 'provisional_draft',
    provisionalDetails: {
      isStructureProvisional: true,
      notes: [
        'French Level 2 实务 official weighting is 60 pts (Section 1: 法译汉) and 40 pts (Section 2: 汉译法), unlike the English 50/50 division.',
        'Word counts and passage sub-timings are provisional drafts modeled on published ATICICG French syllabus guidance.',
      ],
    },
    disclaimer: `${PRACTICE_ESTIMATE_DISCLAIMER} ${PROVISIONAL_DRAFT_NOTICE}`,
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
            sourceText: `L'océan mondial constitue le poumon écologique de notre planète et le régulateur thermique central des équilibres climatiques globaux. Absorbant plus de quatre-vingt-dix pour cent de l'excédent thermique généré par l'effet de serre et séquestrant des milliards de tonnes de dioxyde de carbone, les écosystèmes océaniques subissent pourtant une pression anthropique sans précédent. L'acidification croissante des eaux côtières, la prolifération de microparticules plastiques et la surpêche industrielle menacent d'anéantir la biodiversité des récifs coralliens et de désorganiser les chaînes trophiques pélagiques. Face à cette dégradation alarmante, les nations maritimes s'orientent vers un nouveau modèle de développement : l'économie bleue durable. Ce paradigme novateur postule que la prospérité économique littorale ne saurait s'obtenir au détriment de l'intégrité biologique marine. Le déploiement d'aires marines protégées hautement surveillées, la conversion écologique des flottes de pêche artisanale et le développement raisonné de l'aquaculture multitrophique intégrée permettent de restaurer les stocks halieutiques tout en sécurisant les moyens de subsistance des communautés côtières. Par ailleurs, l'innovation biotechnologique marine offre des perspectives thérapeutiques et énergétiques considérables à travers la valorisation des microalgues et des enzymes marines extrémophiles. Concilier rigueur scientifique et souveraineté économique maritime représente désormais une priorité stratégique pour la gouvernance mondiale des océans.`,
          },
          {
            id: 'catti-2-fr-zh-p2',
            title: 'Passage 2: L’essor de la mobilité ferroviaire et la décarbonation urbaine',
            wordCount: 394,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 50 minutes',
            sourceText: `La transition écologique des grandes métropoles européennes exige une refonte radicale des infrastructures de transport terrestre, traditionnellement dominées par l'automobile individuelle. Responsable d'une part substantielle des émissions de polluants atmosphériques et de particules fines, le trafic routier congestionne les artères urbaines et altère durablement la santé publique des résidents. En réponse, les autorités métropolitaines investissent massivement dans la modernisation des réseaux ferrés régionaux et l'extension des lignes de tramway à propulsion électrique. Le transport ferroviaire présente une efficacité énergétique inégalée et une empreinte carbone par passager-kilomètre considérablement inférieure à celle des autres modes motorisés. L'interconnexion fluide entre gares multimodales, pistes cyclables sécurisées et parcs de stationnement incitatifs encourage les usagers pendulaires à délaisser leur véhicule thermique. Toutefois, la massification du transport public sur rail requiert une maintenance préventive rigoureuse et des investissements substantiels dans la signalisation numérique automatisée. L'adoption d'horaires cadencés et la tarification solidaire contribuent à garantir l'accessibilité sociale de ces réseaux écologiques. C'est en repensant l'aménagement spatial autour des axes ferroviaires structurants que les villes contemporaines parviendront à concilier fluidité des déplacements et neutralité climatique durable.`,
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
    version: 1,
    examType: 'CATTI',
    level: 'Level 2',
    sourceLanguage: 'ar',
    targetLanguage: 'zh',
    title: 'CATTI Level 2 Translation Practice (Arabic <-> Chinese Draft)',
    description:
      'Provisional profile draft for CATTI Arabic Level 2 《笔译实务》. Fully supports Right-to-Left (RTL) Arabic text rendering with balanced 50/50 point weighting.',
    totalDurationMinutes: 180,
    maxTotalPoints: 100,
    passBenchmarkPoints: 60,
    benchmarkType: 'fixed-60-percent',
    status: 'provisional_draft',
    provisionalDetails: {
      isStructureProvisional: true,
      notes: [
        'Arabic Level 2 实务 passage distribution and point splits represent provisional drafts pending publication of updated ATICICG Arabic syllabus criteria.',
        'Directional text rendering (RTL) is active for Arabic source and translation editors.',
      ],
    },
    disclaimer: `${PRACTICE_ESTIMATE_DISCLAIMER} ${PROVISIONAL_DRAFT_NOTICE}`,
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
        title: 'Section 1: Arabic-to-Chinese Translation (阿译汉 50分)',
        direction: 'ar-to-zh',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 50,
        passages: [
          {
            id: 'catti-2-ar-zh-p1',
            title: 'Passage 1: مكافحة التصحر واستصلاح الأراضي في المناطق الجافة',
            wordCount: 408,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `تعد ظاهرة التصحر وتدهور الأراضي الزراعية في البيئات الجافة وشبه الجافة من أخطر التحديات البيئية والاقتصادية التي تواجه العديد من الدول في عصرنا الراهن. يؤدي تآكل الغطاء النباتي الطبيعي وتكرار موجات الجفاف الشديد والرعي الجائر إلى تراجع خصوبة التربة وتوسع الكثبان الرملية المتحركة، مما يهدد الأمن الغذائي والاستقرار السكاني في المناطق الريفية الهشة. ولمواجهة هذه الأزمة المتفاقمة، تبنت العديد من الحكومات استراتيجيات رائدة لإعادة التأهيل البيئي تعتمد على الزراعة المستدامة وتقنيات الري الحديثة عالية الكفاءة. ومن خلال زراعة أحزمة خضراء من الأشجار المقاومة للملوحة والجفاف، واستخدام تقنيات تثبيت الرمال البيولوجية، تمكنت المشاريع البيئية من استعادة مساحات شاسعة من الأراضي المتدهورة والحد من العواصف الترابية المدمرة. إضافة إلى ذلك، يسهم استخدام محطات تحلية المياه بالطاقة الشمسية وشبكات الري بالتنقيط في توفير مياه الري دون استنزاف المياه الجوفية غير المتجددة. إن حماية البيئات الجافة لا تقتصر على الحفاظ على التنوع الحيوي فحسب، بل تمثل ركيزة أساسية لتحقيق التنمية المستدامة وتوفير فرص العمل المجتمعية في المناطق الصحراوية.`,
          },
          {
            id: 'catti-2-ar-zh-p2',
            title: 'Passage 2: التبادل الحضاري والثقافي على طريق الحرير التاريخي',
            wordCount: 395,
            targetLanguage: 'zh',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `شكل طريق الحرير التاريخي عبر العصور جسراً حيوياً للتواصل الإنساني والتلاقح الفكري بين الحضارات الشرقية والغربية. ولم تكن القوافل التجارية التي عبرت الواحات والصحاري تنقل الحرير والتوابل والمنسوجات الثمينة فحسب، بل حملت معها المعارف العلمية والترجمات الفلسفية والابتكارات التكنولوجية مثل صناعة الورق والطباعة. وقد شهدت المدن التاريخية الواقعة على طول المسار ازدهاراً ملحوظاً في حركة الترجمة والتبادل الأكاديمي، حيث التقى العلماء والفلكيون والأطباء لتبادل الخبرات وتدوين المخطوطات التي أثرت التراث الفكري البشري بأكمله. واليوم، تكتسب إحياء روح التبادل الثقافي أهمية متجددة في ظل العولمة المعاصرة، إذ تسعى الدول إلى تعزيز الحوار بين الثقافات وبناء شراكات وثيقة في مجالات التعليم والفنون والبحث العلمي. إن تعميق التفاهم المتبادل واحترام التنوع الحضاري هما السبيل الأمثل لترسيخ السلام العالمي وتعزيز التعاون الاقتصادي الشامل بين الشعوب.`,
          },
        ],
      },
      {
        id: 'catti-2-zh-ar-sec-2',
        title: 'Section 2: Chinese-to-Arabic Translation (汉译阿 50分)',
        direction: 'zh-to-ar',
        taskType: 'translation',
        timeLimitMinutes: 90,
        maxPoints: 50,
        passages: [
          {
            id: 'catti-2-zh-ar-p1',
            title: 'Passage 1: 中国茶文化与传统制茶技艺的历史源流',
            wordCount: 302,
            targetLanguage: 'ar',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `中国茶文化源远流长，历经数千年的沉淀与演进，已深深融入中华民族的日常生活与精神追求之中。古人以茶会友、以茶修身，将和敬清寂的哲学理念赋予一片东方树叶。从绿茶的清雅、红茶的醇厚到乌龙茶的芬芳，传统制茶技艺凝聚着世代茶农对自然时令与火候工艺的深刻领悟。采茶、杀青、揉捻与烘焙等数十道工序环环相扣，造就了品类丰富、香气各异的茶中佳品。近年来，中国传统制茶技艺及其相关习俗成功列入人类非物质文化遗产代表作名录，茶文化正跨越山海走向世界，成为促进中外民心相通与文明互鉴的亮丽名片。`,
          },
          {
            id: 'catti-2-zh-ar-p2',
            title: 'Passage 2: 高铁技术与现代交通网络的创新突破',
            wordCount: 298,
            targetLanguage: 'ar',
            recommendedPace: 'Approx. 45 minutes',
            sourceText: `高速铁路作为现代综合交通枢纽的重要骨干，深刻重塑着区域经济地理格局与人们的出行方式。凭借自主创新研发，中国高铁攻克了高寒冻土、湿陷性黄土及复杂山区桥隧建设等一系列世界级工程技术难题，建成了世界上规模最大、运营速度最高的高铁网络。“千里江陵一日还”的诗意畅想已成为现代人触手可及的出行日常。高铁不仅大幅压缩了城市之间的时空距离，促进了人员、资金与技术要素的高效流动，更以其低碳绿色的显著优势为节能减排提供了有力支撑。`,
          },
        ],
      },
    ],
  },
]

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

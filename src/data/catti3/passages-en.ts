import type { Catti3Passage } from './types'

/** English source passages (英译汉). Original, CATTI Level 3 style. */
export const EN_PASSAGES: Catti3Passage[] = [
  {
    id: 'en-urban-heat-islands',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'Why Cities Are Getting Hotter',
    topic: 'Climate and cities',
    genre: 'science',
    usage: 'practice',
    paragraphs: [
      {
        source: 'On a hot summer afternoon, the centre of a large city can be several degrees warmer than the surrounding countryside. Scientists call this phenomenon the “urban heat island” effect. It occurs because roads, roofs and pavements absorb sunlight during the day and release the heat slowly at night, while cars, air conditioners and factories add even more heat to the air.',
        reference: {
          zh: '在炎热的夏日午后，大城市中心的气温可能比周边乡村高出好几度。科学家把这种现象称为“城市热岛效应”。造成这一现象的原因是，道路、屋顶和人行道在白天吸收阳光，夜间又缓慢地释放热量，而汽车、空调和工厂则向空气中排放更多的热量。',
        },
      },
      {
        source: 'The effect is more than a matter of comfort. Higher temperatures increase demand for electricity, worsen air pollution and put vulnerable groups, such as the elderly and people with heart disease, at greater risk. During heatwaves, hospitals in many cities report a sharp rise in admissions for heat-related illnesses.',
        reference: {
          zh: '这一效应不仅仅关系到人们是否感到舒适。气温升高会增加电力需求，加剧空气污染，并使老年人和心脏病患者等弱势群体面临更大的风险。在热浪期间，许多城市的医院都报告称，因与高温相关的疾病而入院的人数急剧上升。',
        },
      },
      {
        source: 'Fortunately, there are practical ways to cool cities down. Planting trees along streets provides shade and releases moisture into the air. “Green roofs” covered with plants and “cool roofs” painted in light colours can reflect sunlight instead of absorbing it. Some cities have also redesigned public squares to include fountains, lawns and permeable surfaces that allow rainwater to soak into the ground.',
        reference: {
          zh: '幸运的是，有一些切实可行的办法可以为城市降温。在街道两旁植树既能提供遮阴，又能向空气中释放水分。覆盖植物的“绿色屋顶”和涂成浅色的“冷屋顶”能够反射而不是吸收阳光。一些城市还重新设计了公共广场，增设喷泉、草坪和透水地面，让雨水能够渗入地下。',
        },
      },
      {
        source: 'Experts say that such measures work best when they are part of long-term urban planning rather than isolated projects. As climate change makes heatwaves more frequent and more intense, designing cities that stay cool may become one of the most important tasks for local governments in the coming decades.',
        reference: {
          zh: '专家表示，这些措施只有纳入长期城市规划，而不是作为孤立的项目来实施，才能发挥最大效果。随着气候变化导致热浪更加频繁、更加猛烈，建设能够保持凉爽的城市，可能会成为未来几十年地方政府最重要的任务之一。',
        },
      },
    ],
    keyTerms: [
      { source: 'urban heat island', accepted: { zh: ['热岛'] } },
      { source: 'heatwave', accepted: { zh: ['热浪'] } },
      { source: 'vulnerable groups', accepted: { zh: ['弱势群体', '易受影响', '脆弱群体'] } },
      { source: 'green roofs', accepted: { zh: ['绿色屋顶', '屋顶绿化'] } },
      { source: 'permeable surfaces', accepted: { zh: ['透水'] } },
      { source: 'urban planning', accepted: { zh: ['城市规划'] } },
      { source: 'climate change', accepted: { zh: ['气候变化'] } },
    ],
  },
  {
    id: 'en-food-waste',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'The Hidden Cost of Food Waste',
    topic: 'Food and environment',
    genre: 'report',
    usage: 'practice',
    paragraphs: [
      {
        source: 'Roughly one third of all the food produced in the world is lost or wasted every year, according to widely cited estimates by the United Nations. At the same time, hundreds of millions of people do not have enough to eat. This contrast has made food waste one of the most discussed issues in global food security.',
        reference: {
          zh: '根据联合国被广泛引用的估算，全世界每年生产的粮食中约有三分之一被损失或浪费。与此同时，仍有数亿人吃不饱饭。这种反差使粮食浪费成为全球粮食安全领域最受关注的问题之一。',
        },
      },
      {
        source: 'Food is lost at every stage of the supply chain. In developing countries, much of it spoils after harvest because of poor storage facilities and a lack of refrigerated transport. In richer countries, the largest share is thrown away by shops, restaurants and households, often simply because it does not look perfect or has passed its “best before” date.',
        reference: {
          zh: '粮食在供应链的每一个环节都会发生损失。在发展中国家，由于储存设施落后、冷藏运输不足，大量粮食在收获后就腐烂变质。而在较富裕的国家，被浪费最多的是商店、餐馆和家庭丢弃的食物，原因往往只是外观不够完美，或者已经过了“最佳食用日期”。',
        },
      },
      {
        source: 'The consequences go far beyond the dinner table. Producing food that nobody eats wastes water, land and energy, and rotting food in landfills releases methane, a powerful greenhouse gas. Some researchers estimate that if food waste were a country, it would be among the world’s largest emitters of greenhouse gases.',
        reference: {
          zh: '其影响远远超出了餐桌。生产无人食用的食物，浪费了水、土地和能源；而垃圾填埋场中腐烂的食物会释放甲烷，这是一种强效温室气体。一些研究人员估计，如果把粮食浪费看作一个国家，它将跻身全球温室气体排放大国之列。',
        },
      },
      {
        source: 'Governments, businesses and consumers are all starting to respond. Some countries have passed laws requiring supermarkets to donate unsold food to charities, while apps now connect restaurants with customers who want to buy leftover meals at a discount. Experts stress, however, that lasting change will depend on everyday habits: planning meals, buying only what we need and making use of leftovers.',
        reference: {
          zh: '各国政府、企业和消费者都已开始采取行动。一些国家通过法律，要求超市把卖不出去的食品捐给慈善机构；还有一些应用程序把餐馆和希望以折扣价购买剩余餐食的顾客联系起来。不过专家强调，能否实现持久的改变，取决于人们的日常习惯：合理安排饮食、按需购买、充分利用剩菜剩饭。',
        },
      },
    ],
    keyTerms: [
      { source: 'food security', accepted: { zh: ['粮食安全'] } },
      { source: 'supply chain', accepted: { zh: ['供应链'] } },
      { source: 'refrigerated transport', accepted: { zh: ['冷藏', '冷链'] } },
      { source: 'best before date', accepted: { zh: ['最佳食用', '保质期', '赏味期'] } },
      { source: 'methane', accepted: { zh: ['甲烷'] } },
      { source: 'greenhouse gas', accepted: { zh: ['温室气体'] } },
      { source: 'landfill', accepted: { zh: ['填埋'] } },
    ],
  },
  {
    id: 'en-remote-work',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'Working From Home, Five Years On',
    topic: 'Work and society',
    genre: 'society',
    usage: 'practice',
    paragraphs: [
      {
        source: 'When offices around the world closed in 2020, millions of employees suddenly found themselves working from kitchen tables and spare bedrooms. Many expected the arrangement to be temporary. Five years later, however, remote and hybrid work have become a permanent feature of the labour market in many countries.',
        reference: {
          zh: '2020年，世界各地的办公室纷纷关闭，数以百万计的员工突然发现自己要在厨房餐桌旁或空闲的卧室里办公。许多人原以为这只是权宜之计。然而五年过去了，远程办公和混合办公已经成为许多国家劳动力市场的常态。',
        },
      },
      {
        source: 'Supporters argue that working from home saves time and money on commuting, gives parents more flexibility and allows companies to hire talent regardless of location. Surveys suggest that a large majority of employees who can work remotely would prefer to do so at least part of the week.',
        reference: {
          zh: '支持者认为，居家办公可以节省通勤的时间和费用，让为人父母者有更大的灵活性，也使企业能够不受地域限制地招揽人才。调查显示，在能够远程办公的员工中，绝大多数人希望每周至少有几天居家办公。',
        },
      },
      {
        source: 'Critics, on the other hand, worry about the effects on teamwork, training and company culture. Young employees in particular may miss the chance to learn from experienced colleagues, and some people report feeling isolated or finding it hard to separate work from private life.',
        reference: {
          zh: '另一方面，批评者担心远程办公会对团队协作、员工培训和企业文化产生不利影响。年轻员工尤其可能失去向经验丰富的同事学习的机会；还有一些人表示感到孤独，或者难以把工作和私人生活分开。',
        },
      },
      {
        source: 'As a result, many organisations are experimenting with compromises, such as requiring staff to come into the office on fixed days. The debate is far from settled, but one thing seems clear: the traditional five-day office week is unlikely to return in its old form.',
        reference: {
          zh: '因此，许多机构正在尝试折中办法，比如要求员工在固定的日子到办公室上班。这场争论远未尘埃落定，但有一点似乎是明确的：传统的每周五天坐班制不太可能以原有的形式回归。',
        },
      },
    ],
    keyTerms: [
      { source: 'hybrid work', accepted: { zh: ['混合办公', '混合工作', '混合式'] } },
      { source: 'remote', accepted: { zh: ['远程'] } },
      { source: 'labour market', accepted: { zh: ['劳动力市场', '就业市场'] } },
      { source: 'commuting', accepted: { zh: ['通勤'] } },
      { source: 'company culture', accepted: { zh: ['企业文化', '公司文化'] } },
      { source: 'isolated', accepted: { zh: ['孤独', '孤立'] } },
    ],
  },
  {
    id: 'en-digital-museums',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'Museums Go Digital',
    topic: 'Culture and technology',
    genre: 'culture',
    usage: 'practice',
    paragraphs: [
      {
        source: 'For centuries, visiting a museum meant travelling to a particular building and looking at objects behind glass. Today, a growing number of museums are opening their collections to anyone with an internet connection. High-resolution images, virtual tours and online exhibitions allow people to explore famous artworks and historical relics from their own homes.',
        reference: {
          zh: '几百年来，参观博物馆意味着要专程前往某座建筑，隔着玻璃观看展品。如今，越来越多的博物馆正在向所有能上网的人开放藏品。借助高清图片、虚拟导览和网上展览，人们足不出户就能欣赏著名的艺术品和历史文物。',
        },
      },
      {
        source: 'Digital technology also helps museums protect fragile objects. By creating detailed three-dimensional scans, curators can record the exact condition of a painting or a sculpture and monitor even tiny changes over time. These digital records can be extremely valuable if an object is damaged by fire, flood or war.',
        reference: {
          zh: '数字技术还能帮助博物馆保护易损的文物。通过制作精细的三维扫描图像，策展人可以准确记录一幅画作或一件雕塑的状况，并长期监测其哪怕极其细微的变化。一旦文物因火灾、洪水或战争而受损，这些数字档案就会显得极其珍贵。',
        },
      },
      {
        source: 'Some museums have gone further, using virtual reality and interactive games to attract younger audiences. Visitors can “walk” through an ancient city, handle a virtual copy of a rare vase or follow an artist’s brushstrokes step by step. Supporters say such experiences make history and art more engaging and accessible.',
        reference: {
          zh: '一些博物馆走得更远，利用虚拟现实和互动游戏吸引年轻观众。参观者可以“漫步”于古城之中，把玩一件珍稀花瓶的虚拟复制品，或者一步步追随艺术家的笔触。支持者认为，这样的体验能让历史和艺术更具吸引力，也更容易为大众所接触。',
        },
      },
      {
        source: 'Yet many curators insist that digital displays cannot fully replace the real thing. Standing in front of an original work, they argue, creates a sense of connection with the past that no screen can reproduce. For most museums, the goal is not to choose between the physical and the digital, but to make each support the other.',
        reference: {
          zh: '然而，许多策展人坚持认为，数字展示无法完全取代实物。他们指出，站在原作面前所产生的那种与历史相连的感觉，是任何屏幕都无法复制的。对大多数博物馆来说，目标并不是在实体与数字之间二选一，而是让二者相辅相成。',
        },
      },
    ],
    keyTerms: [
      { source: 'collections', accepted: { zh: ['藏品', '馆藏'] } },
      { source: 'virtual tours', accepted: { zh: ['虚拟导览', '虚拟参观', '虚拟游览', '云参观'] } },
      { source: 'historical relics', accepted: { zh: ['文物'] } },
      { source: 'three-dimensional scans', accepted: { zh: ['三维', '3d', '3D'] } },
      { source: 'curators', accepted: { zh: ['策展人', '馆员', '研究员'] } },
      { source: 'virtual reality', accepted: { zh: ['虚拟现实', 'vr', 'VR'] } },
    ],
  },

  // ---- Exam passages (CATTI 3 profiles only) ----
  {
    id: 'en-exam-1',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'Recycling the Batteries of Electric Cars',
    topic: 'Energy and industry',
    genre: 'economy',
    usage: 'exam',
    paragraphs: [
      {
        source: 'Sales of electric vehicles have grown rapidly over the past decade, as governments encourage cleaner transport and battery prices fall. This success, however, raises a question that is only beginning to receive serious attention: what will happen to millions of car batteries when they reach the end of their useful life?',
        reference: {
          zh: '过去十年间，随着各国政府鼓励清洁交通、电池价格不断下降，电动汽车的销量迅速增长。然而，这一成功也引出了一个刚刚开始受到认真关注的问题：数以百万计的汽车电池在使用寿命结束后该如何处置？',
        },
      },
      {
        source: 'A typical electric car battery lasts between eight and fifteen years. Even after it can no longer power a vehicle efficiently, it usually retains around 70 to 80 percent of its original capacity. Such batteries can be given a “second life”, for example by storing electricity generated by solar panels or providing backup power for buildings.',
        reference: {
          zh: '电动汽车电池的使用寿命一般为八到十五年。即便已无法高效驱动车辆，电池通常仍保留70%到80%的初始容量。这类电池可以获得“第二次生命”，比如用来储存太阳能电池板产生的电力，或为建筑物提供备用电源。',
        },
      },
      {
        source: 'Eventually, though, every battery must be recycled. Batteries contain valuable metals such as lithium, cobalt and nickel, and recovering them reduces the need for new mining, which often damages the environment and local communities. At present, however, recycling is complicated and costly, partly because batteries come in many different designs and are difficult to take apart safely.',
        reference: {
          zh: '不过，所有电池最终都必须回收利用。电池中含有锂、钴、镍等贵重金属，回收这些金属可以减少新的矿产开采，而采矿往往会对环境和当地社区造成破坏。但目前电池回收工艺复杂、成本高昂，部分原因在于电池的设计五花八门，而且难以安全拆解。',
        },
      },
      {
        source: 'To address these problems, several countries have introduced rules that make manufacturers responsible for collecting and recycling the batteries they produce. Some also require new batteries to contain a minimum share of recycled materials. Industry experts believe that, with the right policies and technology, battery recycling could become a major industry in its own right.',
        reference: {
          zh: '为解决这些问题，一些国家出台规定，要求制造商负责回收和再利用其生产的电池；有些国家还要求新电池必须含有一定比例的再生材料。业内专家认为，只要政策得当、技术到位，电池回收本身就有望发展成为一个重要产业。',
        },
      },
      {
        source: 'Researchers are also working on batteries that are easier to recycle from the start. New designs use fewer screws and less glue, so that robots can dismantle them quickly, while some companies are developing batteries that rely less on scarce metals such as cobalt. If these efforts succeed, the electric car could become not only cleaner to drive, but also far more sustainable from production to disposal.',
        reference: {
          zh: '研究人员还在努力从源头上设计更易于回收的电池。新的设计减少了螺丝和胶水的使用，使机器人能够快速拆解电池；一些企业还在研发对钴等稀缺金属依赖更少的电池。如果这些努力取得成功，电动汽车将不仅在驾驶时更加清洁，而且从生产到报废的全过程都会更具可持续性。',
        },
      },
    ],
    keyTerms: [
      { source: 'electric vehicles', accepted: { zh: ['电动汽车', '电动车', '新能源汽车'] } },
      { source: 'useful life', accepted: { zh: ['使用寿命'] } },
      { source: 'capacity', accepted: { zh: ['容量'] } },
      { source: 'second life', accepted: { zh: ['第二次生命', '梯次利用', '二次生命'] } },
      { source: 'lithium, cobalt and nickel', accepted: { zh: ['锂'] } },
      { source: 'recycled materials', accepted: { zh: ['再生材料', '回收材料'] } },
    ],
  },
  {
    id: 'en-exam-2',
    sourceLanguage: 'en',
    targetLanguages: ['zh'],
    title: 'Teenagers and Sleep',
    topic: 'Health and education',
    genre: 'science',
    usage: 'exam',
    paragraphs: [
      {
        source: 'Parents often complain that their teenage children stay up late at night and find it almost impossible to get out of bed in the morning. It is easy to blame laziness or late-night screen time, but scientists say there is also a biological explanation.',
        reference: {
          zh: '家长们常常抱怨，自家处于青春期的孩子晚上熬夜，早上几乎起不了床。人们很容易将其归咎于懒惰或深夜看手机等电子屏幕，但科学家表示，这背后也有生理上的原因。',
        },
      },
      {
        source: 'During adolescence, the body’s internal clock shifts. The hormone melatonin, which makes us feel sleepy, is released about two hours later in the evening than in younger children. As a result, many teenagers simply do not feel tired until eleven o’clock or later, even though they still need eight to ten hours of sleep a night.',
        reference: {
          zh: '在青春期，人体的生物钟会发生变化。让人产生困意的褪黑素，其晚间分泌时间要比年龄较小的儿童晚两个小时左右。因此，许多青少年要到晚上十一点甚至更晚才会感到困倦，尽管他们每晚仍需要八到十个小时的睡眠。',
        },
      },
      {
        source: 'When school starts early, the result is chronic sleep loss. Research has linked lack of sleep among teenagers to poorer concentration, lower exam results, a higher risk of road accidents and problems with mental health such as anxiety and depression.',
        reference: {
          zh: '如果学校上课时间较早，就会造成长期睡眠不足。研究表明，青少年睡眠不足与注意力下降、考试成绩变差、交通事故风险升高以及焦虑、抑郁等心理健康问题都有关联。',
        },
      },
      {
        source: 'Some schools have responded by starting lessons later in the morning. Early studies of these schools have reported encouraging results, including better attendance and improved grades. Experts add that families can help too, for example by keeping phones out of bedrooms and encouraging regular sleep routines, even at weekends.',
        reference: {
          zh: '对此，一些学校推迟了上午的上课时间。针对这些学校的初步研究显示，效果令人鼓舞，学生的出勤率和学习成绩都有所提高。专家补充说，家庭也可以发挥作用，比如不让孩子把手机带进卧室，鼓励他们养成规律的作息习惯，即使周末也不例外。',
        },
      },
      {
        source: 'Not everyone is convinced, however. Changing the school day affects bus timetables, after-school activities and parents’ working hours, and some teachers worry that later finishing times will leave students with less time for homework and sport. Supporters respond that these practical difficulties can be solved, and that the health and education of young people should come first. As more evidence becomes available, the question of when the school day should begin is likely to remain on the agenda of education authorities in many countries.',
        reference: {
          zh: '不过，并非所有人都认同这种做法。调整学校作息会影响校车时刻表、课外活动和家长的工作时间；一些教师还担心，放学时间推迟会让学生用于做作业和体育锻炼的时间减少。支持者则回应说，这些实际困难都可以解决，青少年的健康和教育才应放在首位。随着越来越多的证据出现，学校每天应该何时开始上课这一问题，很可能仍将是许多国家教育主管部门议事日程上的重要议题。',
        },
      },
    ],
    keyTerms: [
      { source: 'adolescence', accepted: { zh: ['青春期'] } },
      { source: 'internal clock', accepted: { zh: ['生物钟'] } },
      { source: 'melatonin', accepted: { zh: ['褪黑素', '褪黑激素'] } },
      { source: 'chronic sleep loss', accepted: { zh: ['睡眠不足', '缺觉', '睡眠缺乏'] } },
      { source: 'mental health', accepted: { zh: ['心理健康', '精神健康'] } },
      { source: 'anxiety and depression', accepted: { zh: ['焦虑'] } },
    ],
  },
]

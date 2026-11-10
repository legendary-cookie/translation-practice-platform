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
  {
    id: 'zh-solar-terms',
    sourceLanguage: 'zh',
    targetLanguages: ['en', 'ru'],
    title: '二十四节气',
    topic: 'Chinese culture',
    genre: 'culture',
    usage: 'practice',
    paragraphs: [
      {
        source: '二十四节气是中国古人通过观察太阳周年运动而形成的时间知识体系。它把一年平均分为二十四等份，每一份代表一个节气，如立春、清明、夏至、秋分和冬至等。',
        reference: {
          en: 'The 24 Solar Terms are a system of time-related knowledge that the ancient Chinese developed by observing the sun’s annual motion. The system divides the year into 24 equal parts, each representing one solar term, such as the Beginning of Spring, Pure Brightness, the Summer Solstice, the Autumn Equinox and the Winter Solstice.',
          ru: 'Двадцать четыре сезона сельскохозяйственного календаря — это система знаний о времени, созданная древними китайцами на основе наблюдений за годовым движением Солнца. Год делится на 24 равные части, каждая из которых соответствует одному сезону, например «Начало весны», «Праздник чистого света», «Летнее солнцестояние», «Осеннее равноденствие» и «Зимнее солнцестояние».',
        },
      },
      {
        source: '在漫长的农耕社会中，二十四节气一直是指导农业生产的重要依据。农民根据节气安排播种、灌溉和收获，形成了“清明前后，种瓜点豆”等许多通俗易懂的农谚。',
        reference: {
          en: 'Throughout China’s long agrarian history, the solar terms served as an important guide for farming. Farmers scheduled sowing, irrigation and harvesting according to the terms, giving rise to many easy-to-remember farming proverbs, such as “Around Pure Brightness, plant melons and sow beans.”',
          ru: 'На протяжении долгой истории земледельческого общества сезоны служили важным ориентиром для сельскохозяйственных работ. Крестьяне планировали посев, полив и уборку урожая в соответствии с ними, и так появилось множество простых и понятных пословиц, например: «Около Праздника чистого света сажай дыни и сей бобы».',
        },
      },
      {
        source: '二十四节气不仅是农业生产的时间指南，也深深融入了人们的日常生活。许多节气都有相应的民俗活动和饮食习惯，比如冬至吃饺子、立春吃春饼。这些习俗承载着人们对自然的敬畏和对美好生活的向往。',
        reference: {
          en: 'The solar terms are not only a timetable for farming but have also become deeply woven into everyday life. Many of them are associated with folk customs and food traditions, such as eating dumplings at the Winter Solstice and spring pancakes at the Beginning of Spring. These customs express people’s reverence for nature and their hopes for a good life.',
          ru: 'Сезоны — это не только календарь сельскохозяйственных работ: они глубоко вошли в повседневную жизнь людей. Со многими из них связаны народные обычаи и кулинарные традиции, например в день зимнего солнцестояния едят пельмени цзяоцзы, а в начале весны — весенние лепёшки. Эти обычаи отражают благоговение людей перед природой и их стремление к лучшей жизни.',
        },
      },
      {
        source: '2016年，二十四节气被列入联合国教科文组织人类非物质文化遗产代表作名录。如今，越来越多的年轻人通过网络了解节气知识，这一古老的时间智慧正在焕发新的活力。',
        reference: {
          en: 'In 2016, the 24 Solar Terms were inscribed on UNESCO’s Representative List of the Intangible Cultural Heritage of Humanity. Today, more and more young people learn about the solar terms online, and this ancient wisdom about time is taking on new vitality.',
          ru: 'В 2016 году двадцать четыре сезона были включены в Репрезентативный список нематериального культурного наследия человечества ЮНЕСКО. Сегодня всё больше молодых людей узнают о сезонах из интернета, и эта древняя мудрость об устройстве времени обретает новую жизнь.',
        },
      },
    ],
    keyTerms: [
      { source: '二十四节气', accepted: { en: ['solar term'], ru: ['сезон', 'сезонов'] } },
      { source: '农耕社会', accepted: { en: ['agrarian', 'agricultural', 'farming societ'], ru: ['земледел', 'аграрн'] } },
      { source: '农谚', accepted: { en: ['proverb', 'saying'], ru: ['пословиц', 'поговор'] } },
      { source: '民俗', accepted: { en: ['folk'], ru: ['народн'] } },
      { source: '非物质文化遗产', accepted: { en: ['intangible cultural heritage'], ru: ['нематериальн'] } },
      { source: '联合国教科文组织', accepted: { en: ['unesco'], ru: ['юнеско'] } },
    ],
  },
  {
    id: 'zh-rural-ecommerce',
    sourceLanguage: 'zh',
    targetLanguages: ['en', 'ru'],
    title: '农村电商助力乡村振兴',
    topic: 'Economy and rural development',
    genre: 'economy',
    usage: 'practice',
    paragraphs: [
      {
        source: '近年来，我国农村电子商务快速发展，已成为推动乡村振兴的新引擎。随着网络基础设施不断完善，越来越多的农民通过电商平台和直播带货，把本地特色农产品卖到全国各地。',
        reference: {
          en: 'In recent years, rural e-commerce in China has developed rapidly and become a new engine for rural revitalization. As internet infrastructure keeps improving, more and more farmers are using e-commerce platforms and livestreaming sales to sell local specialty produce to buyers across the country.',
          ru: 'В последние годы электронная торговля в сельских районах Китая быстро развивается и стала новым двигателем возрождения села. По мере совершенствования интернет-инфраструктуры всё больше крестьян с помощью платформ электронной коммерции и прямых трансляций продают местную фирменную сельхозпродукцию покупателям по всей стране.',
        },
      },
      {
        source: '数据显示，2023年全国农村网络零售额达到2.49万亿元，比上年增长12.5%。电商不仅拓宽了农产品的销售渠道，也带动了包装、物流和仓储等相关产业的发展，为农村创造了大量就业岗位。',
        reference: {
          en: 'Data show that online retail sales in rural areas nationwide reached 2.49 trillion yuan in 2023, up 12.5% year on year. E-commerce has not only widened sales channels for farm produce but also boosted related industries such as packaging, logistics and warehousing, creating a large number of jobs in the countryside.',
          ru: 'По имеющимся данным, в 2023 году объём сетевой розничной торговли в сельских районах страны достиг 2,49 трлн юаней, увеличившись на 12,5% по сравнению с предыдущим годом. Электронная торговля не только расширила каналы сбыта сельхозпродукции, но и дала толчок развитию смежных отраслей — упаковки, логистики и складского хозяйства, создав на селе множество рабочих мест.',
        },
      },
      {
        source: '与此同时，农村电商的发展仍面临一些问题。部分地区物流成本较高，农产品标准化程度不够，懂电商、会经营的人才也比较缺乏。',
        reference: {
          en: 'At the same time, rural e-commerce still faces some problems. Logistics costs remain high in some areas, farm produce is not sufficiently standardized, and there is a shortage of people with e-commerce and business management skills.',
          ru: 'Вместе с тем развитие сельской электронной торговли по-прежнему сталкивается с рядом проблем. В некоторых районах логистические расходы остаются высокими, сельхозпродукция недостаточно стандартизирована, ощущается нехватка кадров, разбирающихся в электронной коммерции и умеющих вести бизнес.',
        },
      },
      {
        source: '下一步，有关部门将加快完善县、乡、村三级物流配送体系，加强农产品品牌建设，并加大对农村电商人才的培训力度，让更多农民共享数字经济发展的成果。',
        reference: {
          en: 'Going forward, the relevant authorities will speed up the development of a three-tier logistics and delivery system covering counties, townships and villages, strengthen branding for farm produce, and step up training for rural e-commerce professionals, so that more farmers can share in the benefits of the digital economy.',
          ru: 'В дальнейшем профильные ведомства ускорят создание трёхуровневой системы логистики и доставки — на уровне уездов, волостей и деревень, — усилят работу по формированию брендов сельхозпродукции и расширят подготовку кадров для сельской электронной торговли, чтобы как можно больше крестьян могли пользоваться плодами развития цифровой экономики.',
        },
      },
    ],
    keyTerms: [
      { source: '农村电子商务', accepted: { en: ['rural e-commerce'], ru: ['электронн'] } },
      { source: '乡村振兴', accepted: { en: ['rural revitali'], ru: ['возрожден', 'подъём'] } },
      { source: '直播带货', accepted: { en: ['livestream', 'live stream', 'live-stream'], ru: ['трансляц', 'стрим'] } },
      { source: '网络零售额', accepted: { en: ['online retail'], ru: ['розничн'] } },
      { source: '物流', accepted: { en: ['logistic'], ru: ['логист'] } },
      { source: '数字经济', accepted: { en: ['digital economy'], ru: ['цифров'] } },
    ],
  },
  {
    id: 'zh-high-speed-rail',
    sourceLanguage: 'zh',
    targetLanguages: ['en', 'ru'],
    title: '高铁改变出行方式',
    topic: 'Transport and society',
    genre: 'society',
    usage: 'practice',
    paragraphs: [
      {
        source: '2008年，我国第一条设计时速350公里的高速铁路——京津城际铁路建成通车。此后十多年间，我国高铁建设突飞猛进，截至2023年底，全国高铁营业里程已超过4.5万公里，居世界第一。',
        reference: {
          en: 'In 2008, the Beijing–Tianjin Intercity Railway, China’s first high-speed line designed for 350 kilometres per hour, opened to traffic. Over the following decade and more, high-speed rail construction in China advanced by leaps and bounds. By the end of 2023, the country’s high-speed rail network in operation exceeded 45,000 kilometres, the longest in the world.',
          ru: 'В 2008 году была открыта первая в Китае высокоскоростная железная дорога с расчётной скоростью 350 км/ч — междугородная линия Пекин — Тяньцзинь. За последующие полтора десятилетия строительство высокоскоростных магистралей в стране шло стремительными темпами: к концу 2023 года их эксплуатационная протяжённость превысила 45 тыс. км — больше, чем в любой другой стране мира.',
        },
      },
      {
        source: '高铁的发展深刻改变了人们的出行方式。过去从北京到上海坐火车需要十几个小时，现在乘坐高铁最快只需4个多小时。“同城化”效应日益明显，不少人选择在一座城市工作、在另一座城市生活。',
        reference: {
          en: 'The development of high-speed rail has profoundly changed the way people travel. A train journey from Beijing to Shanghai used to take more than ten hours; today the fastest high-speed trains make it in just over four hours. Neighbouring cities are increasingly functioning as one, and many people now choose to work in one city and live in another.',
          ru: 'Развитие высокоскоростных железных дорог коренным образом изменило то, как люди путешествуют. Раньше поездка на поезде из Пекина в Шанхай занимала более десяти часов, а теперь на самом быстром скоростном поезде она длится немногим более четырёх. Соседние города всё больше сливаются в единое пространство, и многие предпочитают работать в одном городе, а жить в другом.',
        },
      },
      {
        source: '高铁还带动了沿线地区的经济发展。一些过去交通不便的中小城市因为通了高铁，旅游业迅速兴起，吸引了更多投资和人才。',
        reference: {
          en: 'High-speed rail has also driven economic growth along its routes. Some small and medium-sized cities that used to be hard to reach have seen tourism take off after gaining high-speed rail links, attracting more investment and talent.',
          ru: 'Скоростные магистрали также способствуют экономическому развитию прилегающих районов. В ряде малых и средних городов, куда раньше было трудно добраться, после открытия скоростного сообщения стремительно развился туризм, что привлекло дополнительные инвестиции и специалистов.',
        },
      },
      {
        source: '如今，中国高铁不仅方便了国内百姓出行，也开始走向世界。中国企业参与建设的海外铁路项目，正在为当地经济社会发展作出贡献。',
        reference: {
          en: 'Today, China’s high-speed rail not only makes travel easier for people at home but is also going global. Overseas railway projects built with the participation of Chinese companies are contributing to local economic and social development.',
          ru: 'Сегодня китайские высокоскоростные железные дороги не только облегчают поездки внутри страны, но и выходят на мировой рынок. Зарубежные железнодорожные проекты, в строительстве которых участвуют китайские компании, вносят вклад в социально-экономическое развитие стран, где они реализуются.',
        },
      },
    ],
    keyTerms: [
      { source: '高速铁路', accepted: { en: ['high-speed rail', 'high-speed railway', 'high-speed line'], ru: ['высокоскоростн', 'скоростн'] } },
      { source: '营业里程', accepted: { en: ['in operation', 'operating'], ru: ['эксплуатацион', 'протяжённост', 'протяженност'] } },
      { source: '同城化', accepted: { en: ['as one', 'integrat'], ru: ['единое', 'слива'] } },
      { source: '沿线地区', accepted: { en: ['along'], ru: ['прилегающ', 'вдоль'] } },
      { source: '经济社会发展', accepted: { en: ['economic and social development', 'socio-economic development', 'socioeconomic development'], ru: ['социально-экономическ'] } },
    ],
  },

  // ---- Exam passages (CATTI 3 profiles only) ----
  {
    id: 'zh-exam-en-1',
    sourceLanguage: 'zh',
    targetLanguages: ['en'],
    title: '共享单车与绿色出行',
    topic: 'Cities and green transport',
    genre: 'society',
    usage: 'exam',
    paragraphs: [
      {
        source: '共享单车是近年来在我国城市中出现的一种新型交通服务。用户只需用手机扫描车身上的二维码，就可以随时取车、随地还车，按使用时间付费。',
        reference: {
          en: 'Bike sharing is a new type of transport service that has appeared in Chinese cities in recent years. Users simply scan the QR code on a bike with their mobile phone to pick it up at any time, return it almost anywhere, and pay according to how long they ride.',
        },
      },
      {
        source: '共享单车有效解决了城市出行“最后一公里”的难题，也减少了机动车的使用和尾气排放。据统计，目前全国共享单车日均订单量已超过3000万单。',
        reference: {
          en: 'Bike sharing has effectively solved the “last mile” problem in urban travel and has also reduced car use and exhaust emissions. According to statistics, shared bikes nationwide now handle more than 30 million rides a day on average.',
        },
      },
      {
        source: '然而，共享单车在快速发展的同时也带来了一些问题。在一些城市，车辆乱停乱放现象较为严重，占用了人行道和盲道，给市民出行带来不便。',
        reference: {
          en: 'However, the rapid growth of bike sharing has also brought problems. In some cities, bikes are often parked haphazardly, blocking pavements and tactile paths for the visually impaired and causing inconvenience to residents.',
        },
      },
      {
        source: '为此，各地政府出台管理办法，划定停放区域，并利用电子围栏等技术规范停车行为。企业和用户也应共同努力，让共享单车真正成为绿色出行的好帮手。',
        reference: {
          en: 'In response, local governments have introduced management rules, designated parking zones and used technologies such as electronic fences to regulate parking. Companies and users should also work together to make shared bikes a genuine aid to green travel.',
        },
      },
    ],
    keyTerms: [
      { source: '共享单车', accepted: { en: ['bike sharing', 'bike-sharing', 'shared bike', 'shared bicycle'] } },
      { source: '二维码', accepted: { en: ['qr code'] } },
      { source: '最后一公里', accepted: { en: ['last mile', 'last kilometre', 'last kilometer'] } },
      { source: '尾气排放', accepted: { en: ['emission'] } },
      { source: '盲道', accepted: { en: ['tactile', 'blind'] } },
      { source: '电子围栏', accepted: { en: ['electronic fenc', 'geofenc', 'geo-fenc'] } },
      { source: '绿色出行', accepted: { en: ['green travel', 'green transport', 'green mobility'] } },
    ],
  },
  {
    id: 'zh-exam-en-2',
    sourceLanguage: 'zh',
    targetLanguages: ['en'],
    title: '大熊猫保护',
    topic: 'Wildlife protection',
    genre: 'science',
    usage: 'exam',
    paragraphs: [
      {
        source: '大熊猫是中国特有的珍稀动物，被誉为“国宝”。它们主要生活在四川、陕西和甘肃三省的山区，以竹子为主要食物。',
        reference: {
          en: 'The giant panda is a rare animal found only in China and is known as a “national treasure”. Pandas live mainly in the mountains of Sichuan, Shaanxi and Gansu provinces and feed mostly on bamboo.',
        },
      },
      {
        source: '上世纪八十年代，由于栖息地遭到破坏，野生大熊猫数量一度下降到1100只左右。为了保护这一物种，我国建立了多个自然保护区，并开展人工繁育研究。',
        reference: {
          en: 'In the 1980s, the destruction of their habitat caused the wild panda population to fall to about 1,100 at one point. To protect the species, China established a number of nature reserves and launched research into captive breeding.',
        },
      },
      {
        source: '经过几十年的努力，保护工作取得了显著成效。第四次全国大熊猫调查结果显示，野生大熊猫数量已增至1864只。2021年，大熊猫的受威胁等级由“濒危”降为“易危”。',
        reference: {
          en: 'Decades of effort have produced remarkable results. The fourth national giant panda survey found that the wild population had risen to 1,864. In 2021, the panda’s threat status was downgraded from “endangered” to “vulnerable”.',
        },
      },
      {
        source: '2021年，大熊猫国家公园正式设立。这将进一步加强对大熊猫及其栖息地的整体保护，也为其他野生动植物提供了良好的生存环境。',
        reference: {
          en: 'In 2021, Giant Panda National Park was officially established. This will further strengthen the protection of pandas and their habitat as a whole, while also providing a good living environment for other wild animals and plants.',
        },
      },
    ],
    keyTerms: [
      { source: '大熊猫', accepted: { en: ['giant panda', 'panda'] } },
      { source: '国宝', accepted: { en: ['national treasure'] } },
      { source: '栖息地', accepted: { en: ['habitat'] } },
      { source: '自然保护区', accepted: { en: ['nature reserve', 'nature preserve'] } },
      { source: '人工繁育', accepted: { en: ['captive breeding', 'artificial breeding', 'breeding'] } },
      { source: '濒危', accepted: { en: ['endangered'] } },
      { source: '易危', accepted: { en: ['vulnerable'] } },
      { source: '国家公园', accepted: { en: ['national park'] } },
    ],
  },
  {
    id: 'zh-exam-ru-1',
    sourceLanguage: 'zh',
    targetLanguages: ['ru'],
    title: '冰雪运动走进大众生活',
    topic: 'Sport and tourism',
    genre: 'society',
    usage: 'exam',
    paragraphs: [
      {
        source: '北京冬奥会成功举办以来，冰雪运动在我国越来越受欢迎。滑雪、滑冰等过去被认为是少数人参与的运动，如今正在走进普通百姓的生活。',
        reference: {
          ru: 'После успешного проведения зимних Олимпийских игр в Пекине зимние виды спорта становятся в Китае всё популярнее. Горные лыжи, катание на коньках и другие виды спорта, которые раньше считались уделом немногих, теперь входят в жизнь простых людей.',
        },
      },
      {
        source: '东北地区拥有丰富的冰雪资源。每年冬天，哈尔滨冰雪大世界都会吸引大量国内外游客。2024年元旦假期，哈尔滨共接待游客300多万人次，旅游收入近60亿元。',
        reference: {
          ru: 'Северо-Восток Китая богат снегом и льдом. Каждую зиму харбинский парк «Мир льда и снега» привлекает множество туристов из Китая и из-за рубежа. За новогодние праздники 2024 года Харбин посетили более 3 млн туристов, а доходы от туризма составили почти 6 млрд юаней.',
        },
      },
      {
        source: '冰雪旅游的兴起带动了餐饮、住宿、交通等相关产业的发展，也让当地居民的收入明显增加。不少南方城市也建起了室内滑雪场，让更多人足不出城就能体验冰雪运动的乐趣。',
        reference: {
          ru: 'Развитие зимнего туризма дало толчок смежным отраслям — общественному питанию, гостиничному бизнесу, транспорту — и заметно повысило доходы местных жителей. Во многих городах на юге страны также построены крытые горнолыжные комплексы, чтобы больше людей могли испытать радость зимнего спорта, не выезжая из своего города.',
        },
      },
      {
        source: '中俄两国都有悠久的冰雪运动传统。近年来，两国在冰雪运动和冰雪旅游领域的交流合作不断深化，为两国人民增进友谊搭建了新的平台。',
        reference: {
          ru: 'И Китай, и Россия имеют давние традиции зимних видов спорта. В последние годы обмены и сотрудничество двух стран в области зимнего спорта и зимнего туризма постоянно углубляются, создавая новую площадку для укрепления дружбы между нашими народами.',
        },
      },
    ],
    keyTerms: [
      { source: '冰雪运动', accepted: { ru: ['зимн'] } },
      { source: '冬奥会', accepted: { ru: ['олимпийск', 'олимпиад'] } },
      { source: '哈尔滨冰雪大世界', accepted: { ru: ['мир льда и снега', 'ледяной и снежный мир', 'мир снега и льда'] } },
      { source: '人次', accepted: { ru: ['турист', 'посетител'] } },
      { source: '室内滑雪场', accepted: { ru: ['крыт', 'закрыт'] } },
      { source: '交流合作', accepted: { ru: ['сотрудничеств'] } },
    ],
  },
  {
    id: 'zh-exam-ru-2',
    sourceLanguage: 'zh',
    targetLanguages: ['ru'],
    title: '万里茶道',
    topic: 'History and cultural exchange',
    genre: 'culture',
    usage: 'exam',
    paragraphs: [
      {
        source: '茶起源于中国，至今已有数千年的历史。中国人不仅把茶当作日常饮品，还形成了独具特色的茶文化，讲究泡茶的方法、饮茶的环境和待客的礼仪。',
        reference: {
          ru: 'Чай родом из Китая, и его история насчитывает несколько тысяч лет. Для китайцев чай — не только повседневный напиток: в Китае сложилась самобытная чайная культура, в которой большое значение придаётся способу заваривания, обстановке чаепития и правилам приёма гостей.',
        },
      },
      {
        source: '十七世纪后期，一条以茶叶贸易为主的国际商道逐渐形成。这条商道从中国福建武夷山出发，经蒙古高原，到达俄罗斯恰克图，再延伸至圣彼得堡等地，全长约1.3万公里，被称为“万里茶道”。',
        reference: {
          ru: 'В конце XVII века постепенно сложился международный торговый путь, основным товаром на котором был чай. Этот путь начинался в горах Уишань в провинции Фуцзянь, проходил через Монгольское плато, достигал российской Кяхты и далее тянулся до Санкт-Петербурга и других городов. Его общая протяжённость составляла около 13 тыс. км, и он получил название «Великий чайный путь».',
        },
      },
      {
        source: '通过万里茶道，中国茶叶大量进入俄罗斯，饮茶逐渐成为俄罗斯人的生活习惯。俄罗斯人喜欢用茶炊煮水，在茶里加糖、柠檬或果酱，形成了自己的饮茶方式。',
        reference: {
          ru: 'По Великому чайному пути китайский чай в больших количествах поступал в Россию, и чаепитие постепенно стало частью русского быта. Россияне полюбили кипятить воду в самоваре и добавлять в чай сахар, лимон или варенье, выработав собственные традиции чаепития.',
        },
      },
      {
        source: '今天，万里茶道已成为中俄蒙三国人文交流的重要纽带。沿线城市正在合作开发文化旅游线路，让这条古老的商道焕发新的生机。',
        reference: {
          ru: 'Сегодня Великий чайный путь стал важным связующим звеном в гуманитарных обменах между Китаем, Россией и Монголией. Города, расположенные вдоль него, совместно разрабатывают культурно-туристические маршруты, вдыхая новую жизнь в этот древний торговый путь.',
        },
      },
    ],
    keyTerms: [
      { source: '茶文化', accepted: { ru: ['чайн'] } },
      { source: '万里茶道', accepted: { ru: ['чайный путь', 'чайного пути', 'чайному пути', 'чайным путём'] } },
      { source: '恰克图', accepted: { ru: ['кяхт'] } },
      { source: '蒙古高原', accepted: { ru: ['монгольск'] } },
      { source: '茶炊', accepted: { ru: ['самовар'] } },
      { source: '人文交流', accepted: { ru: ['гуманитарн'] } },
    ],
  },
]

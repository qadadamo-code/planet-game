/* Website content — all taken from theplanetco.com (work, clients, services, about) and the Planet team list. L(en, ar). */

const SITE = {
  nav: { home: L("Home","الرئيسية"), work: L("Work","أعمالنا"), clients: L("Clients","عملاؤنا"), services: L("Services","خدماتنا"), team: L("Team","الفريق"), about: L("About","من نحن"), contact: L("Contact","تواصل") },
  cta: L("Start a project","ابدأ مشروعك"),
  explore: L("Explore the planet","استكشف الكوكب"),
  exploreHint: L("Walk around our tiny planet, meet each studio, deliver the briefs.","امشِ على كوكبنا الصغير، قابل كل استوديو، وسلّم البريفات."),
  backHome: L("Back to the website","ارجع للموقع"),
  hero: {
    kicker: L("Creative marketing — New Cairo","تسويق إبداعي — القاهرة الجديدة"),
    h1: L("Marketing that gets you <em>noticed.</em><br>And turns interest into <em>customers.</em>","تسويق يخلّي الناس <em>تشوفك.</em><br>ويحوّل الاهتمام <em>لعملاء.</em>"),
    p: L("We cover eight areas in-house: planning, branding, social media, campaigns, video, websites, paid ads and marketing advice. One team, one plan, and one person you can call.",
         "بنغطّي تمن مجالات جوه الاستوديو: التخطيط، الهوية، السوشيال ميديا، الحملات، الفيديو، المواقع، الإعلانات الممولة، والاستشارات. فريق واحد، خطة واحدة، وشخص واحد تكلّمه."),
    seeWork: L("See our work","شوف شغلنا"),
    trusted: L("Trusted by 370+ brands","بيثق فينا أكتر من 370 علامة"),
  },
  stats: [ [ "370+", L("Brands we have worked with","علامة اشتغلنا معاها") ], [ "9", L("Services, all in-house","خدمات كلها جوه البيت") ], [ "24", L("Industries served","مجال خدمناه") ], [ "7", L("Languages we work in","لغات بنشتغل بيها") ] ],
  pages: {
    work: { kicker: L("Our work","أعمالنا"), h: L("Projects and what they changed.","مشاريع وإيه اللي غيّرته."),
            p: L("Every project below started with a business problem, not a design request.","كل مشروع هنا بدأ بمشكلة في البزنس، مش بطلب تصميم.") },
    clients: { kicker: L("Clients","عملاؤنا"), h: L("The brands we work with.","العلامات اللي بنشتغل معاها."),
            p: L("23 of the 370+ brands we have worked with — hospitals and clinics, charities, financial companies, restaurants, hotels and more.","23 من أكتر من 370 علامة اشتغلنا معاها — مستشفيات وعيادات، جمعيات خيرية، شركات مالية، مطاعم، فنادق وغيرهم.") },
    services: { kicker: L("Services","خدماتنا"), h: L("Eight services. One team.","تمن خدمات. فريق واحد."),
            p: L("We do all of this ourselves, in one studio — so nothing gets lost between the people who plan the work and the people who make it. Most companies need two or three of these, not all eight. We will tell you which.","بنعمل كل ده بنفسنا في استوديو واحد — فمفيش حاجة بتضيع بين اللي بيخطط واللي بينفّذ. وأغلب الشركات محتاجة خدمتين أو تلاتة مش التمانية، وإحنا هنقولك أنهي.") },
    team: { kicker: L("Team","الفريق"), h: L("The people behind the work.","الناس اللي ورا الشغل."),
            p: L("Designers, writers, filmmakers and marketers in one studio in New Cairo. Everyone presents their own ideas — including the most junior people.","مصممين وكتّاب وصنّاع أفلام ومسوّقين في استوديو واحد في القاهرة الجديدة. وكل واحد بيعرض فكرته بنفسه — حتى أصغر واحد في الفريق.") },
    about: { kicker: L("About","من نحن"), h: L("How Planet started.","إزاي Planet بدأت.") },
    contact: { kicker: L("Contact","تواصل"), h: L("Let's get you noticed.","يلا نخلّي الناس تشوفك."),
            p: L("A new project, a partnership, or just a question — this reaches the whole team, not an inbox nobody checks.","مشروع جديد، شراكة، أو مجرد سؤال — رسالتك بتوصل للفريق كله، مش لصندوق بريد محدش بيفتحه.") },
  },
  allWork: L("All","الكل"),
  caseCta: L("Want results like this?","عايز نتيجة زي دي؟"),
  servicesUsed: L("What we did","اللي عملناه"),
  year: L("Year","السنة"), industry: L("Industry","المجال"),
  viewCase: L("View project","شوف المشروع"),
  whatYouGet: L("What you get","هتاخد إيه"),
  products: L("Products we build ourselves","منتجات بنبنيها بنفسنا"),
  leadership: L("Leadership","الإدارة"),
  careersH: L("Come and work with us.","تعالى اشتغل معانا."),
  careersP: L("More responsibility, a wider range of work, and less waiting for permission. The standard is high and the feedback is direct.","مسؤولية أكتر، شغل متنوّع أكتر، وانتظار أقل للإذن. المستوى عالي والفيدباك مباشر."),
  careersBtn: L("See careers","شوف الوظايف"),
  whatsapp: L("WhatsApp us","كلّمنا واتساب"),
  emailUs: L("Email us","ابعتلنا إيميل"),
  briefForm: L("Send a project brief","ابعت بريف مشروعك"),
  follow: L("Follow us","تابعنا"),
  rights: L("Planet — Creative Marketing, New Cairo","Planet — تسويق إبداعي، القاهرة الجديدة"),
};

const DEPTS = {
  management: L("Leadership & strategy","الإدارة والاستراتيجية"),
  account_management: L("Account management","إدارة الحسابات"),
  content: L("Content","المحتوى"),
  graphic_design: L("Design","التصميم"),
  motion: L("Motion","الموشن"),
  video_editing: L("Video editing","المونتاج"),
  photography: L("Photography","التصوير"),
  moderation: L("Publishing","النشر والجدولة"),
  finance: L("Finance","المالية"),
  admin: L("Office","المكتب"),
};

/* the eight case studies on theplanetco.com/work */
const WORK = [
  { id:'fly29', name:L("Fly 29","Fly 29"), ind:L("Travel & Tourism","السفر والسياحة"), year:2025, logo:'fly29', imgs:['work/fly29_01.jpg','work/fly29_02.jpg','work/fly29_03.jpg'],
    svc:['s3','s7'], sum:L("A travel company with good prices but few bookings. We rebuilt their social media and advertising around why people travel, not where they fly to.","شركة سفر أسعارها حلوة وحجوزاتها قليلة. بنينا السوشيال ميديا والإعلانات من جديد حوالين الناس بتسافر ليه، مش رايحين فين."),
    quote:L("They stopped asking us what to post and started asking who we were selling to. The plan got simpler and the numbers moved.","بطّلوا يسألونا ننشر إيه وبدأوا يسألوا بنبيع لمين. الخطة بقت أبسط والأرقام اتحركت.") },
  { id:'wakeelak', name:L("Wakeelak","وكيلك"), ind:L("Legal services","خدمات قانونية"), year:2025, logo:'wakeelak', imgs:['covers/wakeelak.jpg'],
    svc:['s1','s3'], sum:L("A legal service whose biggest problem was that people could not understand it. We rewrote everything in plain Arabic and turned the explanations into short videos.","خدمة قانونية مشكلتها الأكبر إن الناس مش فاهماها. كتبنا كل حاجة من جديد بعربي بسيط، وحوّلنا الشرح لفيديوهات قصيرة."),
    quote:L("We had been explaining our service. Planet explained the situation the client was in. That was the whole difference.","إحنا كنا بنشرح خدمتنا. Planet شرحت الموقف اللي العميل فيه. ودي كانت كل الفرق.") },
  { id:'qidra', name:L("Qidra","قدرة"), ind:L("Hospitality & Food","الضيافة والمطاعم"), year:2024, logo:'qidra', imgs:['work/qidra_01.jpg','work/qidra_02.jpg','work/qidra_03.jpg'],
    svc:['s2','s1'], sum:L("A restaurant brand named after a traditional dish. The look had to be proud of that history without feeling old-fashioned.","علامة مطعم اسمها على اسم أكلة تراثية. الشكل كان لازم يفتخر بالتاريخ ده من غير ما يبان قديم.") },
  { id:'zaytouna', name:L("Al Zaytouna","الزيتونة"), ind:L("Non-profit","عمل خيري"), year:2024, logo:'alzaytouna', imgs:['work/alzaytouna_01.jpg','work/alzaytouna_02.jpg','work/alzaytouna_03.jpg'],
    svc:['s4','s5'], sum:L("A campaign for a charity that could not afford to sound like advertising. Holding back was the whole idea.","حملة لجمعية خيرية مينفعش صوتها يبقى صوت إعلان. الهدوء كان هو الفكرة كلها.") },
  { id:'united', name:L("United Investment","يونايتد إنفستمنت"), ind:L("Finance & Investment","المال والاستثمار"), year:2025, logo:'unitedinvestment', imgs:['covers/united.jpg'],
    svc:['s6','s2'], sum:L("A finance company whose website had to satisfy large investors and still make sense to individuals. One site, two very different audiences.","شركة مالية موقعها لازم يرضي المستثمرين الكبار ويفضل مفهوم للأفراد. موقع واحد لجمهورين مختلفين جداً."),
    quote:L("The Arabic version is not a translation of the site. It is the site.","النسخة العربي مش ترجمة للموقع. هي الموقع.") },
  { id:'gms', name:L("GMS","GMS"), ind:L("Healthcare","الرعاية الصحية"), year:2024, logo:'gms', imgs:['work/gms_01.jpg','work/gms_02.jpg','work/gms_03.jpg'],
    svc:['s8','s1'], sum:L("A medical group that talked about its machines. We moved the focus to the patient standing in front of them.","مجموعة طبية كانت بتتكلم عن أجهزتها. نقلنا التركيز للمريض اللي واقف قدامها.") },
  { id:'terhal', name:L("Terhal","ترحال"), ind:L("Travel & Lifestyle","السفر ونمط الحياة"), year:2025, logo:'terhal', imgs:['covers/terhal.jpg'],
    svc:['s5','s4'], sum:L("A three-minute film plus forty short clips, all from a single day of filming and one idea.","فيلم تلات دقايق وأربعين كليب قصير، كلهم من يوم تصوير واحد وفكرة واحدة.") },
  { id:'mavi', name:L("Mavi Realty","مافي العقارية"), ind:L("Real estate","العقارات"), year:2024, logo:'mavirealty', imgs:['covers/mavi.jpg'],
    svc:['s4','s6'], sum:L("A property launch in a market where every competitor shows the same sunset picture. We sold the decision instead of the view.","إطلاق مشروع عقاري في سوق كل المنافسين فيه بيعرضوا نفس صورة الغروب. بعنا القرار بدل المنظر.") },
];

/* 23 clients from theplanetco.com — logo file, cover file, and the case study if there is one */
const CLIENTS = [
  ['Fly 29','Fly 29','fly29','','fly29'], ['Wakeelak','وكيلك','wakeelak','wakeelak','wakeelak'], ['Qidra','قدرة','qidra','qidra','qidra'],
  ['Al Zaytouna','الزيتونة','alzaytouna','zayrouna','zaytouna'], ['United Investment','يونايتد إنفستمنت','unitedinvestment','united','united'], ['GMS','GMS','gms','gms','gms'],
  ['Terhal','ترحال','terhal','terhal','terhal'], ['Mavi Realty','مافي العقارية','mavirealty','mavi','mavi'], ['Uber','Uber','uber','uber',''],
  ['Al Ashi','العشي','alashi','alashi',''], ['Al Shawa','الشوا','alshawa','alshawwa',''], ['Al Jamalla','الجملة','aljamalla','aljamalla',''],
  ['Mohamed Adel','محمد عادل','mo-adel','mo-adel',''], ['Belal Hanif','بلال حنيف','belalhanif','hnaif',''], ['Jagal','جقل','jagal','jagal',''],
  ['Lorya','لوريا','lorya','lorya',''], ['Tadawa','تداوى','tadawa','tadawa',''], ['Value','فاليو','value','value',''],
  ['Westeros','ويستروس','westeros','westeros',''], ['Best One','بيست وان','best-one','bestone',''], ['SehaPracto','صحة براكتو','seha-practo','seha',''],
  ['Implant Gate','إمبلانت جيت','implant-gate','implant-gate',''], ['Bossco','بوسكو','bossco','bossco',''],
].map(([en, ar, logo, cover, work]) => ({ name: L(en, ar), logo, cover, work }));

/* what each service delivers (theplanetco.com/services) */
const SERVICE_GETS = {
  s1: [L("A review of your market and your competitors","مراجعة لسوقك ومنافسينك"), L("A clear picture of who your customers are","صورة واضحة لعملاءك"), L("What makes you different, and the proof behind it","إيه اللي بيميّزك والدليل عليه"), L("Names and taglines","أسماء وشعارات"), L("Your brand story in Arabic and English","قصة علامتك بالعربي والإنجليزي")],
  s2: [L("Your logo, in versions for every size and place","اللوجو بنسخ لكل مقاس ومكان"), L("Your colours and fonts, with rules for using them","الألوان والخطوط وقواعد استخدامها"), L("Arabic and English versions of everything","نسخة عربي وإنجليزي من كل حاجة"), L("A brand guide your team can follow","دليل هوية فريقك يمشي عليه"), L("Business cards, letterheads and templates","كروت شخصية ومطبوعات وقوالب")],
  s3: [L("A plan for what to post and why","خطة إيه اللي يتنشر وليه"), L("A monthly calendar of posts","تقويم شهري للبوستات"), L("Designed posts, carousels and short videos","بوستات وكاروسيل وفيديوهات قصيرة"), L("Replying to comments and messages","الرد على التعليقات والرسائل"), L("A monthly report in plain language","تقرير شهري بلغة بسيطة")],
  s4: [L("The campaign idea and its main image","فكرة الحملة وصورتها الأساسية"), L("Where it runs, and in what order","هتنزل فين وبأي ترتيب"), L("Versions sized for every place it appears","نسخ بمقاسات كل مكان هتظهر فيه"), L("Files ready to send to media partners","ملفات جاهزة لشركاء الإعلام"), L("A clear report on how it performed","تقرير واضح عن أداءها")],
  s5: [L("The idea, planned out scene by scene","الفكرة متخططة مشهد مشهد"), L("Directing and filming","إخراج وتصوير"), L("Editing, colour and sound","مونتاج وألوان وصوت"), L("Animation and an animated logo","أنيميشن ولوجو متحرك"), L("Short versions for each platform, with subtitles","نسخ قصيرة لكل منصة بترجمة")],
  s6: [L("A plan of the pages and how people move through them","خريطة الصفحات وإزاي الناس بتتنقل فيها"), L("The visual design of every screen","تصميم كل شاشة"), L("Building the site itself","برمجة الموقع نفسه"), L("A simple admin area, and training to use it","لوحة تحكم بسيطة وتدريب عليها"), L("A proper Arabic version, reading right to left","نسخة عربي حقيقية من اليمين للشمال")],
  s7: [L("Which platforms to use, and how to split the budget","أنهي منصات وإزاي تتقسم الميزانية"), L("Setting up the ads and the tracking","تجهيز الإعلانات والتتبّع"), L("Testing different versions to find the best","تجربة نسخ مختلفة لحد ما نلاقي الأحسن"), L("Seeing which ads led to real sales or enquiries","معرفة أنهي إعلان جاب مبيعات حقيقية"), L("A live dashboard and a monthly report","داشبورد مباشر وتقرير شهري")],
  s8: [L("A review of your marketing and your brand","مراجعة لتسويقك وعلامتك"), L("A plan and budget for the year","خطة وميزانية للسنة"), L("Advice on how to structure your team","نصيحة في هيكلة فريقك"), L("Training for your team","تدريب لفريقك"), L("A check-in session every three months","جلسة متابعة كل تلات شهور")],
};

/* team — Arabic titles alongside the English ones from the studio's records */
const TEAM = [
  ['emp-001','محمد قدادة','Mohammed Qadada','CEO & Founder','المؤسس والرئيس التنفيذي','management',1],
  ['emp-002','آية العشي','Aya Alashi','Head of Accounts & Team Management','مديرة الحسابات وإدارة الفريق','management',1],
  ['emp-003','طارق نصر','Tareq Nasr','Chief Operating Officer','مدير العمليات','management',1],
  ['emp-004','يوسف خالد','Yousef Khaled','Marketing Strategist','استراتيجي تسويق','management',0],
  ['emp-005','يمنى فتحي','Yomna Fathi','Art Director','مديرة فنية','graphic_design',0],
  ['emp-006','نورين نبيل','Noreen Nabil','Account Manager','مديرة حسابات','account_management',0],
  ['emp-007','ديما عبد العال','Dima Abdel Aal','Account Manager','مديرة حسابات','account_management',0],
  ['emp-008','جمانة شاهين','Jumana Shaheen','Content Creator','صانعة محتوى','content',0],
  ['emp-009','يوستينا ناصف','Youstina Nassef','Content Creator','صانعة محتوى','content',0],
  ['emp-010','يارا أمين','Yara Ameen','Content Creator','صانعة محتوى','content',0],
  ['emp-011','أحمد قدادة','Ahmed Qadada','Motion Graphics Lead & Video Editor','قائد الموشن جرافيك ومونتير','motion',0],
  ['emp-012','إبراهيم محمود','Ibrahem Mahmoud','Video Editor','مونتير','video_editing',0],
  ['emp-013','محمد ماجد','Mohammed Maged','Video Editor','مونتير','video_editing',0],
  ['emp-014','أميرة قدادة','Amira Qadada','Video Editor','مونتيرة','video_editing',0],
  ['emp-015','إبراهيم نصر','Ibrahim Nasr','Photographer & Videographer','مصوّر فوتوغرافي وفيديو','photography',0],
  ['emp-016','حسن فتحي','Hassan Fathi','Photographer','مصوّر','photography',0],
  ['emp-017','بسنت أحمد','Bassant Ahmed','Graphic Designer','مصممة جرافيك','graphic_design',0],
  ['emp-018','مصطفى حمدي','Mustafa Hamdy','Graphic Designer','مصمم جرافيك','graphic_design',0],
  ['emp-019','يوستينا كامل','Youstina Kamel','Graphic Designer','مصممة جرافيك','graphic_design',0],
  ['emp-020','محمد عنان','Mohammed Anan','Graphic Designer','مصمم جرافيك','graphic_design',0],
  ['emp-021','دانا قدادة','Dana Qadada','AI Visual Production','إنتاج بصري بالذكاء الاصطناعي','graphic_design',0],
  ['emp-022','شاهندة حامد','Shahinda Hamed','Publishing & Scheduling Specialist','أخصائية نشر وجدولة','moderation',0],
  ['emp-023','باسل مطير','Bassel Mutair','Finance & Operations Manager','مدير المالية والعمليات','finance',0],
  ['emp-024','آية عربي','Aya Arabi','Office Support','دعم المكتب','admin',0],
].map(([id, ar, en, ten, tar, dept, lead]) => ({ id, name: L(en, ar), title: L(ten, tar), dept, lead: !!lead }));

const ABOUT = {
  story: [L("Planet began as a small group of designers, writers and marketers who kept working together on the same kind of job — the ones where the client knew something was wrong, but not exactly what. Instead of carrying on separately, we built a studio for that work.",
            "Planet بدأت كمجموعة صغيرة من المصممين والكتّاب والمسوّقين كانوا بيشتغلوا مع بعض على نفس نوع الشغل — الشغلانات اللي العميل فيها عارف إن فيه حاجة غلط، بس مش عارف إيه بالظبط. فبدل ما كل واحد يكمّل لوحده، عملنا استوديو للشغل ده."),
          L("We work with hospitals and clinics, charities, financial companies, restaurants and hotels. Their customers are choosing who to trust, so we would rather prove something than shout about it.",
            "بنشتغل مع مستشفيات وعيادات، وجمعيات خيرية، وشركات مالية، ومطاعم وفنادق. عملاءهم بيختاروا يثقوا في مين، فإحنا بنفضّل نثبت بدل ما نزعّق.")],
  mission: L("To make marketing that connects with people before it sells to them — and holds their attention long enough to matter.","تسويق يتواصل مع الناس قبل ما يبيعلهم — ويمسك انتباههم وقت كفاية عشان يفرق."),
  vision: L("A region where the most creative work is also the most carefully made, and where brands from Cairo can stand beside the best anywhere in the world.","منطقة فيها أكتر الشغل إبداعاً هو كمان أكتره إتقاناً، وعلامات من القاهرة تقف جنب أحسن العلامات في العالم."),
  missionH: L("Mission","المهمة"), visionH: L("Vision","الرؤية"), valuesH: L("What we believe","اللي بنؤمن بيه"),
  values: [
    [L("Precise","دقيقين"), L("Every decision has a reason we can explain to you.","كل قرار وراه سبب نقدر نشرحهولك.")],
    [L("Magnetic","جاذبين"), L("We would rather draw people in than interrupt them.","بنفضّل نجذب الناس بدل ما نقاطعهم.")],
    [L("At home in Arabic and English","في بيتنا بالعربي والإنجليزي"), L("We write in both languages from the start, so the Arabic sounds natural.","بنكتب باللغتين من الأول، فالعربي بيطلع طبيعي مش مترجم.")],
    [L("Quietly playful","مرحين بهدوء"), L("Serious work does not have to be dull.","الشغل الجد مش لازم يبقى ممل.")],
    [L("Proof over promise","الدليل قبل الوعد"), L("If we claim something, we show the number or the example behind it.","لو قلنا حاجة، بنوريك الرقم أو المثال اللي وراها.")],
    [L("Built to hand over","معمول عشان يتسلّم"), L("We build things your team can run without us.","بنبني حاجات فريقك يقدر يشغّلها من غيرنا.")],
  ],
};

/* clients from the studio's records that have no logo file on theplanetco.com — shown as name badges */
[['Maestro','مايسترو'], ['Smartiva','سمارتيفا'], ['Dantel','دانتيل'], ['Boat Battana','بوت بطانة']]
  .forEach(([en, ar]) => CLIENTS.push({ name: L(en, ar), logo: '', cover: '', work: '' }));

/* industries we know from the studio's records, for the gallery entries that have a cover but no written case */
const CLIENT_IND = {
  uber: L("FMCG","سلع استهلاكية"), value: L("Dental clinics","عيادات أسنان"), lorya: L("Retail brand","براند تجاري"),
  aljamalla: L("Restaurants & cafés","مطاعم وكافيهات"), westeros: L("Restaurants & cafés","مطاعم وكافيهات"), alshawwa: L("Restaurants & cafés","مطاعم وكافيهات"),
  jagal: L("Services","خدمات"), 'mo-adel': L("Professional services","خدمات مهنية"), hnaif: L("Travel & Tourism","السفر والسياحة"),
  tadawa: L("Healthcare","الرعاية الصحية"), 'implant-gate': L("Dentistry","طب الأسنان"),
};
/* every client with a cover joins the gallery, so a visit shows 20+ pieces, not only the 8 written cases */
CLIENTS.filter(c => c.cover && !c.work).forEach(c => WORK.push({
  id: 'c-' + c.cover, name: c.name, ind: CLIENT_IND[c.cover] || L("Planet client","عميل Planet"), year: '', logo: c.logo,
  imgs: ['covers/' + c.cover + '.jpg'], svc: [], sum: null,
}));

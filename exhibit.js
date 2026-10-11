/* In-game showcases: when you finish talking at a place, its real content pops up as a game screen —
   the gallery shows our work, the monument our clients, the careers office the team, each studio its service.
   Shares lang / t / $ / Sfx / state with game.js (classic scripts share one global scope). */

const X = {
  close: L("Back to the planet", "ارجع للكوكب"),
  next: L("Next", "التالي"), prev: L("Previous", "السابق"),
  get: L("What you get", "هتاخد إيه"), seen: L("Seen in", "اتعمل في"),
  ourWork: L("OUR WORK", "معرض الأعمال"), clients: L("OUR CLIENTS", "عملاؤنا"), team: L("THE CREW", "طاقم الكوكب"),
  products: L("PRODUCTS LAB", "معمل المنتجات"), about: L("WHO WE ARE", "إحنا مين"), contact: L("SAY HELLO", "قول أهلاً"),
  tapLogo: L("Tap a glowing logo to open its story.", "دوس على أي لوجو منوّر يفتحلك قصته."),
  tapCard: L("Tap a card to flip it.", "دوس على أي كارت يتقلب."),
  of370: L("of 370+ brands", "من أكتر من 370 علامة"),
  collected: L("collected", "اتجمعوا"),
  everyone: L("Everyone", "الكل"),
  start: L("Start a project", "ابدأ مشروعك"),
  more: L("One of the 370+ brands we have worked with. Ask us about this project.", "واحدة من أكتر من 370 علامة اشتغلنا معاها. اسألنا عن المشروع ده."),
};

const xsvc = id => t(POIS.find(p => p.id === id).name);
function linksHTML(key){
  const ar = lang === 'ar', lk = CLIENT_LINKS[key] || {}, ic = { website: ['🌐', ar ? 'الموقع' : 'Website'], instagram: ['📸', 'Instagram'], facebook: ['👍', 'Facebook'], tiktok: ['🎵', 'TikTok'], linkedin: ['💼', 'LinkedIn'], whatsapp: ['💬', 'WhatsApp'] };
  const ks = Object.keys(ic).filter(k => lk[k]); return ks.length ? `<div class="clinks">${ks.map(k => `<a href="${lk[k]}" target="_blank" rel="noopener">${ic[k][0]} ${ic[k][1]}</a>`).join('')}</div>` : '';
}
const xshuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--){ const j = Math.random()*(i + 1)|0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const xini = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const EXTRA = {};
let xRender = null, xKeys = null, xPrevState = 'play', xAfter = null;

function openExhibit(kind, arg, after){
  const build = EXHIBITS[kind]; if (!build) return;
  xPrevState = state === 'exhibit' ? xPrevState : state; state = 'exhibit'; releaseAll(); $('prompt').hidden = true;
  Sfx.open(); Sfx.duck(0.55);
  $('exhibit').hidden = false; $('exhibit').className = 'layer ex-' + kind;
  if (after !== undefined) xAfter = after; xKeys = null; xRender = () => build(arg); xRender();
}
function closeExhibit(){
  if (state !== 'exhibit') return;
  $('exhibit').hidden = true; state = xPrevState === 'exhibit' ? 'play' : xPrevState; xRender = xKeys = null;
  Sfx.close(); Sfx.duck(1); canvas.focus();
  const a = xAfter; xAfter = null; a && setTimeout(a, 300);
}
function shell(tag, title, inner, foot = ''){
  $('exbody').innerHTML = `<div class="ex-head"><span class="ex-tag">${t(tag)}</span><h2>${title}</h2></div>${inner}${foot}`;
  $('exbody').scrollTop = 0;
  // any service tag opens that service's screen
  $('exbody').onclick = svcTap;
}
function svcTap(e){ const b = e.target.closest('[data-svc]'); if (b && state === 'exhibit'){ e.stopPropagation(); Sfx.click(); openExhibit('service', b.dataset.svc); } }

const EXHIBITS = {
  /* one case at a time, like walking past framed pieces */
  work(start = 0){
    // a fresh order every visit; a specific piece (from a logo or a studio) opens first
    const list = xshuffle(WORK);
    if (typeof start === 'string'){ const k = list.findIndex(w => w.id === start); if (k > 0) list.unshift(...list.splice(k, 1)); }
    let i = 0;
    const draw = () => {
      const w = list[i];
      shell(X.ourWork, `<span class="ex-count">${String(i + 1).padStart(2,'0')}<small>/${String(list.length).padStart(2,'0')}</small></span>`, `
        <div class="case-stage" key="${w.id}">
          <div class="frame"><div class="slides">${w.imgs.map((s, k) => `<img src="img/${s}" alt="" style="--k:${k}">`).join('')}</div>
            <span class="badge">${t(w.ind)}${w.year ? ' · ' + w.year : ''}</span></div>
          <div class="plaque">
            <img class="plogo" src="img/logos/${w.logo}.png" alt="">
            <h3>${t(w.name)}</h3>
            ${w.sum ? `<p>${t(w.sum)}</p>` : `<p class="soon">${t(X.more)}</p>`}
            <div class="chips">${w.svc.map(s => `<button type="button" data-svc="${s}">${xsvc(s)} ←</button>`).join('')}</div>
            ${w.quote ? `<blockquote>${t(w.quote)}</blockquote>` : ''}
            ${linksHTML(w.logo)}
          </div>
        </div>`, `
        <div class="ex-nav"><button type="button" class="ex-arrow" data-d="-1" aria-label="${t(X.prev)}">‹</button>
          <div class="dots">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <button type="button" class="ex-arrow" data-d="1" aria-label="${t(X.next)}">›</button></div>`);
      $('exbody').querySelectorAll('[data-d]').forEach(b => b.onclick = () => go(+b.dataset.d));
    };
    const go = d => { i = (i + d + list.length) % list.length; Sfx.click(); draw(); };
    // in RTL the "next" arrow sits on the left, so the arrow keys follow what you see
    xKeys = e => { if (e.code === 'ArrowLeft') go(lang === 'ar' ? 1 : -1); if (e.code === 'ArrowRight') go(lang === 'ar' ? -1 : 1); };
    draw();
  },

  /* a collection wall: logos pop in one by one, the counter rolls up */
  clients(){
    shell(X.clients, `<span class="roll" data-to="${CLIENTS.length}">0</span> <small>${t(X.of370)}</small>`, `
      <p class="ex-note">${t(X.tapLogo)}</p>
      <div class="wall">${xshuffle(CLIENTS).map((c, k) => { const open = c.work || (c.cover ? 'c-' + c.cover : '');
        return `<button type="button" class="ctile ${open ? 'has' : ''}" style="--d:${k * 40}ms" ${open ? `data-case="${open}"` : 'disabled'}>
          ${c.logo ? `<img src="img/logos/${c.logo}.png" alt="">` : `<span class="mono" style="--h:${(k * 53) % 360}">${xini(t(c.name))}</span>`}<span>${t(c.name)}</span></button>`; }).join('')}</div>`);
    const r = $('exbody').querySelector('.roll'); let n = 0;
    const tick = setInterval(() => { if (!r.isConnected) return clearInterval(tick); r.textContent = ++n; if (n % 3 === 0) Sfx.blip(); if (n >= +r.dataset.to) clearInterval(tick); }, 45);
    $('exbody').querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
  },

  /* trading cards that flip to show the role */
  team(){
    let dept = 'all';
    const depts = [...new Set(TEAM.map(m => m.dept))];
    const draw = () => {
      const list = TEAM.filter(m => dept === 'all' || m.dept === dept);
      shell(X.team, `${TEAM.length} <small>${lang === 'ar' ? 'شخص على الكوكب' : 'people on the planet'}</small>`, `
        <div class="ftabs">${['all', ...depts].map(d => `<button type="button" data-dept="${d}" class="${d === dept ? 'on' : ''}">${d === 'all' ? t(X.everyone) : t(DEPTS[d])}</button>`).join('')}</div>
        <p class="ex-note">${t(X.tapCard)}</p>
        <div class="deck">${list.map((m, k) => `
          <button type="button" class="tcard ${m.lead ? 'lead' : ''}" style="--d:${k * 55}ms;--h:${(parseInt(m.id.slice(4)) * 47) % 360}">
            <span class="face front">${m.photo ? `<img class="av ph" src="${m.photo}" alt="" loading="lazy">` : `<span class="av">${xini(t(m.name))}</span>`}<b>${t(m.name)}</b><small>${t(DEPTS[m.dept])}</small></span>
            <span class="face back"><b>${t(m.name)}</b><span>${t(m.title)}</span><i>★ Planet</i></span>
          </button>`).join('')}</div>`);
      $('exbody').querySelectorAll('[data-dept]').forEach(b => b.onclick = () => { dept = b.dataset.dept; Sfx.click(); draw(); });
      $('exbody').querySelectorAll('.tcard').forEach(c => c.onclick = () => { c.classList.toggle('flip'); Sfx.click(); });
    };
    draw();
  },

  /* a studio's service card: deliverables tick in one by one, with the projects that used it */
  service(id){
    const p = POIS.find(x => x.id === id), cases = WORK.filter(w => w.svc.includes(id));
    shell(L(`STUDIO ${p.n}`, `استوديو ${p.n}`), t(p.name), `
      <p class="ex-lead">${t(p.lines[0])}</p>
      <h4>${t(X.get)}</h4>
      <p class="ex-note">${lang === 'ar' ? 'اختار اللي محتاجه منها:' : 'Pick what you need:'}</p>
      <div class="ticks">${SERVICE_GETS[id].map((g, k) => `<button type="button" class="tk ${(brief.wants[id] || []).includes(k) ? 'on' : ''}" data-k="${k}" style="--d:${200 + k * 160}ms">${t(g)}</button>`).join('')}</div>
      <div class="sendrow"><button type="button" class="ex-cta" id="askSvc">📝 ${lang === 'ar' ? 'اطلب الخدمة دي' : 'Request this service'}</button></div>
      ${cases.length ? `<h4>${t(X.seen)}</h4><div class="minicases">${cases.map(w => `
        <button type="button" data-case="${w.id}"><img src="img/${w.imgs[0]}" alt=""><span>${t(w.name)}</span></button>`).join('')}</div>` : ''}`);
    $('exbody').querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
    $('exbody').querySelectorAll('.tk').forEach(b => b.onclick = () => { const k = +b.dataset.k, cur = brief.wants[id] || [];
      brief.wants[id] = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]; b.classList.toggle('on'); Sfx.click(); });
    $('askSvc').onclick = () => { if (!brief.svcs.includes(id)) brief.svcs.push(id); if (!(brief.wants[id] || []).length) brief.wants[id] = SERVICE_GETS[id].map((_, k) => k);
      brief.step = 0; openExhibit('brief'); };
    SERVICE_GETS[id].forEach((_, k) => setTimeout(() => state === 'exhibit' && Sfx.blip(), 200 + k * 160));
  },

  products(){
    const lab = POIS.find(p => p.id === 'lab'), acad = POIS.find(p => p.id === 'academy');
    shell(X.products, lang === 'ar' ? 'حاجات بنبنيها بنفسنا' : 'Things we build ourselves',
      `<div class="pods">${[...lab.lines.slice(1), acad.lines[0]].map((l, k) => { const [a, ...b] = t(l).split(/ — /);
        return `<div class="pod" style="--d:${k * 140}ms"><span class="orb">${['📈','🤖','🎓'][k]}</span><b>${a}</b><span>${b.join(' — ')}</span></div>`; }).join('')}</div>`);
  },

  about(){
    shell(X.about, lang === 'ar' ? 'إزاي Planet بدأت' : 'How Planet started', `
      ${ABOUT.story.map(p => `<p class="ex-lead">${t(p)}</p>`).join('')}
      <div class="mv"><div><h4>${t(ABOUT.missionH)}</h4><p>${t(ABOUT.mission)}</p></div><div><h4>${t(ABOUT.visionH)}</h4><p>${t(ABOUT.vision)}</p></div></div>
      <h4>${t(ABOUT.valuesH)}</h4>
      <div class="vals">${ABOUT.values.map(([h, d], k) => `<div style="--d:${k * 90}ms"><span>0${k + 1}</span><b>${t(h)}</b><small>${t(d)}</small></div>`).join('')}</div>`);
  },

  contact(){
    const ar = lang === 'ar';
    const C = [
      ['💬', 'WhatsApp', '+20 120 310 1104', 'https://wa.me/201203101104', 'wa'],
      ['📞', ar ? 'اتصل بينا' : 'Call us', '+20 120 310 1104', 'tel:+201203101104'],
      ['✉️', t(UI.email), 'info@theplanetco.com', 'mailto:info@theplanetco.com'],
      ['🌐', ar ? 'الموقع' : 'Website', 'theplanetco.com', 'https://theplanetco.com'],
      ['📸', 'Instagram', '@planet4cm', 'https://instagram.com/planet4cm', 'ig'],
      ['👍', 'Facebook', 'planet4cm', 'https://facebook.com/planet4cm', 'fb'],
      ['💼', 'LinkedIn', 'planet4cm', 'https://linkedin.com/company/planet4cm', 'li'],
      ['▶️', 'YouTube', '@planet4cm', 'https://youtube.com/@planet4cm', 'yt'],
      ['📍', t(UI.studio), t(UI.studioV), 'https://maps.google.com/?q=30.0131,31.4969'],
    ];
    shell(X.contact, t(UI.finalH), `
      <p class="ex-lead">${t(UI.finalP)}</p>
      <div class="cgrid">${C.map(([ic, n, v, u, k], i) => `<a class="${k || ''}" href="${u}" ${u.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} style="--d:${i * 60}ms"><span>${ic}</span><b>${n}</b><small dir="ltr">${v}</small></a>`).join('')}</div>
      <p class="ex-note">${t(UI.hours)}: ${t(UI.hoursV)}</p>
      <div class="sendrow"><button type="button" class="ex-cta" id="tobrief">📝 ${ar ? 'اعمل بريفك في دقيقة' : 'Build your brief in a minute'}</button>
        <a class="ex-cta light" href="https://theplanetco.com/contact" target="_blank" rel="noopener">${t(X.start)} →</a></div>`);
    $('tobrief').onclick = () => openExhibit('brief');
  },
};

/* which showcase each place opens */
const PLACE_EXHIBIT = { gallery: ['work', 0], fly: ['work', 'fly29'], monument: ['clients'], careers: ['team'], cafe: ['team'],
  lab: ['products'], academy: ['quiz'], process: ['brief'], observatory: ['about'], lighthouse: ['about'], values: ['about'], hq: ['contact'] };
function exhibitFor(p){
  if (p.client) return () => openExhibit('client', p.client.logo || p.client.name.en);
  if (p.svc) return () => openExhibit('service', p.id);
  const e = PLACE_EXHIBIT[p.id]; return e ? () => openExhibit(e[0], e[1]) : null;
}

$('exclose').onclick = closeExhibit;
$('exhibit').addEventListener('click', e => { if (e.target.id === 'exhibit') closeExhibit(); });
addEventListener('keydown', e => {
  if (state !== 'exhibit') return;
  if (e.code === 'Escape' || e.code === 'KeyE' && !e.target.closest('a,button')){ closeExhibit(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (xKeys) xKeys(e);
}, true);

/* ---------- brief builder: a few questions, then the services that fit, a client like you, and a ready WhatsApp message ---------- */
const INDS = [
  ['food', L("Restaurants & cafés","مطاعم وكافيهات"), '🍽️', 'qidra'], ['health', L("Medical & clinics","طبي وعيادات"), '🩺', 'gms'],
  ['estate', L("Real estate","عقارات"), '🏙️', 'mavi'], ['travel', L("Travel & tourism","سفر وسياحة"), '✈️', 'fly29'],
  ['finance', L("Finance & investment","مالية واستثمار"), '📊', 'united'], ['legal', L("Legal & professional","خدمات قانونية ومهنية"), '⚖️', 'wakeelak'],
  ['retail', L("Retail & products","براند ومنتجات"), '🛍️', 'c-lorya'], ['charity', L("Non-profit","عمل خيري"), '🤝', 'zaytouna'],
  ['other', L("Something else","حاجة تانية"), '✨', 'terhal'],
];
const GOALS = [
  ['known', L("People don't know us yet","الناس لسه مش عارفانا"), ['s1','s2','s4']],
  ['sales', L("We need more sales or bookings","محتاجين مبيعات أو حجوزات أكتر"), ['s7','s3','s4']],
  ['content', L("We need steady content","محتاجين محتوى منتظم"), ['s3','s5']],
  ['launch', L("We have a launch coming","عندنا إطلاق جديد"), ['s4','s5','s7']],
  ['site', L("We need a website","محتاجين موقع"), ['s6']],
  ['team', L("Our team needs direction","فريقنا محتاج توجيه"), ['s8','s1']],
];
const BUDGETS = [L("Not sure yet","لسه مش متأكد"), L("Under 20k EGP / month","أقل من 20 ألف جنيه شهرياً"), L("20k – 60k EGP / month","20 – 60 ألف جنيه شهرياً"), L("60k+ EGP / month","أكتر من 60 ألف جنيه شهرياً")];
const brief = { step: 0, ind: null, goals: [], budget: 0, name: '', company: '', svcs: [], wants: {} };
const BQ = L("Build your brief","اعمل بريفك");
function recommend(){
  const score = {}; brief.svcs.forEach(id => score[id] = 100); brief.goals.forEach(g => GOALS.find(x => x[0] === g)[2].forEach((s, k) => score[s] = (score[s] || 0) + 3 - k));
  return Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 3);
}
function wantLines(lg){
  return Object.entries(brief.wants).filter(([, ks]) => ks.length).map(([id, ks]) => `• ${POIS.find(p => p.id === id).name[lg]}: ${ks.map(k => SERVICE_GETS[id][k][lg]).join(lg === 'ar' ? '، ' : ', ')}`);
}
function briefMessage(){
  const ind = INDS.find(x => x[0] === brief.ind), ar = lang === 'ar';
  const lines = ar
    ? ['أهلاً Planet 👋', `أنا ${brief.name || '—'}${brief.company ? ' من ' + brief.company : ''}.`, `المجال: ${ind ? ind[1].ar : '—'}`,
       `اللي محتاجينه: ${brief.goals.map(g => GOALS.find(x => x[0] === g)[1].ar).join('، ') || '—'}`, `الخدمات المقترحة: ${recommend().map(id => POIS.find(p => p.id === id).name.ar).join('، ')}`, `الميزانية: ${BUDGETS[brief.budget].ar}`, ...wantLines('ar'), '(من كوكب Planet)']
    : ['Hi Planet 👋', `I'm ${brief.name || '—'}${brief.company ? ' from ' + brief.company : ''}.`, `Industry: ${ind ? ind[1].en : '—'}`,
       `What we need: ${brief.goals.map(g => GOALS.find(x => x[0] === g)[1].en).join(', ') || '—'}`, `Suggested services: ${recommend().map(id => POIS.find(p => p.id === id).name.en).join(', ')}`, `Budget: ${BUDGETS[brief.budget].en}`, ...wantLines('en'), '(sent from the Planet game)'];
  return lines.join('\n');
}
EXTRA.brief = () => {
  const ar = lang === 'ar', steps = 4, st = brief.step;
  const bar = `<div class="qbar"><i style="width:${(st / steps) * 100}%"></i></div>`;
  const nav = (canNext, label) => `<div class="qnav">${st ? `<button type="button" class="qback">${ar ? '← رجوع' : '← Back'}</button>` : '<span></span>'}
      <button type="button" class="qnext" ${canNext ? '' : 'disabled'}>${label || (ar ? 'التالي ←' : 'Next →')}</button></div>`;
  let body = '';
  if (st === 0) body = `<p class="ex-lead">${ar ? 'شغلك في أنهي مجال؟' : 'What field are you in?'}</p>
    <div class="opts">${INDS.map(([id, n, ic]) => `<button type="button" class="opt ${brief.ind === id ? 'on' : ''}" data-ind="${id}"><span>${ic}</span>${t(n)}</button>`).join('')}</div>${nav(!!brief.ind)}`;
  if (st === 1) body = `<p class="ex-lead">${ar ? 'إيه اللي محتاجه دلوقتي؟ (اختار أكتر من واحدة)' : 'What do you need right now? (pick any)'}</p>
    <div class="opts col">${GOALS.map(([id, n]) => `<button type="button" class="opt ${brief.goals.includes(id) ? 'on' : ''}" data-goal="${id}"><span>${brief.goals.includes(id) ? '✓' : '+'}</span>${t(n)}</button>`).join('')}</div>${nav(brief.goals.length > 0 || brief.svcs.length > 0)}`;
  if (st === 2) body = `<p class="ex-lead">${ar ? 'الميزانية التقريبية؟' : 'Rough budget?'}</p>
    <div class="opts col">${BUDGETS.map((b, k) => `<button type="button" class="opt ${brief.budget === k ? 'on' : ''}" data-bud="${k}"><span>${'💰'.repeat(Math.max(1, k))}</span>${t(b)}</button>`).join('')}</div>${nav(true)}`;
  if (st === 3) body = `<p class="ex-lead">${ar ? 'وأخيراً، نكلّم مين؟' : 'Last one — who do we talk to?'}</p>
    <label class="fld">${ar ? 'اسمك' : 'Your name'}<input id="bname" value="${(brief.name || '').replace(/"/g,'&quot;')}" autocomplete="name"></label>
    <label class="fld">${ar ? 'اسم الشركة أو البراند' : 'Company or brand'}<input id="bco" value="${(brief.company || '').replace(/"/g,'&quot;')}" autocomplete="organization"></label>${nav(true, ar ? 'شوف النتيجة ✨' : 'See my plan ✨')}`;
  if (st === 4){
    const rec = recommend(), ind = INDS.find(x => x[0] === brief.ind), like = WORK.find(w => w.id === ind[3]) || WORK[0], msg = briefMessage();
    body = `<p class="ex-lead">${ar ? `${brief.name ? brief.name + '، ' : ''}دي الخطة اللي نقترحها:` : `${brief.name ? brief.name + ', ' : ''}here is what we'd suggest:`}</p>
      <div class="recs">${rec.map((id, k) => { const p = POIS.find(x => x.id === id); return `<div class="rec" style="--d:${k * 140}ms"><span class="n">${p.n}</span><b>${t(p.name)}</b><small>${t(p.lines[0])}</small></div>`; }).join('')}</div>
      <h4>${ar ? 'عميل زيك' : 'A client like you'}</h4>
      <button type="button" class="like" data-case="${like.id}"><img src="img/${like.imgs[0]}" alt=""><span><b>${t(like.name)}</b><small>${like.sum ? t(like.sum) : t(like.ind)}</small></span></button>
      <div class="sendrow">
        <a class="ex-cta wa" target="_blank" rel="noopener" href="https://wa.me/201203101104?text=${encodeURIComponent(msg)}">💬 ${ar ? 'ابعت البريف على واتساب' : 'Send on WhatsApp'}</a>
        <a class="ex-cta light" href="mailto:info@theplanetco.com?subject=${encodeURIComponent(ar ? 'بريف جديد' : 'New brief')}&body=${encodeURIComponent(msg)}">✉️ ${ar ? 'أو بالإيميل' : 'or by email'}</a>
        <button type="button" class="qback">${ar ? 'عدّل إجاباتي' : 'Edit answers'}</button>
      </div>`;
  }
  shell(BQ, ar ? `خطوة ${Math.min(st + 1, 5)} من 5` : `Step ${Math.min(st + 1, 5)} of 5`, bar + `<div class="qstep">${body}</div>`);
  const B = $('exbody'), redraw = () => { Sfx.click(); xRender(); };
  B.querySelectorAll('[data-ind]').forEach(b => b.onclick = () => { brief.ind = b.dataset.ind; brief.step = 1; redraw(); });
  B.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { const g = b.dataset.goal; brief.goals = brief.goals.includes(g) ? brief.goals.filter(x => x !== g) : [...brief.goals, g]; redraw(); });
  B.querySelectorAll('[data-bud]').forEach(b => b.onclick = () => { brief.budget = +b.dataset.bud; brief.step = 3; redraw(); });
  const keep = () => { if ($('bname')){ brief.name = $('bname').value.trim().slice(0, 60); brief.company = $('bco').value.trim().slice(0, 60); } };
  B.querySelector('.qnext')?.addEventListener('click', () => { keep(); brief.step++; if (brief.step === 4) Sfx.deliver(); redraw(); });
  B.querySelectorAll('.qback').forEach(b => b.onclick = () => { keep(); brief.step = st === 4 ? 0 : st - 1; redraw(); });
  B.querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
  if (st === 3) setTimeout(() => $('bname')?.focus(), 50);
};

/* ---------- logo quiz at the academy: which client made this? ---------- */
const QUIZ_N = 5;
let quiz = null;
EXTRA.quiz = () => {
  const ar = lang === 'ar';
  if (!quiz){ const pool = xshuffle(WORK.filter(w => w.logo)).slice(0, QUIZ_N);
    quiz = { qs: pool.map(w => ({ w, opts: xshuffle([w, ...xshuffle(WORK.filter(o => o.logo && o.id !== w.id)).slice(0, 2)]) })), i: 0, score: 0, picked: null }; }
  if (quiz.i >= QUIZ_N){
    const best = Math.max(save.q || 0, quiz.score); save.q = best; persist();
    shell(L("ACADEMY QUIZ","مسابقة الأكاديمية"), `${quiz.score}/${QUIZ_N}`, `
      <div class="qdone"><span class="big">${quiz.score === QUIZ_N ? '🏆' : quiz.score >= 3 ? '🎉' : '💪'}</span>
      <p class="ex-lead">${quiz.score === QUIZ_N ? (ar ? 'ممتاز! انت تعرف شغلنا كويس.' : 'Perfect! You know our work.') : (ar ? `جبت ${quiz.score} من ${QUIZ_N}. أعلى نتيجة ليك: ${best}.` : `You got ${quiz.score} of ${QUIZ_N}. Your best: ${best}.`)}</p>
      <button type="button" class="ex-cta" id="qagain">${ar ? 'العب تاني' : 'Play again'}</button></div>`);
    if (quiz.score === QUIZ_N) Sfx.finish(); else Sfx.deliver();
    $('qagain').onclick = () => { quiz = null; Sfx.click(); xRender(); };
    return;
  }
  const q = quiz.qs[quiz.i];
  shell(L("ACADEMY QUIZ","مسابقة الأكاديمية"), ar ? `السؤال ${quiz.i + 1} من ${QUIZ_N}` : `Question ${quiz.i + 1} of ${QUIZ_N}`, `
    <div class="qbar"><i style="width:${(quiz.i / QUIZ_N) * 100}%"></i></div>
    <p class="ex-lead">${ar ? 'الشغل ده لأنهي عميل؟' : 'Which client is this work for?'} <b class="qscore">★ ${quiz.score}</b></p>
    <div class="qimg"><img src="img/${q.w.imgs[0]}" alt=""></div>
    <div class="qopts">${q.opts.map(o => `<button type="button" class="qopt ${quiz.picked ? (o.id === q.w.id ? 'right' : o.id === quiz.picked ? 'wrong' : '') : ''}" data-q="${o.id}" ${quiz.picked ? 'disabled' : ''}>
      <img src="img/logos/${o.logo}.png" alt=""><span>${t(o.name)}</span></button>`).join('')}</div>`);
  $('exbody').querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    quiz.picked = b.dataset.q; const ok = quiz.picked === q.w.id; if (ok){ quiz.score++; Sfx.collect(); } else Sfx.land();
    xRender(); setTimeout(() => { if (state !== 'exhibit' || !quiz) return; quiz.i++; quiz.picked = null; xRender(); }, 1300);
  });
};

/* ---------- certificate: a shareable card with the visitor's name and progress ---------- */
EXTRA.cert = () => {
  const ar = lang === 'ar';
  shell(L("YOUR CERTIFICATE","شهادتك"), ar ? 'شارك رحلتك على الكوكب' : 'Share your trip around the planet', `
    <label class="fld">${ar ? 'اسمك على الشهادة' : 'Your name on the card'}<input id="cname" value="${(store.get('pm-name') || brief.name || '').replace(/"/g,'&quot;')}" maxlength="40"></label>
    <canvas id="certcv" width="1080" height="1350" class="certcv"></canvas>
    <div class="sendrow"><button type="button" class="ex-cta" id="cshare">${ar ? '📤 شارك' : '📤 Share'}</button><button type="button" class="ex-cta light" id="csave">${ar ? '⬇️ احفظ الصورة' : '⬇️ Save image'}</button></div>`);
  const draw = () => drawCert($('certcv'), $('cname').value.trim());
  $('cname').oninput = () => { store.set('pm-name', $('cname').value.trim()); draw(); };
  const blob = () => new Promise(r => $('certcv').toBlob(r, 'image/png'));
  $('csave').onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await blob()); a.download = 'planet-certificate.png'; a.click(); Sfx.click(); };
  $('cshare').onclick = async () => { const f = new File([await blob()], 'planet-certificate.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: ar ? 'لفّيت كوكب Planet 🪐 theplanetco.com' : 'I explored Planet 🪐 theplanetco.com' }).catch(() => {});
    else $('csave').click(); };
  const logo = new Image(); logo.onload = draw; logo.src = 'logo.png'; drawCert.logo = logo; draw();
};
function drawCert(cv, name){
  const x = cv.getContext('2d'), W = 1080, H = 1350, ar = lang === 'ar';
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12153A'); g.addColorStop(1, '#2E6BA9'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++){ x.fillStyle = `rgba(255,255,255,${0.15 + (i * 37 % 60) / 100})`; x.beginPath(); x.arc((i * 263) % W, (i * 151) % 700, (i % 3) + 1, 0, 7); x.fill(); }
  x.fillStyle = '#5E9F5E'; x.beginPath(); x.arc(W / 2, H + 420, 900, 0, 7); x.fill(); x.strokeStyle = '#12153A'; x.lineWidth = 14; x.stroke();
  x.fillStyle = '#F4F7FC'; x.strokeStyle = '#12153A'; x.lineWidth = 10; x.beginPath(); x.roundRect ? x.roundRect(90, 230, 900, 760, 28) : x.rect(90, 230, 900, 760); x.fill(); x.stroke();
  if (drawCert.logo && drawCert.logo.complete && drawCert.logo.naturalWidth) x.drawImage(drawCert.logo, W / 2 - 60, 110, 120, 120 * drawCert.logo.naturalHeight / drawCert.logo.naturalWidth);
  x.textAlign = 'center'; x.direction = ar ? 'rtl' : 'ltr';
  const font = (w, s) => `${w} ${s}px ${ar ? 'IBM Plex Sans Arabic' : 'Montserrat'}, sans-serif`;
  x.fillStyle = '#2E6BA9'; x.font = font(800, 40); x.fillText(ar ? 'شهادة ساعي كوكب Planet' : 'PLANET MESSENGER CERTIFICATE', W / 2, 320);
  x.fillStyle = '#12153A'; x.font = font(800, 84); x.fillText(name || (ar ? 'ضيف الكوكب' : 'Planet guest'), W / 2, 450);
  x.font = font(600, 34); x.fillStyle = '#3a4566'; x.fillText(ar ? 'لفّ الكوكب واتعرّف على شغلنا' : 'explored the planet and met our work', W / 2, 520);
  const stats = [[`${save.d.length}/8`, ar ? 'بريفات' : 'briefs'], [`${save.p.length}/${N_POI}`, ar ? 'أماكن' : 'places'], [`${save.s.length}/40`, ar ? 'نجوم' : 'stars'], [`${save.q || 0}/${QUIZ_N}`, ar ? 'المسابقة' : 'quiz']];
  stats.forEach(([n, l], k) => { const cx = 210 + k * 220; x.fillStyle = '#F2C94C'; x.beginPath(); x.arc(cx, 700, 92, 0, 7); x.fill(); x.lineWidth = 8; x.stroke();
    x.fillStyle = '#12153A'; x.font = '900 46px Orbitron, Montserrat, sans-serif'; x.fillText(n, cx, 712); x.font = font(700, 30); x.fillText(l, cx, 840); });
  x.font = font(700, 30); x.fillStyle = '#2E6BA9'; x.fillText(new Date().toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }), W / 2, 930);
  x.fillStyle = '#F4F7FC'; x.font = '800 40px Montserrat, sans-serif'; x.fillText('game.theplanetco.com', W / 2, 1260);
}

/* ---------- WhatsApp from anywhere, telling us where on the planet you are ---------- */
$('wa').onclick = () => {
  const near = typeof pDir !== 'undefined' && pois.length ? pois[poiDist(pDir)[1]] : null;
  const msg = lang === 'ar' ? `أهلاً Planet 👋 أنا بلعب على الكوكب${near ? ` وواقف عند ${near.name.ar}` : ''} وعايز أتكلم معاكم.` : `Hi Planet 👋 I'm on your planet${near ? ` at the ${near.name.en}` : ''} and I'd like to talk.`;
  Sfx.click(); window.open('https://wa.me/201203101104?text=' + encodeURIComponent(msg), '_blank', 'noopener');
};
$('dn').onclick = () => { dnMode = { auto: isNight() ? 'day' : 'night', day: 'night', night: 'auto' }[dnMode]; store.set('pm-dn', dnMode); applyDayNight(); Sfx.click();
  mini(dnMode === 'auto' ? (lang === 'ar' ? '🕐 حسب ساعتك' : '🕐 Following your clock') : dnMode === 'night' ? (lang === 'ar' ? '🌙 ليل' : '🌙 Night') : (lang === 'ar' ? '☀️ نهار' : '☀️ Day')); };


/* ---------- a client's place: their story and every piece we delivered for them ---------- */
EXTRA.client = key => {
  const c = CLIENTS.find(x => (x.logo || x.name.en) === key); if (!c) return;
  const ar = lang === 'ar', w = WORK.find(x => x.id === c.work), imgs = clientGallery(c);
  const dk = Object.keys(DISTRICTS).find(k => DISTRICTS[k].clients.includes(c.logo)), D = dk && DISTRICTS[dk];
  shell(D ? L(`${D.icon} ${D.name.en}`, `${D.icon} ${D.name.ar}`) : X.clients, `${c.logo ? `<img class="hlogo" src="img/logos/${c.logo}.png" alt="">` : ''}${t(c.name)}`, `
    ${w && w.sum ? `<p class="ex-lead">${t(w.sum)}</p>` : `<p class="ex-lead">${ar ? `شغل اتسلّم لـ${c.name.ar} — من أكتر من 370 علامة اشتغلنا معاها.` : `Selected creatives delivered for ${c.name.en} — one of the 370+ brands we work with.`}</p>`}
    ${w && w.svc.length ? `<div class="chips">${w.svc.map(s2 => `<button type="button" data-svc="${s2}">${xsvc(s2)} ←</button>`).join('')}${w.year ? `<span>${w.year}</span>` : ''}</div>` : ''}
    ${w && w.quote ? `<blockquote>${t(w.quote)}</blockquote>` : ''}
    ${linksHTML(c.logo)}
    <h4>${ar ? `أعمالنا لـ${c.name.ar}` : `Our work for ${c.name.en}`} <small class="cnt">${imgs.length}</small></h4>
    <div class="cgal">${imgs.map((src, k) => `<button type="button" class="cg" data-i="${k}" style="--d:${k * 50}ms"><img src="img/${src}" alt="" loading="lazy"></button>`).join('')}</div>
    <div class="sendrow"><button type="button" class="ex-cta" id="likethis">${ar ? '✨ عايز شغل زي ده؟ اعمل بريفك' : '✨ Want work like this? Build your brief'}</button></div>
    <div class="lightbox" id="lb" hidden><button type="button" class="lbx">✕</button><button type="button" class="lba" data-l="-1">‹</button><img id="lbimg" alt=""><button type="button" class="lba" data-l="1">›</button><span id="lbn" dir="ltr"></span></div>`);
  let li = 0; const lb = $('lb'), show = k => { li = (k + imgs.length) % imgs.length; $('lbimg').src = 'img/' + imgs[li]; $('lbn').textContent = `${li + 1} / ${imgs.length}`; lb.hidden = false; };
  $('exbody').querySelectorAll('.cg').forEach(b => b.onclick = () => { Sfx.click(); show(+b.dataset.i); });
  lb.querySelectorAll('[data-l]').forEach(b => b.onclick = e => { e.stopPropagation(); show(li + (+b.dataset.l) * (ar ? -1 : 1)); Sfx.click(); });
  lb.querySelector('.lbx').onclick = () => lb.hidden = true;
  xKeys = e => { if (lb.hidden) return; if (e.code === 'ArrowLeft') show(li + (ar ? 1 : -1)); if (e.code === 'ArrowRight') show(li + (ar ? -1 : 1)); };
  $('likethis').onclick = () => { if (dk){ const ind = { food:'food', health:'health', travel:'travel', money:'estate', shop:'retail', pro:'legal' }[dk]; if (!brief.ind) brief.ind = ind; } openExhibit('brief'); };
};

/* ---------- one crew member, from the Moon ---------- */
EXTRA.member = id => {
  const m = TEAM.find(x => x.id === id); if (!m) return; const ar = lang === 'ar';
  const mates = TEAM.filter(x => x.dept === m.dept && x.id !== m.id);
  shell(L("THE CREW", "طاقم Planet"), t(m.name), `
    <div class="member">
      ${m.photo ? `<img class="mph" src="${m.photo}" alt="">` : `<span class="av big" style="--h:${(parseInt(m.id.slice(4)) * 47) % 360}">${xini(t(m.name))}</span>`}
      <div><p class="mrole">${t(m.title)}</p><p class="ex-note">${t(DEPTS[m.dept])}${m.lead ? (ar ? ' · الإدارة' : ' · Leadership') : ''}</p>
        ${mates.length ? `<h4>${ar ? 'في نفس الفريق' : 'Same team'}</h4><div class="mates">${mates.map(x => `<button type="button" data-m="${x.id}">${x.photo ? `<img src="${x.photo}" alt="">` : ''}<span>${t(x.name)}</span></button>`).join('')}</div>` : ''}
      </div>
    </div>`);
  $('exbody').querySelectorAll('[data-m]').forEach(b => b.onclick = () => openExhibit('member', b.dataset.m));
};

Object.assign(EXHIBITS, EXTRA);

/* ---------- install as an app (Android/desktop: the browser's own prompt; iPhone: the Share-sheet steps) ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const showInstall = on => { $('install').hidden = $('install2').hidden = !on; };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; showInstall(true); });
if (isIOS && !standalone) showInstall(true);
addEventListener('appinstalled', () => { showInstall(false); mini(lang === 'ar' ? '📲 Planet بقى على شاشتك' : '📲 Planet is on your home screen'); });
$('install2').onclick = () => $('install').onclick();
$('install').onclick = async () => {
  Sfx.click();
  if (installEvt){ installEvt.prompt(); const ch = await installEvt.userChoice; installEvt = null; if (ch && ch.outcome === 'accepted') showInstall(false); return; }
  const ar = lang === 'ar', steps = isIOS
    ? [ar ? 'دوس على زرار <b>المشاركة</b> ⬆️ (تحت في Safari، أو فوق في Chrome)' : 'Tap the <b>Share</b> ⬆️ button (bottom in Safari, top in Chrome)',
       ar ? 'انزل واختار <b>إضافة إلى الشاشة الرئيسية</b> ➕' : 'Scroll and choose <b>Add to Home Screen</b> ➕',
       ar ? 'دوس <b>إضافة</b> — وهتلاقي أيقونة Planet جنب تطبيقاتك' : 'Tap <b>Add</b> — the Planet icon joins your apps']
    : [ar ? 'افتح قائمة المتصفح <b>⋮</b> (فوق على اليمين)' : 'Open the browser menu <b>⋮</b> (top right)',
       ar ? 'اختار <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>' : 'Choose <b>Install app</b> or <b>Add to Home screen</b>',
       ar ? 'دوس <b>تثبيت</b> — وهتلاقي أيقونة Planet جنب تطبيقاتك' : 'Tap <b>Install</b> — the Planet icon joins your apps'];
  EXTRA.install = () => shell(L("INSTALL","ثبّت التطبيق"), ar ? 'Planet على شاشتك الرئيسية' : 'Planet on your home screen', `<ol class="steps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>`);
  EXHIBITS.install = EXTRA.install; openExhibit('install');
};
/* touch: run is a toggle, so pushing the stick to the edge just walks */
$('trun').onclick = () => { runToggle = !runToggle; $('trun').setAttribute('aria-pressed', runToggle); Sfx.click(); };

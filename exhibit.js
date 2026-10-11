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
};

const xsvc = id => t(POIS.find(p => p.id === id).name);
const xini = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
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
}

const EXHIBITS = {
  /* one case at a time, like walking past framed pieces */
  work(start = 0){
    let i = typeof start === 'number' ? start : Math.max(0, WORK.findIndex(w => w.id === start));
    const draw = () => {
      const w = WORK[i];
      shell(X.ourWork, `<span class="ex-count">${String(i + 1).padStart(2,'0')}<small>/${String(WORK.length).padStart(2,'0')}</small></span>`, `
        <div class="case-stage" key="${w.id}">
          <div class="frame"><div class="slides">${w.imgs.map((s, k) => `<img src="img/${s}" alt="" style="--k:${k}">`).join('')}</div>
            <span class="badge">${t(w.ind)} · ${w.year}</span></div>
          <div class="plaque">
            <img class="plogo" src="img/logos/${w.logo}.png" alt="">
            <h3>${t(w.name)}</h3>
            <p>${t(w.sum)}</p>
            <div class="chips">${w.svc.map(s => `<span>${xsvc(s)}</span>`).join('')}</div>
            ${w.quote ? `<blockquote>${t(w.quote)}</blockquote>` : ''}
          </div>
        </div>`, `
        <div class="ex-nav"><button type="button" class="ex-arrow" data-d="-1" aria-label="${t(X.prev)}">‹</button>
          <div class="dots">${WORK.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <button type="button" class="ex-arrow" data-d="1" aria-label="${t(X.next)}">›</button></div>`);
      $('exbody').querySelectorAll('[data-d]').forEach(b => b.onclick = () => go(+b.dataset.d));
    };
    const go = d => { i = (i + d + WORK.length) % WORK.length; Sfx.click(); draw(); };
    // in RTL the "next" arrow sits on the left, so the arrow keys follow what you see
    xKeys = e => { if (e.code === 'ArrowLeft') go(lang === 'ar' ? 1 : -1); if (e.code === 'ArrowRight') go(lang === 'ar' ? -1 : 1); };
    draw();
  },

  /* a collection wall: logos pop in one by one, the counter rolls up */
  clients(){
    shell(X.clients, `<span class="roll" data-to="${CLIENTS.length}">0</span> <small>${t(X.of370)}</small>`, `
      <p class="ex-note">${t(X.tapLogo)}</p>
      <div class="wall">${CLIENTS.map((c, k) => `
        <button type="button" class="tile ${c.work ? 'has' : ''}" style="--d:${k * 45}ms" ${c.work ? `data-case="${c.work}"` : 'disabled'}>
          <img src="img/logos/${c.logo}.png" alt=""><span>${t(c.name)}</span></button>`).join('')}</div>`);
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
            <span class="face front"><span class="av">${xini(t(m.name))}</span><b>${t(m.name)}</b><small>${t(DEPTS[m.dept])}</small></span>
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
      <ul class="ticks">${SERVICE_GETS[id].map((g, k) => `<li style="--d:${200 + k * 160}ms">${t(g)}</li>`).join('')}</ul>
      ${cases.length ? `<h4>${t(X.seen)}</h4><div class="minicases">${cases.map(w => `
        <button type="button" data-case="${w.id}"><img src="img/${w.imgs[0]}" alt=""><span>${t(w.name)}</span></button>`).join('')}</div>` : ''}`);
    $('exbody').querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
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
    shell(X.contact, t(UI.finalH), `
      <p class="ex-lead">${t(UI.finalP)}</p>
      <div class="cgrid">
        <a href="https://wa.me/201203101104" target="_blank" rel="noopener" style="--d:0ms"><span>💬</span><b>WhatsApp</b><small dir="ltr">+20 120 310 1104</small></a>
        <a href="mailto:info@theplanetco.com" style="--d:90ms"><span>✉️</span><b>${t(UI.email)}</b><small>info@theplanetco.com</small></a>
        <a href="https://maps.google.com/?q=30.0131,31.4969" target="_blank" rel="noopener" style="--d:180ms"><span>📍</span><b>${t(UI.studio)}</b><small>${t(UI.studioV)}</small></a>
        <a href="https://instagram.com/planet4cm" target="_blank" rel="noopener" style="--d:270ms"><span>📸</span><b>Instagram</b><small>@planet4cm</small></a>
      </div>
      <a class="ex-cta" href="https://theplanetco.com/contact" target="_blank" rel="noopener">${t(X.start)} →</a>`);
  },
};

/* which showcase each place opens */
const PLACE_EXHIBIT = { gallery: ['work', 0], fly: ['work', 'fly29'], monument: ['clients'], careers: ['team'], cafe: ['team'],
  lab: ['products'], academy: ['products'], observatory: ['about'], lighthouse: ['about'], values: ['about'], hq: ['contact'] };
function exhibitFor(p){
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

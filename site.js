/* The website layer: one scrolling page floating over the planet. The game is one button away ("Explore the planet").
   Relies on lang / t() from game.js (shared global scope) — renderSite() is called by applyLang(). */

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const SVC_POIS = POIS.filter(p => p.svc);
const svcName = id => t(POIS.find(p => p.id === id).name);
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const SECTIONS = ['work', 'clients', 'services', 'team', 'about', 'contact'];
let workFilter = 'all';

const ICON = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
};

function renderSite(){
  const S = SITE, nav = $('sitenav');
  nav.innerHTML = `<a href="#home" class="brand"><img src="logo.png" alt="Planet"></a>
    <div class="links">${SECTIONS.map(s => `<a href="#${s}">${t(S.nav[s])}</a>`).join('')}</div>
    <a href="#contact" class="btn gold sm">${t(S.cta)}</a>`;

  const hero = `<section id="home" class="hero">
    <div class="hero-in">
      <span class="kicker">${t(S.hero.kicker)}</span>
      <h1>${t(S.hero.h1)}</h1>
      <p class="lead">${t(S.hero.p)}</p>
      <div class="row-btns">
        <a href="#work" class="btn gold">${t(S.hero.seeWork)}</a>
        <a href="#contact" class="btn light">${t(S.cta)}</a>
        <button type="button" class="btn ghost" id="begin">🪐 ${t(S.explore)}</button>
      </div>
      <p class="hint-small">${t(S.exploreHint)}</p>
    </div>
    <div class="stats">${S.stats.map(([n, l]) => `<div><b>${n}</b><span>${t(l)}</span></div>`).join('')}</div>
    <div class="marquee" aria-label="${esc(t(S.hero.trusted))}"><div class="track">${[...CLIENTS, ...CLIENTS].map(c => `<img src="img/logos/${c.logo}.png" alt="${esc(t(c.name))}" loading="lazy">`).join('')}</div></div>
  </section>`;

  const inds = [...new Set(WORK.map(w => w.ind.en))];
  const work = `<section id="work" class="sec">${head(S.pages.work)}
    <div class="chips">${['all', ...inds].map(k => `<button type="button" data-f="${esc(k)}" class="${workFilter === k ? 'on' : ''}">${k === 'all' ? t(S.allWork) : t(WORK.find(w => w.ind.en === k).ind)}</button>`).join('')}</div>
    <div class="grid work">${WORK.filter(w => workFilter === 'all' || w.ind.en === workFilter).map(w => `
      <button type="button" class="case" data-case="${w.id}">
        <span class="cover"><img src="img/${w.imgs[0]}" alt="" loading="lazy"><span class="tag2">${t(w.ind)} · ${w.year}</span></span>
        <span class="cbody"><img class="clogo" src="img/logos/${w.logo}.png" alt="" loading="lazy"><b>${t(w.name)}</b><span>${t(w.sum)}</span>
          <span class="svcs">${w.svc.map(s => `<i>${svcName(s)}</i>`).join('')}</span><u>${t(S.viewCase)} ←</u></span>
      </button>`).join('')}</div></section>`;

  const clients = `<section id="clients" class="sec alt">${head(S.pages.clients)}
    <div class="grid logos">${CLIENTS.map(c => `
      <button type="button" class="logo" ${c.work ? `data-case="${c.work}"` : 'tabindex="-1"'} style="${c.cover ? `--cv:url('img/covers/${c.cover}.jpg')` : ''}">
        <img src="img/logos/${c.logo}.png" alt="" loading="lazy"><span>${t(c.name)}</span>${c.work ? `<em>${t(S.viewCase)}</em>` : ''}
      </button>`).join('')}</div></section>`;

  const lab = POIS.find(p => p.id === 'lab'), acad = POIS.find(p => p.id === 'academy');
  const services = `<section id="services" class="sec">${head(S.pages.services)}
    <div class="grid svc">${SVC_POIS.map(p => `
      <details class="svcard"><summary><span class="n">${p.n}</span><b>${t(p.name)}</b><span class="lead2">${t(p.lines[0])}</span></summary>
        <p>${t(p.lines[1])} ${p.lines[2] ? t(p.lines[2]) : ''}</p>
        <h4>${t(S.whatYouGet)}</h4><ul>${SERVICE_GETS[p.id].map(g => `<li>${t(g)}</li>`).join('')}</ul></details>`).join('')}</div>
    <h3 class="subh">${t(S.products)}</h3>
    <div class="grid prods">${[...lab.lines.slice(1), ...acad.lines.slice(0, 1)].map(l => { const [a, ...b] = t(l).split(/ — /); return `<div class="prod"><b>${a}</b><span>${b.join(' — ')}</span></div>`; }).join('')}</div></section>`;

  const leads = TEAM.filter(m => m.lead), rest = TEAM.filter(m => !m.lead);
  const groups = [...new Set(rest.map(m => m.dept))];
  const member = m => `<div class="mem"><span class="av" style="--h:${(parseInt(m.id.slice(4)) * 47) % 360}">${initials(t(m.name))}</span><b>${t(m.name)}</b><span>${t(m.title)}</span></div>`;
  const team = `<section id="team" class="sec alt">${head(S.pages.team)}
    <h3 class="subh">${t(S.leadership)}</h3><div class="grid team lead">${leads.map(member).join('')}</div>
    ${groups.map(g => `<h3 class="subh">${t(DEPTS[g])}</h3><div class="grid team">${rest.filter(m => m.dept === g).map(member).join('')}</div>`).join('')}
    <div class="band"><div><b>${t(S.careersH)}</b><span>${t(S.careersP)}</span></div><a class="btn gold" href="https://theplanetco.com/careers" target="_blank" rel="noopener">${t(S.careersBtn)}</a></div></section>`;

  const about = `<section id="about" class="sec">${head(S.pages.about)}
    <div class="story">${ABOUT.story.map(p => `<p>${t(p)}</p>`).join('')}</div>
    <div class="grid mv"><div class="mvcard"><h4>${t(ABOUT.missionH)}</h4><p>${t(ABOUT.mission)}</p></div><div class="mvcard"><h4>${t(ABOUT.visionH)}</h4><p>${t(ABOUT.vision)}</p></div></div>
    <h3 class="subh">${t(ABOUT.valuesH)}</h3>
    <div class="grid vals">${ABOUT.values.map(([h, p], i) => `<div class="val"><span>0${i + 1}</span><b>${t(h)}</b><p>${t(p)}</p></div>`).join('')}</div>
    <div class="stats in">${S.stats.map(([n, l]) => `<div><b>${n}</b><span>${t(l)}</span></div>`).join('')}</div></section>`;

  const contact = `<section id="contact" class="sec alt">${head(S.pages.contact)}
    <div class="grid contact">
      <div class="cbox">
        <dl class="facts">
          <dt>${t(UI.email)}</dt><dd><a href="mailto:info@theplanetco.com">info@theplanetco.com</a></dd>
          <dt>${t(UI.phone)}</dt><dd><a href="tel:+201203101104" dir="ltr">+20 120 310 1104</a></dd>
          <dt>${t(UI.studio)}</dt><dd>${t(UI.studioV)}</dd>
          <dt>${t(UI.hours)}</dt><dd>${t(UI.hoursV)}</dd>
        </dl>
        <div class="row-btns">
          <a class="btn wa" href="https://wa.me/201203101104" target="_blank" rel="noopener">${ICON.wa}${t(S.whatsapp)}</a>
          <a class="btn light" href="mailto:info@theplanetco.com">${ICON.mail}${t(S.emailUs)}</a>
          <a class="btn gold" href="https://theplanetco.com/contact" target="_blank" rel="noopener">${t(S.briefForm)}</a>
        </div>
      </div>
      <div class="cbox">
        <iframe title="Planet — New Cairo" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=31.47%2C29.995%2C31.52%2C30.03&layer=mapnik&marker=30.0131%2C31.4969"></iframe>
        <b class="follow">${t(S.follow)}</b>
        <div class="socials">${[['Instagram','https://instagram.com/planet4cm'],['LinkedIn','https://linkedin.com/company/planet4cm'],['Facebook','https://facebook.com/planet4cm'],['YouTube','https://youtube.com/@planet4cm']].map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>
      </div>
    </div></section>
    <footer class="foot"><img src="logo.png" alt=""><span>© ${new Date().getFullYear()} ${t(S.rights)}</span><button type="button" class="btn ghost sm" data-explore>🪐 ${t(S.explore)}</button></footer>`;

  $('sitebody').innerHTML = hero + work + clients + services + team + about + contact;
  bindBegin();
  $('homebtn').textContent = t(S.backHome);
  if (!$('case').hidden) openCase(openCaseId);
}
function head(p){ return `<header class="shead"><span class="kicker">${t(p.kicker)}</span><h2>${t(p.h)}</h2>${p.p ? `<p>${t(p.p)}</p>` : ''}</header>`; }

/* case modal */
let openCaseId = null;
function openCase(id){
  const w = WORK.find(x => x.id === id); if (!w) return; openCaseId = id;
  $('casebody').innerHTML = `<img class="clogo" src="img/logos/${w.logo}.png" alt="">
    <h2>${t(w.name)}</h2>
    <dl class="meta"><dt>${t(SITE.industry)}</dt><dd>${t(w.ind)}</dd><dt>${t(SITE.year)}</dt><dd>${w.year}</dd><dt>${t(SITE.servicesUsed)}</dt><dd>${w.svc.map(svcName).join(' · ')}</dd></dl>
    <p class="lead">${t(w.sum)}</p>
    ${w.quote ? `<blockquote>${t(w.quote)}</blockquote>` : ''}
    <div class="gallery">${w.imgs.map(i => `<img src="img/${i}" alt="" loading="lazy">`).join('')}</div>
    <div class="band"><b>${t(SITE.caseCta)}</b><a class="btn gold" href="#contact" data-closecase>${t(SITE.cta)}</a></div>`;
  $('case').hidden = false; $('case').scrollTop = 0; $('caseclose').focus();
}
function closeCase(){ $('case').hidden = true; openCaseId = null; }
$('caseclose').onclick = closeCase;
$('case').addEventListener('click', e => { if (e.target.id === 'case' || e.target.closest('[data-closecase]')) closeCase(); });
addEventListener('keydown', e => { if (e.code === 'Escape' && !$('case').hidden) closeCase(); });

$('sitebody').addEventListener('click', e => {
  const c = e.target.closest('[data-case]'); if (c){ Sfx.click(); return openCase(c.dataset.case); }
  const f = e.target.closest('[data-f]'); if (f){ workFilter = f.dataset.f; renderSite(); return; }
  if (e.target.closest('[data-explore]')) $('begin').click();
});

/* sticky nav state + active link */
$('title').addEventListener('scroll', () => {
  const sc = $('title'); $('sitenav').classList.toggle('solid', sc.scrollTop > 40);
  let cur = 'home'; for (const s of SECTIONS){ const el = document.getElementById(s); if (el && el.offsetTop - 120 <= sc.scrollTop) cur = s; }
  $('sitenav').querySelectorAll('.links a').forEach(a => a.classList.toggle('on', a.hash === '#' + cur));
}, { passive: true });
$('sitenav').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault();
  const el = document.getElementById(a.hash.slice(1)); if (el) $('title').scrollTo({ top: a.hash === '#home' ? 0 : el.offsetTop - 64, behavior: 'smooth' });
});
$('sitebody').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault();
  const el = document.getElementById(a.hash.slice(1)); if (el) $('title').scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
});
function bindBegin(){ $('begin').onclick = () => startExplore(); }
renderSite();

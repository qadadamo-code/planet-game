/* ---------- Planet the agency, not only Planet the game ----------
   Everything here leads from play to who we are and what we've made, without taking anything away:
   · two doors on the title screen: play, or "get to know us in a minute" (one page: work, services, clients, team, contact)
   · a guide bar that is always on screen while you play: our work · the team · services · talk to us
   · client rooms hang the real work we delivered for them on the wall, and the host tells the story
   · the Planet team in the studios opens their own card, with the services their team does
   · every showcase ends with a next step (a brief like this, or WhatsApp), and all of it is counted */
const SC = { from: null, kind: null };
const scEv = (type, label) => { try { if (typeof anEvent === 'function') anEvent(type, label); } catch (e) {} };
const scWa = msg => window.open('https://wa.me/201203101104?text=' + encodeURIComponent(msg), '_blank', 'noopener');
const scSvcs = () => POIS.filter(p => p.svc);
const DEPT_SVC = { management: ['s1', 's8'], account_management: ['s3', 's7'], content: ['s3', 's4'], graphic_design: ['s2', 's3'], motion: ['s5'],
  video_editing: ['s5'], photography: ['s5', 's3'], moderation: ['s3', 's7'] };
const workForDept = d => { const sv = DEPT_SVC[d] || []; return WORK.filter(w => w.sum && w.svc.some(s => sv.includes(s))); };

/* which showcase is on screen: the end-of-page next step depends on it */
{ const plainOpen = openExhibit; openExhibit = function(kind, arg){ SC.kind = kind; SC.arg = arg; return plainOpen.apply(this, arguments); }; }

/* ---------- a next step at the end of every showcase ---------- */
const CTA_KINDS = { work: 1, team: 1, member: 1, services: 1, about: 1, clients: 1, products: 1 };
{ const plainShell = shell; shell = function(){
    plainShell.apply(this, arguments);
    const body = $('exbody'), kind = SC.kind; if (!CTA_KINDS[kind] || body.querySelector('.ex-cta')) return;
    const ar = lang === 'ar', head = { work: ar ? 'عجبك الشغل ده؟' : 'Like what you see?', team: ar ? 'عايز الناس دول يشتغلوا معاك؟' : 'Want this crew on your brand?',
      member: ar ? 'عايز تشتغل مع الفريق ده؟' : 'Want to work with this team?', services: ar ? 'مش عارف تبدأ منين؟' : 'Not sure where to start?' }[kind] || (ar ? 'يلا نشتغل سوا' : "Let's work together");
    const f = document.createElement('div'); f.className = 'scfoot';
    f.innerHTML = `<b>${head}</b><div class="sendrow"><button type="button" class="ex-cta" data-a="brief">📝 ${ar ? 'ابدأ مشروع زي ده' : 'Start a project like this'}</button>
      <button type="button" class="ex-cta light" data-a="wa">💬 ${ar ? 'كلمنا على واتساب' : 'WhatsApp us'}</button></div>`;
    body.appendChild(f);
    f.querySelector('[data-a="brief"]').onclick = () => { scEv('cta', 'brief · ' + kind); if (kind === 'work' && typeof brief !== 'undefined'){ const w = WORK.find(x => x.id === SC.arg); if (w) w.svc.forEach(s => { if (!brief.svcs.includes(s)) brief.svcs.push(s); }); } brief.step = 0; openExhibit('brief'); };
    f.querySelector('[data-a="wa"]').onclick = () => { scEv('cta', 'whatsapp · ' + kind); scWa(ar ? 'أهلاً Planet 👋 شفت شغلكم على الكوكب وعايز أتكلم معاكم في مشروع.' : "Hi Planet 👋 I saw your work on the planet and I'd like to talk about a project."); };
  }; }

/* ---------- the services, all eight on one page ---------- */
EXHIBITS.services = () => {
  const ar = lang === 'ar';
  shell(L('WHAT WE DO', 'خدماتنا'), ar ? '8 استوديوهات، فريق واحد' : 'Eight studios, one team', `
    <p class="ex-lead">${ar ? 'كل خدمة ليها استوديو على الكوكب. دوس على أي واحدة تعرف هتاخد إيه، وشغل اتعمل بيها.' : 'Every service has its own studio on the planet. Tap one to see what you get, and work made with it.'}</p>
    <div class="scsvc">${scSvcs().map((p, k) => `<button type="button" data-svc="${p.id}" style="--d:${k * 60}ms"><span>${p.n}</span><b>${t(p.name)}</b><small>${t(p.lines[0]).split(/[.؟!]/)[0]}</small></button>`).join('')}</div>`);
};

/* ---------- "get to know us in a minute": the whole agency on one page ---------- */
EXHIBITS.quick = () => {
  const ar = lang === 'ar', work = WORK.filter(w => w.sum).slice(0, 6), faces = TEAM.filter(m => m.photo), logos = CLIENTS.filter(c => c.logo).slice(0, 18);
  const fromTitle = SC.from === 'title';
  shell(L('PLANET IN A MINUTE', 'Planet في دقيقة'), ar ? 'وكالة تسويق إبداعي من القاهرة' : 'A creative marketing agency from Cairo', `
    <div class="qstats">
      <div><b>370+</b><span>${ar ? 'علامة اشتغلنا معاها' : 'brands we have worked with'}</span></div>
      <div><b>${scSvcs().length}</b><span>${ar ? 'خدمات تحت سقف واحد' : 'services under one roof'}</span></div>
      <div><b>${TEAM.length}</b><span>${ar ? 'شخص في الفريق' : 'people on the team'}</span></div>
    </div>
    <p class="ex-lead">${t(ABOUT.story[0])}</p>
    <h4>🖼️ ${ar ? 'من شغلنا' : 'Some of our work'}</h4>
    <div class="qwork">${work.map(w => `<button type="button" data-case="${w.id}"><img src="img/${w.imgs[0]}" alt="" loading="lazy"><b>${t(w.name)}</b><small>${t(w.ind)}</small></button>`).join('')}</div>
    <button type="button" class="qmore" data-go="work">${ar ? 'شوف كل الأعمال ←' : 'See all our work →'}</button>
    <h4>🎨 ${ar ? 'بنعمل إيه' : 'What we do'}</h4>
    <div class="qsvc">${scSvcs().map(p => `<button type="button" data-svc="${p.id}">${t(p.name)}</button>`).join('')}</div>
    <h4>🤝 ${ar ? 'اشتغلنا مع' : 'We have worked with'}</h4>
    <div class="qlogos">${logos.map(c => `<img src="img/logos/${c.logo}.png" alt="${t(c.name)}" title="${t(c.name)}" loading="lazy">`).join('')}</div>
    <button type="button" class="qmore" data-go="clients">${ar ? 'كل عملاءنا ←' : 'All our clients →'}</button>
    <h4>👥 ${ar ? 'الفريق' : 'The team'}</h4>
    <div class="qteam">${faces.map(m => `<button type="button" data-m="${m.id}" title="${t(m.name)} · ${t(m.title)}"><img src="${m.photo}" alt="" loading="lazy"><span>${t(m.name).split(' ')[0]}</span></button>`).join('')}</div>
    <button type="button" class="qmore" data-go="team">${ar ? 'قابل الفريق كله ←' : 'Meet the whole team →'}</button>
    <div class="qend">
      <b>${ar ? 'عندك مشروع؟' : 'Got a project?'}</b>
      <div class="sendrow"><button type="button" class="ex-cta" data-a="brief">📝 ${ar ? 'اعمل بريفك في دقيقة' : 'Build your brief in a minute'}</button>
        <button type="button" class="ex-cta light" data-a="wa">💬 ${ar ? 'واتساب' : 'WhatsApp'}</button>
        <button type="button" class="ex-cta light" data-go="contact">📞 ${ar ? 'كل طرق التواصل' : 'All the ways to reach us'}</button></div>
      ${fromTitle ? `<button type="button" class="qplay" data-a="play">🚀 ${ar ? 'دلوقتي العب واستكشف الكوكب' : 'Now explore the planet'}</button>` : ''}
    </div>`);
  const body = $('exbody');
  body.querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
  body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => openExhibit('member', b.dataset.m));
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => openExhibit(b.dataset.go));
  body.querySelector('[data-a="brief"]').onclick = () => { scEv('cta', 'brief · quick'); brief.step = 0; openExhibit('brief'); };
  body.querySelector('[data-a="wa"]').onclick = () => { scEv('cta', 'whatsapp · quick'); scWa(ar ? 'أهلاً Planet 👋 اتعرفت عليكم من موقعكم وعايز أتكلم معاكم في مشروع.' : "Hi Planet 👋 I found you through your site and I'd like to talk about a project."); };
  const play = body.querySelector('[data-a="play"]'); if (play) play.onclick = () => { closeExhibit(); setTimeout(() => $('begin').click(), 320); };
};
function openQuick(from){ SC.from = from; scEv('quick', from); Sfx.init && Sfx.init(); openExhibit('quick'); }

/* the second door on the title screen */
(function titleDoor(){
  const tt = $('title'), begin = $('begin'); if (!tt || !begin || $('quickbtn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'quickbtn'; b.className = 'quickbtn';
  const paint = () => b.innerHTML = lang === 'ar' ? '⚡ تعرّف علينا في دقيقة <small>أعمالنا · خدماتنا · الفريق</small>' : '⚡ Get to know us in a minute <small>Our work · services · team</small>';
  paint(); langHooks.push(paint); begin.after(b);
  // the title's other links arrive a moment later and slot in after "Begin": keep the two doors side by side
  const keep = setInterval(() => { if (begin.nextElementSibling !== b) begin.after(b); if ($('lblink') || state !== 'loading' && state !== 'title') clearInterval(keep); }, 300);
  b.onclick = () => { if (state !== 'title') return; openQuick('title'); };
})();

/* ---------- the guide bar: the agency is one tap away, always ---------- */
(function guideBar(){
  const hud = $('hud'); if (!hud || $('guide')) return;
  const g = document.createElement('nav'); g.id = 'guide'; g.className = 'guide';
  const items = [['work', '🖼️', L('Our work', 'أعمالنا')], ['team', '👥', L('Team', 'الفريق')], ['services', '🎨', L('Services', 'خدماتنا')], ['contact', '💬', L('Talk to us', 'كلمنا')]];
  const paint = () => { g.innerHTML = items.map(([k, ic, n]) => `<button type="button" data-g="${k}">${ic}<span>${t(n)}</span></button>`).join('');
    g.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); if (state !== 'play') return; scEv('guide', b.dataset.g); Sfx.click(); openExhibit(b.dataset.g); }); };
  paint(); langHooks.push(paint); hud.appendChild(g);
})();

/* ---------- client rooms: their real work hangs on the wall ---------- */
const iFrames = [];
function frameLabel(text){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d');
  x.fillStyle = '#12153A'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#F2C94C'; x.font = `700 40px ${lang === 'ar' ? '"IBM Plex Sans Arabic"' : 'Orbitron'}, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; x.fillText(text, 256, 50);
  const tx = new THREE.CanvasTexture(cv); return tx;
}
function hangWork(p){
  const c = p.client; if (!c) return; const imgs = clientGallery(c).slice(0, 3); if (!imgs.length) return;
  const loader = new THREE.TextureLoader(), wallX = -iW / 2 + 0.07, zs = imgs.length === 1 ? [0.6] : imgs.length === 2 ? [-0.1, 1.3] : [-0.8, 0.5, 1.8];
  imgs.forEach((src, i) => {
    const z = zs[i], h = 0.95;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.14, h + 0.14), new THREE.MeshToonMaterial({ color: 0x12153A, gradientMap: grad })); back.position.set(wallX, 1.62, z); iG.add(back);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }), pic = new THREE.Mesh(new THREE.PlaneGeometry(h, h), mat);
    pic.rotation.y = Math.PI / 2; pic.position.set(wallX + 0.04, 1.62, z); pic.userData.keep = true; pic.userData.ownMap = true; iG.add(pic);
    loader.load('img/' + src, tx => { mat.map = tx; mat.needsUpdate = true; const a = tx.image.width / tx.image.height || 1; if (a > 1) pic.scale.set(1, 1 / a, 1); else pic.scale.set(a, 1, 1); });
  });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), new THREE.MeshBasicMaterial({ map: frameLabel(lang === 'ar' ? 'شغل Planet معانا' : 'Made with Planet') }));
  lab.rotation.y = Math.PI / 2; lab.position.set(wallX + 0.04, 2.38, zs[Math.floor(zs.length / 2)]); iG.add(lab);
  iFrames.push({ x: wallX + 0.85, z: zs[Math.floor(zs.length / 2)], c });
}
{ const plainBuild = buildRoom; buildRoom = function(p){ iFrames.length = 0; const r = plainBuild.apply(this, arguments); try { hangWork(p); } catch (e) { console.warn('hang work', e); } return r; }; }
{ const plainClear = clearRoom; clearRoom = function(){ iFrames.length = 0; return plainClear.apply(this, arguments); }; }
{ const plainFrame = interiorFrame; interiorFrame = function(dt, now){
    const r = plainFrame.apply(this, arguments); if (!r || state !== 'play' || sitting) return r;
    for (const f of iFrames){ const d = Math.hypot(f.x - iPos.x, f.z - iPos.y);
      if (d < 1.25 && (!near || near.kind !== 'ihost')){ near = { kind: 'iframe', ref: f }; $('prompt').hidden = false; $('promptText').textContent = lang === 'ar' ? `🖼️ شوف شغلنا مع ${f.c.name.ar}` : `🖼️ See our work for ${f.c.name.en}`; } }
    return r; }; }

/* the host tells what we actually did for them */
{ const plainLines = hostLines; hostLines = function(h){
    const lines = plainLines.apply(this, arguments), c = h.p.client, w = c && WORK.find(x => x.id === c.work);
    if (c && !h.m){ const story = w && w.sum ? L(`What Planet did for us: ${w.sum.en}`, `اللي Planet عملوه معانا: ${w.sum.ar}`) : null;
      const wall = clientGallery(c).length ? L('Their work for us is on the wall over there — have a look.', 'شغلهم معانا متعلّق على الحيطة هناك — اتفرّج عليه.') : null;
      lines.splice(2, 0, ...[story, wall].filter(Boolean)); }
    return lines; }; }

/* ---------- the Planet team in the studios: who they are, and what their team does ---------- */
{ const plainStaff = staffRoom; staffRoom = function(p){
    const r = plainStaff.apply(this, arguments);
    for (const s of IST.list){ if (!s.team || s.m) continue; const m = TEAM.find(x => x.name.en === s.name.en); if (!m) continue; s.m = m;
      const w = workForDept(m.dept)[0], sv = (DEPT_SVC[m.dept] || []).map(id => POIS.find(x => x.id === id)).filter(Boolean);
      if (sv.length) s.lines.splice(1, 0, L(`My team does ${sv.map(x => x.name.en).join(' and ')}.`, `فريقي بيشتغل على ${sv.map(x => x.name.ar).join(' و')}.`));
      if (w) s.lines.splice(2, 0, L(`One I loved: ${w.name.en} — ${w.sum.en}`, `من أكتر حاجة حبيتها: ${w.name.ar} — ${w.sum.ar}`)); }
    return r; }; }
{ const plainInteract = interact; interact = function(tk){
    if (tk && tk.kind === 'iframe'){ scEv('frame', tk.ref.c.name.ar); return openExhibit('client', tk.ref.c.logo || tk.ref.c.name.en); }
    if (tk && tk.kind === 'istaff' && tk.ref.m){ const s = tk.ref, m = s.m; s.g.rotation.y = Math.atan2(iPos.x - s.x, iPos.y - s.z);
      return talk(s.name, s.lines, true, null, [{ label: L(`👤 About ${m.name.en.split(' ')[0]}`, `👤 تعرّف على ${m.name.ar.split(' ')[0]}`), act: () => openExhibit('member', m.id) },
        { label: L('👥 The whole team', '👥 الفريق كله'), cls: 'ghost', act: () => openExhibit('team') }]); }
    return plainInteract.apply(this, arguments); }; }

/* ---------- a crew member's card: what their team does, and work made with it ---------- */
{ const plainMember = EXHIBITS.member; EXHIBITS.member = id => {
    plainMember(id); const m = TEAM.find(x => x.id === id); if (!m) return; const ar = lang === 'ar';
    const sv = DEPT_SVC[m.dept] || [], works = workForDept(m.dept).slice(0, 4), host = $('exbody').querySelector('.member > div'); if (!host) return;
    const box = document.createElement('div'); box.className = 'mwork';
    box.innerHTML = `${sv.length ? `<h4>${ar ? 'فريقه بيعمل' : 'Their team does'}</h4><div class="chips">${sv.map(s => `<button type="button" data-svc="${s}">${xsvc(s)} ←</button>`).join('')}</div>` : ''}
      ${works.length ? `<h4>${ar ? 'شغل اتعمل بالخدمات دي' : 'Work made with these services'}</h4><div class="minicases">${works.map(w => `<button type="button" data-case="${w.id}"><img src="img/${w.imgs[0]}" alt=""><span>${t(w.name)}</span></button>`).join('')}</div>` : ''}`;
    host.appendChild(box); box.querySelectorAll('[data-case]').forEach(b => b.onclick = () => openExhibit('work', b.dataset.case));
  }; }

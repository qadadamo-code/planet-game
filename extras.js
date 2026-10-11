/* Extras on top of the game: the visitor's name and colour, the people panel, the parcel race, the group photo,
   the meeting-room call, seasonal decorations, the daily hidden-logo challenge, and the personal client tour
   (?for=Name&d=district). Everything here only reads the game's state and adds to it. */

const AR = () => lang === 'ar';
const WA_NUM = '201203101104';
const waOpen = text => window.open(`https://wa.me/${WA_NUM}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
const hexCss = c => '#' + new THREE.Color(c).getHexString();
function hashStr(s){ let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(n){ let x = (n % 2147483646) + 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const onPlanet = () => !(typeof inSpace !== 'undefined' && inSpace) && !(typeof inOffice !== 'undefined' && inOffice);
const QS = new URLSearchParams(location.search);

/* a modal card reused by the small panels here */
function xModal(id, html, onClose){
  let box = document.getElementById(id);
  if (!box){ box = document.createElement('div'); box.id = id; box.className = 'layer xmodal'; document.body.appendChild(box);
    box.addEventListener('click', e => { if (e.target === box) closeX(id); }); box.addEventListener('keydown', e => { if (e.key === 'Escape') closeX(id); e.stopPropagation(); }); }
  box.innerHTML = `<div class="xm-card panel"><button type="button" class="x xm-x" aria-label="Close">✕</button>${html}</div>`;
  box.querySelector('.xm-x').onclick = () => closeX(id); box.hidden = false; box._close = onClose;
  if (state === 'play') { state = 'xmodal'; box._took = true; } else box._took = false;
  releaseAll(); return box;
}
function closeX(id){ const b = document.getElementById(id); if (!b || b.hidden) return; b.hidden = true; if (b._took && state === 'xmodal') state = 'play'; b._close && b._close(); canvas.focus(); }

/* ---------- 1. name and colour ---------- */
function openProfile(after){
  let pick = netColor;
  const box = xModal('profilebox', `<h3>${AR() ? '👤 اسمك ولونك' : '👤 Your name and colour'}</h3>
    <p class="xm-sub">${AR() ? 'كده الزوار التانيين هيشوفوك باسمك ولونك بدل «زائر»' : 'Other visitors will see your name and colour instead of "Visitor"'}</p>
    <input id="pfname" maxlength="20" autocomplete="nickname" placeholder="${AR() ? 'اسمك…' : 'Your name…'}">
    <div class="pfcols">${PROFILE_COLORS.map(c => `<button type="button" data-c="${c}" style="background:${hexCss(c)}" aria-label="colour"></button>`).join('')}</div>
    <button type="button" class="xm-go" id="pfsave">${AR() ? 'احفظ' : 'Save'}</button>`, after);
  const inp = box.querySelector('#pfname'); inp.value = profile.nick || '';
  const mark = () => box.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', +b.dataset.c === pick)); mark();
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pick = +b.dataset.c; mark(); Sfx.click(); });
  box.querySelector('#pfsave').onclick = () => { saveProfile(inp.value, pick); Sfx.open(); closeX('profilebox'); mini(AR() ? `✅ أهلاً يا ${profile.nick || 'زائر'}` : `✅ Hi ${profile.nick || 'there'}`); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') box.querySelector('#pfsave').click(); });
  setTimeout(() => inp.focus(), 60);
}

/* the people panel: who's here, plus the things you can do together */
function openPeople(){
  const list = [...peers.values()];
  const where = p => p.world === 'o' ? (AR() ? 'في المكتب' : 'in the office') : p.world === 's' ? (AR() ? 'في الفضاء' : 'in space') : (AR() ? 'على الكوكب' : 'on the planet');
  const box = xModal('peoplebox', `<h3>👥 ${AR() ? `على الكوكب دلوقتي (${list.length + 1})` : `On the planet now (${list.length + 1})`}</h3>
    <div class="pplist"><div class="pp me"><i style="background:${hexCss(netColor)}"></i><b>${AR() ? 'إنت' : 'You'}</b><span id="ppme"></span></div>
      ${list.map(p => `<div class="pp"><i style="background:${hexCss(p.color)}"></i><b data-n="${p.id}"></b><span>${where(p)}</span></div>`).join('')}</div>
    <div class="xm-acts">
      <button type="button" data-a="profile">👤 ${AR() ? 'اسمي ولوني' : 'My name & colour'}</button>
      <button type="button" data-a="race">🏁 ${AR() ? 'سباق الطرود' : 'Parcel race'}</button>
      <button type="button" data-a="photo">📸 ${AR() ? 'صورة جماعية' : 'Group photo'}</button>
      <button type="button" data-a="chat">💬 ${AR() ? 'الدردشة' : 'Chat'}</button>
    </div>`);
  box.querySelector('#ppme').textContent = profile.nick || '';
  list.forEach(p => { const b = box.querySelector(`[data-n="${p.id}"]`); if (b) b.textContent = t(visitorName(p.num, p.nick)); });
  box.querySelector('[data-a="profile"]').onclick = () => { closeX('peoplebox'); openProfile(); };
  box.querySelector('[data-a="race"]').onclick = () => { closeX('peoplebox'); startRace(); };
  box.querySelector('[data-a="photo"]').onclick = () => { closeX('peoplebox'); takeGroupPhoto(); };
  box.querySelector('[data-a="chat"]').onclick = () => { closeX('peoplebox'); const c = document.getElementById('chatbtn'); c && !c.hidden && c.click(); };
}

/* ---------- 2. the parcel race ---------- */
const RACE = { on: false, id: '', t0: 0, t1: 0, parcels: [], scores: new Map(), started: false, mine: 0 };
const RACE_N = 12, RACE_MS = 120000;
function startRace(){
  if (RACE.on) return mini(AR() ? '🏁 فيه سباق شغّال دلوقتي' : '🏁 A race is already on');
  if (!onPlanet()) return mini(AR() ? 'السباق على الكوكب بس' : 'Races happen on the planet');
  const msg = { rid: netId + Date.now().toString(36), seed: (Math.random() * 1e9) | 0, t0: Date.now() + 5000, i: netId, n: netNum, k: myNick(), c: netColor };
  if (netLive) netChan.send({ type: 'broadcast', event: 'race', payload: msg });
  joinRace(msg);
}
let raceOffer = 0;
function onRaceInvite(p){
  if (!p || p.i === netId || RACE.on || Date.now() > p.t0 + RACE_MS) return;
  const btn = netBtn('netrace'); const who = t(visitorName(p.n, p.k));
  btn.textContent = AR() ? `🏁 ${who} بدأ سباق الطرود — ادخل` : `🏁 ${who} started a parcel race — join`;
  btn.hidden = false; clearTimeout(raceOffer); raceOffer = setTimeout(() => btn.hidden = true, Math.max(4000, p.t0 + 20000 - Date.now()));
  btn.onclick = () => { btn.hidden = true; if (onPlanet() && !(typeof passengerOf !== 'undefined' && passengerOf)) joinRace(p); else mini(AR() ? 'ارجع للكوكب الأول' : 'Head back to the planet first'); };
  Sfx.blip();
}
function parcelMesh(){
  const g = new THREE.Group(); const b = mesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), 0xC98A5A); b.position.y = 0.3; g.add(b);
  const r1 = mesh(new THREE.BoxGeometry(0.78, 0.62, 0.14), 0xF2C94C, 0); r1.position.y = 0.3; g.add(r1);
  const r2 = mesh(new THREE.BoxGeometry(0.14, 0.62, 0.78), 0xF2C94C, 0); r2.position.y = 0.3; g.add(r2);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF2C94C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(2.4); gl.position.y = 0.4; g.add(gl);
  return g;
}
function joinRace(p){
  raceClear(); RACE.on = true; RACE.id = p.rid; RACE.t0 = p.t0; RACE.t1 = p.t0 + RACE_MS; RACE.started = false; RACE.mine = 0; RACE.scores.clear();
  RACE.scores.set(netId, { name: AR() ? 'إنت' : 'You', me: true, c: netColor, n: 0 });
  const r = seeded(p.seed); let tries = 0;
  while (RACE.parcels.length < RACE_N && tries++ < 400){
    const ei = (r() * EDGES.length) | 0, [a, b] = EDGES[ei], tt = 0.15 + r() * 0.7;
    const d = poiDirs[a].clone().lerp(poiDirs[b], tt).normalize().addScaledVector(edgeN[ei], (r() - 0.5) * 3 / R).normalize();
    if (!walkable(d) || poiDist(d)[0] < 7 || RACE.parcels.some(x => x.d.angleTo(d) * R < 14)) continue;
    const g = parcelMesh(); placeAt(g, d, r() * 6, 0.35); planet.add(g); RACE.parcels.push({ d, g, got: false, k: RACE.parcels.length });
  }
  if (netLive && p.i !== netId){ const s = { name: t(visitorName(p.n, p.k)), c: p.c, n: 0 }; RACE.scores.set(p.i, s); netChan.send({ type: 'broadcast', event: 'rj', payload: { rid: RACE.id, i: netId, n: netNum, k: myNick(), c: netColor } }); }
  paintRaceBoard(); Sfx.open();
  mini(AR() ? `🏁 لمّ أكبر عدد من الطرود في دقيقتين — ${RACE_N} طرد على الكوكب` : `🏁 Grab the most parcels in two minutes — ${RACE_N} are out there`);
}
function raceClear(){ for (const pc of RACE.parcels) planet.remove(pc.g); RACE.parcels.length = 0; RACE.on = false; const b = document.getElementById('raceboard'); if (b) b.hidden = true; }
function onRaceJoin(p){ if (!RACE.on || p.rid !== RACE.id || p.i === netId) return; if (!RACE.scores.has(p.i)) RACE.scores.set(p.i, { name: t(visitorName(p.n, p.k)), c: p.c, n: 0 }); paintRaceBoard(); }
function onRaceGrab(p){
  if (!RACE.on || p.rid !== RACE.id) return; const pc = RACE.parcels[p.k]; if (!pc || pc.got) return;
  pc.got = true; planet.remove(pc.g);
  const s = RACE.scores.get(p.i) || { name: t(visitorName(p.n, p.k2)), c: p.c, n: 0 }; s.n++; RACE.scores.set(p.i, s); paintRaceBoard();
}
function paintRaceBoard(){
  let b = document.getElementById('raceboard'); if (!b){ b = document.createElement('div'); b.id = 'raceboard'; b.className = 'panel'; document.body.appendChild(b); }
  b.hidden = !RACE.on || !onPlanet(); if (b.hidden) return;
  const now = Date.now(), left = RACE.started ? Math.max(0, Math.ceil((RACE.t1 - now) / 1000)) : Math.max(0, Math.ceil((RACE.t0 - now) / 1000));
  const rows = [...RACE.scores.values()].sort((a, c) => c.n - a.n).slice(0, 6);
  b.innerHTML = `<b>${RACE.started ? `🏁 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : (AR() ? `🏁 السباق بيبدأ بعد ${left}…` : `🏁 Starting in ${left}…`)}</b>` +
    rows.map(r => `<div class="rb${r.me ? ' me' : ''}"><i style="background:${hexCss(r.c)}"></i><span></span><em>${r.n}</em></div>`).join('') +
    `<small>${AR() ? `📦 فاضل ${RACE.parcels.filter(x => !x.got).length}` : `📦 ${RACE.parcels.filter(x => !x.got).length} left`}</small>`;
  b.querySelectorAll('.rb span').forEach((sp, k) => sp.textContent = rows[k].name);
}
let raceTick = 0;
function raceFrame(ts){
  if (!RACE.on) return;
  const now = Date.now();
  if (!RACE.started && now >= RACE.t0){ RACE.started = true; toast(AR() ? '🏁 يلا!' : '🏁 Go!'); Sfx.finish(); }
  for (const pc of RACE.parcels){ if (pc.got) continue; pc.g.children[0].rotation.y = ts * 1.5; pc.g.children[1].rotation.y = pc.g.children[2].rotation.y = ts * 1.5;
    if (RACE.started && state === 'play' && onPlanet() && pc.d.angleTo(pDir) * R < 1.8){ pc.got = true; planet.remove(pc.g); RACE.mine++;
      const me = RACE.scores.get(netId); me.n++; Sfx.collect(); burst(pc.g.position.clone(), 0xF2C94C, 40, 4, 0.8); mini(`📦 +1 · ${me.n}`);
      if (netLive) netChan.send({ type: 'broadcast', event: 'rg', payload: { rid: RACE.id, k: pc.k, i: netId, n: netNum, k2: myNick(), c: netColor } }); } }
  if (++raceTick % 15 === 0) paintRaceBoard();
  if (now > RACE.t1 || (RACE.started && RACE.parcels.every(x => x.got))){
    const rows = [...RACE.scores.values()].sort((a, c) => c.n - a.n), win = rows[0];
    toast(win && win.me ? (AR() ? '🏆 إنت كسبت السباق!' : '🏆 You won the race!') : (AR() ? `🏁 السباق خلص — الفايز: ${win ? win.name : '—'}` : `🏁 Race over — winner: ${win ? win.name : '—'}`), AR() ? `جبت ${RACE.mine} طرد` : `You grabbed ${RACE.mine}`);
    const best = +(store.get('pm-race-best') || 0); if (RACE.mine > best) store.set('pm-race-best', String(RACE.mine));
    if (win && win.me) for (let i = 0; i < 5; i++) setTimeout(() => burst(player.position.clone().addScaledVector(pDir, 4 + Math.random() * 3), [0xF2C94C, 0xE76F51, 0x5FA0E6][i % 3], 70, 7, 1.4), i * 250);
    raceClear();
  }
}

/* ---------- 3. the meeting room: ask the team for a live call ---------- */
function meetingFrame(){
  const btn = netBtn('meetbtn');
  const inMeet = typeof inOffice !== 'undefined' && inOffice && typeof oRoom !== 'undefined' && oRoom && oRoom.id === 'meeting' && state === 'play';
  btn.hidden = !inMeet; if (!inMeet) return;
  const others = [...peers.values()].filter(p => p.world === 'o').length;
  btn.textContent = AR() ? `📹 اطلب مكالمة فيديو مع فريق Planet${others ? ` · معاك ${others}` : ''}` : `📹 Ask Planet for a live video call${others ? ` · ${others} with you` : ''}`;
  btn.onclick = () => { Sfx.click(); waOpen(AR() ? `أهلاً Planet 👋 أنا في غرفة الاجتماعات في الكوكب${profile.nick ? ` (${profile.nick})` : ''}${others ? ` ومعايا ${others}` : ''} — ينفع نعمل مكالمة فيديو دلوقتي أو نحدد ميعاد؟`
    : `Hi Planet 👋 I'm in the meeting room on your planet${profile.nick ? ` (${profile.nick})` : ''}${others ? ` with ${others} others` : ''} — can we have a video call now or book a time?`); };
}

/* ---------- 4. the group photo ---------- */
let photoBusy = false;
function takeGroupPhoto(){
  if (photoBusy || !['play', 'space'].includes(state)) return;
  photoBusy = true; if (netLive) netChan.send({ type: 'broadcast', event: 'photo', payload: { i: netId, n: netNum, k: myNick(), w: onPlanet() ? 'p' : (inOffice ? 'o' : 's') } });
  let n = 3; const cd = document.createElement('div'); cd.className = 'photocd'; document.body.appendChild(cd);
  const tick = () => { cd.textContent = n ? String(n) : '📸'; Sfx.blip(); if (n-- > 0) return setTimeout(tick, 800); setTimeout(() => { cd.remove(); snapPhoto(); photoBusy = false; }, 120); };
  tick();
}
function onPhoto(p){
  if (!p || p.i === netId) return; const meW = onPlanet() ? 'p' : (inOffice ? 'o' : 's'); if (p.w !== meW) return;
  const peer = peers.get(p.i); if (peer && meW !== 's' && peer.pos.distanceTo(player.position) > 25) return;
  mini(AR() ? `📸 ${t(visitorName(p.n, p.k))} بياخد صورة جماعية — قرّب وابتسم!` : `📸 ${t(visitorName(p.n, p.k))} is taking a group photo — come closer and smile!`);
}
function snapPhoto(){
  const cp = camera.position.clone(), cq = camera.quaternion.clone(), cu = camera.up.clone();
  if (state === 'play'){
    // a selfie: the camera swings round to face you and whoever's standing with you
    const up = onPlanet() ? pDir.clone() : V(0, 1, 0), fwd = onPlanet() ? pFwd.clone() : V(0, 0, 1).applyQuaternion(player.quaternion);
    const side = V().crossVectors(up, fwd).normalize(), head = player.position.clone().addScaledVector(up, 1.2);
    camera.position.copy(head).addScaledVector(fwd, 3.6).addScaledVector(up, 0.7).addScaledVector(side, 0.8); camera.up.copy(up); camera.lookAt(head.addScaledVector(side, -0.6));
  }
  const tagsWere = [...peers.values()].map(p => [p, p.tag.visible]); tagsWere.forEach(([p]) => p.tag.visible = true);
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const W = 1080, H = Math.round(W * src.height / src.width), out = document.createElement('canvas'); out.width = W; out.height = H + 170; const x = out.getContext('2d');
  x.drawImage(src, 0, 0, W, H);
  tagsWere.forEach(([p, v]) => p.tag.visible = v); camera.position.copy(cp); camera.quaternion.copy(cq); camera.up.copy(cu);
  // the frame: Planet's mark, who was there, and where
  x.fillStyle = '#12153A'; x.fillRect(0, H, W, 170); x.fillStyle = '#F2C94C'; x.fillRect(0, H, W, 10);
  const near = [...peers.values()].filter(p => p.g.visible && p.pos.distanceTo(player.position) < 25).map(p => t(visitorName(p.num, p.nick)));
  const names = [profile.nick || (AR() ? 'أنا' : 'Me'), ...near].slice(0, 6).join(' · ');
  x.fillStyle = '#F4F7FC'; x.textAlign = AR() ? 'right' : 'left'; x.direction = AR() ? 'rtl' : 'ltr';
  const tx = AR() ? W - 40 : 200;
  x.font = '800 46px IBM Plex Sans Arabic, sans-serif'; x.fillText(AR() ? 'على كوكب Planet 🪐' : 'On Planet 🪐', tx, H + 72, W - 260);
  x.font = '600 32px IBM Plex Sans Arabic, sans-serif'; x.fillStyle = '#C9D6EA'; x.fillText(names, tx, H + 118, W - 260);
  x.font = '600 26px IBM Plex Sans Arabic, sans-serif'; x.fillText(`game.theplanetco.com · ${new Date().toLocaleDateString(AR() ? 'ar-EG' : 'en-GB')}`, tx, H + 154, W - 260);
  const lg = new Image(); lg.onload = () => { const lx = AR() ? 30 : 30; x.fillStyle = '#F4F7FC'; x.beginPath(); x.arc(lx + 70, H + 88, 66, 0, 7); x.fill(); x.drawImage(lg, lx + 18, H + 36, 104, 104); showPhoto(out); };
  lg.onerror = () => showPhoto(out); lg.src = 'logo.png';
  Sfx.finish(); const fl = document.createElement('div'); fl.className = 'photoflash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 500);
}
function showPhoto(cv){
  const url = cv.toDataURL('image/jpeg', 0.9);
  const box = xModal('photobox', `<h3>📸 ${AR() ? 'صورتكم من الكوكب' : 'Your photo from the planet'}</h3><img class="ph-img" alt="">
    <div class="xm-acts"><button type="button" data-a="share">📤 ${AR() ? 'شارك' : 'Share'}</button><a data-a="dl" download="planet-photo.jpg">⬇️ ${AR() ? 'نزّلها' : 'Download'}</a>
    <button type="button" data-a="again">🔁 ${AR() ? 'صورة تانية' : 'Another one'}</button></div>`);
  box.querySelector('.ph-img').src = url; box.querySelector('[data-a="dl"]').href = url;
  box.querySelector('[data-a="again"]').onclick = () => { closeX('photobox'); setTimeout(takeGroupPhoto, 200); };
  box.querySelector('[data-a="share"]').onclick = async () => {
    try { const blob = await (await fetch(url)).blob(), f = new File([blob], 'planet-photo.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Planet', text: AR() ? 'صورتنا من كوكب Planet 🪐 game.theplanetco.com' : 'Our photo from Planet 🪐 game.theplanetco.com' });
      else box.querySelector('[data-a="dl"]').click(); } catch (e) {} };
}
function photoBtn(){
  let b = document.getElementById('photobtn'); if (b) return b;
  b = document.createElement('button'); b.id = 'photobtn'; b.type = 'button'; b.className = 'panel tbtn'; b.textContent = '📸'; b.setAttribute('aria-label', 'Photo');
  const tools = document.querySelector('.tools'); (tools || document.body).appendChild(b); b.onclick = () => { Sfx.click(); takeGroupPhoto(); }; return b;
}

/* ---------- 6. seasons: decorations that switch on by date (preview any with ?season=ramadan) ---------- */
const SEASONS = [
  { id: 'ramadan', from: '2026-02-17', to: '2026-03-19', hi: L('Ramadan Kareem 🌙', 'رمضان كريم 🌙') },
  { id: 'eid', from: '2026-03-20', to: '2026-03-23', hi: L('Eid Mubarak 🎉', 'عيد مبارك 🎉') },
  { id: 'eid', from: '2026-05-26', to: '2026-05-30', hi: L('Eid al-Adha Mubarak 🐑', 'عيد أضحى مبارك 🐑') },
  { id: 'worldcup', from: '2026-06-11', to: '2026-07-19', hi: L('World Cup 2026 ⚽', 'كأس العالم 2026 ⚽') },
  { id: 'newyear', from: '2026-12-24', to: '2027-01-03', hi: L('Happy New Year ✨', 'سنة سعيدة ✨') },
  { id: 'ramadan', from: '2027-02-07', to: '2027-03-08', hi: L('Ramadan Kareem 🌙', 'رمضان كريم 🌙') },
  { id: 'eid', from: '2027-03-09', to: '2027-03-12', hi: L('Eid Mubarak 🎉', 'عيد مبارك 🎉') },
  { id: 'eid', from: '2027-05-15', to: '2027-05-19', hi: L('Eid al-Adha Mubarak 🐑', 'عيد أضحى مبارك 🐑') },
  { id: 'newyear', from: '2027-12-24', to: '2028-01-03', hi: L('Happy New Year ✨', 'سنة سعيدة ✨') },
];
function activeSeason(){
  const q = QS.get('season'); if (q){ const s = SEASONS.find(x => x.id === q); if (s) return s; }
  const d = todayKey(); return SEASONS.find(s => d >= s.from && d <= s.to) || null;
}
function bannerSprite(text, bg = '#12153A', fg = '#F2C94C'){
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 200; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = () => { x.clearRect(0, 0, 1024, 200); x.fillStyle = bg; x.strokeStyle = fg; x.lineWidth = 12; x.beginPath(); x.roundRect ? x.roundRect(8, 8, 1008, 184, 60) : x.rect(8, 8, 1008, 184); x.fill(); x.stroke();
    x.fillStyle = fg; x.font = '800 92px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = AR() ? 'rtl' : 'ltr'; x.fillText(typeof text === 'string' ? text : t(text), 512, 104, 960); tx.needsUpdate = true; };
  paint(); langHooks.push(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true })); s.scale.set(10, 1.95, 1); return s;
}
const seasonFx = { id: null, fireworks: false, confetti: false };
function lantern(col){ const g = new THREE.Group(); const top = mesh(new THREE.ConeGeometry(0.22, 0.25, 6), 0xC99A2E); top.position.y = 0.55; g.add(top);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.5, 6), new THREE.MeshBasicMaterial({ color: col })); body.position.y = 0.25; g.add(body);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.6); gl.position.y = 0.25; g.add(gl); return g; }
function balloon(col){ const g = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.45, 14, 10), col); b.scale.y = 1.2; b.position.y = 2.6; g.add(b);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.1, 3), basic(0x12153A)); s.position.y = 1.05; g.add(s); return g; }
function buildSeason(){
  const s = activeSeason(); if (!s) return; seasonFx.id = s.id;
  const hq = pois[0], side = V().crossVectors(hq.dir, Y).normalize(); if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  const ring = (rad, n, fn) => { for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2, d = hq.dir.clone().addScaledVector(side.clone().applyAxisAngle(hq.dir, a), rad / R).normalize(); if (walkable(d) && roadDist(d) > 1.6) fn(d, i); } };
  const ban = bannerSprite(s.hi); placeAt(ban, hq.dir, 0, 10); ban.scale.set(8, 1.56, 1); fitSprite(ban, 24, 64); planet.add(ban);
  if (s.id === 'ramadan'){
    const near = lampsList.filter(p => p.angleTo(hq.dir) * R < 70);
    near.forEach((p, i) => { const l = lantern([0xF2C94C, 0xE76F51, 0x5FA0E6, 0x2EA87A][i % 4]); placeAt(l, p, 0, 2.05); planet.add(l); });
    ring(hq.r + 7, 14, (d, i) => { const l = lantern([0xF2C94C, 0xE76F51][i % 2]); const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), 0x12153A, 0); pole.position.y = 1; l.add(pole); l.children.slice(0, 3).forEach(c => c.position.y += 2); placeAt(l, d); planet.add(l); });
    const moonS = bannerSprite('🌙 ✦', 'rgba(0,0,0,0)', '#F2C94C'); placeAt(moonS, hq.dir, 0, 12.4); moonS.scale.set(6, 1.2, 1); planet.add(moonS);
  }
  if (s.id === 'eid'){ seasonFx.confetti = true;
    ring(hq.r + 6, 10, (d, i) => { const g = new THREE.Group(); [0, 1, 2].forEach(k => { const b = balloon([0xE76F51, 0xF2C94C, 0x5FA0E6, 0xE9A0B8, 0x2EA87A][(i + k) % 5]); b.position.set((k - 1) * 0.5, k * 0.3, 0); g.add(b); }); placeAt(g, d); planet.add(g); }); }
  if (s.id === 'worldcup'){
    ring(hq.r + 7, 12, (d, i) => { const f = new THREE.Group(); const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), 0x12153A, 0); pole.position.y = 1.5; f.add(pole);
      const cols = [[0xC8102E, 0xFFFFFF, 0x000000], [0x006233, 0xFFFFFF, 0xD21034], [0x007A3D, 0xFFFFFF, 0xCE1126]][i % 3];
      cols.forEach((c, k) => { const st = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.26), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); st.position.set(0.62, 2.75 - k * 0.26, 0); f.add(st); });
      placeAt(f, d, i); planet.add(f); });
    const ballD = hq.dir.clone().addScaledVector(side, (hq.r + 3.5) / R).normalize(); const ball = mesh(new THREE.IcosahedronGeometry(0.7, 1), 0xF4F7FC); ball.material = new THREE.MeshToonMaterial({ color: 0xF4F7FC, gradientMap: grad, flatShading: true });
    const bg = new THREE.Group(); ball.position.y = 0.7; bg.add(ball); placeAt(bg, ballD); planet.add(bg); seasonFx.ball = ball;
  }
  if (s.id === 'newyear'){ seasonFx.fireworks = true; }
  setTimeout(() => { if (state !== 'title') toast(t(s.hi)); }, 1500);
}
function seasonFrame(dt, ts){
  if (!seasonFx.id || !onPlanet() || state === 'title' || state === 'loading') return;
  const hq = pois[0], close = pDir.angleTo(hq.dir) * R < 45;
  if (seasonFx.ball) seasonFx.ball.rotation.y = ts;
  if (close && (seasonFx.fireworks || seasonFx.confetti) && Math.random() < dt * (seasonFx.fireworks ? 1.6 : 0.8)){
    const p = hq.dir.clone().multiplyScalar(R + (seasonFx.fireworks ? 14 : 7) + Math.random() * 5).add(randDir().multiplyScalar(6));
    burst(p, [0xF2C94C, 0x8FB4E3, 0xE76F51, 0xF4F7FC, 0xE9A0B8][Math.random() * 5 | 0], seasonFx.fireworks ? 90 : 40, seasonFx.fireworks ? 7 : 3, 1.5); }
}

/* ---------- 7. the daily challenge: a golden Planet logo hidden somewhere new every day ---------- */
const DAILY = { day: todayKey(), d: null, g: null, done: false, near: null };
function buildDaily(){
  DAILY.done = store.get('pm-daily') === DAILY.day;
  const r = seeded(hashStr('planet-' + DAILY.day)); let d = null;
  for (let i = 0; i < 400 && !d; i++){ const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), c = V(s * Math.cos(th), u, s * Math.sin(th));
    if (walkable(c) && poiDist(c)[0] > 10 && roadDist(c) > 3 && poiDist(c)[0] < 26 && !obstacles.some(o => o.d.angleTo(c) * R < o.r + 1.5)) d = c; }
  if (!d) return; DAILY.d = d; DAILY.near = pois[poiDist(d)[1]];
  const g = new THREE.Group(), coin = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 28), 0xF2C94C); disc.rotation.x = Math.PI / 2; coin.add(disc);
  [0.075, -0.075].forEach((z, k) => { const f = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); f.position.z = z; if (k) f.rotation.y = Math.PI; coin.add(f); });
  coin.position.y = 1.2; g.add(coin);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF2C94C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(3.2); gl.position.y = 1.2; g.add(gl);
  placeAt(g, d); planet.add(g); DAILY.g = g; DAILY.coin = coin; g.visible = !DAILY.done; paintDaily();
}
function dailyChip(){ let c = document.getElementById('dailychip'); if (!c){ c = document.createElement('button'); c.type = 'button'; c.id = 'dailychip'; c.className = 'panel'; document.body.appendChild(c); c.onclick = () => { Sfx.click(); dailyInfo(); }; } return c; }
function paintDaily(){
  const c = dailyChip(); if (!DAILY.d){ c.hidden = true; return; }
  if (DAILY.done){ c.innerHTML = `✅ <span>${AR() ? 'خلصت تحدي النهارده' : "Today's challenge done"}</span>`; return; }
  const m = DAILY.d.angleTo(pDir) * R * 2;
  const heat = m < 30 ? (AR() ? '🔥🔥 هنا حواليك!' : '🔥🔥 Right here!') : m < 80 ? (AR() ? '🔥 قربت جداً' : '🔥 Very close') : m < 170 ? (AR() ? '🌤️ دافي' : '🌤️ Warm') : (AR() ? '❄️ بعيد' : '❄️ Cold');
  c.innerHTML = `🎯 <span>${AR() ? 'تحدي النهارده' : "Today's challenge"}</span> <b>${heat}</b>`;
}
langHooks.push(paintDaily);
function dailyInfo(){
  if (DAILY.done) return showDailyPrize();
  const box = xModal('dailybox', `<h3>🎯 ${AR() ? 'تحدي النهارده' : "Today's challenge"}</h3>
    <p>${AR() ? 'فيه لوجو Planet دهبي متخبّي على الكوكب — مكانه بيتغيّر كل يوم.' : 'A golden Planet logo is hidden on the planet — it moves every day.'}</p>
    <p class="xm-hint">💡 ${AR() ? 'تلميح: متخبّي قريب من' : 'Hint: hidden near'} <b data-n></b></p>
    <p class="xm-sub">${AR() ? 'اللي يلاقيه يكسب جايزة 🎁 — والمؤشر فوق بيقولك سخن ولا بارد' : 'Find it to win a prize 🎁 — the chip tells you hot or cold'}</p>
    <button type="button" class="xm-go" data-a="go">🧭 ${AR() ? 'وجّهني للمنطقة' : 'Point me to the area'}</button>`);
  box.querySelector('[data-n]').textContent = DAILY.near ? t(DAILY.near.name) : '';
  box.querySelector('[data-a="go"]').onclick = () => { if (DAILY.near){ guide = DAILY.near; mapRouteFor = null; } closeX('dailybox'); };
}
function dailyCode(){ return `PLANET-${DAILY.day.slice(8, 10)}${DAILY.day.slice(5, 7)}-${(hashStr(netId + DAILY.day) % 9000 + 1000)}`; }
function showDailyPrize(){
  const code = dailyCode();
  const box = xModal('dailybox', `<h3>🏆 ${AR() ? 'لقيته!' : 'You found it!'}</h3>
    <p>${AR() ? 'جايزتك: جلسة استشارة تسويق مجانية ٣٠ دقيقة مع فريق Planet 🎁' : 'Your prize: a free 30-minute marketing consultation with the Planet team 🎁'}</p>
    <div class="xm-code">${code}</div>
    <div class="xm-acts"><button type="button" data-a="wa">💬 ${AR() ? 'استلم الجايزة على واتساب' : 'Claim on WhatsApp'}</button>
    <button type="button" data-a="copy">📋 ${AR() ? 'انسخ الكود' : 'Copy code'}</button></div><p class="xm-sub">${AR() ? 'تحدي جديد بكرة 👀' : 'A new one tomorrow 👀'}</p>`);
  box.querySelector('[data-a="wa"]').onclick = () => waOpen(AR() ? `أهلاً Planet 👋 لقيت اللوجو الدهبي في تحدي النهارده! الكود: ${code}` : `Hi Planet 👋 I found today's golden logo! Code: ${code}`);
  box.querySelector('[data-a="copy"]').onclick = async e => { try { await navigator.clipboard.writeText(code); e.target.textContent = '✅'; } catch (er) {} };
}
let dailyTick = 0;
function dailyFrame(ts){
  const c = dailyChip(); c.hidden = !DAILY.d || !onPlanet() || !['play', 'talk'].includes(state) || $('hud').hidden;
  if (!DAILY.d || DAILY.done) return;
  DAILY.coin.rotation.y = ts * 2; DAILY.coin.position.y = 1.2 + Math.sin(ts * 2) * 0.15;
  if (++dailyTick % 20 === 0) paintDaily();
  if (state === 'play' && onPlanet() && DAILY.d.angleTo(pDir) * R < 1.6){
    DAILY.done = true; store.set('pm-daily', DAILY.day); DAILY.g.visible = false; Sfx.finish(); burst(DAILY.coin.getWorldPosition(V()), 0xF2C94C, 120, 7, 1.6); paintDaily();
    if (typeof sendChat === 'function' && netLive) sendChat(AR() ? '🎯 لقيت اللوجو الدهبي بتاع النهارده!' : "🎯 I found today's golden logo!");
    setTimeout(showDailyPrize, 700);
  }
}

/* ---------- 8. the client tour: a link that welcomes a prospective client by name in their own district ---------- */
const TOUR = { name: (QS.get('for') || '').replace(/[<>]/g, '').trim().slice(0, 30), d: QS.get('d') || '', c: QS.get('c') || '' };
function tourPoi(){
  if (TOUR.c){ const p = pois.find(p => p.id === 'c_' + TOUR.c); if (p) return p; }
  if (TOUR.d && DISTRICTS[TOUR.d]) return pois.find(p => p.district === TOUR.d) || null;
  return null;
}
function buildTour(){
  if (!TOUR.name && !TOUR.d && !TOUR.c) return;
  const p = tourPoi() || pois[0];
  if (p !== pois[0]) spawn(p);
  if (TOUR.name){ const k = document.querySelector('#title .kicker'); if (k){ k.removeAttribute('data-t'); k.textContent = AR() ? `أهلاً يا ${TOUR.name} 👋 — جولة مخصوصة ليك` : `Welcome, ${TOUR.name} 👋 — a tour made for you`; } }
  const ban = bannerSprite(TOUR.name ? L(`Welcome, ${TOUR.name} 👋`, `أهلاً يا ${TOUR.name} 👋`) : L('Welcome 👋', 'أهلاً بيك 👋'), '#F2C94C', '#12153A');
  placeAt(ban, p.dir, 0, 6.2); ban.scale.set(7, 1.36, 1); fitSprite(ban, 24, 64); planet.add(ban);
  TOUR.poi = p; if (p !== pois[0]) guide = p;
}
function tourIntro(){
  if (!TOUR.poi || TOUR.poi === pois[0]) return false;
  const D = TOUR.poi.district ? DISTRICTS[TOUR.poi.district] : null, nm = TOUR.name;
  talk(UI.me, [L(`${nm ? `Hi ${nm}! ` : ''}Planet made this tour for you. You're standing in the ${D ? D.name.en : 'right'} district — the brands here are businesses like yours that we work with.`,
                 `${nm ? `أهلاً يا ${nm}! ` : ''}Planet عملتلك الجولة دي مخصوص. إنت واقف في ${D ? D.name.ar : 'الحي المناسب ليك'} — العلامات اللي هنا شغل زي شغلك بنشتغل معاه.`),
               L('Walk up to any building to see what we did for them. When you are ready, the WhatsApp button reaches the team directly.', 'قرّب من أي مبنى وشوف عملنالهم إيه. ولما تكون جاهز، زرار الواتساب بيوصّلك بالفريق على طول.')]);
  if (nm && typeof brief !== 'undefined' && !brief.name) brief.name = nm;
  return true;
}
/* the link builder for the team: ?builder=1 */
function openTourBuilder(){
  const opts = Object.entries(DISTRICTS).map(([k, D]) => `<option value="${k}">${D.icon} ${t(D.name)}</option>`).join('');
  const box = xModal('builderbox', `<h3>🔗 ${AR() ? 'رابط جولة لعميل' : 'Client tour link'}</h3>
    <input id="tbname" maxlength="30" placeholder="${AR() ? 'اسم العميل…' : 'Client name…'}"><select id="tbd">${opts}</select>
    <input id="tblink" readonly><div class="xm-acts"><button type="button" data-a="copy">📋 ${AR() ? 'انسخ' : 'Copy'}</button><button type="button" data-a="wa">💬 ${AR() ? 'ابعته واتساب' : 'Send on WhatsApp'}</button></div>`);
  const upd = () => { const u = new URL(location.origin + location.pathname); const n = box.querySelector('#tbname').value.trim(); if (n) u.searchParams.set('for', n); u.searchParams.set('d', box.querySelector('#tbd').value); box.querySelector('#tblink').value = u.toString(); };
  box.querySelector('#tbname').oninput = upd; box.querySelector('#tbd').onchange = upd; upd();
  box.querySelector('[data-a="copy"]').onclick = async e => { try { await navigator.clipboard.writeText(box.querySelector('#tblink').value); e.target.textContent = '✅'; } catch (er) {} };
  box.querySelector('[data-a="wa"]').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(box.querySelector('#tblink').value), '_blank', 'noopener');
}

/* ---------- wiring ---------- */
if (typeof introDone === 'function'){ const plainIntro = introDone; introDone = function(){ if (!tourIntro()) plainIntro(); }; }
function extrasNet(){
  if (typeof netChan === 'undefined' || !netChan) return setTimeout(extrasNet, 900);
  netChan.on('broadcast', { event: 'race' }, ({ payload }) => onRaceInvite(payload));
  netChan.on('broadcast', { event: 'rj' }, ({ payload }) => onRaceJoin(payload));
  netChan.on('broadcast', { event: 'rg' }, ({ payload }) => onRaceGrab(payload));
  netChan.on('broadcast', { event: 'photo' }, ({ payload }) => onPhoto(payload));
}
extrasNet();
function extrasBoot(){
  if (state === 'loading'){ return setTimeout(extrasBoot, 300); }
  buildSeason(); buildDaily(); buildTour(); photoBtn();
  const tt = document.getElementById('title');
  if (tt && !document.getElementById('pflink')){ const b = document.createElement('button'); b.type = 'button'; b.id = 'pflink'; b.className = 'pflink';
    const paint = () => b.textContent = profile.nick ? (AR() ? `👤 ${profile.nick} — غيّر` : `👤 ${profile.nick} — change`) : (AR() ? '👤 اختار اسمك ولونك' : '👤 Pick your name and colour'); paint(); langHooks.push(paint);
    b.onclick = () => openProfile(paint); const bg = document.getElementById('begin'); bg ? bg.after(b) : tt.appendChild(b); }
  if (QS.get('builder')) setTimeout(openTourBuilder, 600);
}
extrasBoot();
let exPrev = performance.now();
function extrasFrame(now){
  requestAnimationFrame(extrasFrame);
  const dt = Math.min(0.1, (now - exPrev) / 1000), ts = now / 1000; exPrev = now;
  if (state === 'loading') return;
  raceFrame(ts); meetingFrame(); seasonFrame(dt, ts); dailyFrame(ts);
  const cb = document.getElementById('chatbtn'); if (cb && state === 'title') cb.hidden = true; else if (cb && typeof netLive !== 'undefined' && netLive && cb.hidden && state !== 'loading') cb.hidden = false;
  const pb = document.getElementById('photobtn'); if (pb) pb.hidden = !['play', 'space'].includes(state) && state !== 'xmodal';
}
requestAnimationFrame(extrasFrame);

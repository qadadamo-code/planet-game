/* ---------- More from the tour bus ----------
   · the driver announces every stop out loud (Arabic or English, with the voice button respected)
   · a tour passport: a stamp for every stop you ride into, and a "Planet tourist" badge for all of them
   · riders sit in the bus by the windows, so you see who's on the tour with you (and they see you)
   · a timetable at every bus stop: when the bus comes next, and the stops after
   · themed tours: pick studios, food, health, shopping or places — the bar counts down to the next one */
const TOURS = [
  { id: 'story', icon: '⭐', name: L('The Planet story', 'قصة Planet') },
  { id: 'all', icon: '🌍', name: L('The whole planet', 'الكوكب كله') },
  { id: 'studios', icon: '🎨', name: L('Planet studios', 'استوديوهات Planet') },
  { id: 'food', icon: '🍽️', name: L('Food & cafés', 'أكل وكافيهات') },
  { id: 'health', icon: '🩺', name: L('Health', 'صحة') },
  { id: 'shops', icon: '🛍️', name: L('Shopping & travel', 'تسوّق وسفر') },
  { id: 'places', icon: '📍', name: L('Landmarks', 'معالم') },
];
const stopTheme = p => { if (p.svc) return 'studios'; const k = p.district && DISTRICTS[p.district] ? DISTRICTS[p.district].kind : '';
  if (k === 'resto' || p.id === 'cafe') return 'food'; if (k === 'clinic') return 'health'; if (k === 'shop' || k === 'kiosk') return 'shops'; return p.client ? 'shops' : 'places'; };
// the story tour: the stops that tell who we are — the studios, our work, our clients, the team, how we started
const STORY_IDS = ['gallery', 'monument', 'careers', 'cafe', 'observatory', 'lighthouse', 'values', 'process', 'lab', 'academy', 'hq', 'fly'];
const isStory = p => !!p.svc || STORY_IDS.includes(p.id);
let busTour = store.get('pm-bus-tour') || 'story';
const inTour = p => busTour === 'all' || (busTour === 'story' ? isStory(p) : stopTheme(p) === busTour);
function storyLine(p){
  const first = l => t(l).split(/(?<=[.؟!])\s/)[0];
  if (p.svc) return lang === 'ar' ? `استوديو ${p.n}: ${t(p.name)}. ${first(p.lines[0])}` : `Studio ${p.n}: ${t(p.name)}. ${first(p.lines[0])}`;
  if (p.id === 'gallery'){ const w = WORK.filter(x => x.sum); const k = w[Math.floor(Math.random() * w.length)];
    return lang === 'ar' ? `معرض أعمالنا. زي ${k.name.ar}: ${first(k.sum)}` : `Our gallery. Like ${k.name.en}: ${first(k.sum)}`; }
  if (p.id === 'monument') return lang === 'ar' ? 'ده نُصب عملائنا — أكتر من 370 علامة اشتغلنا معاها.' : 'Our clients\' monument — more than 370 brands we have worked with.';
  if (p.id === 'careers' || p.id === 'cafe') return lang === 'ar' ? `هنا بتقابل فريق Planet — ${TEAM.length} شخص بيعملوا كل ده.` : `This is where you meet the Planet team — ${TEAM.length} people who make all of this.`;
  if (p.id === 'hq') return lang === 'ar' ? 'مقر Planet: تمن استوديوهات، فريق واحد، خطة واحدة.' : 'Planet HQ: eight studios, one team, one plan.';
  if (p.id === 'fly'){ const w = WORK.find(x => x.id === 'fly29'); if (w && w.sum) return `${t(p.name)}. ${first(w.sum)}`; }
  return `${t(p.name)}. ${p.lines && p.lines[0] ? first(p.lines[0]) : ''}`;
}
const stamps = (() => { try { return new Set(JSON.parse(store.get('pm-bus-stamps') || '[]')); } catch (e) { return new Set(); } })();
const saveStamps = () => store.set('pm-bus-stamps', JSON.stringify([...stamps]));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* when the bus pulls into stop k next (seconds from now) */
function busEta(k){
  const tt = ((busClock() % BUS.total) + BUS.total) % BUS.total, b = busAt(busClock());
  if (b.stop === k) return 0;
  let best = Infinity; for (const h of BUS.hops) if (h.to === k){ const a = (h.t0 + h.dwell + h.dur) % BUS.total; best = Math.min(best, (a - tt + BUS.total) % BUS.total); }
  return best;
}
function nextTourStop(){ let best = null; BUS.stops.forEach((p, k) => { if (busTour !== 'all' && !inTour(p)) return; const e = busEta(k); if (e > 0.5 && (!best || e < best.e)) best = { p, k, e }; }); return best; }

/* ---------- arriving: announcement, stamp, badge ---------- */
function busArrive(p, k){
  const ar = lang === 'ar', themed = inTour(p);
  const story = busTour === 'story' && isStory(p) ? storyLine(p) : '';
  if (typeof Voice !== 'undefined' && Voice.on) Voice.say((ar ? `المحطة: ${t(p.name)}` : `Next stop, ${t(p.name)}`) + (story ? '. ' + story : ''), 'bus driver');
  if (story) setTimeout(() => mini('⭐ ' + story), 300);
  if (!stamps.has(p.id)){ stamps.add(p.id); saveStamps(); if (themed) setTimeout(() => mini(`🎫 ${ar ? 'ختم جديد في باسبورك:' : 'New stamp in your passport:'} ${t(p.name)} (${stamps.size}/${BUS.stops.length})`), 900);
    if (stamps.size >= BUS.stops.length){ const b = myBadges(); if (!b.some(x => x.id === 'bus-tourist')){ b.push({ id: 'bus-tourist', icon: '🎫', name: L('Planet tourist', 'سائح Planet') }); store.set('pm-badges', JSON.stringify(b)); Sfx.deliver(); toast(ar ? '🏅 بقيت سائح Planet!' : '🏅 You are a Planet tourist!', ar ? 'زرت كل محطات الكوكب بالباص' : 'You rode to every stop on the planet'); } }
    else if ([10, 25].includes(stamps.size)) toast(`🎫 ${stamps.size} ${ar ? 'ختم!' : 'stamps!'}`, ar ? 'كمّل الجولة عشان بادج سائح Planet' : 'Keep riding for the Planet tourist badge'); }
}

/* ---------- my seat in the bus, and everyone else's ---------- */
const BUS_SEATS = [[-0.48, 1.0], [0.48, 1.0], [-0.48, 0.25], [0.48, 0.25], [-0.48, -0.5], [0.48, -0.5], [-0.48, -1.25], [0.48, -1.25]];
// every rider (me and everyone else on the bus) gets a different seat: the same sorted list on every screen gives the same answer
const seatOf = id => { const ids = [...peers.values()].filter(pr => pr.bu || pr.id === id).map(pr => pr.id); if (onBus || id === netId) ids.push(netId);
  const list = [...new Set(ids)].sort(), i = Math.max(0, list.indexOf(id)), s = BUS_SEATS[i % BUS_SEATS.length]; return { x: s[0], z: s[1] }; };
function busSeatMe(){
  const s = seatOf(netId); rig.visible = true; rig.position.set(s.x, 0.72, s.z); rig.scale.setScalar(0.5);
  if (proc.legL){ proc.legL.rotation.x = proc.legR.rotation.x = -1.45; proc.knL.rotation.x = proc.knR.rotation.x = 1.4; proc.armL.rotation.x = proc.armR.rotation.x = -0.4; proc.body.position.y = 0; }
}
{ const plainLeave = leaveBus; leaveBus = function(){ const was = onBus; plainLeave.apply(this, arguments); if (was){ rig.position.set(0, 0, 0); rig.scale.setScalar(1); } }; }
{ const plainMy = myState; myState = function(){ const s = plainMy(); if (s && onBus && s.w === 'p') s.bu = 1; return s; }; }
{ const plainState = onPeerState; onPeerState = function(p){ plainState(p); if (!p || p.i === netId) return; const peer = peers.get(p.i); if (!peer) return;
    const was = !!peer.bu; peer.bu = p.bu ? seatOf(p.i) : null; for (const pr of peers.values()) if (pr.bu) pr.bu = seatOf(pr.id);   // someone got on or off: everyone shuffles to their seat
    if (!was && peer.bu && onBus) mini(lang === 'ar' ? `🚌 ${t(visitorName(peer.num, peer.nick))} ركب الباص معاك` : `🚌 ${t(visitorName(peer.num, peer.nick))} got on the bus`); }; }

/* ---------- the bar: tour choice, next stop of the tour, passport, who's riding ---------- */
{ const plainPaint = paintBusBar; paintBusBar = function(b){
    plainPaint(b); const el = document.getElementById('busbar'); if (!el || el.hidden) return;
    let x = document.getElementById('busx');
    if (!x){ x = document.createElement('div'); x.id = 'busx'; x.className = 'bb-x';
      x.innerHTML = '<div class="bb-tours" id="bbtours"></div><div class="bb-info"><span id="bbtour"></span><button type="button" id="bbsee" hidden></button><button type="button" id="bbpass"></button></div><div id="bbride" class="bb-ride"></div>';
      el.appendChild(x); x.querySelector('#bbpass').onclick = () => { Sfx.click(); openPassport(); }; x.dataset.lang = ''; }
    const ar = lang === 'ar';
    if (x.dataset.lang !== lang + busTour){ x.dataset.lang = lang + busTour;
      x.querySelector('#bbtours').innerHTML = TOURS.map(tr => `<button type="button" class="bb-t${tr.id === busTour ? ' on' : ''}" data-t="${tr.id}" title="${t(tr.name)}">${tr.icon}<span>${t(tr.name)}</span></button>`).join('');
      x.querySelectorAll('[data-t]').forEach(bt => bt.onclick = () => { busTour = bt.dataset.t; store.set('pm-bus-tour', busTour); Sfx.click(); const tr = TOURS.find(z => z.id === busTour); mini(`${tr.icon} ${ar ? 'جولة:' : 'Tour:'} ${t(tr.name)}`); paintBusBar(busAt(busClock())); }); }
    const nx = nextTourStop();
    x.querySelector('#bbtour').textContent = nx ? (ar ? `⏱️ ${t(nx.p.name)} بعد ${mmss(nx.e)}` : `⏱️ ${t(nx.p.name)} in ${mmss(nx.e)}`) : '';
    x.querySelector('#bbpass').textContent = `🎫 ${stamps.size}/${BUS.stops.length}`;
    const see = x.querySelector('#bbsee'), here = b && b.stop >= 0 ? BUS.stops[b.stop] : null, open = here && typeof exhibitFor === 'function' ? exhibitFor(here) : null;
    see.hidden = !open; if (open){ see.textContent = ar ? `👀 شوف ${t(here.name)}` : `👀 See ${t(here.name)}`; see.onclick = () => { Sfx.click(); try { if (typeof anEvent === 'function') anEvent('bus-see', t(here.name)); } catch (e) {} open(); }; }
    const riders = [...peers.values()].filter(p => p.bu).map(p => t(visitorName(p.num, p.nick)));
    x.querySelector('#bbride').textContent = riders.length ? (ar ? `👥 معاك في الباص: ${riders.join('، ')}` : `👥 On the bus with you: ${riders.join(', ')}`) : '';
  }; }

/* ---------- the passport ---------- */
function openPassport(){
  const ar = AR(), n = BUS.stops.length;
  const box = xModal('passportbox', `<h3>🎫 ${ar ? 'باسبور جولة Planet' : 'Planet tour passport'}</h3>
    <p class="xm-sub">${ar ? `ختمت ${stamps.size} من ${n} محطة — اركب الباص لحد كل محطة عشان بادج «سائح Planet»` : `${stamps.size} of ${n} stops stamped — ride to every stop for the "Planet tourist" badge`}</p>
    <div class="pass-bar"><i style="width:${(stamps.size / n * 100).toFixed(1)}%"></i></div>
    <div class="pass-grid">${BUS.stops.map(p => { const on = stamps.has(p.id), tr = TOURS.find(z => z.id === stopTheme(p));
      return `<div class="pass-s${on ? ' on' : ''}" title="${t(p.name)}"><b>${on ? tr.icon : '·'}</b><span>${on ? t(p.name) : '???'}</span></div>`; }).join('')}</div>`);
}

/* ---------- timetables at the stops ---------- */
function openTimetable(sign){
  const ar = AR(); let timer = 0;
  const paint = () => { const box = document.getElementById('ttbox'); if (!box || box.hidden){ clearInterval(timer); return; }
    const e = busEta(sign.k), b = busAt(busClock()), here = b.stop === sign.k;
    const rows = []; for (let i = 1; i <= 4; i++){ const k = (sign.k + i) % BUS.stops.length; rows.push(`<li><span>${t(BUS.stops[k].name)}</span><b>${mmss(busEta(k))}</b></li>`); }
    box.querySelector('.tt-body').innerHTML = `<div class="tt-now${here ? ' here' : ''}">${here ? (ar ? `🚌 الباص هنا دلوقتي! بيتحرك بعد ${Math.ceil(b.wait)}ث` : `🚌 The bus is here now! Leaving in ${Math.ceil(b.wait)}s`) : (ar ? `🚌 الباص جاي بعد <b>${mmss(e)}</b>` : `🚌 Next bus in <b>${mmss(e)}</b>`)}</div>
      <p class="xm-sub">${ar ? 'وبعدها بيعدّي على:' : 'Then it goes on to:'}</p><ol class="tt-list">${rows.join('')}</ol>`;
    const go = box.querySelector('[data-a="board"]'); go.hidden = !(here && bus.position.distanceTo(player.position) < 9); };
  xModal('ttbox', `<h3>🚏 ${ar ? 'محطة' : 'Stop'}: ${t(BUS.stops[sign.k].name)}</h3><div class="tt-body"></div>
    <button type="button" class="xm-go" data-a="board" hidden>🚌 ${ar ? 'اركب دلوقتي' : 'Hop on now'}</button>`);
  document.querySelector('#ttbox [data-a="board"]').onclick = () => { closeX('ttbox'); boardBus(); };
  paint(); timer = setInterval(paint, 500);
}
{ const plainInteract = interact; interact = function(tk){ if (tk && tk.kind === 'busstop') return openTimetable(tk.ref); return plainInteract.apply(this, arguments); }; }
(function waitSigns(){ if (!busReady || !BUS.signs.length) return setTimeout(waitSigns, 700);
  for (const s of BUS.signs) talkables.push({ d: s.d, r: 2.4, kind: 'busstop', ref: s, label: L('🚏 Bus times', '🚏 مواعيد الباص') }); })();

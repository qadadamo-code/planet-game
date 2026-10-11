/* The minimap and "take me there": a small round map that turns with the camera (you in the middle,
   roads, every place, other visitors), and a big map with a searchable list of places. Picking a place
   sets it as the compass target and draws the road route there — e.g. from Al Shawa to Al Jamalla. */

const MAP = { range: 58, bigRange: Math.PI * R };
let mapRoute = [], mapRouteFor = null, mapRouteAt = 0;

function mapEl(){
  let c = document.getElementById('minimap'); if (c) return c;
  c = document.createElement('canvas'); c.id = 'minimap'; c.className = 'panel'; c.width = c.height = 300; c.title = 'Map';
  c.addEventListener('click', () => { Sfx.click(); openBigMap(); });
  document.body.appendChild(c); return c;
}

/* azimuthal projection around me, "up" = where the camera looks */
const _mv = new THREE.Vector3(), _mr = new THREE.Vector3();
function mapProject(d, scale){
  const dot = THREE.MathUtils.clamp(pDir.dot(d), -1, 1), dist = Math.acos(dot) * R;
  _mv.copy(d).addScaledVector(pDir, -dot); const l = _mv.length(); if (l < 1e-6) return [0, 0, dist];
  _mv.multiplyScalar(1 / l); _mr.crossVectors(camFwd, pDir).normalize();
  return [_mv.dot(_mr) * dist * scale, -_mv.dot(camFwd) * dist * scale, dist];
}
function placeColor(p){ if (p.id === 'hq') return '#F2C94C'; if (p.svc) return '#2E6BA9'; if (p.district) return '#' + DISTRICTS[p.district].color.toString(16).padStart(6, '0'); return '#8A93AD'; }

function drawMap(ctx, size, range, big){
  const r = size / 2, sc = (r - 8) / range;
  ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(r, r);
  ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.fillStyle = '#9FD68A'; ctx.fill(); ctx.clip();
  // the far side of the planet fades out on the big map
  if (big){ const gr = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r); gr.addColorStop(0, 'rgba(18,21,58,0)'); gr.addColorStop(1, 'rgba(18,21,58,.35)'); ctx.fillStyle = gr; ctx.fillRect(-r, -r, size, size); }
  // roads
  ctx.strokeStyle = '#E9E4D8'; ctx.lineWidth = big ? 4 : 5; ctx.lineCap = 'round';
  const drawEdge = (a, b) => { ctx.beginPath(); for (let k = 0; k <= 10; k++){ const d = poiDirs[a].clone().lerp(poiDirs[b], k / 10).normalize(); const [x, y, dist] = mapProject(d, sc);
      if (dist > range * 1.15){ ctx.moveTo(x, y); continue; } k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
  for (const [a, b] of EDGES) drawEdge(a, b);
  // the route to where you're going
  if (mapRoute.length > 1){ ctx.strokeStyle = '#F2C94C'; ctx.lineWidth = big ? 6 : 7; ctx.setLineDash([10, 8]); for (let i = 1; i < mapRoute.length; i++) drawEdge(mapRoute[i - 1], mapRoute[i]); ctx.setLineDash([]); }
  // places
  const tgt = typeof currentTarget === 'function' ? currentTarget() : null, labels = [];
  for (const p of pois){ const [x, y, dist] = mapProject(p.dir, sc); if (dist > range) continue;
    const isT = p === tgt; ctx.beginPath(); ctx.arc(x, y, isT ? (big ? 9 : 11) : (big ? 5 : 7), 0, Math.PI * 2); ctx.fillStyle = placeColor(p); ctx.fill();
    ctx.lineWidth = isT ? 4 : 2; ctx.strokeStyle = isT ? '#E05A5A' : '#12153A'; ctx.stroke();
    if (big && dist < range * 0.75) labels.push({ p, x, y, isT, dist }); }
  // names only where they fit: the target first, then the nearest places; a name that would overlap is skipped
  if (big){ ctx.font = '700 13px IBM Plex Sans Arabic, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(244,247,252,.92)';
    labels.sort((a, b) => (b.isT - a.isT) || a.dist - b.dist); const boxes = [];
    for (const l of labels){ const nm = t(l.p.name), w = ctx.measureText(nm).width + 6, bx = [l.x - w / 2, l.y - 25, l.x + w / 2, l.y - 7];
      if (!l.isT && boxes.some(o => bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1])) continue;
      boxes.push(bx); ctx.strokeText(nm, l.x, l.y - 11); ctx.fillStyle = l.isT ? '#C0392B' : '#12153A'; ctx.fillText(nm, l.x, l.y - 11); } }
  // target beyond the edge: a pointer on the rim
  if (tgt){ const [x, y, dist] = mapProject(tgt.dir, sc); if (dist > range){ const a = Math.atan2(y, x); ctx.save(); ctx.translate(Math.cos(a) * (r - 16), Math.sin(a) * (r - 16)); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fillStyle = '#E05A5A'; ctx.fill(); ctx.restore(); } }
  // race parcels
  if (typeof RACE !== 'undefined' && RACE.on) for (const pc of RACE.parcels){ if (pc.got) continue; const [x, y, dist] = mapProject(pc.d, sc); if (dist > range) continue;
    const s = big ? 6 : 8; ctx.fillStyle = '#C98A5A'; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.lineWidth = 2; ctx.strokeStyle = '#F2C94C'; ctx.strokeRect(x - s, y - s, s * 2, s * 2); }
  // other visitors, live: an arrow in their colour pointing where they walk, their name, and where they are if not outside
  if (typeof peers !== 'undefined') drawPeers(ctx, sc, range, r, big);
  // me, pointing the way I face
  _mr.crossVectors(camFwd, pDir).normalize(); const fa = Math.atan2(pFwd.dot(_mr), pFwd.dot(camFwd));
  ctx.rotate(fa); ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.lineTo(-10, 10); ctx.closePath();
  ctx.fillStyle = '#E05A5A'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#12153A'; ctx.stroke();
  if (!big){ ctx.fillStyle = '#12153A'; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⌕', r, size - 16); }
}

/* where a visitor is on the planet's surface, even when they're inside a building or the office */
function peerDir(p){
  if (p.world === 'p') return p.pos.clone().normalize();
  if (p.world === 'o') return pois[0].dir;
  if (p.world === 'b'){ const b = pois.find(x => x.id === p.bld); return b ? b.dir : null; }
  return null;
}
const _ph = new THREE.Vector3();
function drawPeers(ctx, sc, range, r, big){
  const now = performance.now(), followId = guide && guide.peerId;
  for (const p of peers.values()){
    const d = peerDir(p); if (!d) continue;
    const [x, y, dist] = mapProject(d, sc), col = '#' + new THREE.Color(p.color).getHexString(), nm = t(visitorName(p.num, p.nick)), fol = p.id === followId;
    if (dist > range){   // out of view: a dot on the rim in their colour
      if (big) continue; const a = Math.atan2(y, x), rx = Math.cos(a) * (r - 14), ry = Math.sin(a) * (r - 14);
      ctx.beginPath(); ctx.arc(rx, ry, fol ? 8 : 6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = fol ? 3 : 2; ctx.strokeStyle = fol ? '#F2C94C' : '#fff'; ctx.stroke(); continue; }
    // a soft pulse so you can spot people moving around
    const pulse = (now / 900 + p.num * 0.37) % 1;
    ctx.beginPath(); ctx.arc(x, y, (big ? 8 : 10) + pulse * (big ? 10 : 14), 0, Math.PI * 2); ctx.fillStyle = col; ctx.globalAlpha = 0.35 * (1 - pulse); ctx.fill(); ctx.globalAlpha = 1;
    if (fol){ ctx.beginPath(); ctx.arc(x, y, big ? 13 : 16, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#F2C94C'; ctx.stroke(); }
    ctx.save(); ctx.translate(x, y);
    if (p.world === 'p'){ // which way they're facing, turned into the map's frame
      _ph.set(0, 0, 1).applyQuaternion(p.quat); _ph.addScaledVector(d, -_ph.dot(d)); _mr.crossVectors(camFwd, pDir).normalize();
      ctx.rotate(Math.atan2(_ph.dot(_mr), _ph.dot(camFwd)));
      const k = big ? 0.8 : 1; ctx.beginPath(); ctx.moveTo(0, -12 * k); ctx.lineTo(9 * k, 9 * k); ctx.lineTo(0, 4 * k); ctx.lineTo(-9 * k, 9 * k); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
    } else { // inside the office or a building: a little house badge
      ctx.beginPath(); ctx.arc(0, 0, big ? 9 : 11, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = `${big ? 11 : 13}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏠', 0, 1); ctx.restore(); }
    // their name, small, under the marker
    if (big || dist < range * 0.75){ ctx.font = `800 ${big ? 12 : 15}px IBM Plex Sans Arabic, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.direction = /[؀-ۿ]/.test(nm) ? 'rtl' : 'ltr'; const w = ctx.measureText(nm).width + 10, ly = y + (big ? 22 : 27);
      ctx.fillStyle = 'rgba(18,21,58,.82)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w/2, ly - (big ? 12 : 15), w, big ? 16 : 20, 8) : ctx.rect(x - w/2, ly - 14, w, 18); ctx.fill();
      ctx.fillStyle = col === '#12153a' ? '#F4F7FC' : col; ctx.fillText(nm, x, ly); ctx.direction = 'ltr'; }
  }
}
/* follow a visitor: the compass and the yellow route lead to wherever they are now */
function followPeer(id){
  const p = peers.get(id); if (!p) return;
  guide = { peerId: id, r: 2.5, name: visitorName(p.num, p.nick),
    get dir(){ const q = peers.get(id), d = q && peerDir(q); return d || pDir.clone(); },
    get i(){ return poiDist(this.dir)[1]; } };
  mapRouteFor = null; Sfx.click(); mini((lang === 'ar' ? '👣 بتتابع ' : '👣 Following ') + t(guide.name));
}
function followFrame(){
  if (!guide || !guide.peerId) return;
  const p = peers.get(guide.peerId);
  if (!p || p.world === 's'){ mini(lang === 'ar' ? '👣 الزائر اللي بتتابعه مشي' : '👣 The visitor you were following left'); guide = null; return; }
  if (state === 'play' && p.world === 'p' && pDir.angleTo(peerDir(p)) * R < 4){ mini(lang === 'ar' ? `👋 وصلت عند ${t(guide.name)}` : `👋 You caught up with ${t(guide.name)}`); guide = null; }
}

/* shortest road route (Dijkstra over the planet's road graph) from the place nearest me to the target */
function routeTo(target){
  const from = poiDist(pDir)[1], to = target.i, n = poiDirs.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[from] = 0;
  for (let it = 0; it < n; it++){ let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || dist[u] === Infinity) break; done[u] = true; if (u === to) break;
    for (const ei of ADJ[u]){ const [a, b] = EDGES[ei], v = a === u ? b : a, w = poiDirs[u].angleTo(poiDirs[v]); if (dist[u] + w < dist[v]){ dist[v] = dist[u] + w; prev[v] = u; } } }
  const path = []; for (let v = to; v >= 0; v = prev[v]) path.unshift(v);
  return path[0] === from ? path : [from, to];
}

let mapTick = 0;
function mapFrame(now){
  requestAnimationFrame(mapFrame);
  const c = mapEl(), show = (state === 'play' || state === 'talk') && !(typeof inOffice !== 'undefined' && inOffice) && !(typeof inSpace !== 'undefined' && inSpace) && !(typeof inBuilding !== 'undefined' && inBuilding) && !$('hud').hidden;
  c.hidden = !show;
  const bm = document.getElementById('bigmap'), bigOpen = bm && !bm.hidden;
  if (!show && !bigOpen) return;
  if (++mapTick % 2) return;   // 30 fps is plenty for a map
  const tgt = guide;
  followFrame(); if (tgt !== mapRouteFor || (tgt && now - mapRouteAt > (tgt.peerId ? 600 : 1500))){ mapRouteFor = tgt; mapRouteAt = now; mapRoute = tgt ? routeTo(tgt) : []; }
  if (show) drawMap(c.getContext('2d'), c.width, MAP.range, false);
  if (bigOpen){ drawMap(document.getElementById('bigmapc').getContext('2d'), 560, MAP.bigRange, true); if (mapTick % 60 === 0 && document.activeElement !== document.getElementById('bmsearch')) renderPlaceList(); }
}

function openBigMap(){
  let box = document.getElementById('bigmap');
  if (!box){
    box = document.createElement('div'); box.id = 'bigmap'; box.className = 'layer';
    box.innerHTML = `<div class="bm-card panel"><button type="button" class="x bm-x" aria-label="Close">✕</button>
      <div class="bm-head"><b data-m="title"></b><small data-m="sub"></small></div>
      <div class="bm-body"><canvas id="bigmapc" width="560" height="560"></canvas>
      <div class="bm-side"><input id="bmsearch" type="search" autocomplete="off"><div id="bmlist"></div></div></div></div>`;
    document.body.appendChild(box);
    box.querySelector('.bm-x').onclick = closeBigMap; box.addEventListener('click', e => { if (e.target === box) closeBigMap(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') closeBigMap(); e.stopPropagation(); });
    document.getElementById('bmsearch').oninput = renderPlaceList;
    langHooks.push(() => { if (!box.hidden) paintBigMap(); });
  }
  paintBigMap(); box.hidden = false; if (state === 'play') state = 'map';
}
function closeBigMap(){ const b = document.getElementById('bigmap'); if (b) b.hidden = true; if (state === 'map') state = 'play'; canvas.focus(); }
function paintBigMap(){
  const box = document.getElementById('bigmap');
  box.querySelector('[data-m="title"]').textContent = lang === 'ar' ? '🗺️ خريطة الكوكب' : '🗺️ Planet map';
  box.querySelector('[data-m="sub"]').textContent = lang === 'ar' ? 'اختار مكان أو زائر وهنوريك الطريق — البوصلة والخط الأصفر هيوصلوك' : 'Pick a place or a visitor and we\'ll show you the way — follow the compass and the yellow line';
  document.getElementById('bmsearch').placeholder = lang === 'ar' ? '🔎 دوّر على مكان أو عميل…' : '🔎 Search a place or client…';
  renderPlaceList();
}
function renderPlaceList(){
  const q = (document.getElementById('bmsearch').value || '').trim().toLowerCase(), list = document.getElementById('bmlist'); list.textContent = '';
  if (typeof peers !== 'undefined' && peers.size){
    const h = document.createElement('h5'); h.textContent = lang === 'ar' ? `👥 الزوار دلوقتي (${peers.size})` : `👥 Visitors now (${peers.size})`; list.appendChild(h);
    for (const p of peers.values()){ const nm = t(visitorName(p.num, p.nick)); if (q && !nm.toLowerCase().includes(q)) continue;
      const d = peerDir(p), b = document.createElement('button'); b.type = 'button'; b.className = 'bm-place' + (guide && guide.peerId === p.id ? ' on' : '');
      const dot = document.createElement('i'); dot.style.background = '#' + new THREE.Color(p.color).getHexString(); const sp = document.createElement('span'); sp.textContent = nm;
      const sm = document.createElement('small'); const bld = p.world === 'b' && pois.find(x => x.id === p.bld);
      sm.textContent = p.world === 's' ? (lang === 'ar' ? '🚀 في الفضاء' : '🚀 in space') : p.world === 'o' ? (lang === 'ar' ? '🏢 في المكتب' : '🏢 in the office') : bld ? '🏠 ' + t(bld.name) : d ? `${Math.round(pDir.angleTo(d) * R * 2)} m · 👣` : '';
      b.append(dot, sp, sm); b.onclick = () => { if (p.world === 's') return mini(lang === 'ar' ? '🚀 الزائر ده في الفضاء — اطلع بالصاروخ' : '🚀 They are in space — take the rocket'); followPeer(p.id); closeBigMap(); };
      list.appendChild(b); } }
  const groups = [[lang === 'ar' ? '🏢 Planet' : '🏢 Planet', pois.filter(p => !p.district)], ...Object.entries(DISTRICTS).map(([dk, D]) => [`${D.icon} ${t(D.name)}`, pois.filter(p => p.district === dk)])];
  for (const [title, ps] of groups){
    const hits = ps.filter(p => !q || p.name.en.toLowerCase().includes(q) || p.name.ar.includes(q)); if (!hits.length) continue;
    const h = document.createElement('h5'); h.textContent = title; list.appendChild(h);
    for (const p of hits){ const b = document.createElement('button'); b.type = 'button'; b.className = 'bm-place' + (guide === p ? ' on' : '');
      const dot = document.createElement('i'); dot.style.background = placeColor(p); const nm = document.createElement('span'); nm.textContent = t(p.name);
      const d = document.createElement('small'); d.textContent = `${Math.round(pDir.angleTo(p.dir) * R * 2)} m`;
      b.append(dot, nm, d); b.onclick = () => { guide = p; mapRouteFor = null; Sfx.click(); closeBigMap(); mini(`🧭 ${t(UI.guide)}: ${t(p.name)}`); }; list.appendChild(b); }
  }
  if (!list.children.length){ const e = document.createElement('p'); e.textContent = lang === 'ar' ? 'مفيش نتايج' : 'No matches'; list.appendChild(e); }
}
addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea')) return; if (e.code === 'KeyM' && (state === 'play' || state === 'map')){ const b = document.getElementById('bigmap'); b && !b.hidden ? closeBigMap() : openBigMap(); } });
requestAnimationFrame(mapFrame);

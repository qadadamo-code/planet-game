/* ---------- the Planet tour bus ----------
   One yellow bus loops the whole planet in a fixed order, stopping at every place in turn.
   Its position comes from the wall clock, so every visitor sees the same bus at the same stop.
   Hop on anywhere you meet it, ride past the studios and clients with a little introduction at each
   stop, and hop off wherever you like. */
let onBus = false, busReady = false, bus = null, busTk = null, busOffNext = false, busLast = -1;
const BUS = { speed: 9, dwell: 9, lane: -0.6, hops: [], total: 0 };

function busTex(){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#12153A'; x.beginPath(); x.roundRect ? x.roundRect(4, 4, 504, 120, 30) : x.rect(4, 4, 504, 120); x.fill();
  x.fillStyle = '#F2C94C'; x.font = '900 52px Orbitron, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('PLANET TOUR', 256, 48); x.fillStyle = '#F4F7FC'; x.font = '700 34px IBM Plex Sans Arabic, sans-serif'; x.direction = 'rtl'; x.fillText('جولة حوالين الكوكب', 256, 96);
  const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; return tx;
}
function makeBus(){
  const g = new THREE.Group(); g.userData.dyn = true;
  const Y = 0xF2C94C, B = 0x2E6BA9, W = 0xF4F7FC, D = 0x12153A;
  const add = (geo, col, x, y, z, basicMat) => { const m = new THREE.Mesh(geo, basicMat ? basic(col) : toon(col)); m.position.set(x, y, z); m.castShadow = SHADOWS; g.add(m); return m; };
  add(RB(2.0, 1.55, 4.6), Y, 0, 1.12, 0);                       // the body
  add(RB(2.04, 0.34, 4.64), B, 0, 0.56, 0);                     // blue skirt
  add(RB(1.84, 0.3, 4.3), W, 0, 1.98, 0);                       // white roof
  for (let i = 0; i < 5; i++){ const z = -1.65 + i * 0.78;     // side windows
    [-1, 1].forEach(sd => add(new THREE.BoxGeometry(0.06, 0.52, 0.62), 0xBFE3F2, sd * 1.01, 1.4, z, true)); }
  add(new THREE.BoxGeometry(1.7, 0.66, 0.06), 0xBFE3F2, 0, 1.38, 2.31, true);   // windscreen
  add(new THREE.BoxGeometry(1.5, 0.5, 0.06), 0xBFE3F2, 0, 1.45, -2.31, true);   // back window
  [-0.7, 0.7].forEach(x => { add(new THREE.SphereGeometry(0.12, 12, 8), 0xFFF3C4, x, 0.72, 2.3, true); add(new THREE.SphereGeometry(0.1, 10, 6), 0xE76F51, x, 0.72, -2.3, true); });
  add(new THREE.BoxGeometry(0.06, 1.0, 0.7), D, 1.02, 0.95, 1.55);                // door
  [[-1, 1.5], [1, 1.5], [-1, -1.4], [1, -1.4]].forEach(([sd, z]) => {
    const w = add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), 0x23284D, sd * 0.95, 0.4, z); w.rotation.z = Math.PI / 2; w.userData.wheel = true;
    const hub = add(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10), 0xDCE2EE, sd * 0.96, 0.4, z); hub.rotation.z = Math.PI / 2; hub.userData.wheel = true; });
  const tx = busTex();
  [-1, 1].forEach(sd => { const s = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
    s.position.set(sd * 1.035, 0.95, -0.25); s.rotation.y = sd * Math.PI / 2; g.add(s); });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: tx, transparent: true })); top.position.set(0, 1.9, 2.33); g.add(top);
  return g;
}
function busStopSign(){
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), 0x12153A); pole.position.y = 1.15; g.add(pole);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#F2C94C'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#12153A'; x.stroke(); x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚌', 64, 70);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
  disc.position.y = 2.35; g.add(disc); const bench = mesh(new THREE.BoxGeometry(1.1, 0.1, 0.4), 0xB5835A); bench.position.set(0.7, 0.45, 0); g.add(bench);
  [0.25, 1.15].forEach(x0 => { const l = mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), 0x12153A); l.position.set(x0, 0.22, 0); g.add(l); });
  return g;
}

/* shortest road between two places (Dijkstra over the road graph), as a list of { e, dir, len } */
function roadPath(a, b){
  const n = poiDirs.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false); dist[a] = 0;
  for (;;){ let u = -1; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || u === b) break; done[u] = true;
    for (const ei of ADJ[u]){ const [x, y] = EDGES[ei], v = x === u ? y : x, w = poiDirs[x].angleTo(poiDirs[y]) * R; if (dist[u] + w < dist[v]){ dist[v] = dist[u] + w; prev[v] = ei; } } }
  const out = []; let v = b; while (v !== a && prev[v] >= 0){ const ei = prev[v], [x, y] = EDGES[ei], u = x === v ? y : x; out.unshift({ e: ei, dir: x === u ? 1 : -1, len: poiDirs[x].angleTo(poiDirs[y]) * R }); v = u; }
  return out;
}
function buildBus(){
  // stop order: start at HQ, then always the nearest place not yet visited — a tidy loop round the planet
  const left = pois.filter(p => p !== pois[0]), order = [pois[0]];
  while (left.length){ const last = order[order.length - 1]; left.sort((a, b) => last.dir.angleTo(a.dir) - last.dir.angleTo(b.dir)); order.push(left.shift()); }
  BUS.stops = order;
  const legsOf = order.map((p, k) => roadPath(p.i, order[(k + 1) % order.length].i));
  const sA = l => l.dir > 0 ? Math.min(E0(l.e) + 0.6, l.len / 2) : Math.max(l.len - E1(l.e) - 0.6, l.len / 2);   // where a road begins, past the roundabout
  const sB = l => l.dir > 0 ? Math.max(l.len - E1(l.e) - 0.6, l.len / 2) : Math.min(E0(l.e) + 0.6, l.len / 2);   // where it ends, before the next one
  const lp = (l, s0) => edgePoint(l.e, s0, BUS.lane * l.dir, V());
  const nodeAfter = l => l.dir > 0 ? EDGES[l.e][1] : EDGES[l.e][0];
  let t = 0;
  for (let k = 0; k < order.length; k++){
    const legs = legsOf[k], prevLegs = legsOf[(k + order.length - 1) % order.length], pts = [];
    const pushArc = (node, from, to, longWay) => { const arc = ringArc(node, from, to, 0, longWay), n = Math.max(2, Math.ceil(arc.len / 1.2)); for (let i = 1; i <= n; i++) pts.push(ringPoint(arc, i / n, V())); };
    if (legs.length){
      if (prevLegs.length){ const pl = prevLegs[prevLegs.length - 1]; pts.push(lp(pl, sB(pl))); pushArc(order[k].i, lp(pl, sB(pl)), lp(legs[0], sA(legs[0])), pl.e === legs[0].e); }
      legs.forEach((l, i) => {
        const a0 = sA(l), b0 = sB(l), n = Math.max(2, Math.ceil(Math.abs(b0 - a0) / 1.5)); for (let j = 0; j <= n; j++) pts.push(lp(l, a0 + (b0 - a0) * j / n));
        const nx = legs[i + 1]; if (nx) pushArc(nodeAfter(l), lp(l, b0), lp(nx, sA(nx)), nx.e === l.e); });
    }
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].angleTo(pts[i]) * R);
    const len = cum[cum.length - 1] || 0, dur = len / BUS.speed + 2.2;   // a little extra for pulling away and braking
    BUS.hops.push({ from: k, to: (k + 1) % order.length, legs, pts, cum, len, t0: t, dur, dwell: BUS.dwell }); t += BUS.dwell + dur; }
  BUS.total = t;
  bus = makeBus(); planet.add(bus);
  busTk = { d: pois[0].dir.clone(), r: 3.6, kind: 'bus' }; talkables.push(busTk);
  // a stop sign on the kerb where the bus pulls up in front of every place
  for (const h of BUS.hops){ const l = h.legs[h.legs.length - 1]; if (!l) continue; const s0 = sB(l);
    for (const lane of [-2.5, -3.2]){ const d = edgePoint(l.e, s0, lane * l.dir); if (!walkable(d) || !clearOf(d, 0, 0, 0.6)) continue;
      const sg = busStopSign(); placeAt(sg, d); faceToward(sg, edgePoint(l.e, s0 + l.dir, lane * l.dir).multiplyScalar(R)); planet.add(sg); cullList.push(sg); addObstacle(d, 0.3); break; } }
  busReady = true;
}
/* where the bus is at a given clock time: { d, fwd, stop (index or -1), hop, u } */
const _bf = new THREE.Vector3();
function busAt(ts){
  const tt = ((ts % BUS.total) + BUS.total) % BUS.total;
  let h = BUS.hops[0]; for (const x of BUS.hops) if (tt >= x.t0) h = x;
  const local = tt - h.t0;
  if (local < h.dwell){ const prev = BUS.hops[(BUS.hops.indexOf(h) + BUS.hops.length - 1) % BUS.hops.length];   // waiting at the end of the previous ride
  return { stop: h.from, hop: h, u: 0, at: busPoint(prev, prev.len), next: busPoint(prev, prev.len + 0.6), back: busPoint(prev, prev.len - 0.6), wait: h.dwell - local }; }
  const u = Math.min(1, (local - h.dwell) / h.dur), eased = u * u * (3 - 2 * u);   // gentle start, gentle stop
  const s = eased * h.len;
  return { stop: -1, hop: h, u, at: busPoint(h, s), next: busPoint(h, s + 0.6), wait: 0 };
}
function busPoint(h, s){
  const P = h.pts, C = h.cum; if (!P.length) return { d: BUS.stops[h.from].dir.clone() };
  if (s <= 0) return { d: P[0].clone() }; if (s >= h.len) return { d: P[P.length - 1].clone() };
  let lo = 0, hi = C.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (C[m] <= s) lo = m; else hi = m; }
  const k = (s - C[lo]) / Math.max(1e-6, C[hi] - C[lo]); return { d: P[lo].clone().lerp(P[hi], k).normalize() };
}
function busClock(){ return Date.now() / 1000; }

let busPrevPos = new THREE.Vector3();
function busFrame(){
  requestAnimationFrame(busFrame);
  if (!busReady){ if (typeof state !== 'undefined' && state !== 'loading' && pois.length && pois[0].doorTan) buildBus(); return; }
  const b = busAt(busClock()), d = b.at.d, up = d.clone().normalize();
  const fwd = b.back ? d.clone().sub(b.back.d) : b.next.d.clone().sub(d); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() < 1e-10) fwd.copy(_bf); else fwd.normalize(); _bf.copy(fwd);
  const right = new THREE.Vector3().crossVectors(up, fwd), m = new THREE.Matrix4().makeBasis(right, up, fwd);
  bus.quaternion.setFromRotationMatrix(m); bus.position.copy(up).multiplyScalar(R + Math.max(0, heightAt(up)) + 0.02);
  const moved = busPrevPos.distanceTo(bus.position); busPrevPos.copy(bus.position);
  if (moved > 1e-4 && moved < 2) bus.traverse(o => { if (o.userData.wheel) o.rotation.x += moved * 2.5; });
  busTk.d.copy(up);
  // the bus doesn't drive through people: anyone standing in its way gets nudged onto the pavement
  if (!onBus && !riding && state === 'play' && !(typeof passengerOf !== 'undefined' && passengerOf)){ const dd = bus.position.distanceTo(player.position);
    if (dd < 2.7 && dd > 1e-4){ const away = player.position.clone().sub(bus.position); away.addScaledVector(pDir, -away.dot(pDir)).normalize(); const nd = pDir.clone().addScaledVector(away, (2.7 - dd) / R).normalize(); if (walkable(nd)) pDir.copy(nd); } }
  bus.visible = bus.position.distanceTo(camera.position) < 70 && !(typeof inBuilding !== 'undefined' && inBuilding) && !(typeof inOffice !== 'undefined' && inOffice);
  // arriving at a stop: announce it to riders
  if (b.stop >= 0 && b.stop !== busLast){ busLast = b.stop; if (onBus){ const p = BUS.stops[b.stop];
      toast((lang === 'ar' ? '🚏 محطة: ' : '🚏 Stop: ') + t(p.name), p.lines && p.lines[0] ? t(p.lines[0]).slice(0, 120) : '');
      Sfx.open(); if (busOffNext){ busOffNext = false; setTimeout(leaveBus, 600); } } }
  if (b.stop < 0) busLast = -1;
  if (onBus){
    pDir.copy(up); pFwd.copy(fwd); rig.visible = false;
    if (state !== 'play' && state !== 'talk') leaveBus();
  }
  paintBusBar(b);
}
function boardBus(){
  if (riding) dismount();
  if (typeof passengerOf !== 'undefined' && passengerOf) leaveRide();
  onBus = true; busOffNext = false; camDist = Math.max(camDist, 11); Sfx.open(); document.body.classList.add('passenger');
  const b = busAt(busClock()); busLast = b.stop;
  mini(lang === 'ar' ? '🚌 أهلاً في جولة Planet! استريح، الباص هيلف بيك على كل الأماكن' : '🚌 Welcome to the Planet tour! Sit back — the bus visits every place in turn');
  if (typeof track === 'function') track('car', 'bus');
}
function leaveBus(){
  if (!onBus) return; onBus = false; busOffNext = false; rig.visible = true; document.body.classList.remove('passenger');
  // step out on the kerb side, facing the stop
  const up = pDir.clone(), side = new THREE.Vector3().crossVectors(up, pFwd).normalize();
  for (const s of [-2.6, 2.6, -3.6, 3.6]){ const nd = up.clone().addScaledVector(side, s / R).normalize(); if (walkable(nd)){ pDir.copy(nd); break; } }
  Sfx.close(); paintBusBar(busAt(busClock()));
}
function paintBusBar(b){
  let el = document.getElementById('busbar');
  if (!el){ el = document.createElement('div'); el.id = 'busbar'; el.className = 'panel'; el.innerHTML = '<div class="bb-top"><b id="bbnow"></b><span id="bbnext"></span></div><div class="bb-prog"><i id="bbfill"></i></div><div class="bb-act"><button type="button" id="bboff"></button></div>'; document.body.appendChild(el);
    el.querySelector('#bboff').onclick = () => { const bb = busAt(busClock()); if (bb.stop >= 0) leaveBus(); else { busOffNext = !busOffNext; paintBusBar(bb); } }; }
  el.hidden = !onBus; if (!onBus) return;
  const n = BUS.stops.length, cur = b.stop >= 0 ? b.stop : b.hop.to, nxt = BUS.stops[b.stop >= 0 ? b.hop.to : b.hop.to];
  const ar = lang === 'ar';
  document.getElementById('bbnow').textContent = b.stop >= 0
    ? (ar ? `🚏 واقفين عند ${t(BUS.stops[b.stop].name)} · بنتحرك بعد ${Math.ceil(b.wait)}ث` : `🚏 At ${t(BUS.stops[b.stop].name)} · leaving in ${Math.ceil(b.wait)}s`)
    : (ar ? `🚌 رايحين ${t(nxt.name)}` : `🚌 Heading to ${t(nxt.name)}`);
  document.getElementById('bbnext').textContent = ar ? `محطة ${cur + 1} من ${n}` : `Stop ${cur + 1} of ${n}`;
  document.getElementById('bbfill').style.width = ((cur + (b.stop >= 0 ? 0 : b.u)) / n * 100).toFixed(1) + '%';
  document.getElementById('bboff').textContent = b.stop >= 0 ? (ar ? '🚪 انزل هنا' : '🚪 Hop off here') : busOffNext ? (ar ? '✔ هتنزل في المحطة الجاية' : '✔ Getting off at the next stop') : (ar ? '🔔 انزل في المحطة الجاية' : '🔔 Stop at the next one');
}
requestAnimationFrame(busFrame);

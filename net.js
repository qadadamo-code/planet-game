/* Shared world: everyone who has the game open at the same moment sees everyone else walking, driving
   and visiting the office — live. Runs on Supabase Realtime (broadcast + presence) of the Planet Co
   project; no database tables are touched, and nothing is stored. Each visitor sends a small position
   update a few times a second while moving, and a heartbeat while standing still. */

const NET = {
  url: 'https://fxgljuswxeovwimfokml.supabase.co',
  key: 'sb_publishable_l9G4Rf4BwKtJfXjLbqtzoA_lerUfKHZ',
  room: 'planet-world-v1',
  sendMs: 110,       // while moving
  idleMs: 2000,      // heartbeat while still
  dropMs: 9000,      // a visitor we haven't heard from in this long has left
};
const VISITOR_COLORS = [0xE76F51, 0x3E8E7E, 0x8E6BC2, 0xF2C94C, 0xE9A0B8, 0x5FA0E6, 0xD94C93, 0x2EA87A];

const netId = (() => { try { const k = 'pm-net-id', v = localStorage.getItem(k); if (v) return v;
  const n = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 12); localStorage.setItem(k, n); return n; } catch (e) { return Math.random().toString(36).slice(2, 14); } })();
const netNum = parseInt(netId.slice(0, 6), 36) % 900 + 100;
const netColor = VISITOR_COLORS[parseInt(netId.slice(6, 10), 36) % VISITOR_COLORS.length];
const peers = new Map();
let netChan = null, netLive = false, netLastSend = 0, netLastKey = '';

function visitorName(num, nick){ return nick ? L(nick, nick) : L(`Visitor ${num}`, `زائر ${num}`); }
function myNick(){ return (typeof brief !== 'undefined' && brief.name) ? String(brief.name).slice(0, 24) : ''; }

function peerTag(peer){
  const w = 420, h = 96, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = () => { x.clearRect(0, 0, w, h);
    const col = '#' + new THREE.Color(peer.color).getHexString();
    x.fillStyle = '#12153A'; x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, 44) : x.rect(4, 4, w - 8, h - 8); x.fill(); x.stroke();
    x.fillStyle = '#F4F7FC'; x.font = '800 44px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr';
    x.fillText('👋 ' + t(visitorName(peer.num, peer.nick)), w/2, 51, w - 30); tx.needsUpdate = true; };
  paint(); peer.paint = paint; langHooks.push(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 7; s.scale.set(w/h*0.55, 0.55, 1); return s;
}

function addPeer(id, p){
  const peer = { id, num: p.n, nick: p.k || '', color: p.c || VISITOR_COLORS[0], world: p.w, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), yaw: 0,
    tPos: new THREE.Vector3(), tQuat: new THREE.Quaternion(), last: performance.now(), walkT: 0, riding: false };
  const g = new THREE.Group();
  const body = person(peer.num, { shirt: peer.color, logo: logoTex(PLANET_C) }); body.scale.setScalar(1.15); g.add(body); peer.body = body;
  const tag = peerTag(peer); tag.position.y = 2.55; g.add(tag); peer.tag = tag;
  const ringM = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24), new THREE.MeshBasicMaterial({ color: peer.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ringM.rotation.x = -Math.PI/2; ringM.position.y = 0.06; g.add(ringM);
  g.visible = false; scene.add(g); peer.g = g;
  peers.set(id, peer); updatePeerCount();
  if (state !== 'loading') mini(lang === 'ar' ? `👋 ${t(visitorName(peer.num, peer.nick))} وصل للكوكب` : `👋 ${t(visitorName(peer.num, peer.nick))} landed on the planet`);
  return peer;
}
function removePeer(id){
  const peer = peers.get(id); if (!peer) return;
  scene.remove(peer.g); const i = langHooks.indexOf(peer.paint); if (i >= 0) langHooks.splice(i, 1);
  if (peer.car){ peer.car.traverse(o => o.geometry && o.geometry.dispose()); }
  peers.delete(id); updatePeerCount();
}

function onPeerState(p){
  if (!p || p.i === netId) return;
  let peer = peers.get(p.i) || addPeer(p.i, p);
  peer.last = performance.now(); peer.world = p.w;
  if (p.k !== undefined && p.k !== peer.nick){ peer.nick = p.k; peer.paint(); }
  if (p.w === 'p' && p.p){ peer.tPos.fromArray(p.p); peer.tQuat.fromArray(p.q); }
  if (p.w === 'o' && p.o){ peer.tPos.copy(OFF).add(P3(p.o[0], p.o[1])); peer.tQuat.setFromEuler(new THREE.Euler(0, p.o[2], 0)); }
  if (!peer.g.visible && p.w !== 's'){ peer.pos.copy(peer.tPos); peer.quat.copy(peer.tQuat); }
  const riding = !!p.r;
  if (riding !== peer.riding){ peer.riding = riding;
    if (riding){ peer.car = makeCar(peer.color, 0xF4F7FC); peer.g.add(peer.car); peer.body.visible = false; peer.tag.position.y = 2.9; }
    else { if (peer.car) peer.g.remove(peer.car); peer.car = null; peer.body.visible = true; peer.tag.position.y = 2.55; } }
}

function myState(){
  if (state === 'loading' || state === 'title') return null;
  const base = { i: netId, n: netNum, c: netColor, k: myNick() };
  if (typeof inSpace !== 'undefined' && inSpace) return { ...base, w: 's' };
  if (typeof inOffice !== 'undefined' && inOffice) return { ...base, w: 'o', o: [+oPos.x.toFixed(2), +oPos.y.toFixed(2), +oYaw.toFixed(2)] };
  return { ...base, w: 'p', r: riding ? 1 : 0, p: player.position.toArray().map(v => +v.toFixed(2)), q: player.quaternion.toArray().map(v => +v.toFixed(3)) };
}

function netTick(now){
  if (!netLive) return;
  const s = myState(); if (!s) return;
  const key = JSON.stringify([s.w, s.p, s.q, s.o, s.r, s.k]);
  const due = key !== netLastKey ? NET.sendMs : NET.idleMs;
  if (now - netLastSend < due) return;
  netLastSend = now; netLastKey = key;
  netChan.send({ type: 'broadcast', event: 's', payload: s });
}

let netPrev = performance.now();
function netFrame(now){
  requestAnimationFrame(netFrame);
  const dt = Math.min(0.1, (now - netPrev) / 1000); netPrev = now;
  netTick(now);
  const meWorld = (typeof inSpace !== 'undefined' && inSpace) ? 's' : (typeof inOffice !== 'undefined' && inOffice) ? 'o' : 'p';
  for (const peer of [...peers.values()]){
    if (now - peer.last > NET.dropMs){ removePeer(peer.id); continue; }
    // only show visitors who are in the same place as me
    peer.g.visible = peer.world !== 's' && peer.world === meWorld;
    if (!peer.g.visible) continue;
    const before = peer.pos.clone();
    const k = 1 - Math.exp(-10 * dt); peer.pos.lerp(peer.tPos, k); peer.quat.slerp(peer.tQuat, k);
    peer.g.position.copy(peer.pos); peer.g.quaternion.copy(peer.quat);
    const moved = before.distanceTo(peer.pos);
    if (moved > 0.002) peer.walkT += moved * 3.2; else peer.walkT *= 0.85;
    if (peer.body.visible) animatePerson(peer.body, moved > 0.002 ? peer.walkT : 0, false, now / 1000);
    if (peer.car && moved > 0.002) peer.car.traverse(o => { if (o.userData.wheel) o.rotation.x += moved * 3; });
  }
}

function updatePeerCount(){
  let el = document.getElementById('netcount');
  if (!el){ el = document.createElement('div'); el.id = 'netcount'; el.className = 'panel'; document.body.appendChild(el);
    el.onclick = () => { const list = [...peers.values()].map(p => t(visitorName(p.num, p.nick)) + (p.world === 'o' ? (lang === 'ar' ? ' (في المكتب)' : ' (in the office)') : p.world === 's' ? (lang === 'ar' ? ' (في الفضاء)' : ' (in space)') : ''));
      mini(list.length ? list.join(' · ') : (lang === 'ar' ? 'إنت لوحدك دلوقتي' : "You're the only one here right now")); }; }
  const n = peers.size;
  el.hidden = !netLive;
  el.innerHTML = n ? `👥 <b>${n + 1}</b> ${lang === 'ar' ? 'على الكوكب دلوقتي' : 'on the planet now'}` : `🟢 ${lang === 'ar' ? 'أونلاين' : 'Online'}`;
}
langHooks.push(updatePeerCount);

function netStart(){
  if (!window.supabase || !window.supabase.createClient) return setTimeout(netStart, 800);
  try {
    const sb = window.supabase.createClient(NET.url, NET.key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
    netChan = sb.channel(NET.room, { config: { broadcast: { self: false, ack: false }, presence: { key: netId } } });
    netChan.on('broadcast', { event: 's' }, ({ payload }) => onPeerState(payload));
    netChan.on('broadcast', { event: 'bye' }, ({ payload }) => payload && removePeer(payload.i));
    netChan.on('presence', { event: 'leave' }, ({ key }) => removePeer(key));
    netChan.subscribe(status => {
      netLive = status === 'SUBSCRIBED'; updatePeerCount();
      if (netLive){ netChan.track({ n: netNum }); netLastKey = ''; netLastSend = 0; }
    });
    addEventListener('pagehide', () => { try { netChan.send({ type: 'broadcast', event: 'bye', payload: { i: netId } }); } catch (e) {} });
  } catch (e) { /* multiplayer is a bonus: the game runs fine without it */ }
}
requestAnimationFrame(netFrame);
netStart();

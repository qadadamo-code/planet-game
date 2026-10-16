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
/* the visitor's own name and colour (chosen once, kept on this device) */
const PROFILE_COLORS = [0xE76F51, 0x3E8E7E, 0x8E6BC2, 0xF2C94C, 0xE9A0B8, 0x5FA0E6, 0xD94C93, 0x2EA87A, 0x12153A, 0xF4F7FC];
const profile = (() => { try { return JSON.parse(localStorage.getItem('pm-profile') || '{}') || {}; } catch (e) { return {}; } })();
let netColor = PROFILE_COLORS.includes(profile.color) ? profile.color : VISITOR_COLORS[parseInt(netId.slice(6, 10), 36) % VISITOR_COLORS.length];
const peers = new Map();
let netChan = null, netLive = false, netLastSend = 0, netLastKey = '';

function visitorName(num, nick){ return nick ? L(nick, nick) : L(`Visitor ${num}`, `زائر ${num}`); }
function myNick(){ return profile.nick ? String(profile.nick).slice(0, 20) : (typeof brief !== 'undefined' && brief.name) ? String(brief.name).slice(0, 24) : ''; }
function saveProfile(nick, color){
  profile.nick = cleanText(nick).slice(0, 20); if (PROFILE_COLORS.includes(color)) profile.color = color;
  try { localStorage.setItem('pm-profile', JSON.stringify(profile)); } catch (e) {}
  if (profile.color) netColor = profile.color; paintMyRing(); netLastKey = ''; netLastSend = 0;
}
/* my colour as a ring under my feet — the way everyone else sees me marked */
let myRing = null;
function paintMyRing(){
  if (!myRing){ myRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24), new THREE.MeshBasicMaterial({ color: netColor, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    myRing.rotation.x = -Math.PI/2; myRing.position.y = 0.06; player.add(myRing); }
  myRing.material.color.setHex(netColor);
}
paintMyRing();

function peerTag(peer){
  const w = 420, h = 96, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = () => { x.clearRect(0, 0, w, h);
    const col = '#' + new THREE.Color(peer.color).getHexString();
    x.fillStyle = '#12153A'; x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, 44) : x.rect(4, 4, w - 8, h - 8); x.fill(); x.stroke();
    x.fillStyle = '#F4F7FC'; x.font = '800 44px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr';
    x.fillText('👋 ' + t(visitorName(peer.num, peer.nick)), w/2, 51, w - 30); tx.needsUpdate = true; };
  paint(); peer.paint = paint; langHooks.push(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 7; s.scale.set(w/h*0.42, 0.42, 1); return fitSprite(s, 16, 30);
}

function addPeer(id, p){
  const peer = { id, num: p.n, nick: p.k || '', color: p.c || VISITOR_COLORS[0], world: p.w, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), yaw: 0,
    tPos: new THREE.Vector3(), tQuat: new THREE.Quaternion(), last: performance.now(), walkT: 0, riding: false };
  const g = new THREE.Group();
  const body = person(peer.num, { shirt: peer.color, logo: logoTex(PLANET_C) }); body.scale.setScalar(1.15); g.add(body); peer.body = body;
  const tag = peerTag(peer); tag.position.y = 2.55; g.add(tag); peer.tag = tag;
  const ringM = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24), new THREE.MeshBasicMaterial({ color: peer.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ringM.rotation.x = -Math.PI/2; ringM.position.y = 0.06; g.add(ringM); peer.ring = ringM;
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
  peer.last = performance.now(); peer.world = p.w; peer.ps = p.ps || null; peer.sw = p.sw || '';
  if (p.k !== undefined && p.k !== peer.nick){ peer.nick = p.k; peer.paint(); }
  if (p.c !== undefined && p.c !== peer.color){ peer.color = p.c; peer.paint(); peer.ring.material.color.setHex(p.c);
    const vis = peer.body.visible, nb = person(peer.num, { shirt: peer.color, logo: logoTex(PLANET_C) }); nb.scale.setScalar(1.15); nb.visible = vis; peer.g.remove(peer.body); peer.g.add(nb); peer.body = nb; }
  if (p.w === 'p' && p.p){ peer.tPos.fromArray(p.p); peer.tQuat.fromArray(p.q); }
  if (p.w === 'o' && p.o){ peer.tPos.copy(OFF).add(P3(p.o[0], p.o[1])); peer.tQuat.setFromEuler(new THREE.Euler(0, p.o[2], 0)); }
  peer.bld = p.w === 'b' ? p.b : null;
  if (p.w === 'b' && p.o && typeof INT_OFF !== 'undefined'){ peer.tPos.copy(INT_OFF).add(new THREE.Vector3(p.o[0], 0, p.o[1])); peer.tQuat.setFromEuler(new THREE.Euler(0, p.o[2], 0)); }
  if (!peer.g.visible && p.w !== 's'){ peer.pos.copy(peer.tPos); peer.quat.copy(peer.tQuat); }
  const riding = !!p.r;
  if (riding !== peer.riding){ peer.riding = riding;
    if (riding){ peer.car = p.r === 2 ? makeShip() : makeCar(peer.color, 0xF4F7FC); peer.g.add(peer.car); peer.body.visible = false; peer.tag.position.y = 2.9; }
    else { if (peer.car) peer.g.remove(peer.car); peer.car = null; peer.body.visible = true; peer.tag.position.y = 2.55; } }
  if (peer.car && peer.car.userData.car) setCarStyle(peer.car, !!p.f);
}

function myState(){
  if (state === 'loading' || state === 'title') return null;
  const base = { i: netId, n: netNum, c: netColor, k: myNick() };
  if (typeof inSpace !== 'undefined' && inSpace) return { ...base, w: 's', sw: (typeof cur !== 'undefined' && cur) ? cur.id : '' };
  if (typeof inOffice !== 'undefined' && inOffice) return { ...base, w: 'o', o: [+oPos.x.toFixed(2), +oPos.y.toFixed(2), +oYaw.toFixed(2)] };
  return { ...base, w: 'p', r: riding ? (car && car.userData.ship ? 2 : 1) : 0, f: riding && car && car.userData.car && car.userData.car.future ? 1 : 0, ps: passengerOf || undefined, p: player.position.toArray().map(v => +v.toFixed(2)), q: player.quaternion.toArray().map(v => +v.toFixed(3)) };
}

function netTick(now){
  if (!netLive) return;
  const s = myState(); if (!s) return;
  const key = JSON.stringify([s.w, s.p, s.q, s.o, s.r, s.k, s.ps, s.sw, s.f, s.c, s.a, s.b]);
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
  const meWorld = (typeof inSpace !== 'undefined' && inSpace) ? 's' : (typeof inOffice !== 'undefined' && inOffice) ? 'o' : (typeof inBuilding !== 'undefined' && inBuilding) ? 'b' : 'p';
  for (const peer of [...peers.values()]){
    if (now - peer.last > NET.dropMs){ removePeer(peer.id); continue; }
    // in space: a little rocket orbiting the same world as me
    if (peer.world === 's' && meWorld === 's'){ peer.g.visible = false; placeSpaceRocket(peer, now); continue; }
    if (peer.space) peer.space.visible = false;
    // only show visitors who are in the same place as me
    peer.g.visible = peer.world !== 's' && peer.world === meWorld && (meWorld !== 'b' || peer.bld === inBuilding.id);
    if (!peer.g.visible) continue;
    const before = peer.pos.clone();
    // a passenger rides in the driver's car: sit them beside the driver
    const drv = peer.ps === netId ? { pos: player.position, quat: player.quaternion } : peer.ps && peers.get(peer.ps);
    if (drv){ peer.pos.copy(drv.pos); peer.quat.copy(drv.quat); peer.body.position.set(0.38, 0.2, -0.15); peer.body.scale.setScalar(0.95); }
    else { const k = 1 - Math.exp(-10 * dt); peer.pos.lerp(peer.tPos, k); peer.quat.slerp(peer.tQuat, k); peer.body.position.set(0, 0, 0); peer.body.scale.setScalar(1.15); }
    peer.g.position.copy(peer.pos); peer.g.quaternion.copy(peer.quat);
    peer.tag.visible = peer.id !== passengerOf && camera.position.distanceTo(peer.pos) > 5;   // a name tag right in front of the lens fills the screen
    const moved = before.distanceTo(peer.pos);
    if (moved > 0.002) peer.walkT += moved * 3.2; else peer.walkT *= 0.85;
    if (peer.body.visible) animatePerson(peer.body, moved > 0.002 ? peer.walkT : 0, false, now / 1000);
    if (peer.car && moved > 0.002) peer.car.traverse(o => { if (o.userData.wheel) o.rotation.x += moved * 3; });
    if (peer.bubble) peer.bubble.visible = performance.now() < peer.bubbleUntil;
  }
  if (myBubble){ myBubble.visible = performance.now() < myBubbleUntil && !(typeof inSpace !== 'undefined' && inSpace);
    if (myBubble.visible) myBubble.position.copy(player.position).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(player.quaternion), riding ? 3.6 : 3.1); }
  sharedRideFrame(meWorld);
}

function updatePeerCount(){
  let el = document.getElementById('netcount');
  if (!el){ el = document.createElement('button'); el.type = 'button'; el.id = 'netcount'; el.className = 'chip panel'; (document.querySelector('#hud .bar') || document.body).appendChild(el);
    el.onclick = () => { if (typeof openPeople === 'function') return openPeople(); const list = [...peers.values()].map(p => t(visitorName(p.num, p.nick)) + (p.world === 'o' ? (lang === 'ar' ? ' (في المكتب)' : ' (in the office)') : p.world === 's' ? (lang === 'ar' ? ' (في الفضاء)' : ' (in space)') : ''));
      mini(list.length ? list.join(' · ') : (lang === 'ar' ? 'إنت لوحدك دلوقتي' : "You're the only one here right now")); }; }
  const n = peers.size;
  el.hidden = !netLive;
  el.innerHTML = n ? `👥 <span class="num">${n + 1}</span>` : `🟢`;
  el.title = n ? (lang === 'ar' ? `${n + 1} على الكوكب دلوقتي` : `${n + 1} on the planet now`) : (lang === 'ar' ? 'أونلاين' : 'Online');
}
langHooks.push(updatePeerCount);

function netStart(){
  if (!window.supabase || !window.supabase.createClient) return setTimeout(netStart, 800);
  try {
    const sb = window.supabase.createClient(NET.url, NET.key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
    netChan = sb.channel(NET.room, { config: { broadcast: { self: false, ack: false }, presence: { key: netId } } });
    netChan.on('broadcast', { event: 's' }, ({ payload }) => onPeerState(payload));
    netChan.on('broadcast', { event: 'chat' }, ({ payload }) => onChat(payload));
    netChan.on('broadcast', { event: 'trip' }, ({ payload }) => onTrip(payload));
    netChan.on('broadcast', { event: 'bye' }, ({ payload }) => payload && removePeer(payload.i));
    netChan.on('presence', { event: 'leave' }, ({ key }) => removePeer(key));
    netChan.subscribe(status => {
      netLive = status === 'SUBSCRIBED'; updatePeerCount(); buildChatUi();
      if (netLive){ netChan.track({ n: netNum }); netLastKey = ''; netLastSend = 0; }
    });
    addEventListener('pagehide', () => { try { netChan.send({ type: 'broadcast', event: 'bye', payload: { i: netId } }); } catch (e) {} });
  } catch (e) { /* multiplayer is a bonus: the game runs fine without it */ }
}
requestAnimationFrame(netFrame);
netStart();


/* ---------- riding together: hop into another visitor's car ---------- */
let passengerOf = null;
function sharedRideFrame(meWorld){
  const btn = netBtn('netride');
  if (passengerOf){
    const d = peers.get(passengerOf);
    if (!d || !d.riding || d.world !== 'p' || meWorld !== 'p'){ leaveRide(); return; }
    // follow the driver: the game moves the player from pDir/pFwd every frame
    pDir.copy(d.pos).normalize(); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(d.quat); pFwd.copy(f).addScaledVector(pDir, -f.dot(pDir)).normalize();
    rig.visible = false;
    btn.hidden = state !== 'play'; btn.textContent = lang === 'ar' ? '🚗 انزل من العربية' : '🚗 Get out'; btn.onclick = leaveRide;
    return;
  }
  // offer a seat when I'm standing next to someone who is driving
  let near = null;
  if (meWorld === 'p' && !riding && state === 'play') for (const p of peers.values()) if (p.riding && p.world === 'p' && !p.ps && p.pos.distanceTo(player.position) < 4.2){ near = p; break; }
  btn.hidden = !near;
  if (near){ btn.textContent = (lang === 'ar' ? '🚗 اركب مع ' : '🚗 Ride with ') + t(visitorName(near.num, near.nick)); btn.onclick = () => joinRide(near.id); }
}
function joinRide(id){ const d = peers.get(id); if (!d) return; passengerOf = id; document.body.classList.add('passenger'); Sfx.open(); netLastKey = '';
  mini(lang === 'ar' ? `🚗 راكب مع ${t(visitorName(d.num, d.nick))}` : `🚗 Riding with ${t(visitorName(d.num, d.nick))}`);
  netChan && netChan.send({ type: 'broadcast', event: 'chat', payload: { i: netId, n: netNum, c: netColor, k: myNick(), sys: 'ride', to: id } }); }
function leaveRide(){ if (!passengerOf) return; passengerOf = null; document.body.classList.remove('passenger'); rig.visible = true; netLastKey = '';
  const side = new THREE.Vector3().crossVectors(pDir, pFwd).normalize(); pDir.addScaledVector(side, 2.2 / R).normalize(); Sfx.close(); netBtn('netride').hidden = true; }

/* ---------- flying together: anyone who launches the rocket invites everyone on the planet ---------- */
if (typeof startLaunch === 'function'){
  const launchAlone = startLaunch; let lastTripSent = 0;
  startLaunch = function(){ launchAlone();
    if (netLive && performance.now() - lastTripSent > 8000){ lastTripSent = performance.now(); netChan.send({ type: 'broadcast', event: 'trip', payload: { i: netId, n: netNum, k: myNick() } }); } };
}
let tripTimer = 0;
function onTrip(p){
  if (!p || p.i === netId || (typeof inSpace !== 'undefined' && inSpace) || (typeof inOffice !== 'undefined' && inOffice)) return;
  const btn = netBtn('nettrip'); const who = t(visitorName(p.n, p.k));
  btn.textContent = lang === 'ar' ? `🚀 ${who} طالع الفضاء — تعالى معاه` : `🚀 ${who} is flying to space — join`;
  btn.hidden = false; clearTimeout(tripTimer); tripTimer = setTimeout(() => btn.hidden = true, 12000);
  btn.onclick = () => { btn.hidden = true; if (passengerOf) leaveRide(); if (state === 'play') startLaunch(); };
  Sfx.blip();
}
function placeSpaceRocket(peer, now){
  if (typeof worlds === 'undefined' || typeof cur === 'undefined' || !cur) return;
  const w = worlds.find(x => x.id === peer.sw);
  if (!w || w !== cur){ if (peer.space) peer.space.visible = false; return; }
  if (!peer.space){ const g = new THREE.Group(); const r = makeRocket(); r.scale.setScalar(0.55); r.traverse(o => { if (o.userData.pad) o.visible = false; }); g.add(r);
    const tag = peerTag(peer); tag.position.y = 5; g.add(tag); scene.add(g); peer.space = g; }
  const c = w.obj.getWorldPosition(new THREE.Vector3()), a = now / 4000 + (peer.num % 7);
  peer.space.position.set(c.x + Math.cos(a) * w.r * 2.6, c.y + w.r * 0.9, c.z + Math.sin(a) * w.r * 2.6);
  peer.space.rotation.set(0, -a, 0.5); peer.space.visible = true;
}

/* ---------- talking: a chat box, quick reactions, and speech bubbles over heads ---------- */
const QUICK = ['👋', '😂', '❤️', '👍', '🔥', '🚀', '🎉', '😮'];
const chatLog = []; let chatOpen = false, chatUnread = 0, lastChatSent = 0, myBubble = null, myBubbleUntil = 0;
function bubbleSprite(){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 8; s.scale.set(2.2, 0.82, 1); fitSprite(s, 34, 64);
  s.userData.draw = text => { x.clearRect(0, 0, 512, 192);
    x.fillStyle = '#F4F7FC'; x.strokeStyle = '#12153A'; x.lineWidth = 7; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 500, 150, 34) : x.rect(6, 6, 500, 150); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(236, 154); x.lineTo(256, 186); x.lineTo(276, 154); x.fill(); x.stroke(); x.fillRect(238, 146, 36, 10);
    x.fillStyle = '#12153A'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = /[؀-ۿ]/.test(text) ? 'rtl' : 'ltr';
    const big = [...text].length <= 3; x.font = big ? '72px serif' : '700 38px IBM Plex Sans Arabic, sans-serif';
    const lines = big ? [text] : wrapText(x, text, 460).slice(0, 2);
    lines.forEach((l, i) => x.fillText(l, 256, lines.length === 1 ? 82 : 58 + i * 48, 470)); tx.needsUpdate = true; };
  return s;
}
function wrapText(x, text, w){ const out = []; let line = ''; for (const word of text.split(/\s+/)){ const tr = line ? line + ' ' + word : word; if (x.measureText(tr).width > w && line){ out.push(line); line = word; } else line = tr; } if (line) out.push(line); if (out.length > 2) out[1] = out[1].slice(0, -1) + '…'; return out; }
function sayOver(target, text, isMe){
  if (isMe){ if (!myBubble){ myBubble = bubbleSprite(); scene.add(myBubble); } myBubble.userData.draw(text); myBubbleUntil = performance.now() + 6500; return; }
  if (!target.bubble){ target.bubble = bubbleSprite(); target.bubble.position.y = 3.35; target.g.add(target.bubble); }
  target.bubble.userData.draw(text); target.bubbleUntil = performance.now() + 6500;
}
function cleanText(s){ return String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140); }
function sendChat(text){
  text = cleanText(text); if (!text || !netLive) return false;
  if (performance.now() - lastChatSent < 1200){ mini(lang === 'ar' ? '⏳ استنى ثانية' : '⏳ One sec'); return false; }
  lastChatSent = performance.now();
  netChan.send({ type: 'broadcast', event: 'chat', payload: { i: netId, n: netNum, c: netColor, k: myNick(), m: text } });
  addLog(null, text); sayOver(null, text, true); return true;
}
function onChat(p){
  if (!p || p.i === netId) return;
  let peer = peers.get(p.i);
  if (p.sys === 'ride'){ if (p.to === netId) mini(lang === 'ar' ? `🚗 ${t(visitorName(p.n, p.k))} ركب معاك` : `🚗 ${t(visitorName(p.n, p.k))} hopped in`); return; }
  const text = cleanText(p.m); if (!text) return;
  if (peer) sayOver(peer, text);
  addLog(p, text); Sfx.blip();
  if (!chatOpen){ chatUnread++; paintChatBtn(); }
}
function addLog(p, text){
  chatLog.push({ me: !p, who: p ? t(visitorName(p.n, p.k)) : (lang === 'ar' ? 'إنت' : 'You'), color: p ? p.c : netColor, text });
  if (chatLog.length > 40) chatLog.shift(); renderLog();
}
function renderLog(){
  const box = document.getElementById('chatlog'); if (!box) return; box.textContent = '';
  for (const l of chatLog){ const row = document.createElement('div'); row.className = 'cl' + (l.me ? ' me' : '');
    const b = document.createElement('b'); b.textContent = l.who; b.style.color = '#' + new THREE.Color(l.color).getHexString(); const sp = document.createElement('span'); sp.textContent = l.text;
    row.append(b, sp); box.appendChild(row); }
  if (!chatLog.length){ const e = document.createElement('div'); e.className = 'cl empty'; e.textContent = lang === 'ar' ? 'قول أهلاً للي على الكوكب 👋' : 'Say hi to everyone on the planet 👋'; box.appendChild(e); }
  box.scrollTop = box.scrollHeight;
}
function paintChatBtn(){ const b = document.getElementById('chatbtn'); if (!b) return; b.innerHTML = '💬' + (chatUnread ? `<i>${chatUnread > 9 ? '9+' : chatUnread}</i>` : ''); }
function buildChatUi(){
  if (document.getElementById('chatbtn')){ document.getElementById('chatbtn').hidden = !netLive; return; }
  const btn = document.createElement('button'); btn.id = 'chatbtn'; btn.type = 'button'; btn.className = 'round panel'; btn.setAttribute('aria-label', 'Chat'); document.body.appendChild(btn); paintChatBtn();
  const box = document.createElement('div'); box.id = 'chatbox'; box.className = 'panel'; box.hidden = true;
  box.innerHTML = `<div class="ch-head"><b data-c="title"></b><button type="button" class="ch-x" aria-label="Close">✕</button></div><div id="chatlog"></div>
    <div class="ch-quick">${QUICK.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>
    <form class="ch-form"><input id="chatin" maxlength="140" autocomplete="off" enterkeyhint="send"><button type="submit" class="ch-send">➤</button></form>`;
  document.body.appendChild(box);
  const paint = () => { box.querySelector('[data-c="title"]').textContent = lang === 'ar' ? '💬 دردشة الكوكب' : '💬 Planet chat'; document.getElementById('chatin').placeholder = lang === 'ar' ? 'اكتب رسالة…' : 'Type a message…'; renderLog(); };
  paint(); langHooks.push(paint);
  const open = v => { chatOpen = v; box.hidden = !v; if (v){ chatUnread = 0; paintChatBtn(); renderLog(); setTimeout(() => document.getElementById('chatin').focus(), 50); } else document.getElementById('chatin').blur(); };
  btn.onclick = () => { Sfx.click(); open(!chatOpen); };
  box.querySelector('.ch-x').onclick = () => open(false);
  box.querySelectorAll('[data-q]').forEach(q => q.onclick = () => sendChat(q.dataset.q));
  box.querySelector('form').onsubmit = e => { e.preventDefault(); const inp = document.getElementById('chatin'); if (sendChat(inp.value)) inp.value = ''; };
  box.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); e.stopPropagation(); });
  btn.hidden = !netLive;
}
/* small floating action buttons (ride along / join the trip) */
function netBtn(id){ let b = document.getElementById(id); if (!b){ b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'panel netact'; b.hidden = true; document.body.appendChild(b); } return b; }

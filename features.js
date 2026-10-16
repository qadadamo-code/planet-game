/* More to do on the planet: a custom avatar (hair, hat, glasses), message walls that stay for the next visitors,
   a live screen of our latest work, a weekly mission with a badge, a saved leaderboard, a voice guide,
   a night market in the food district, and a planet of its own for Fly 29. */

const SB_REST = NET.url + '/rest/v1/';
const sbHead = () => ({ apikey: NET.key, Authorization: 'Bearer ' + NET.key, 'Content-Type': 'application/json' });
async function sbGet(path){ try { const r = await fetch(SB_REST + path, { headers: sbHead() }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
async function sbPost(table, row){ try { const r = await fetch(SB_REST + table, { method: 'POST', headers: { ...sbHead(), Prefer: 'return=minimal' }, body: JSON.stringify(row) }); return r.ok; } catch (e) { return false; } }
const myName = () => myNick() || t(visitorName(netNum, ''));
const vid = netId.slice(0, 12);
/* keep the shared walls friendly: no links, no phone numbers, a short list of words */
const BAD = ['http', 'www.', '.com', 'fuck', 'shit', 'sex', 'porn', 'كس', 'زب', 'شرموط', 'متناك', 'خول', 'عرص', 'منيك', 'نيك', 'قحب'];
function cleanMsg(s){ s = cleanText(s).slice(0, 80); if (!s) return ''; const low = s.toLowerCase(); if (BAD.some(w => low.includes(w)) || /\d{7,}/.test(s.replace(/\s/g, ''))) return null; return s; }

/* ================= 1. avatar: hair, hat and glasses ================= */
const AV = { hair: profile.av ? profile.av.l ?? -1 : -1, hat: profile.av ? profile.av.h || 0 : 0, glass: profile.av ? profile.av.g || 0 : 0 };
const HATS = [L('None', 'من غير'), L('Planet cap', 'كاب Planet'), L('Beanie', 'طاقية صوف'), L('Crown', 'تاج'), L('Headphones', 'سماعات'), L('Sun hat', 'برنيطة')];
const GLASSES = [L('None', 'من غير'), L('Round', 'نظارة مدورة'), L('Shades', 'نظارة شمس'), L('Star', 'نظارة نجوم')];
const HAIRS = [L('Short', 'قصير'), L('Cap', 'كاب'), L('Hijab', 'حجاب'), L('Long', 'طويل'), L('Short + glasses', 'قصير + نظارة'), L('Bun', 'كعكة')];
const avCode = () => `${AV.hair}.${AV.hat}.${AV.glass}`;
const avParse = s => { const [l, h, g] = String(s || '').split('.').map(Number); return { hair: Number.isFinite(l) ? l : -1, hat: h || 0, glass: g || 0 }; };
/* accessories around a head of radius r centred at the group's origin, facing +z */
function accessories(av, r){
  const g = new THREE.Group(); const M = (geo, c, ink = 1) => mesh(geo, c, ink);
  if (av.hat === 1){ const cap = M(new THREE.SphereGeometry(r * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xF2C94C); cap.position.y = r * 0.15; g.add(cap);
    const brim = M(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 0.08, 16, 1, false, -Math.PI / 2, Math.PI), 0x12153A, 0); brim.position.set(0, r * 0.2, r * 0.55); g.add(brim);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 14), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); dot.position.set(0, r * 0.62, r * 0.82); dot.rotation.x = -0.6; g.add(dot); }
  if (av.hat === 2){ const b = M(new THREE.SphereGeometry(r * 1.06, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xE76F51); b.position.y = r * 0.12; g.add(b);
    const rim = M(new THREE.CylinderGeometry(r * 1.08, r * 1.08, r * 0.25, 16), 0xF4F7FC, 0); rim.position.y = r * 0.18; g.add(rim);
    const pom = M(new THREE.SphereGeometry(r * 0.25, 10, 8), 0xF4F7FC, 0); pom.position.y = r * 1.22; g.add(pom); }
  if (av.hat === 3){ const c = M(new THREE.CylinderGeometry(r * 0.85, r * 0.8, r * 0.4, 8, 1, true), 0xF2C94C); c.material.side = THREE.DoubleSide; c.position.y = r * 1.0; g.add(c);
    for (let k = 0; k < 8; k++){ const sp = M(new THREE.ConeGeometry(r * 0.13, r * 0.35, 4), 0xF2C94C, 0); const a = k / 8 * Math.PI * 2; sp.position.set(Math.cos(a) * r * 0.82, r * 1.32, Math.sin(a) * r * 0.82); g.add(sp); }
    const gem = M(new THREE.OctahedronGeometry(r * 0.12), 0xE05A5A, 0); gem.position.set(0, r * 1.0, r * 0.86); g.add(gem); }
  if (av.hat === 4){ const band = M(new THREE.TorusGeometry(r * 1.02, r * 0.09, 6, 20, Math.PI), 0x12153A); band.rotation.z = 0; band.position.y = r * 0.1; g.add(band);
    [-1, 1].forEach(s => { const cup = M(new THREE.CylinderGeometry(r * 0.32, r * 0.32, r * 0.22, 14), 0xE76F51); cup.rotation.z = Math.PI / 2; cup.position.set(s * r * 1.02, r * 0.05, 0); g.add(cup); }); }
  if (av.hat === 5){ const top = M(new THREE.CylinderGeometry(r * 0.75, r * 0.85, r * 0.55, 16), 0xE9C98A); top.position.y = r * 0.95; g.add(top);
    const brim = M(new THREE.CylinderGeometry(r * 1.75, r * 1.75, r * 0.06, 20), 0xE9C98A); brim.position.y = r * 0.68; g.add(brim);
    const rib = M(new THREE.CylinderGeometry(r * 0.86, r * 0.86, r * 0.14, 16), 0xE76F51, 0); rib.position.y = r * 0.78; g.add(rib); }
  if (av.glass){ const gg = new THREE.Group(); gg.position.set(0, r * 0.08, r * 0.92);
    const col = av.glass === 2 ? 0x12153A : av.glass === 3 ? 0xF2C94C : 0x12153A;
    [-1, 1].forEach(s => { const fr = av.glass === 3 ? M(new THREE.CircleGeometry(r * 0.3, 5), col, 0) : M(new THREE.TorusGeometry(r * 0.24, r * 0.05, 6, 16), col, 0); fr.position.x = s * r * 0.34; gg.add(fr);
      if (av.glass === 2){ const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 16), new THREE.MeshBasicMaterial({ color: 0x12153A, transparent: true, opacity: 0.85 })); lens.position.set(s * r * 0.34, 0, 0.005); gg.add(lens); }
      if (av.glass === 3) fr.rotation.z = Math.PI / 2; });
    const br = M(new THREE.BoxGeometry(r * 0.22, r * 0.05, r * 0.05), col, 0); gg.add(br); g.add(gg); }
  return g;
}
/* on me: hang the accessories on the character's head bone so they move with it */
let myAcc = null, headBone = null, headInfo = null;
function findHead(){
  if (headInfo) return headInfo;
  let hb = null; rig.traverse(o => { if (!hb && o.isBone && /head$/i.test(o.name)) hb = o; });
  if (!hb) rig.traverse(o => { if (!hb && o.isBone && /head/i.test(o.name) && !/top|end/i.test(o.name)) hb = o; });
  if (!hb && proc.head){ headBone = proc.head; headInfo = { r: 0.42, lift: 0.36 }; return headInfo; }
  headBone = hb; headInfo = { r: hb ? 0.29 : 0.34, lift: hb ? 0.25 : 0 }; return headInfo;
}
function paintMyAvatar(){
  if (state === 'loading') return;
  const hi = findHead();
  if (myAcc){ rig.remove(myAcc); myAcc = null; }
  if (!AV.hat && !AV.glass) return;
  myAcc = accessories(AV, hi.r); rig.add(myAcc); placeMyAcc();
}
const _hb = new THREE.Vector3();
function placeMyAcc(){
  if (!myAcc) return;
  if (headBone){ headBone.getWorldPosition(_hb); rig.worldToLocal(_hb); myAcc.position.copy(_hb).add(new THREE.Vector3(0, headInfo.lift, 0.02)); }
  else myAcc.position.set(0, 1.45, 0);
}
/* on other visitors: rebuild their body with their hair and accessories */
function dressPeer(peer, code){
  peer.av = code; const av = avParse(code), vis = peer.body.visible;
  const nb = person(peer.num, { shirt: peer.color, logo: logoTex(PLANET_C), look: av.hair >= 0 ? av.hair : undefined });
  if (av.hat || av.glass){ const a = accessories(av, 0.26); a.position.set(0, 1.38, 0); nb.userData.body.add(a); }
  nb.scale.setScalar(1.15); nb.visible = vis; peer.g.remove(peer.body); peer.g.add(nb); peer.body = nb;
}
{ const plainState = onPeerState; onPeerState = function(p){ plainState(p); if (!p || p.i === netId) return; const peer = peers.get(p.i); if (!peer) return;
    if ((p.a || '') !== (peer.av || '') || (p.c !== undefined && peer.avC !== p.c && peer.av)){ peer.avC = p.c; dressPeer(peer, p.a || ''); } }; }
{ const plainMy = myState; myState = function(){ const s = plainMy(); if (s) s.a = avCode(); return s; }; }
function saveAvatar(){ profile.av = { l: AV.hair, h: AV.hat, g: AV.glass }; try { localStorage.setItem('pm-profile', JSON.stringify(profile)); } catch (e) {} netLastKey = ''; netLastSend = 0; paintMyAvatar(); }

/* the profile panel, now with the look too */
openProfile = function(after){
  let pick = netColor; const draft = { ...AV };
  const chips = (key, list) => list.map((n, k) => `<button type="button" class="avc" data-k="${key}" data-v="${key === 'hair' ? k : k}">${t(n)}</button>`).join('');
  const badges = myBadges();
  const box = xModal('profilebox', `<h3>${AR() ? '👤 اسمك وشكلك' : '👤 Your name and look'}</h3>
    <p class="xm-sub">${AR() ? 'الزوار التانيين هيشوفوك بالاسم والشكل ده' : 'Other visitors will see you with this name and look'}</p>
    <input id="pfname" maxlength="20" autocomplete="nickname" placeholder="${AR() ? 'اسمك…' : 'Your name…'}">
    <div class="pfcols">${PROFILE_COLORS.map(c => `<button type="button" data-c="${c}" style="background:${hexCss(c)}" aria-label="colour"></button>`).join('')}</div>
    <b class="avh">🧢 ${AR() ? 'على راسك' : 'On your head'}</b><div class="avrow">${chips('hat', HATS)}</div>
    <b class="avh">🕶️ ${AR() ? 'نظارة' : 'Glasses'}</b><div class="avrow">${chips('glass', GLASSES)}</div>
    <b class="avh">💇 ${AR() ? 'الشعر (اللي بيشوفه الزوار التانيين)' : 'Hair (as others see you)'}</b><div class="avrow">${chips('hair', HAIRS)}</div>
    ${badges.length ? `<b class="avh">🏅 ${AR() ? 'بادجاتك' : 'Your badges'}</b><div class="avrow badges">${badges.map(b => `<span class="bdg">${b.icon} ${t(b.name)}</span>`).join('')}</div>` : ''}
    <button type="button" class="xm-go" id="pfsave">${AR() ? 'احفظ' : 'Save'}</button>`, after);
  const inp = box.querySelector('#pfname'); inp.value = profile.nick || '';
  const mark = () => { box.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', +b.dataset.c === pick)); box.querySelectorAll('.avc').forEach(b => b.classList.toggle('on', draft[b.dataset.k] === +b.dataset.v)); };
  mark();
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pick = +b.dataset.c; mark(); Sfx.click(); });
  box.querySelectorAll('.avc').forEach(b => b.onclick = () => { const k = b.dataset.k, v = +b.dataset.v; draft[k] = draft[k] === v && k === 'hair' ? -1 : v; mark(); Sfx.click(); Object.assign(AV, draft); paintMyAvatar(); });
  box.querySelector('#pfsave').onclick = () => { Object.assign(AV, draft); saveProfile(inp.value, pick); saveAvatar(); Sfx.open(); closeX('profilebox'); mini(AR() ? `✅ أهلاً يا ${profile.nick || 'زائر'}` : `✅ Hi ${profile.nick || 'there'}`); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') box.querySelector('#pfsave').click(); });
};

/* ================= placing things next to a building ================= */
function spotNear(p, dist, tries = 24){
  const side = V().crossVectors(p.dir, p.doorTan || Y).normalize();
  for (let k = 0; k < tries; k++){ const a = k * 2.399, d = p.dir.clone().addScaledVector(side.clone().applyAxisAngle(p.dir, a), (dist + (k % 3)) / R).normalize();
    if (walkable(d) && roadDist(d) > 2.6 && poiDist(d)[0] > 6 && !obstacles.some(o => o.d.angleTo(d) * R < o.r + 2.2)) return d; }
  return null;
}
function faceDir(obj, d, target){ const up = d.clone(); obj.updateMatrixWorld(true); faceToward(obj, target.clone().multiplyScalar(R)); }
const myTalkables = [];
function addTk(tk){ talkables.push(tk); myTalkables.push(tk); return tk; }

/* ================= 2. message walls ================= */
const WALLS = []; // { idx, p, tex, msgs, paint }
const WALL_SPOTS = [['hq', L('The visitors\' wall', 'حيطة الزوار')], ['cafe', L('The café wall', 'حيطة المقهى')], ['gallery', L('The fans\' wall', 'حيطة المعجبين')]];
function buildWalls(){
  WALL_SPOTS.forEach(([pid, title], idx) => { const p = pois.find(x => x.id === pid); if (!p) return; const d = spotNear(p, p.r + 6); if (!d) return;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 560; const x = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
    const w = { idx, p, d, title, tex, msgs: [] };
    w.paint = () => { x.fillStyle = '#F4EEE6'; x.fillRect(0, 0, 1024, 560); x.fillStyle = '#E2D6C4'; for (let r = 0; r < 14; r++) for (let c = 0; c < 9; c++) x.fillRect(c * 120 + (r % 2) * 60 - 4, r * 40 + 2, 112, 34);
      x.fillStyle = '#12153A'; x.fillRect(0, 0, 1024, 78); x.fillStyle = '#F2C94C'; x.font = '800 44px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = AR() ? 'rtl' : 'ltr';
      x.fillText('✍️ ' + t(title), 512, 41, 980);
      const cols = ['#F2C94C', '#E9A0B8', '#8FB4E3', '#C9F0D2', '#FFD3B0', '#E0D3F5'];
      if (!w.msgs.length){ x.fillStyle = '#5a6688'; x.font = '700 38px IBM Plex Sans Arabic, sans-serif'; x.fillText(AR() ? 'كن أول واحد يكتب هنا 👋' : 'Be the first to write here 👋', 512, 310); }
      w.msgs.slice(0, 6).forEach((m, k) => { const cx = 30 + (k % 3) * 330, cy = 100 + Math.floor(k / 3) * 225; x.save(); x.translate(cx + 150, cy + 100); x.rotate(((k * 37) % 9 - 4) * 0.012);
        x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(-142, -92, 300, 200); x.fillStyle = cols[k % cols.length]; x.fillRect(-150, -100, 300, 200);
        x.fillStyle = '#12153A'; x.textAlign = 'center'; x.direction = /[؀-ۿ]/.test(m.msg) ? 'rtl' : 'ltr'; x.font = '700 30px IBM Plex Sans Arabic, sans-serif';
        const lines = wrapText(x, m.msg, 270).slice(0, 3); lines.forEach((l, i) => x.fillText(l, 0, -40 + i * 38, 280));
        x.font = '800 24px IBM Plex Sans Arabic, sans-serif'; x.fillStyle = hexCss(m.color || 0x12153A) === '#f4f7fc' ? '#5a6688' : hexCss(m.color || 0x12153A); x.direction = /[؀-ۿ]/.test(m.nick) ? 'rtl' : 'ltr'; x.fillText('— ' + m.nick, 0, 76, 280); x.restore(); });
      tex.needsUpdate = true; };
    w.paint(); langHooks.push(w.paint);
    const g = new THREE.Group(); const board = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.0, 0.25), toon(0x8A6A4A)); board.position.y = 2.1; g.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.84), new THREE.MeshBasicMaterial({ map: tex })); face.position.set(0, 2.1, 0.13); g.add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.84), new THREE.MeshBasicMaterial({ map: tex })); back.position.set(0, 2.1, -0.13); back.rotation.y = Math.PI; g.add(back);
    [-2.4, 2.4].forEach(xx => { const leg = mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6), 0x12153A, 0); leg.position.set(xx, 0.55, 0); g.add(leg); });
    const pen = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), 0xE76F51, 0); pen.position.set(2.2, 0.9, 0.35); pen.rotation.z = 0.5; g.add(pen);
    placeAt(g, d); faceToward(g, p.dir.clone().multiplyScalar(R)); planet.add(g);
    addObstacle(d, 1.6); addTk({ d, r: 4.2, kind: 'wall', ref: w, label: L(`✍️ Write on ${title.en}`, `✍️ اكتب على ${title.ar}`) }); WALLS.push(w); });
  loadWalls();
}
/* walls refresh themselves: a message lives three weeks, its author can take it down any time
   (the browser keeps a private delete key per message), and the admin dashboard can remove any */
const WALL_DAYS = 21;
const wallKeys = (() => { try { return JSON.parse(localStorage.getItem('pm-wallkeys') || '{}'); } catch (e) { return {}; } })();
const saveWallKeys = () => { try { localStorage.setItem('pm-wallkeys', JSON.stringify(wallKeys)); } catch (e) {} };
const newKey = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
async function deleteWallMsg(m){
  const key = wallKeys[m.id]; if (!key) return false;
  try { const r = await fetch(NET.url + '/functions/v1/game-wall', { method: 'POST', headers: { 'content-type': 'application/json', apikey: NET.key }, body: JSON.stringify({ a: 'del', id: m.id, key }) });
    const j = await r.json(); if (!j.ok) return false; } catch (e) { return false; }
  delete wallKeys[m.id]; saveWallKeys(); return true;
}
async function loadWalls(){
  const since = new Date(Date.now() - WALL_DAYS * 864e5).toISOString();
  const rows = await sbGet(`game_wall?select=id,nick,color,msg,wall,created_at&created_at=gte.${since}&order=created_at.desc&limit=120`); if (!rows) return;
  for (const w of WALLS){ w.msgs = rows.filter(r => r.wall === w.idx); w.paint(); }
  const box = document.getElementById('wallbox'); if (box && !box.hidden && box._w) renderWallList(box, box._w);
}
function renderWallList(box, w){
  const list = box.querySelector('.wl-list'); list.textContent = '';
  if (!w.msgs.length){ const e = document.createElement('p'); e.className = 'xm-sub'; e.textContent = AR() ? 'لسه مفيش رسايل — إنت أول واحد' : 'No messages yet — you\'re the first'; list.appendChild(e); }
  for (const m of w.msgs.slice(0, 40)){ const row = document.createElement('div'); row.className = 'wl-m'; const b = document.createElement('b'); b.textContent = m.nick; b.style.color = hexCss(m.color || 0x12153A) === '#f4f7fc' ? '#5a6688' : hexCss(m.color || 0x12153A);
    const s = document.createElement('span'); s.textContent = m.msg; const tm = document.createElement('small'); tm.textContent = new Date(m.created_at).toLocaleDateString(AR() ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }); row.append(b, s, tm);
    if (m.id && wallKeys[m.id]){ const del = document.createElement('button'); del.type = 'button'; del.className = 'wl-del'; del.textContent = AR() ? '🗑 احذف' : '🗑 Delete';
      del.onclick = async () => { del.disabled = true; if (!await deleteWallMsg(m)){ del.disabled = false; return mini(AR() ? '⏳ ماقدرناش نحذفها، جرب تاني' : '⏳ Couldn\'t delete it, try again'); }
        w.msgs = w.msgs.filter(x => x.id !== m.id); w.paint(); renderWallList(box, w); if (netLive) netChan.send({ type: 'broadcast', event: 'wall', payload: { w: w.idx } }); mini(AR() ? '🗑 رسالتك اتشالت' : '🗑 Your message is gone'); };
      row.appendChild(del); }
    list.appendChild(row); }
}
function openWall(w){
  const box = xModal('wallbox', `<h3>✍️ ${t(w.title)}</h3><p class="xm-sub">${AR() ? 'سيب رسالة أو توقيع — بتفضل ٣ أسابيع، وتقدر تحذفها في أي وقت' : 'Leave a message or your signature — it stays for three weeks, and you can delete it any time'}</p>
    <form class="wl-form"><input id="wlin" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="${AR() ? 'اكتب رسالتك…' : 'Write your message…'}"><button type="submit" class="xm-go">${AR() ? 'اكتب' : 'Post'}</button></form>
    <div class="wl-list"></div>`);
  box._w = w; renderWallList(box, w);
  box.querySelector('form').onsubmit = async e => { e.preventDefault(); const inp = box.querySelector('#wlin'), msg = cleanMsg(inp.value);
    if (msg === null) return mini(AR() ? '🙏 من غير روابط أو أرقام أو ألفاظ' : '🙏 No links, numbers or rude words please'); if (!msg) return;
    const key = newKey(); let id = null;
    try { const r = await fetch(SB_REST + 'game_wall?select=id', { method: 'POST', headers: { ...sbHead(), Prefer: 'return=representation' }, body: JSON.stringify({ vid, nick: myName().slice(0, 24), color: netColor, msg, wall: w.idx, del_key: key }) });
      if (r.ok){ const j = await r.json(); id = j[0] && j[0].id; } } catch (e) {}
    if (!id) return mini(AR() ? '⏳ استنى شوية وجرب تاني' : '⏳ Wait a moment and try again');
    wallKeys[id] = key; saveWallKeys();
    inp.value = ''; Sfx.deliver(); w.msgs.unshift({ id, nick: myName(), color: netColor, msg, wall: w.idx, created_at: new Date().toISOString() }); w.paint(); renderWallList(box, w);
    if (netLive) netChan.send({ type: 'broadcast', event: 'wall', payload: { w: w.idx } }); mini(AR() ? '✅ رسالتك اتكتبت على الحيطة' : '✅ Your message is on the wall'); };
  setTimeout(() => box.querySelector('#wlin').focus(), 60);
}

/* ================= 3. the live screen in the square ================= */
const LIVE = { g: null, k: 0, t: 0, imgs: [], tex: null, x: null };
function buildLiveScreen(){
  const hq = pois[0], d = spotNear(hq, hq.r + 9); if (!d) return;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640; LIVE.x = cv.getContext('2d'); LIVE.tex = new THREE.CanvasTexture(cv);
  LIVE.items = WORK.flatMap(w => w.imgs.slice(0, 2).map(src => ({ w, src })));
  const g = new THREE.Group(); const frame = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.7, 0.35), toon(0x12153A)); frame.position.y = 4.2; g.add(frame);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 4.375), new THREE.MeshBasicMaterial({ map: LIVE.tex })); scr.position.set(0, 4.2, 0.18); g.add(scr);
  const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 4.375), new THREE.MeshBasicMaterial({ map: LIVE.tex })); scr2.position.set(0, 4.2, -0.18); scr2.rotation.y = Math.PI; g.add(scr2);
  [-2.8, 2.8].forEach(xx => { const leg = mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 8), 0x2E3557, 0); leg.position.set(xx, 1.0, 0); g.add(leg); });
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8FB4E3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(11, 7, 1); gl.position.y = 4.2; g.add(gl);
  placeAt(g, d); faceToward(g, hq.dir.clone().multiplyScalar(R)); planet.add(g); LIVE.g = g;
  addObstacle(d, 2.6); addTk({ d, r: 5.4, kind: 'live', label: L('📺 See the work on the live screen', '📺 شوف الشغل على الشاشة اللايف') });
  liveNext(0);
}
function liveNext(step = 1){
  if (!LIVE.items || !LIVE.items.length) return; LIVE.k = (LIVE.k + step + LIVE.items.length) % LIVE.items.length; const it = LIVE.items[LIVE.k];
  const im = new Image(); im.onload = () => paintLive(im, it); im.onerror = () => paintLive(null, it); im.src = 'img/' + it.src;
}
function paintLive(im, it){
  const x = LIVE.x, W = 1024, H = 640; x.fillStyle = '#0A0F26'; x.fillRect(0, 0, W, H);
  if (im){ const s = Math.max(W / im.width, H / im.height); x.drawImage(im, W / 2 - im.width * s / 2, H / 2 - im.height * s / 2, im.width * s, im.height * s); }
  const gr = x.createLinearGradient(0, H - 200, 0, H); gr.addColorStop(0, 'rgba(10,15,38,0)'); gr.addColorStop(1, 'rgba(10,15,38,.92)'); x.fillStyle = gr; x.fillRect(0, H - 200, W, 200);
  x.fillStyle = '#E05A5A'; x.beginPath(); x.roundRect ? x.roundRect(26, 24, 150, 54, 27) : x.rect(26, 24, 150, 54); x.fill(); x.fillStyle = '#fff'; x.font = '800 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('● LIVE', 101, 52);
  x.direction = AR() ? 'rtl' : 'ltr'; x.textAlign = AR() ? 'right' : 'left'; x.font = '800 54px IBM Plex Sans Arabic, sans-serif'; x.fillStyle = '#F2C94C'; const tx = AR() ? W - 40 : 40;
  x.fillText(t(it.w.name), tx, H - 92, W - 80); x.font = '600 32px IBM Plex Sans Arabic, sans-serif'; x.fillStyle = '#F4F7FC'; x.fillText((AR() ? 'أحدث شغلنا · ' : 'Our latest work · ') + t(it.w.ind || L('', '')), tx, H - 40, W - 80);
  LIVE.tex.needsUpdate = true; LIVE.cur = it;
}

/* ================= 4. the weekly mission ================= */
const MISSIONS = [
  { id: 'shawa', client: 'c_alshawa', icon: '🌙', name: L('Help Al Shawa get ready for the season', 'ساعد الشوا يجهّز حملة الموسم'), badge: L('Campaign hero', 'بطل الحملات'),
    steps: [['s1', L('Plan the idea at the Strategy studio', 'خطّط الفكرة في استوديو الاستراتيجية')], ['s4', L('Build the campaign at the Campaigns studio', 'جهّز الحملة في استوديو الحملات')], ['c_alshawa', L('Deliver it to Al Shawa', 'سلّمها للشوا')]] },
  { id: 'fly', client: 'c_fly29', icon: '✈️', name: L('Get Fly 29 ready for summer', 'جهّز Fly 29 لموسم الصيف'), badge: L('Travel maker', 'صانع الرحلات'),
    steps: [['s5', L('Shoot the trip videos at the Video studio', 'صوّر فيديوهات الرحلات في استوديو الفيديو')], ['s7', L('Launch the ads at the Ads studio', 'شغّل الإعلانات في استوديو الإعلانات')], ['c_fly29', L('Take the results to Fly 29', 'ودّي النتايج لـ Fly 29')]] },
  { id: 'value', client: 'c_value', icon: '🦷', name: L('Launch a new look for Value Dental', 'اطلق هوية جديدة لـ Value Dental'), badge: L('Brand builder', 'باني العلامات'),
    steps: [['s2', L('Design the identity at the Identity studio', 'صمّم الهوية في استوديو الهوية')], ['s3', L('Write the first posts at the Content studio', 'اكتب أول بوستات في استوديو المحتوى')], ['c_value', L('Unveil it at the clinic', 'اكشفها في العيادة')]] },
  { id: 'west', client: 'c_westeros', icon: '🍔', name: L('Bring Westeros online', 'طلّع Westeros أونلاين'), badge: L('Digital chef', 'الشيف الرقمي'),
    steps: [['s6', L('Build the ordering site at the Web studio', 'ابني موقع الطلبات في استوديو المواقع')], ['s8', L('Plan the year at the Consulting lounge', 'خطّط السنة في صالة الاستشارات')], ['c_westeros', L('Hand it over to Westeros', 'سلّمه لـ Westeros')]] },
];
const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
const MS = (() => { let s; try { s = JSON.parse(store.get('pm-mission') || 'null'); } catch (e) {} const w = weekNo(); if (!s || s.w !== w) s = { w, s: 0, done: false }; return s; })();
const mission = () => MISSIONS[MS.w % MISSIONS.length];
function msSave(){ store.set('pm-mission', JSON.stringify(MS)); }
function myBadges(){ try { return JSON.parse(store.get('pm-badges') || '[]'); } catch (e) { return []; } }
function msChip(){ let c = document.getElementById('missionchip'); if (!c){ c = document.createElement('button'); c.type = 'button'; c.id = 'missionchip'; c.className = 'panel'; document.body.appendChild(c); c.onclick = () => { Sfx.click(); openMission(); }; } return c; }
function paintMission(){ const m = mission(), c = msChip();
  c.innerHTML = MS.done ? `🏅 <span>${AR() ? 'مهمة الأسبوع خلصت' : 'Weekly mission done'}</span>` : `${m.icon} <span>${AR() ? 'مهمة الأسبوع' : 'Weekly mission'}</span> <b>${MS.s}/${m.steps.length}</b>`; }
langHooks.push(paintMission);
function openMission(){
  const m = mission(), p = id => pois.find(x => x.id === id);
  const box = xModal('missionbox', `<h3>${m.icon} ${t(m.name)}</h3>
    <p class="xm-sub">${AR() ? 'مهمة جديدة كل أسبوع — خلّصها وخد بادج' : 'A new mission every week — finish it to earn a badge'} 🏅 <b>${t(m.badge)}</b></p>
    <ol class="ms-steps">${m.steps.map(([id, txt], k) => `<li class="${k < MS.s || MS.done ? 'ok' : k === MS.s ? 'now' : ''}">${k < MS.s || MS.done ? '✅' : k === MS.s ? '👉' : '⬜'} ${t(txt)} <small>(${p(id) ? t(p(id).name) : ''})</small></li>`).join('')}</ol>
    ${MS.done ? `<p>🎉 ${AR() ? 'خلصت مهمة الأسبوع ده — مهمة جديدة الأسبوع الجاي' : 'You finished this week\'s mission — a new one next week'}</p>` : `<button type="button" class="xm-go" data-a="go">🧭 ${AR() ? 'ودّيني على الخطوة الجاية' : 'Take me to the next step'}</button>`}`);
  const go = box.querySelector('[data-a="go"]'); if (go) go.onclick = () => { const tp = p(m.steps[MS.s][0]); if (tp){ guide = tp; mapRouteFor = null; } closeX('missionbox'); };
}
function missionFrame(){
  const c = msChip(); c.hidden = !onPlanetOrInside() || !['play', 'talk'].includes(state) || $('hud').hidden; if (MS.done || state !== 'play') return;
  const m = mission(), [id, txt] = m.steps[MS.s], p = pois.find(x => x.id === id); if (!p) return;
  const here = (typeof inBuilding !== 'undefined' && inBuilding === p) || (onPlanet() && pDir.angleTo(p.dir) * R < p.r + 3) || (id === 'hq' && typeof inOffice !== 'undefined' && inOffice);
  if (!here) return;
  MS.s++; Sfx.deliver(); if (guide === p) guide = null;
  if (MS.s >= m.steps.length){ MS.done = true; msSave(); paintMission(); const b = myBadges(); if (!b.some(x => x.id === m.id + MS.w)){ b.push({ id: m.id + MS.w, icon: m.icon, name: m.badge }); store.set('pm-badges', JSON.stringify(b)); }
    burst(player.position.clone(), 0xF2C94C, 120, 7, 1.6); setTimeout(() => showBadge(m), 600); voiceSay(t(L(`Mission complete! You earned the ${m.badge.en} badge.`, `المهمة خلصت! خدت بادج ${m.badge.ar}.`)));
    if (netLive) sendChat(AR() ? `🏅 خلصت مهمة الأسبوع وخدت بادج «${m.badge.ar}»!` : `🏅 I finished the weekly mission and earned the "${m.badge.en}" badge!`); return; }
  msSave(); paintMission(); const nx = pois.find(x => x.id === m.steps[MS.s][0]);
  toast(`${m.icon} ${t(txt)} ✅`, AR() ? `الجاي: ${t(m.steps[MS.s][1])}` : `Next: ${t(m.steps[MS.s][1])}`); if (nx){ guide = nx; mapRouteFor = null; }
  voiceSay(t(m.steps[MS.s][1]));
}
function showBadge(m){
  const box = xModal('missionbox', `<div class="bdg-big">${m.icon}</div><h3>🏅 ${t(m.badge)}</h3><p>${AR() ? 'خلصت مهمة الأسبوع — البادج اتضاف لبروفايلك والزوار هيشوفوه' : 'Mission complete — the badge is on your profile now'}</p>
    <div class="xm-acts"><button type="button" data-a="wa">💬 ${AR() ? 'كلّم Planet عن مشروعك' : 'Talk to Planet about your project'}</button><button type="button" data-a="ok">👍 ${AR() ? 'تمام' : 'Great'}</button></div>`);
  box.querySelector('[data-a="ok"]').onclick = () => closeX('missionbox');
  box.querySelector('[data-a="wa"]').onclick = () => waOpen(AR() ? `أهلاً Planet 👋 خلصت مهمة الأسبوع («${m.name.ar}») وعايز أتكلم عن مشروعي` : `Hi Planet 👋 I finished the weekly mission ("${m.name.en}") and want to talk about my project`);
}
const onPlanetOrInside = () => onPlanet() || (typeof inBuilding !== 'undefined' && !!inBuilding);

/* ================= 5. the leaderboard (saved) ================= */
const GAMES = { race: L('Parcel race', 'سباق الطرود'), stars: L('Star Catcher', 'صيد النجوم'), daily: L('Daily logo hunts', 'تحدي اللوجو') };
async function submitScore(game, score){ if (!(score > 0)) return; const ok = await sbPost('game_scores', { vid, nick: myName().slice(0, 24), game, score: Math.min(100000, Math.round(score)) }); if (ok) LB.cache[game] = null; }
const LB = { tab: 'stars', cache: {} };
async function openBoard(tab){
  if (tab) LB.tab = tab;
  const box = xModal('boardbox', `<h3>🏆 ${AR() ? 'لوحة الأبطال' : 'Leaderboard'}</h3>
    <div class="lb-tabs">${Object.entries(GAMES).map(([k, n]) => `<button type="button" data-g="${k}" class="${k === LB.tab ? 'on' : ''}">${t(n)}</button>`).join('')}</div>
    <ol class="lb-list"><li class="xm-sub">${AR() ? 'بيحمّل…' : 'Loading…'}</li></ol><p class="xm-sub" data-me></p>`);
  box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { Sfx.click(); openBoard(b.dataset.g); });
  let rows = LB.cache[LB.tab]; if (!rows){ rows = await sbGet(`game_scores?select=vid,nick,score,created_at&game=eq.${LB.tab}&order=score.desc&limit=200`); if (rows) LB.cache[LB.tab] = rows; }
  if (box.hidden) return; const list = box.querySelector('.lb-list'); list.textContent = '';
  if (!rows){ list.innerHTML = `<li class="xm-sub">${AR() ? 'مش قادرين نحمّل دلوقتي' : 'Couldn\'t load right now'}</li>`; return; }
  const best = new Map(); for (const r of rows) if (!best.has(r.vid)) best.set(r.vid, r);
  const top = [...best.values()].slice(0, 10);
  if (!top.length) list.innerHTML = `<li class="xm-sub">${AR() ? 'لسه محدش لعب — كن الأول!' : 'No scores yet — be the first!'}</li>`;
  top.forEach((r, k) => { const li = document.createElement('li'); if (r.vid === vid) li.className = 'me'; const m = ['🥇', '🥈', '🥉'][k] || `${k + 1}.`;
    const a = document.createElement('i'); a.textContent = m; const n = document.createElement('span'); n.textContent = r.nick; const s = document.createElement('b'); s.textContent = r.score; li.append(a, n, s); list.appendChild(li); });
  const mine = best.get(vid), rank = [...best.keys()].indexOf(vid);
  box.querySelector('[data-me]').textContent = mine ? (AR() ? `أحسن رقم ليك: ${mine.score} — المركز ${rank + 1}` : `Your best: ${mine.score} — rank ${rank + 1}`) : (AR() ? 'العب وسجّل اسمك في اللوحة' : 'Play to get your name on the board');
}
/* hooks into the games */
{ const plainSg = sgEnd; sgEnd = function(){ const s = SG.score; plainSg(); submitScore('stars', s); }; }
let raceWasOn = false, raceLast = 0, dailyWas = null;
function scoreFrame(){
  if (RACE.on){ raceWasOn = true; raceLast = RACE.mine; } else if (raceWasOn){ raceWasOn = false; submitScore('race', raceLast); }
  if (dailyWas === null) dailyWas = DAILY.done; else if (DAILY.done && !dailyWas){ dailyWas = true; const n = +(store.get('pm-daily-count') || 0) + 1; store.set('pm-daily-count', String(n)); submitScore('daily', n); }
}

/* ================= 6. the voice guide ================= */
const VOICE = { on: store.get('pm-voice') === 'on', lastDistrict: null };
function voiceSay(text){
  if (!VOICE.on || !window.speechSynthesis || !text) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    const want = AR() ? 'ar' : 'en', vs = speechSynthesis.getVoices();
    u.voice = vs.find(v => v.lang && v.lang.toLowerCase().startsWith(want + '-eg')) || vs.find(v => v.lang && v.lang.toLowerCase().startsWith(want)) || null;
    u.lang = AR() ? 'ar-EG' : 'en-GB'; u.rate = AR() ? 0.95 : 1; u.pitch = 1.05; speechSynthesis.speak(u); } catch (e) {}
}
function setVoice(on){ VOICE.on = on; store.set('pm-voice', on ? 'on' : 'off'); if (!on && window.speechSynthesis) speechSynthesis.cancel(); paintVoiceBtn();
  mini(on ? (AR() ? '🗣️ المرشد الصوتي شغّال' : '🗣️ Voice guide on') : (AR() ? '🔇 المرشد الصوتي مقفول' : '🔇 Voice guide off')); if (on) voiceSay(AR() ? 'أهلاً! أنا هحكيلك عن كل مكان تروحه.' : "Hi! I'll tell you about every place you visit."); }
function paintVoiceBtn(){ const b = document.getElementById('voicebtn'); if (b){ b.textContent = VOICE.on ? '🗣️' : '🔈'; b.title = AR() ? 'المرشد الصوتي' : 'Voice guide'; b.classList.toggle('off', !VOICE.on); } }
function voiceBtn(){ let b = document.getElementById('voicebtn'); if (b) return b; b = document.createElement('button'); b.id = 'voicebtn'; b.type = 'button'; b.className = 'panel tbtn'; b.setAttribute('aria-label', 'Voice guide');
  const tools = document.querySelector('.tools'); (tools || document.body).appendChild(b); b.onclick = () => { Sfx.click(); setVoice(!VOICE.on); }; paintVoiceBtn(); return b; }
{ const plainRender = renderLine; renderLine = function(keepFull){ plainRender(keepFull); if (dlg.active && VOICE.on){ VOICE.dlg = true; voiceSay(t(dlg.lines[dlg.i])); } }; }
const DISTRICT_SAY = {
  food: L('Welcome to the food district — restaurants and cafés we market, from grills to juice bars.', 'أهلاً في حي المطاعم — مطاعم وكافيهات بنسوّق لها، من المشويات للعصاير.'),
  health: L('This is the health district — clinics and medical centres that trust us with their image.', 'ده حي الصحة — عيادات ومراكز طبية مأمّنانا على صورتها.'),
  travel: L('The travel district — agencies and airlines we help fill seats.', 'حي السفر — شركات سياحة وطيران بنساعدها تملا مقاعدها.'),
  money: L('The business district — real estate and investment brands.', 'حي البيزنس — شركات عقارات واستثمار.'),
  shop: L('The shopping district — stores and brands that sell every day.', 'حي التسوق — محلات وبراندات بتبيع كل يوم.'),
  pro: L('The professionals district — offices and services we grow online.', 'حي المحترفين — مكاتب وخدمات بنكبّرها أونلاين.'),
};
function voiceFrame(){
  if (!VOICE.on || state !== 'play' || !onPlanet()) return;
  const [pd, pi] = poiDist(pDir), p = pois[pi], dk = pd < 18 && p.district ? p.district : null;
  if (dk && dk !== VOICE.lastDistrict){ VOICE.lastDistrict = dk; const s = DISTRICT_SAY[dk] || L(`Welcome to ${DISTRICTS[dk].name.en}.`, `أهلاً في ${DISTRICTS[dk].name.ar}.`); voiceSay(t(s)); }
  if (!dk && pd > 40) VOICE.lastDistrict = null;
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

/* ================= 7. night market in the food district ================= */
const NIGHT = { g: null, on: null, audio: null };
function buildNightMarket(){
  const food = pois.filter(p => p.district === 'food'); if (!food.length) return;
  const c = food.reduce((a, p) => a.add(p.dir), V()).normalize(); const g = new THREE.Group(); planet.add(g); NIGHT.g = g;
  const side = V().crossVectors(c, Y).normalize(); if (side.lengthSq() < 0.1) side.set(1, 0, 0); let n = 0;
  for (let k = 0; k < 40 && n < 7; k++){ const d = c.clone().addScaledVector(side.clone().applyAxisAngle(c, k * 2.399), (6 + (k % 4) * 3.5) / R).normalize();
    if (!walkable(d) || roadDist(d) < 2.2 || poiDist(d)[0] < 6 || obstacles.some(o => o.d.angleTo(d) * R < o.r + 1.8)) continue;
    const st = new THREE.Group(), col = [0xE76F51, 0xF2C94C, 0x3E8E7E, 0x8E6BC2, 0x5FA0E6][n % 5];
    const tbl = mesh(new THREE.BoxGeometry(1.8, 0.9, 0.9), 0x8A6A4A); tbl.position.y = 0.45; st.add(tbl);
    [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]].forEach(([x, z]) => { const p = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), 0x2B2420, 0); p.position.set(x, 1.1, z); st.add(p); });
    for (let s = 0; s < 4; s++){ const stripe = mesh(new THREE.BoxGeometry(0.46, 0.08, 1.2), s % 2 ? 0xF4F7FC : col, 0); stripe.position.set(-0.69 + s * 0.46, 2.25, 0); stripe.rotation.x = 0.18; st.add(stripe); }
    for (let f = 0; f < 4; f++){ const item = mesh(new THREE.SphereGeometry(0.13, 8, 6), [0xF2C94C, 0xE76F51, 0x88C38C, 0xF4F7FC][f], 0); item.position.set(-0.6 + f * 0.4, 0.98, 0.1); st.add(item); }
    for (let b = 0; b < 5; b++){ const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: [0xFFE38A, 0xFFB86B, 0xFF9BE2][b % 3], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); bulb.scale.setScalar(0.7); bulb.position.set(-0.9 + b * 0.45, 2.05, 0.65); st.add(bulb); }
    const seller = person(n * 11 + 3, { shirt: col }); seller.position.set(0, 0, -0.9); st.add(seller);
    placeAt(st, d, n * 1.3); g.add(st); addObstacle(d, 1.2); n++; }
  const ban = bannerSprite(L('🌙 Night market', '🌙 السوق الليلي'), '#12153A', '#F2C94C'); placeAt(ban, c, 0, 6); ban.scale.set(6, 1.17, 1); fitSprite(ban, 22, 56); g.add(ban);
  g.visible = false;
}
function marketSound(on){
  if (!on){ if (NIGHT.audio){ NIGHT.audio.gain.gain.setTargetAtTime(0, NIGHT.audio.ctx.currentTime, 0.4); } return; }
  try { if (!NIGHT.audio){ const ctx = new (window.AudioContext || window.webkitAudioContext)(); const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++){ last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
      const gain = ctx.createGain(); gain.gain.value = 0; src.connect(bp).connect(gain).connect(ctx.destination); src.start(); NIGHT.audio = { ctx, gain }; }
    if (NIGHT.audio.ctx.state !== 'running') NIGHT.audio.ctx.resume().catch(() => {});
    NIGHT.audio.gain.gain.setTargetAtTime(0.16, NIGHT.audio.ctx.currentTime, 0.8); } catch (e) {}
}
let nightTick = 0;
function nightFrame(){
  if (!NIGHT.g || ++nightTick % 30) return;
  const n = isNight(); if (n !== NIGHT.on){ NIGHT.on = n; NIGHT.g.visible = n; }
  const food = pois.filter(p => p.district === 'food'), close = n && onPlanet() && state !== 'title' && food.some(p => pDir.angleTo(p.dir) * R < 30);
  marketSound(close && Sfx.on);
  // each district has its own night tint: warm in the food streets, cool by the clinics
  if (n && onPlanet()){ const [pd, pi] = poiDist(pDir), dk = pd < 24 ? pois[pi].district : null;
    const tint = { food: 0x3A2440, health: 0x163A4A, travel: 0x1B2E5C, money: 0x24224A, shop: 0x3A1E3E, pro: 0x22284E }[dk] || 0x1E2752; scene.fog.color.lerp(new THREE.Color(tint), 0.25); }
}

/* ================= 8. a planet of its own for Fly 29 ================= */
function buildFlyWorld(){
  if (typeof makeWorld !== 'function' || worlds.some(w => w.id === 'fly29')) return;
  const fly = CLIENTS.find(c => c.logo === 'fly29'), work = WORK.find(w => w.id === 'fly29');
  const wld = makeWorld(0x5FA0E6, 9, new THREE.Vector3(-250, 150, -40), { clouds: true, moons: 1, beacon: 0xF2C94C, spin: 0.045 }), body = wld.userData.body;
  // a runway with lights, a terminal and a control tower
  const top = V(0, 1, 0), rw = new THREE.Group(); const strip = spMesh(new THREE.BoxGeometry(2.2, 0.12, 9), 0x2E3557); rw.add(strip);
  for (let k = -4; k <= 4; k++){ const ln = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0xF4F7FC, fog: false })); ln.position.set(0, 0.02, k); rw.add(ln);
    [-1.2, 1.2].forEach(x => { const l = spGlow(0xFFE38A, 0.6); l.position.set(x, 0.15, k); rw.add(l); spBlinkers.push(l); }); }
  onSurface(body, rw, top, 9.0);
  onSurface(body, tinyTower(3.4, 0xF4F7FC, 0x7FE8FF), V(0.35, 1, 0.1), 8.9); onSurface(body, tinyDome(1.4, 0x8FB4E3), V(-0.3, 1, -0.2), 8.9);
  for (let i = 0; i < 10; i++) onSurface(body, tinyTree([0x74B47E, 0xF2C94C][i % 2]), spDir(), 8.9);
  // little planes doing laps
  const planeMesh = () => { const p = new THREE.Group(); const f = spMesh(new THREE.CylinderGeometry(0.22, 0.16, 1.8, 8), 0xF4F7FC); f.rotation.x = Math.PI / 2; p.add(f);
    const wing = spMesh(new THREE.BoxGeometry(2.2, 0.06, 0.45), 0x2E6BA9); p.add(wing); const tail = spMesh(new THREE.BoxGeometry(0.06, 0.55, 0.4), 0xE76F51); tail.position.set(0, 0.3, -0.75); p.add(tail); return p; };
  for (let k = 0; k < 3; k++){ const piv = new THREE.Group(); piv.rotation.set(0.3 + k * 0.5, k * 2, 0.2 * k); wld.add(piv); const pl = planeMesh(); pl.position.set(13 + k * 1.6, 0, 0); pl.rotation.y = Math.PI; piv.add(pl); spMovers.push({ o: piv, ry: 0.35 - k * 0.07 }); }
  const og = new THREE.Group(); wld.add(og); const items = [];
  if (fly){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(fly), fog: false })); items.push({ s, act: () => openExhibit('client', 'fly29'), size: 6 }); }
  (work ? work.imgs : []).forEach(src => items.push({ s: frameCard('img/' + src, L('Fly 29', 'Fly 29')), act: () => openExhibit('work', 'fly29'), size: 5.6 }));
  items.push({ s: actionCard('🌍', L('Their page', 'صفحتهم'), '#8FB4E3'), act: () => window.open('https://www.facebook.com/fly29.net', '_blank', 'noopener'), size: 5.2 });
  items.push({ s: actionCard('💬', L('A plan like this', 'خطة زي دي'), '#C9F0D2'), act: () => waOpen(AR() ? 'أهلاً Planet 👋 شفت كوكب Fly 29 وعايز خطة زيها لشركتي' : 'Hi Planet 👋 I saw the Fly 29 planet and want a plan like that for my business'), size: 5.2 });
  items.forEach((it, k) => { const a = k / items.length * Math.PI * 2; it.s.position.set(Math.cos(a) * 20, (k % 3 - 1) * 4, Math.sin(a) * 20); it.s.scale.setScalar(it.size); og.add(it.s); it.w = wld; spaceTap.push(it); });
  og.visible = false;
  worlds.push({ id: 'fly29', name: L('Voyage Planet', 'كوكب الرحلات'), sub: L('Runways, planes and summer trips', 'مطار وطيارات ورحلات الصيف'), icon: '✈️', obj: wld, r: 9, spin: og,
    tip: L('Fly 29 is a travel brand we market — planes, trips and the ads that fill them', 'Fly 29 شركة سفر بنسوّق لها — طيارات ورحلات والإعلانات اللي بتملاها') });
}
{ const plainBW = buildWorlds; buildWorlds = function(){ plainBW(); buildFlyWorld(); }; if (worlds.length) buildFlyWorld(); }

/* ================= wiring ================= */
{ const plainInteract = interact; interact = function(tk){ if (tk.kind === 'wall') return openWall(tk.ref); if (tk.kind === 'live'){ if (LIVE.cur) return openExhibit('work', LIVE.cur.w.id); return; } return plainInteract(tk); }; }
/* the people panel gets the leaderboard, the voice guide and the mission */
{ const plainPeople = openPeople; openPeople = function(){ plainPeople(); const box = document.getElementById('peoplebox'), acts = box && box.querySelector('.xm-acts'); if (!acts) return;
    const add = (txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = () => { closeX('peoplebox'); fn(); }; acts.appendChild(b); };
    add('🏆 ' + (AR() ? 'لوحة الأبطال' : 'Leaderboard'), () => openBoard()); add(mission().icon + ' ' + (AR() ? 'مهمة الأسبوع' : 'Weekly mission'), openMission);
    add((VOICE.on ? '🔇 ' : '🗣️ ') + (VOICE.on ? (AR() ? 'اقفل المرشد الصوتي' : 'Voice guide off') : (AR() ? 'شغّل المرشد الصوتي' : 'Voice guide on')), () => setVoice(!VOICE.on)); }; }
function featuresNet(){
  if (typeof netChan === 'undefined' || !netChan) return setTimeout(featuresNet, 900);
  netChan.on('broadcast', { event: 'wall' }, () => loadWalls());
}
featuresNet();
function featuresBoot(){
  if (state === 'loading' || !pois.length || !pois[0].doorTan) return setTimeout(featuresBoot, 300);
  buildWalls(); buildLiveScreen(); buildNightMarket(); paintMission(); voiceBtn(); paintMyAvatar();
  setInterval(loadWalls, 90000);
  const tt = document.getElementById('title');
  if (tt && !document.getElementById('lblink')){ const b = document.createElement('button'); b.type = 'button'; b.id = 'lblink'; b.className = 'pflink';
    const paint = () => b.textContent = AR() ? '🏆 لوحة الأبطال' : '🏆 Leaderboard'; paint(); langHooks.push(paint); b.onclick = () => openBoard(); const pf = document.getElementById('pflink');
    if (pf){ const w = document.createElement('div'); w.className = 'titlelinks'; pf.replaceWith(w); w.append(pf, b); } else tt.appendChild(b); }
}
featuresBoot();
let ftPrev = performance.now(), liveT = 0;
function featuresFrame(now){
  requestAnimationFrame(featuresFrame);
  const dt = Math.min(0.1, (now - ftPrev) / 1000); ftPrev = now; if (state === 'loading') return;
  placeMyAcc(); missionFrame(); scoreFrame(); voiceFrame(); nightFrame();
  if (LIVE.g && (liveT += dt) > 5){ liveT = 0; if (onPlanet() && pDir.angleTo(LIVE.g.position.clone().normalize()) * R < 60) liveNext(); }
  if (VOICE.dlg && !dlg.active){ VOICE.dlg = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
  const mc = document.getElementById('missionchip'); if (mc && state === 'title') mc.hidden = true;
}
requestAnimationFrame(featuresFrame);

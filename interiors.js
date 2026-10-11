/* Walk-in buildings: walk up to any building's door and you're inside — no button needed. Every building has
   its own interior that fits what it is (a restaurant, a clinic, a video studio, a classroom…), a host who tells
   you about the place, and sofas and chairs you can sit on. Sitting down asks if you'd like a service.
   HQ's door opens the existing office (office.js). Interiors live far above the planet, like the office lives below. */

const INT_OFF = new THREE.Vector3(0, 3000, 0);
const iG = new THREE.Group(); iG.position.copy(INT_OFF); scene.add(iG);
let inBuilding = null, iW = 9, iD = 7, iPos = new THREE.Vector2(), iYaw = Math.PI, iHost = null, iNear = null;
const iBlocks = [], iSeats = [], iSpin = [], iBlink = [];
let lastExit = null, doorsReady = false;

/* ---------- which building gets which interior ---------- */
const SVC_THEME = { s1: 'war', s2: 'design', s3: 'content', s4: 'campaign', s5: 'video', s6: 'web', s7: 'ads', s8: 'lounge' };
const PLACE_THEME = { lab: 'lab', academy: 'academy', fly: 'terminal', gallery: 'gallery', careers: 'careers', cafe: 'cafe', observatory: 'observatory', lighthouse: 'lighthouse' };
const KIND_THEME = { resto: 'resto', clinic: 'clinic', kiosk: 'kiosk', glass: 'glass', shop: 'shop', office: 'office' };
const HOST_OF = { s1: 'emp-001', s2: 'emp-005', s3: 'emp-008', s4: 'emp-006', s5: 'emp-011', s6: 'emp-017', s7: 'emp-007', s8: 'emp-002',
  lab: 'emp-003', academy: 'emp-004', gallery: 'emp-018', careers: 'emp-024', cafe: 'emp-024', observatory: 'emp-001', lighthouse: 'emp-002' };
const NOT_A_ROOM = ['garden', 'fountain', 'monument', 'billboard'];
const themeOf = p => SVC_THEME[p.id] || PLACE_THEME[p.id] || (p.district ? KIND_THEME[DISTRICTS[p.district].kind] : null) || 'office';
const canEnter = p => p.id === 'hq' || (!NOT_A_ROOM.includes(p.kind) || SVC_THEME[p.id]);

/* each building's front door: buildings face their first road neighbour, and the door is on that side */
function prepDoors(){
  for (const p of pois){ const e = EDGES[ADJ[p.i][0]], nb = e[0] === p.i ? e[1] : e[0];
    const tan = poiDirs[nb].clone().sub(p.dir); tan.addScaledVector(p.dir, -tan.dot(p.dir)).normalize(); p.doorTan = tan; }
  doorsReady = true;
}
function doorCheck(){
  if (!doorsReady || state !== 'play' || riding || inBuilding || (typeof inOffice !== 'undefined' && inOffice) || (typeof inSpace !== 'undefined' && inSpace)) return;
  if (typeof passengerOf !== 'undefined' && passengerOf) return;
  for (const p of pois){ if (!canEnter(p)) continue;
    const d = pDir.angleTo(p.dir) * R;
    if (lastExit === p){ if (d > p.r + 3.2) lastExit = null; continue; }
    if (d > p.r + 0.9) continue;
    const off = pDir.clone().sub(p.dir); off.addScaledVector(p.dir, -off.dot(p.dir)).normalize();
    if (off.dot(p.doorTan) < Math.cos(0.75)) continue;                    // only the front, where the door is
    if (pFwd.dot(p.doorTan) > -0.2) continue;                             // walking towards the building, not away
    Sfx.open(); if (p.id === 'hq') return enterOffice(); return enterBuilding(p);
  }
}

/* ---------- a small furniture kit ---------- */
const iM = c => toon(c);
function B(w, h, d, c, x, y, z, ink = true, parent = iG){ const m = mesh(new THREE.BoxGeometry(w, h, d), c, ink ? 1 : 0); m.position.set(x, y, z); parent.add(m); return m; }
function C(rt, rb, h, c, x, y, z, seg = 12, ink = true, parent = iG){ const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, ink ? 1 : 0); m.position.set(x, y, z); parent.add(m); return m; }
const blk = (x0, z0, x1, z1) => iBlocks.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
const rotXZ = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
function grp(x, z, yaw = 0){ const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; iG.add(g); return g; }
function canvasTex(w, h, draw){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); const tx = new THREE.CanvasTexture(cv); draw(x, w, h, () => tx.needsUpdate = true); return tx; }
function iPlane(tex, w, h, x, y, z, ry = 0, parent = iG){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; }
function imgTex(src, w = 512, h = 384, bg = '#12153A'){ return canvasTex(w, h, (x, W, H, done) => { x.fillStyle = bg; x.fillRect(0, 0, W, H); const im = new Image();
  im.onload = () => { const s = Math.max(W / im.width, H / im.height); x.drawImage(im, W/2 - im.width*s/2, H/2 - im.height*s/2, im.width*s, im.height*s); done(); }; im.src = src; done(); }); }
function textTex(lines, { w = 512, h = 256, bg = '#12153A', fg = '#F4F7FC', accent = '#F2C94C', size = 40 } = {}){
  return canvasTex(w, h, (x, W, H, done) => { const paint = () => { x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = accent; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; const ls = lines.map(l => typeof l === 'string' ? l : t(l));
    ls.forEach((l, i) => { x.fillStyle = i ? fg : accent; x.font = `${i ? 600 : 800} ${i ? size * 0.72 : size}px IBM Plex Sans Arabic, sans-serif`; x.fillText(l, W/2, H/2 + (i - (ls.length - 1)/2) * size * 1.15, W - 30); }); done(); };
    paint(); langHooks.push(paint); }); }
// on the back wall (z = -D/2), the left wall (x = -W/2) or the right wall (x = +W/2)
const onBack = (tex, w, h, x, y) => iPlane(tex, w, h, x, y, -iD/2 + 0.08);
const onLeft = (tex, w, h, z, y) => iPlane(tex, w, h, -iW/2 + 0.08, y, z, Math.PI/2);
const onRight = (tex, w, h, z, y) => iPlane(tex, w, h, iW/2 - 0.08, y, z, -Math.PI/2);
function frameOn(where, src, w, h, a, y = 1.35){ const f = where === 'back' ? B(w + 0.12, h + 0.12, 0.05, 0xF2C94C, a, y, -iD/2 + 0.06, false) : B(0.05, h + 0.12, w + 0.12, 0xF2C94C, where === 'left' ? -iW/2 + 0.06 : iW/2 - 0.06, y, a, false);
  const tx = imgTex(src); return where === 'back' ? onBack(tx, w, h, a, y) : where === 'left' ? onLeft(tx, w, h, a, y) : onRight(tx, w, h, a, y); }
function chair(x, z, yaw, c = 0x2E6BA9, seat = true){ const g = grp(x, z, yaw);
  B(0.46, 0.08, 0.46, c, 0, 0.46, 0, true, g); B(0.46, 0.5, 0.07, c, 0, 0.72, -0.2, true, g);
  [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].forEach(([a, b]) => B(0.05, 0.44, 0.05, 0x2B2420, a, 0.22, b, false, g));
  blk(x - 0.26, z - 0.26, x + 0.26, z + 0.26); if (seat) iSeats.push({ x, z, yaw, h: 0.5 }); return g; }
function sofa(x, z, yaw, c = 0x2E6BA9, len = 1.9){ const g = grp(x, z, yaw), dk = new THREE.Color(c).multiplyScalar(0.8).getHex();
  B(len, 0.42, 0.8, c, 0, 0.24, 0.02, true, g); B(len, 0.75, 0.22, dk, 0, 0.5, -0.32, true, g);
  [-1, 1].forEach(s => B(0.2, 0.6, 0.8, dk, s * (len/2 + 0.08), 0.33, 0.02, true, g));
  [-1, 1].forEach(s => B(0.3, 0.26, 0.12, 0xF2C94C, s * len * 0.28, 0.6, -0.18, false, g));
  const [hx, hz] = rotXZ(len/2 + 0.2, 0.45, yaw), [hx2, hz2] = rotXZ(-len/2 - 0.2, -0.45, yaw); blk(x + hx, z + hz, x + hx2, z + hz2);
  for (const off of len > 1.4 ? [-len * 0.27, len * 0.27] : [0]){ const [ox, oz] = rotXZ(off, 0.06, yaw); iSeats.push({ x: x + ox, z: z + oz, yaw, h: 0.46 }); } return g; }
function table(x, z, w, d, c = 0x6B4227, h = 0.75, round = false){
  if (round){ C(w/2, w/2, 0.07, c, x, h, z, 20); C(0.06, 0.06, h, 0x2B2420, x, h/2, z, 8, false); C(0.3, 0.3, 0.04, 0x2B2420, x, 0.02, z, 12, false); blk(x - w/2, z - w/2, x + w/2, z + w/2); }
  else { B(w, 0.07, d, c, x, h, z); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => B(0.06, h, 0.06, 0x2B2420, x + a*(w/2 - 0.08), h/2, z + b*(d/2 - 0.08), false)); blk(x - w/2, z - d/2, x + w/2, z + d/2); } }
function plant(x, z, s = 1){ C(0.22*s, 0.17*s, 0.36*s, 0xC97B4A, x, 0.18*s, z, 10); for (let k = 0; k < 5; k++){ const l = mesh(new THREE.ConeGeometry(0.16*s, 0.7*s, 5), 0x5E9F5E); l.position.set(x + Math.cos(k*1.3)*0.08*s, 0.62*s, z + Math.sin(k*1.3)*0.08*s); l.rotation.z = Math.cos(k*1.3)*0.35; l.rotation.x = Math.sin(k*1.3)*0.35; iG.add(l); } blk(x - 0.25*s, z - 0.25*s, x + 0.25*s, z + 0.25*s); }
function monitor(x, y, z, yaw, tex, w = 0.6, h = 0.36){ const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; iG.add(g);
  B(w + 0.05, h + 0.05, 0.04, 0x12153A, 0, h/2 + 0.12, 0, false, g); B(0.05, 0.12, 0.05, 0x12153A, 0, 0.06, 0, false, g);
  iPlane(tex || canvasTex(64, 40, (c, W, H, d) => { const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2E6BA9'); gr.addColorStop(1, '#8FB4E3'); c.fillStyle = gr; c.fillRect(0, 0, W, H); d(); }), w, h, 0, h/2 + 0.12, 0.025, 0, g); return g; }
function desk(x, z, yaw = 0, c = 0xF4F7FC, withChair = true){ const g = grp(x, z, yaw); B(1.3, 0.06, 0.65, c, 0, 0.74, 0, true, g); B(0.06, 0.72, 0.6, 0xC9CED8, -0.6, 0.36, 0, false, g); B(0.06, 0.72, 0.6, 0xC9CED8, 0.6, 0.36, 0, false, g);
  g.add(monitor(0, 0.77, -0.15, 0, null));
  const [cx, cz] = rotXZ(0, 0.65, yaw), [a0, b0] = rotXZ(-0.68, -0.36, yaw), [a1, b1] = rotXZ(0.68, 0.36, yaw); blk(x + a0, z + b0, x + a1, z + b1);
  if (withChair) chair(x + cx, z + cz, yaw + Math.PI, 0x12153A); return g; }
function counter(x, z, w, c = 0xF4F7FC, top = 0x6B4227){ B(w, 0.95, 0.6, c, x, 0.48, z); B(w + 0.1, 0.06, 0.7, top, x, 0.98, z, false); blk(x - w/2, z - 0.32, x + w/2, z + 0.32); }
function shelf(x, z, yaw, w = 1.6, items = [0xE76F51, 0xF2C94C, 0x3E8E7E, 0x5FA0E6, 0xE9A0B8]){ const g = grp(x, z, yaw);
  B(w, 1.9, 0.38, 0x8A6A4A, 0, 0.95, 0, true, g); for (let r = 0; r < 4; r++){ B(w - 0.08, 0.04, 0.34, 0xB08A62, 0, 0.3 + r * 0.45, 0.02, false, g);
    for (let k = 0; k < 5; k++) B(0.16 + (k % 2) * 0.06, 0.26 + (k % 3) * 0.05, 0.22, items[(k + r) % items.length], -w/2 + 0.2 + k * (w - 0.3)/4.6, 0.46 + r * 0.45, 0.04, false, g); }
  const [a0, b0] = rotXZ(-w/2, -0.22, yaw), [a1, b1] = rotXZ(w/2, 0.22, yaw); blk(x + a0, z + b0, x + a1, z + b1); return g; }
function rug(x, z, w, d, c){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), iM(c)); m.rotation.x = -Math.PI/2; m.position.set(x, 0.015, z); iG.add(m); }
function pendant(x, z, c = 0xF2C94C){ C(0.01, 0.01, 0.35, 0x12153A, x, 2.45, z, 4, false); const s = mesh(new THREE.ConeGeometry(0.22, 0.2, 14, 1, true), c, 0); s.position.set(x, 2.22, z); iG.add(s);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFE2A0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(0.8); gl.position.set(x, 2.1, z); iG.add(gl); }
function whiteboard(where, a, notes = true){ const tx = canvasTex(512, 300, (x, W, H, d) => { x.fillStyle = '#FBFBF8'; x.fillRect(0, 0, W, H);
    if (notes){ const cols = ['#F2C94C', '#E9A0B8', '#8FB4E3', '#C9F0D2']; for (let i = 0; i < 12; i++){ x.fillStyle = cols[i % 4]; x.fillRect(30 + (i % 4) * 118, 26 + Math.floor(i / 4) * 90, 90, 70); x.fillStyle = 'rgba(18,21,58,.5)'; for (let l = 0; l < 3; l++) x.fillRect(40 + (i % 4) * 118, 44 + Math.floor(i / 4) * 90 + l * 14, 60 - l * 12, 4); } }
    x.strokeStyle = '#2E6BA9'; x.lineWidth = 5; x.beginPath(); x.moveTo(40, H - 30); x.bezierCurveTo(180, H - 120, 300, H - 20, 480, H - 140); x.stroke(); d(); });
  const w = 2.2, h = 1.3; return where === 'back' ? (B(w + 0.1, h + 0.1, 0.05, 0xC9CED8, a, 1.4, -iD/2 + 0.05, false), onBack(tx, w, h, a, 1.4)) : (B(0.05, h + 0.1, w + 0.1, 0xC9CED8, where === 'left' ? -iW/2 + 0.05 : iW/2 - 0.05, 1.4, a, false), where === 'left' ? onLeft(tx, w, h, a, 1.4) : onRight(tx, w, h, a, 1.4)); }
function chartTex(title){ return canvasTex(512, 300, (x, W, H, d) => { x.fillStyle = '#12153A'; x.fillRect(0, 0, W, H); x.fillStyle = '#F2C94C'; x.font = '800 30px IBM Plex Sans Arabic, sans-serif'; x.fillText(title, 24, 44);
  const v = [40, 62, 55, 90, 120, 150, 210]; v.forEach((h, i) => { x.fillStyle = ['#2E6BA9', '#5FA0E6', '#2EA87A'][i % 3]; x.fillRect(40 + i * 64, H - 30 - h, 40, h); });
  x.strokeStyle = '#E9A0B8'; x.lineWidth = 5; x.beginPath(); v.forEach((h, i) => { const px = 60 + i * 64, py = H - 40 - h * 1.05; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); d(); }); }
function codeTex(){ return canvasTex(256, 160, (x, W, H, d) => { x.fillStyle = '#0E1530'; x.fillRect(0, 0, W, H); const cols = ['#8FB4E3', '#F2C94C', '#E9A0B8', '#C9F0D2'];
  for (let r = 0; r < 11; r++){ let px = 10 + (r % 3) * 12; for (let k = 0; k < 4; k++){ const w = 14 + ((r * 7 + k * 13) % 40); x.fillStyle = cols[(r + k) % 4]; x.fillRect(px, 10 + r * 13, w, 6); px += w + 8; } } d(); }); }
function npcAt(x, z, yaw, k, opts){ const p = person(k, opts); p.position.set(x, 0, z); p.rotation.y = yaw; iG.add(p); blk(x - 0.3, z - 0.3, x + 0.3, z + 0.3); return p; }
function logoBoard(c, x, y, z, s = 1.2){ const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: logoTex(c) })); m.position.set(x, y, z); iG.add(m); return m; }

/* ---------- the rooms ---------- */
const THEMES = {
  resto(p){ const c = p.client; counter(-2.6, -iD/2 + 1.1, 2.6, 0xE76F51); B(0.36, 0.3, 0.3, 0x12153A, -3.3, 1.16, -iD/2 + 1.1); C(0.18, 0.18, 0.4, 0xC0C6D2, -2.0, 1.2, -iD/2 + 1.1);
    onBack(textTex([L('Menu', 'المنيو'), L('Grill · Shawarma · Salads', 'مشويات · شاورما · سلطات'), L('Fresh juices · Desserts', 'عصاير فريش · حلويات')], { bg: '#2B2420' }), 2.4, 1.2, -2.6, 1.85);
    [[1.0, -0.8], [3.0, -0.8], [1.0, 1.4], [3.0, 1.4], [-1.6, 1.4]].forEach(([x, z], i) => { table(x, z, 0.85, 0.85, 0x6B4227, 0.75, true); chair(x, z - 0.75, 0, [0xE76F51, 0xF2C94C][i % 2]); chair(x, z + 0.75, Math.PI, [0xE76F51, 0xF2C94C][i % 2]); pendant(x, z, 0xE76F51); });
    if (c) logoBoard(c, 2.0, 1.65, -iD/2 + 0.09, 1.3); plant(-iW/2 + 0.5, iD/2 - 0.6); return { host: [-2.6, -iD/2 + 0.5, 0], wall: 0xFBE3D3, floor: 0x9C6B48 }; },
  clinic(p){ const c = p.client; counter(-2.4, -iD/2 + 1.2, 2.4, 0xF4F7FC, 0x3E8E7E); if (c) logoBoard(c, -2.4, 1.75, -iD/2 + 0.09, 1.0);
    for (let k = 0; k < 4; k++) chair(-iW/2 + 0.6, -0.6 + k * 0.75, Math.PI/2, 0x3E8E7E);
    // the treatment corner: dental chair, lamp, cabinet
    const g = grp(2.7, -1.3, -0.6); B(0.6, 0.45, 1.5, 0xF4F7FC, 0, 0.35, 0, true, g); B(0.6, 0.12, 0.8, 0x3E8E7E, 0, 0.62, 0.2, true, g); const bk = B(0.6, 0.12, 0.8, 0x3E8E7E, 0, 0.85, -0.55, true, g); bk.rotation.x = 0.6;
    C(0.03, 0.03, 1.5, 0xC9CED8, 0.5, 0.75, -0.6, 6, false, g); C(0.16, 0.2, 0.08, 0xF4F7FC, 0.3, 1.5, -0.3, 12, true, g); blk(2.2, -2.1, 3.2, -0.5);
    B(0.7, 0.9, 0.45, 0xDCE2EE, iW/2 - 0.45, 0.45, -1.0); blk(iW/2 - 0.7, -1.3, iW/2, -0.7);
    onRight(textTex([L('Smile 😁', 'ابتسم 😁'), L('Check-ups every 6 months', 'كشف كل ٦ شهور')], { bg: '#3E8E7E' }), 1.6, 0.9, 1.4, 1.5); plant(iW/2 - 0.5, iD/2 - 0.6); plant(-iW/2 + 0.5, iD/2 - 0.6);
    return { host: [-2.4, -iD/2 + 0.55, 0], wall: 0xE8F4F1, floor: 0xDCE7E4 }; },
  kiosk(p){ const c = p.client; counter(0, -iD/2 + 1.2, 3.2, 0x5FA0E6); if (c) logoBoard(c, 0, 1.75, -iD/2 + 0.09, 1.1);
    ['Paris', 'Dubai', 'Istanbul', 'Maldives'].forEach((n, i) => onLeft(textTex(['✈️ ' + n, L('from 9,999 EGP', 'من ٩٬٩٩٩ ج')], { bg: ['#2E6BA9', '#E76F51', '#3E8E7E', '#8E6BC2'][i] }), 1.2, 0.8, -2.2 + i * 1.4, 1.45));
    const gl = C(0.05, 0.05, 0.8, 0x12153A, 2.6, 0.4, -1.4, 8, false); const globe = mesh(new THREE.SphereGeometry(0.45, 18, 12), 0x5FA0E6); globe.position.set(2.6, 1.25, -1.4); iG.add(globe); iSpin.push(globe); blk(2.2, -1.8, 3.0, -1.0);
    sofa(1.8, 1.6, Math.PI, 0x5FA0E6); B(0.5, 0.7, 0.3, 0xE76F51, -2.6, 0.35, 1.8); blk(-2.9, 1.6, -2.3, 2.0); plant(iW/2 - 0.5, -iD/2 + 0.6);
    return { host: [0, -iD/2 + 0.55, 0], wall: 0xE6F0FB, floor: 0xD9D2C4 }; },
  glass(p){ const c = p.client; [-2.4, 0, 2.4].forEach((x, i) => desk(x, -1.3, 0, 0xE6EEF7)); if (c) logoBoard(c, 0, 1.75, -iD/2 + 0.09, 1.1);
    C(0.5, 0.55, 0.7, 0xF4F7FC, -2.6, 0.35, 1.5, 16); for (let k = 0; k < 5; k++) B(0.18, 0.4 + k * 0.18, 0.18, [0x2E6BA9, 0x8FB4E3, 0xF4F7FC][k % 3], -2.8 + (k % 3) * 0.2, 0.9 + (0.2 + k * 0.09), 1.4 + (k % 2) * 0.2, true); blk(-3.1, 1.0, -2.1, 2.0);
    onRight(chartTex('ROI +38%'), 2.0, 1.2, 0, 1.55); sofa(1.6, 1.8, Math.PI, 0x6B4227); plant(-iW/2 + 0.5, -iD/2 + 0.6); plant(iW/2 - 0.5, -iD/2 + 0.6);
    return { host: [1.0, -iD/2 + 0.7, 0], wall: 0xEAF0F7, floor: 0x5E6F96 }; },
  shop(p){ const c = p.client; shelf(-iW/2 + 0.25, -1.2, Math.PI/2, 2.2); shelf(iW/2 - 0.25, -1.2, -Math.PI/2, 2.2); shelf(0, -iD/2 + 0.25, 0, 2.6);
    counter(2.0, 1.2, 1.6, 0xF2C94C); if (c){ logoBoard(c, 2.0, 1.25, 1.53, 0.5).rotation.y = 0; logoBoard(c, -2.0, 2.15, -iD/2 + 0.09, 0.9); }
    const mq = person(41, { shirt: 0xE9A0B8, logo: c ? logoTex(c) : undefined }); mq.position.set(-1.6, 0, 0.6); iG.add(mq); blk(-1.9, 0.3, -1.3, 0.9);
    chair(-2.8, 2.2, Math.PI/2, 0xE9A0B8); return { host: [2.0, 1.9, Math.PI], wall: 0xFFF4DD, floor: 0xE6DED2 }; },
  office(p){ const c = p.client; [-2.4, 0].forEach(x => desk(x, -1.4, 0, 0x6B4227)); shelf(iW/2 - 0.25, -1.0, -Math.PI/2, 2.4, [0x8E6BC2, 0x2E6BA9, 0xE76F51, 0x6B4227]);
    if (c) logoBoard(c, -1.2, 1.75, -iD/2 + 0.09, 1.0); sofa(-1.6, 1.8, Math.PI, 0x8E6BC2); table(-1.6, 0.9, 1.0, 0.5, 0x6B4227, 0.4); plant(iW/2 - 0.5, iD/2 - 0.6); plant(-iW/2 + 0.5, -iD/2 + 0.6);
    onLeft(textTex([L('Your rights, in plain words', 'حقك، بكلام بسيط'), '⚖️'], { bg: '#8E6BC2' }), 1.6, 0.9, 0.4, 1.5); return { host: [2.2, -iD/2 + 1.0, 0.3], wall: 0xF1ECF8, floor: 0xB58A62 }; },

  war(p){ table(0, -0.6, 3.0, 1.3, 0x6B4227); [-1, 0, 1].forEach(k => { chair(k * 0.9, -1.55, 0, 0x2E6BA9); chair(k * 0.9, 0.35, Math.PI, 0x2E6BA9); });
    whiteboard('back', -1.6); onBack(chartTex(t(L('Market map', 'خريطة السوق'))), 2.0, 1.2, 1.9, 1.45); onLeft(textTex([L('Who are we for?', 'إحنا لمين؟'), L('Why us, and not them?', 'ليه إحنا مش هم؟')], { bg: '#2E6BA9' }), 1.8, 1.0, 0, 1.45);
    plant(iW/2 - 0.5, iD/2 - 0.6); return { host: [2.9, -1.6, -0.6], wall: 0xEEF2FA, floor: 0xB58A62 }; },
  design(p){ [-2.4, 0].forEach(x => { const d = desk(x, -1.4, 0); B(0.4, 0.02, 0.3, 0x12153A, 0.3, 0.78, 0.12, false, d); });
    const sw = canvasTex(512, 256, (x, W, H, d) => { const cs = ['#E76F51', '#F2C94C', '#3E8E7E', '#2E6BA9', '#8E6BC2', '#E9A0B8', '#12153A', '#F4F7FC']; cs.forEach((c, i) => { x.fillStyle = c; x.fillRect(i * 64, 0, 64, H); }); d(); });
    onBack(sw, 2.6, 1.0, 1.8, 1.6); onLeft(imgTex('img/' + WORK[1].imgs[0]), 1.6, 1.1, -0.4, 1.45); onLeft(imgTex('img/' + WORK[2].imgs[0]), 1.1, 0.8, 1.6, 1.4);
    sofa(1.7, 1.6, Math.PI, 0xE76F51); C(0.35, 0.4, 0.4, 0xF2C94C, 3.2, 0.2, 0.3, 12); iSeats.push({ x: 3.2, z: 0.3, yaw: -Math.PI/2, h: 0.42 }); blk(2.85, -0.05, 3.55, 0.65); plant(-iW/2 + 0.5, iD/2 - 0.6);
    return { host: [2.6, -1.8, -0.4], wall: 0xFFF4EC, floor: 0x9C6B48 }; },
  content(p){ // filming corner: ring light + phone on tripod facing a sofa
    sofa(-2.0, -1.8, 0, 0xE9A0B8); const rl = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xFFFBEA })); rl.position.set(-2.0, 1.4, 0.4); iG.add(rl);
    C(0.02, 0.02, 1.4, 0x2B2420, -2.0, 0.7, 0.4, 6, false); B(0.1, 0.18, 0.02, 0x12153A, -2.0, 1.4, 0.38, false); blk(-2.2, 0.2, -1.8, 0.6);
    const cal = canvasTex(512, 320, (x, W, H, d) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#C9CED8'; for (let c = 0; c < 7; c++) for (let r = 0; r < 5; r++){ x.strokeRect(10 + c * 70, 10 + r * 60, 70, 60);
      if ((c + r * 2) % 3 === 0){ x.fillStyle = ['#F2C94C', '#E9A0B8', '#8FB4E3'][(c + r) % 3]; x.fillRect(16 + c * 70, 30 + r * 60, 58, 22); } } d(); });
    onBack(cal, 2.4, 1.5, 1.8, 1.5); desk(1.8, -1.0, 0); plant(iW/2 - 0.5, iD/2 - 0.6); return { host: [3.0, -1.9, -0.5], wall: 0xFFF0F5, floor: 0xDCD6CC }; },
  campaign(p){ WORK.slice(0, 3).forEach((w, i) => frameOn('back', 'img/' + w.imgs[0], 1.8, 1.2, -2.6 + i * 2.6, 1.45)); frameOn('left', 'img/' + WORK[3].imgs[0], 1.6, 1.1, 0.2);
    table(0.6, 0.4, 1.6, 0.9, 0xF4F7FC); [-0.2, 1.4].forEach(x => chair(x, 1.25, Math.PI, 0xE76F51)); sofa(-2.4, 1.8, Math.PI, 0x12153A); plant(iW/2 - 0.5, iD/2 - 0.6);
    return { host: [2.6, -1.2, -0.5], wall: 0xF7F2EA, floor: 0x7A6A9A }; },
  video(p){ const gs = B(3.2, 2.2, 0.05, 0x2EA87A, -1.8, 1.1, -iD/2 + 0.1, false); B(3.2, 0.02, 1.4, 0x2EA87A, -1.8, 0.02, -iD/2 + 0.8, false);
    [[-3.3, -1.4], [-0.3, -1.4]].forEach(([x, z]) => { C(0.02, 0.02, 1.6, 0x2B2420, x, 0.8, z, 6, false); const sb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.18), new THREE.MeshBasicMaterial({ color: 0xFFF6E0 })); sb.position.set(x, 1.65, z); sb.lookAt(-1.8 + INT_OFF.x, 1.2 + INT_OFF.y, -2.6 + INT_OFF.z); iG.add(sb); blk(x - 0.2, z - 0.2, x + 0.2, z + 0.2); });
    const cam = grp(-1.8, 0.2, Math.PI); [-0.15, 0.15].forEach(a => B(0.03, 1.1, 0.03, 0x2B2420, a, 0.55, 0, false, cam)); B(0.42, 0.24, 0.2, 0x1A1A1F, 0, 1.18, 0, true, cam); const rec = B(0.04, 0.04, 0.04, 0xFF3344, 0.15, 1.33, 0, false, cam); iBlink.push(rec); blk(-2.0, 0, -1.6, 0.4);
    const ed = desk(2.4, -1.4, 0, 0x12153A); ed.add(monitor(-0.45, 0.77, -0.15, 0.25, null)); chair(0.6, 1.4, -2.4, 0x12153A); iSeats.push({ x: 0.6, z: 1.4, yaw: -2.4, h: 0.5 });
    plant(iW/2 - 0.5, iD/2 - 0.6); return { host: [3.2, 0.4, -1.2], wall: 0x1F2440, floor: 0x3A3F5C }; },
  web(p){ [-2.6, -0.3].forEach(x => { const d = desk(x, -1.4, 0, 0xF4F7FC); d.add(monitor(0.4, 0.77, -0.1, -0.3, codeTex())); });
    const rack = B(0.7, 1.9, 0.6, 0x12153A, iW/2 - 0.45, 0.95, -1.8); for (let k = 0; k < 6; k++){ const l = B(0.04, 0.04, 0.04, [0x2EA87A, 0xF2C94C][k % 2], iW/2 - 0.8, 0.4 + k * 0.25, -1.65, false); iBlink.push(l); } blk(iW/2 - 0.8, -2.1, iW/2, -1.5);
    onBack(codeTex(), 1.8, 1.1, 2.0, 1.55); sofa(-1.4, 1.8, Math.PI, 0x2E6BA9); plant(-iW/2 + 0.5, iD/2 - 0.6); return { host: [1.8, 0.0, -2.4], wall: 0xEAF0F7, floor: 0x5E6F96 }; },
  ads(p){ onBack(chartTex(t(L('Live results', 'النتايج لايف'))), 3.2, 1.6, 0, 1.55); [-2.4, 2.4].forEach(x => desk(x, -0.9, 0)); [[-1.2, 1.6], [1.2, 1.6]].forEach(([x, z]) => { const g = grp(x, z, Math.PI);
      B(0.75, 0.42, 0.75, 0xF2C94C, 0, 0.24, 0, true, g); B(0.75, 0.75, 0.2, 0xD9AE33, 0, 0.45, -0.3, true, g); blk(x - 0.4, z - 0.4, x + 0.4, z + 0.4); iSeats.push({ x, z, yaw: Math.PI, h: 0.46 }); });
    table(0, 1.6, 0.8, 0.5, 0x6B4227, 0.4); plant(iW/2 - 0.5, -iD/2 + 0.6); return { host: [0, -1.6, 0], wall: 0xEEF2FA, floor: 0x7A6A9A }; },
  lounge(p){ rug(0, 0.6, 4.2, 2.8, 0x2E3557); sofa(0, 1.7, Math.PI, 0x2E6BA9, 2.4); sofa(-1.9, 0.5, Math.PI/2, 0x3E8E7E, 1.6); table(0, 0.6, 1.2, 0.6, 0x6B4227, 0.4);
    shelf(iW/2 - 0.25, -0.6, -Math.PI/2, 2.4); whiteboard('back', -1.2, false); onBack(textTex([L('One plan for the year', 'خطة واحدة للسنة'), L('Review · Plan · Train · Check in', 'مراجعة · خطة · تدريب · متابعة')], { bg: '#2E6BA9' }), 2.0, 1.0, 2.0, 1.5);
    plant(-iW/2 + 0.5, -iD/2 + 0.6); return { host: [1.6, -1.6, 0], wall: 0xF4EEE6, floor: 0x9C6B48 }; },
  lab(p){ table(-1.6, -1.4, 2.4, 0.8, 0xC9CED8, 0.9); for (let k = 0; k < 3; k++) B(0.3, 0.2 + k * 0.1, 0.3, [0x5FA0E6, 0xE76F51, 0x2EA87A][k], -2.4 + k * 0.8, 1.05 + k * 0.05, -1.4, true);
    const bot = grp(2.4, -1.2, -0.4); C(0.32, 0.4, 0.8, 0xF4F7FC, 0, 0.4, 0, 14, true, bot); const head = mesh(new THREE.SphereGeometry(0.34, 16, 12), 0xF4F7FC); head.position.y = 1.05; bot.add(head);
    const vis = B(0.42, 0.16, 0.1, 0x12153A, 0, 1.08, 0.28, false, bot); [-0.1, 0.1].forEach(a => { const e = B(0.06, 0.06, 0.02, 0x7FE8FF, a, 1.09, 0.34, false, bot); iBlink.push(e); }); iSpin.push(head); blk(2.0, -1.6, 2.8, -0.8);
    onBack(textTex([L('Sales CRM · AI Chatbot', 'سيستم مبيعات · شات بوت'), L('Built in-house', 'بنبنيه بنفسنا')], { bg: '#12153A' }), 2.2, 1.0, 0, 1.6); onLeft(chartTex('CRM'), 1.6, 1.0, 0.4, 1.5);
    sofa(1.4, 1.8, Math.PI, 0x8E6BC2); plant(-iW/2 + 0.5, iD/2 - 0.6); return { host: [0.6, -1.9, 0], wall: 0xECEFF8, floor: 0xC9C3BA }; },
  academy(p){ const brd = textTex([L('Planet Academy', 'أكاديمية Planet'), L('Marketing · Design · Motion · Editing', 'تسويق · تصميم · موشن · مونتاج')], { bg: '#1E3D33' }); B(3.4, 1.5, 0.05, 0x6B4227, 0, 1.45, -iD/2 + 0.05, false); onBack(brd, 3.2, 1.3, 0, 1.45);
    for (let r = 0; r < 2; r++) for (let c = -1; c <= 1; c++){ table(c * 1.8, -0.4 + r * 1.5, 1.0, 0.5, 0xB58A62, 0.7); chair(c * 1.8, 0.05 + r * 1.5, Math.PI, 0x3E8E7E); }
    plant(iW/2 - 0.5, -iD/2 + 0.6); return { host: [-2.9, -2.0, 0.4], wall: 0xF0F5EE, floor: 0xB58A62 }; },
  terminal(p){ const fly = CLIENTS.find(c => c.logo === 'fly29'); counter(-1.6, -iD/2 + 1.2, 3.0, 0x5FA0E6); if (fly) logoBoard(fly, -1.6, 1.8, -iD/2 + 0.09, 1.0);
    onBack(textTex(['DEPARTURES', 'CAI → DXB 18:40 ✓', 'CAI → IST 20:15 ✓'], { bg: '#0E1530', accent: '#F2C94C', fg: '#7FE8FF' }), 2.2, 1.2, 2.2, 1.65);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) chair(-2.6 + k * 0.65, 0.6 + r * 1.4, Math.PI, 0x2E6BA9);
    B(0.45, 0.65, 0.28, 0xE76F51, 2.6, 0.33, 1.2); blk(2.35, 1.0, 2.85, 1.4); plant(iW/2 - 0.5, iD/2 - 0.6); return { host: [-1.6, -iD/2 + 0.55, 0], client: fly, wall: 0xE6F0FB, floor: 0xDCD6CC }; },
  gallery(p){ WORK.slice(0, 3).forEach((w, i) => frameOn('back', 'img/' + w.imgs[0], 1.8, 1.25, -2.6 + i * 2.6)); WORK.slice(3, 5).forEach((w, i) => frameOn('left', 'img/' + w.imgs[0], 1.5, 1.05, -1.2 + i * 2.2)); WORK.slice(5, 7).forEach((w, i) => frameOn('right', 'img/' + w.imgs[0], 1.5, 1.05, -1.2 + i * 2.2));
    const bench = grp(0, 0.6, 0); B(2.0, 0.1, 0.5, 0x6B4227, 0, 0.45, 0, true, bench); [-0.8, 0.8].forEach(a => B(0.1, 0.42, 0.45, 0x2B2420, a, 0.21, 0, false, bench)); blk(-1.05, 0.3, 1.05, 0.9);
    iSeats.push({ x: -0.5, z: 0.6, yaw: 0, h: 0.5 }, { x: 0.5, z: 0.6, yaw: Math.PI, h: 0.5 }); return { host: [2.8, 1.6, -2.2], wall: 0xF7F4EE, floor: 0xDCD6CC }; },
  careers(p){ [-2.4, 0].forEach(x => desk(x, -1.4, 0)); onRight(textTex([L('Join us 🚀', 'انضم لينا 🚀'), L('Designers · Writers · Editors', 'مصممين · كتّاب · مونتيرين')], { bg: '#E76F51' }), 1.8, 1.0, -0.4, 1.5);
    sofa(-1.6, 1.8, Math.PI, 0xF2C94C); plant(iW/2 - 0.5, iD/2 - 0.6); return { host: [2.4, -1.8, -0.3], wall: 0xFFF4EC, floor: 0x9C6B48 }; },
  cafe(p){ counter(-2.2, -iD/2 + 1.1, 2.6, 0x6B4227, 0xF4F7FC); B(0.5, 0.55, 0.4, 0x12153A, -3.0, 1.28, -iD/2 + 1.1); C(0.08, 0.08, 0.12, 0xF4F7FC, -2.6, 1.07, -iD/2 + 1.0, 10, false);
    onBack(textTex([L('Studio Café', 'قهوة الاستوديو'), L('Turkish coffee · Tea · Latte', 'قهوة تركي · شاي · لاتيه')], { bg: '#2B2420' }), 2.4, 1.1, -2.2, 1.85);
    [[1.2, -0.9], [3.0, -0.9], [1.2, 1.3], [3.0, 1.3]].forEach(([x, z], i) => { table(x, z, 0.75, 0.75, 0xF4F7FC, 0.75, true); chair(x - 0.7, z, Math.PI/2, 0x6B4227); chair(x + 0.7, z, -Math.PI/2, 0x6B4227); pendant(x, z, 0xF2C94C); });
    sofa(-2.4, 1.8, Math.PI, 0xB23A76); plant(-iW/2 + 0.5, -0.4); return { host: [-2.2, -iD/2 + 0.5, 0], wall: 0xF6EBDD, floor: 0x9C6B48 }; },
  observatory(p){ const sky = canvasTex(512, 300, (x, W, H, d) => { x.fillStyle = '#0A0F26'; x.fillRect(0, 0, W, H); for (let i = 0; i < 160; i++){ x.fillStyle = `rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      x.strokeStyle = '#F2C94C'; x.lineWidth = 2; x.beginPath(); [[60, 80], [140, 60], [210, 110], [300, 90], [380, 150]].forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); d(); });
    onBack(sky, 3.6, 1.7, 0, 1.45); onLeft(sky, 2.4, 1.3, 0, 1.45);
    const sc = grp(0.6, -0.8, 0.4); [-0.25, 0, 0.25].forEach((a, i) => { const l = B(0.04, 0.9, 0.04, 0x2B2420, a, 0.45, i === 1 ? -0.2 : 0.12, false, sc); }); const tube = C(0.12, 0.16, 1.4, 0xF4F7FC, 0, 1.1, 0, 14, true, sc); tube.rotation.x = -0.8; blk(0.2, -1.2, 1.0, -0.4);
    [[-2.2, 1.4], [2.2, 1.4]].forEach(([x, z]) => { const g = grp(x, z, Math.PI); B(0.75, 0.42, 0.75, 0x2E3557, 0, 0.24, 0, true, g); B(0.75, 0.75, 0.2, 0x1E2440, 0, 0.45, -0.3, true, g); blk(x - 0.4, z - 0.4, x + 0.4, z + 0.4); iSeats.push({ x, z, yaw: Math.PI, h: 0.46 }); });
    return { host: [2.6, -1.6, -0.5], wall: 0x2A3157, floor: 0x3A3F5C }; },
  lighthouse(p){ WORK.slice(4, 8).forEach((w, i) => frameOn(i < 2 ? 'back' : 'right', 'img/' + w.imgs[0], 1.3, 0.9, i < 2 ? -1.6 + i * 3.2 : -1.0 + (i - 2) * 2.0));
    const lampG = grp(-2.6, -1.6); C(0.25, 0.35, 0.9, 0xE76F51, 0, 0.45, 0, 12, true, lampG); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: 0xFFF1B0 })); bulb.position.y = 1.15; lampG.add(bulb);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFE38A, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(2.4); gl.position.y = 1.15; lampG.add(gl); blk(-3.0, -2.0, -2.2, -1.2);
    sofa(0, 1.7, Math.PI, 0x2E6BA9, 2.2); table(0, 0.7, 1.0, 0.5, 0x6B4227, 0.4); onLeft(textTex([L('Our story', 'حكايتنا'), L('Since day one: plan it, then make it', 'من أول يوم: خطّط، ونفّذ')], { bg: '#E76F51' }), 1.8, 1.0, 0.5, 1.5);
    return { host: [1.8, -1.8, -0.3], wall: 0xEDF3F8, floor: 0xB58A62 }; },
};

/* ---------- building the room ---------- */
function clearRoom(){
  while (iG.children.length){ const o = iG.children.pop(); o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map && c.material.map.isCanvasTexture) c.material.map.dispose(); }); }
  iBlocks.length = iSeats.length = iSpin.length = iBlink.length = 0;
}
function buildRoom(p){
  clearRoom(); const theme = themeOf(p);
  iW = 9; iD = 7;
  const out = (THEMES[theme] || THEMES.office)(p) || {};
  const wallC = out.wall || 0xF3EFE8, accent = p.district ? DISTRICTS[p.district].color : 0x2E6BA9;
  // floor, walls and the low front wall with the door gap
  const fl = new THREE.Mesh(new THREE.BoxGeometry(iW, 0.1, iD), iM(out.floor || 0xDCD6CC)); fl.position.y = -0.05; iG.add(fl);
  const under = new THREE.Mesh(new THREE.BoxGeometry(iW + 0.6, 0.3, iD + 0.6), iM(0x2E3557)); under.position.y = -0.25; iG.add(under);
  B(iW, 2.6, 0.15, wallC, 0, 1.3, -iD/2); B(0.15, 2.6, iD, wallC, -iW/2, 1.3, 0); B(0.15, 2.6, iD, wallC, iW/2, 1.3, 0);
  B(iW, 0.12, 0.17, accent, 0, 2.55, -iD/2, false); B(0.17, 0.12, iD, accent, -iW/2, 2.55, 0, false); B(0.17, 0.12, iD, accent, iW/2, 2.55, 0, false);
  B(iW, 0.1, 0.17, 0xB9AE9E, 0, 0.05, -iD/2 + 0.01, false);
  const half = (iW - 1.8) / 2; [-1, 1].forEach(s => B(half, 0.5, 0.15, wallC, s * (0.9 + half/2), 0.25, iD/2));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.6), new THREE.MeshBasicMaterial({ color: 0xF2C94C, transparent: true, opacity: 0.7 })); glow.position.set(0, 0.02, iD/2 - 0.1); iG.add(glow);
  // the name of the place over the back wall
  const nm = textTex([p.name], { w: 768, h: 128, bg: '#12153A', size: 64 }); iPlane(nm, 3.2, 0.53, 0, 2.25, -iD/2 + 0.1);
  // lights
  const l = new THREE.PointLight(0xFFF1D6, 0.75, 20); l.position.set(0, 4, 1); iG.add(l);
  const l2 = new THREE.PointLight(0xFFE2B0, 0.35, 10); l2.position.set(-2.5, 2.4, -1.5); iG.add(l2);
  // the host who tells you about the place
  const [hx, hz, hy] = out.host || [0, -iD/2 + 1, 0]; let host;
  const mid = HOST_OF[p.id], m = mid && TEAM.find(x => x.id === mid);
  if (m){ const n = parseInt(m.id.slice(4)); host = person(n * 3, { face: faceTex(m.photo), look: [2,5,6,7,8,9,10,14,17,19,21,22,24].includes(n) ? (n % 2 ? 3 : 5) : [0, 4, 1][n % 3], logo: logoTex(PLANET_C) }); }
  else { const c = out.client || p.client; host = person(p.i * 7 + 5, { shirt: accent, logo: logoTex(c || PLANET_C) }); }
  host.position.set(hx, 0, hz); host.rotation.y = hy; iG.add(host); blk(hx - 0.3, hz - 0.3, hx + 0.3, hz + 0.3);
  const cn = (out.client || p.client || { name: p.name }).name;
  const tag = crewTag(m || { name: L(`Welcome to ${cn.en}`, `أهلاً في ${cn.ar}`), title: L('Your host here', 'المضيف هنا') });
  tag.position.set(hx, 2.35, hz); tag.visible = false; iG.add(tag);
  iHost = { g: host, x: hx, z: hz, m, tag, p, theme };
}

/* ---------- the host's words and the call to action ---------- */
function hostLines(h){
  const p = h.p, m = h.m, c = p.client || (h.theme === 'terminal' ? CLIENTS.find(x => x.logo === 'fly29') : null);
  if (m){ const intro = L(`Welcome to ${p.name.en}! I'm ${m.name.en}, ${m.title.en}.`, `أهلاً بيك في ${p.name.ar}! أنا ${m.name.ar}، ${m.title.ar}.`);
    return [intro, ...(p.lines || []).slice(0, 3)]; }
  if (c) return [L(`Welcome to ${c.name.en}! Make yourself at home.`, `أهلاً بيك في ${c.name.ar}! البيت بيتك.`),
    L(`We work with Planet on our marketing — the look, the content and the ads you've seen around the planet.`, `إحنا شغالين مع Planet في التسويق — الشكل والمحتوى والإعلانات اللي شفتها في الكوكب.`),
    L('Have a look around, and grab a seat if you like.', 'اتفرّج براحتك، واقعد لو حابب.')];
  return [L(`Welcome to ${p.name.en}!`, `أهلاً بيك في ${p.name.ar}!`), ...(p.lines || []).slice(0, 2)];
}
function hostCta(h){
  const p = h.p, c = p.client, svc = p.svc ? p.id : null;
  const list = [];
  if (c) list.push({ label: L(`🖼️ See our work for ${c.name.en}`, `🖼️ شوف شغلنا مع ${c.name.ar}`), act: () => openExhibit('client', c.logo || c.name.en) });
  else if (svc) list.push({ label: L('📋 What do I get?', '📋 هاخد إيه؟'), act: () => openExhibit('service', svc) });
  else { const e = exhibitFor(p); if (e) list.push({ label: L('👀 Show me more', '👀 وريني أكتر'), act: e }); }
  list.push({ label: L('📝 Start my brief', '📝 ابدأ بريفي'), cls: 'ghost', act: () => { if (svc && !brief.svcs.includes(svc)){ brief.svcs.push(svc); brief.wants[svc] = SERVICE_GETS[svc].map((_, k) => k); } brief.step = 0; openExhibit('brief'); } });
  list.push({ label: L('💬 WhatsApp', '💬 واتساب'), cls: 'wa', act: () => window.open('https://wa.me/201203101104?text=' + encodeURIComponent(t(L(`Hi Planet 👋 I was just inside ${p.name.en} on your planet.`, `أهلاً Planet 👋 لسه كنت جوه ${p.name.ar} في الكوكب بتاعكم.`))), '_blank', 'noopener') });
  return list;
}
function hostTalk(){
  const h = iHost; if (!h) return;
  const p = h.p;
  if (p.svc && !p.done) return interact({ kind: 'poi', ref: p });   // the delivery happens here too
  talk(h.m ? h.m.name : (p.client ? p.client.name : p.name), hostLines(h), true, null, hostCta(h));
}

/* ---------- entering and leaving ---------- */
function enterBuilding(p){
  buildRoom(p); inBuilding = p; iPos.set(0, iD/2 - 0.9); iYaw = Math.PI;
  $('compass').hidden = true; clouds.visible = false; nightStars.visible = false; releaseAll();
  camera.position.copy(INT_OFF).add(new THREE.Vector3(0, 9, 10));
  mini(lang === 'ar' ? `🚪 دخلت ${t(p.name)}` : `🚪 You're inside ${t(p.name)}`);
}
function exitBuilding(){
  const p = inBuilding; standUp(); inBuilding = null; clearRoom(); iHost = null;
  $('compass').hidden = false; clouds.visible = true; applyDayNight();
  pDir.copy(p.dir).addScaledVector(p.doorTan, (p.r + 2.4) / R).normalize(); pFwd.copy(p.doorTan); camFwd.copy(p.doorTan);
  lastExit = p; Sfx.close(); mini(lang === 'ar' ? '🌍 رجعت للكوكب' : '🌍 Back on the planet');
}

/* ---------- sitting down ---------- */
let sitting = null, legBones = null;
function findLegs(){ if (legBones !== null) return legBones; const b = {}; rig.traverse(o => { if (o.isBone && ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'Hips'].includes(o.name)) b[o.name] = o; }); legBones = b.LeftUpLeg ? b : false; return legBones; }
function sitDown(seat, where){
  sitting = { ...seat, where }; Sfx.click(); releaseAll(); $('prompt').hidden = true; showSitBubble();
}
function standUp(){ if (!sitting) return; sitting = null; rig.position.y = 0; const b = $('sitbubble'); if (b) b.hidden = true; if (proc.legL){ proc.legL.rotation.x = proc.legR.rotation.x = 0; } }
function applySitPose(){
  const legs = findLegs();
  if (legs){ legs.LeftUpLeg.rotateX(-1.45); legs.RightUpLeg.rotateX(-1.45); legs.LeftLeg.rotateX(1.45); legs.RightLeg.rotateX(1.45); }
  else if (proc.legL){ proc.legL.rotation.x = proc.legR.rotation.x = -1.45; }
  rig.position.y = -0.42 + sitting.h * 0.0;   // hips drop onto the seat
}
function sitBubbleEl(){
  let b = $('sitbubble'); if (b) return b;
  b = document.createElement('div'); b.id = 'sitbubble'; b.className = 'panel'; b.hidden = true; document.body.appendChild(b); return b;
}
function showSitBubble(){
  const b = sitBubbleEl(), ar = lang === 'ar';
  const svcs = POIS.filter(p => p.svc);
  b.innerHTML = `<b>${ar ? 'تحب تطلب خدمة معيّنة؟ ☕' : 'Would you like a particular service? ☕'}</b>
    <div class="sb-chips">${svcs.map(s => `<button type="button" data-s="${s.id}">${t(s.name)}</button>`).join('')}</div>
    <div class="sb-row"><button type="button" data-a="rest">${ar ? 'لأ، بستريح شوية 😌' : 'No, just resting 😌'}</button><button type="button" data-a="up">${ar ? 'قوم 🚶' : 'Stand up 🚶'}</button></div>`;
  b.hidden = false;
  b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { const svc = x.dataset.s; if (!brief.svcs.includes(svc)){ brief.svcs.push(svc); brief.wants[svc] = SERVICE_GETS[svc].map((_, k) => k); } brief.step = 0; b.hidden = true; Sfx.click(); openExhibit('brief'); });
  b.querySelector('[data-a="rest"]').onclick = () => { b.hidden = true; Sfx.click(); mini(ar ? '😌 خد راحتك — اتحرك وقت ما تحب تقوم' : '😌 Take your time — move whenever you want to get up'); };
  b.querySelector('[data-a="up"]').onclick = () => standUp();
}
const _hv = new THREE.Vector3();
function placeSitBubble(){
  const b = $('sitbubble'); if (!b || b.hidden || !sitting) return;
  _hv.copy(player.position).add(new THREE.Vector3(0, 1.7, 0)).project(camera);
  const x = (_hv.x * 0.5 + 0.5) * (canvas.clientWidth || innerWidth), y = (-_hv.y * 0.5 + 0.5) * (canvas.clientHeight || innerHeight);
  b.style.left = Math.max(10, Math.min(innerWidth - b.offsetWidth - 10, x - b.offsetWidth / 2)) + 'px'; b.style.top = Math.max(innerWidth < 700 ? 64 : 10, y - b.offsetHeight - 14) + 'px';
}

/* the office has seats too: the reception sofa, the management sofa and armchairs, the coffee stools */
const OFFICE_SEATS = [
  { x: 10.1, y: 8.0, yaw: -Math.PI/2, h: 0.46 }, { x: 10.1, y: 8.8, yaw: -Math.PI/2, h: 0.46 },
  { x: 12.15, y: 8.6, yaw: Math.PI/2, h: 0.46 }, { x: 12.15, y: 9.6, yaw: Math.PI/2, h: 0.46 },
  { x: 14.5, y: 8.4, yaw: -Math.PI/2, h: 0.46 }, { x: 14.5, y: 9.8, yaw: -Math.PI/2, h: 0.46 },
  { x: 4.6, y: 2.95, yaw: Math.PI, h: 0.66 }, { x: 5.6, y: 2.95, yaw: Math.PI, h: 0.66 }, { x: 6.6, y: 2.95, yaw: Math.PI, h: 0.66 },
];

/* ---------- inside: walking, the host, the seats ---------- */
const _iw = new THREE.Vector3();
function iPush(p, rad = 0.28){
  for (const [x0, z0, x1, z1] of iBlocks){ const cx = clamp(p.x, x0, x1), cz = clamp(p.y, z0, z1), dx = p.x - cx, dz = p.y - cz, d = Math.hypot(dx, dz);
    if (d < rad){ if (d < 1e-6){ const l = p.x - x0, r = x1 - p.x, tp = p.y - z0, bt = z1 - p.y, m = Math.min(l, r, tp, bt); if (m === l) p.x = x0 - rad; else if (m === r) p.x = x1 + rad; else if (m === tp) p.y = z0 - rad; else p.y = z1 + rad; }
      else { p.x = cx + dx / d * rad; p.y = cz + dz / d * rad; } } }
  p.x = clamp(p.x, -iW/2 + 0.35, iW/2 - 0.35); p.y = clamp(p.y, -iD/2 + 0.35, iD/2 + 0.2);
}
function interiorFrame(dt, now){
  if (!inBuilding) return false;
  scene.background.set(0x10143A); scene.fog.near = 40; scene.fog.far = 140;
  const ts = now / 1000;
  const [ix, iy, mag] = state === 'play' ? inputVector() : [0, 0, 0];
  if (sitting && mag > 0.3) standUp();
  let moving = false;
  if (!sitting && mag > 0.08){
    _iw.set(ix, 0, -iy).normalize();
    const sp = (keys.ShiftLeft || keys.ShiftRight || runToggle ? 4.0 : 2.6) * mag * dt;
    const before = iPos.clone(); iPos.x += _iw.x * sp; iPos.y += _iw.z * sp; iPush(iPos); iPush(iPos);
    moving = iPos.distanceTo(before) > 0.002;
    const want = Math.atan2(_iw.x, _iw.z); let dA = want - iYaw; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); iYaw += dA * (1 - Math.exp(-14 * dt));
    if (moving && Math.sin(ts * 9) > 0.96) Sfx.step(false, false);
  }
  if (iPos.y > iD/2 + 0.05 && Math.abs(iPos.x) < 0.9){ exitBuilding(); return false; }
  if (sitting){ player.position.copy(INT_OFF).add(new THREE.Vector3(sitting.x, 0, sitting.z)); player.quaternion.setFromEuler(new THREE.Euler(0, sitting.yaw, 0)); }
  else { player.position.copy(INT_OFF).add(new THREE.Vector3(iPos.x, 0, iPos.y)); player.quaternion.setFromEuler(new THREE.Euler(0, iYaw, 0)); }
  shadow.position.copy(player.position).add(new THREE.Vector3(0, 0.07, 0)); shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)); shadow.scale.setScalar(1);
  if (mixer){ walkAction.timeScale = moving ? 1.2 : 0; if (!moving){ let d = idleTime - walkAction.time; d -= Math.round(d/clipDur)*clipDur; walkAction.time += d * (1 - Math.exp(-10*dt)); } mixer.update(dt); }
  rig.position.y = moving ? 0 : Math.sin(now * 0.0022) * 0.012;
  if (sitting) applySitPose();
  const target = player.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  camera.position.lerp(target.clone().add(new THREE.Vector3(0.8, 6.2, 6.8)), 1 - Math.exp(-4 * dt)); camera.up.set(0, 1, 0); camera.lookAt(target);
  for (const s of iSpin) s.rotation.y += dt * 0.6;
  for (const b of iBlink) b.visible = Math.sin(ts * 4 + b.id) > -0.2;
  // the host turns towards you and waves
  const h = iHost, hd = h ? Math.hypot(h.x - iPos.x, h.z - iPos.y) : 99;
  if (h){ animatePerson(h.g, 0, hd < 3, ts); if (hd < 4){ const want = Math.atan2(iPos.x - h.x, iPos.y - h.z); let dA = want - h.g.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); h.g.rotation.y += dA * (1 - Math.exp(-5 * dt)); } h.tag.visible = hd < 2.6; }
  if (state === 'play'){
    let best = null, bd = 1.0;
    if (!sitting) for (const s of iSeats){ const d = Math.hypot(s.x - iPos.x, s.z - iPos.y); if (d < bd){ bd = d; best = s; } }
    near = hd < 2.0 ? { kind: 'ihost' } : best ? { kind: 'seat', ref: best, where: 'b' } : null;
    $('prompt').hidden = !near;
    if (near) $('promptText').textContent = near.kind === 'ihost' ? `${t(UI.talk)} ${t(h.m ? h.m.name : L('the host', 'المضيف'))}` : (lang === 'ar' ? '🛋️ اقعد هنا' : '🛋️ Sit down');
  } else $('prompt').hidden = true;
  placeSitBubble();
  return true;
}

/* ---------- wiring into the game ---------- */
const plainInteract = interact;
interact = function(tk){
  if (tk.kind === 'ihost') return hostTalk();
  if (tk.kind === 'seat') return sitDown(tk.ref, tk.where);
  return plainInteract(tk);
};
const plainOfficeFrame = officeFrame;
officeFrame = function(dt, now){
  if (interiorFrame(dt, now)) return true;
  if (!inOffice) return plainOfficeFrame(dt, now);
  if (sitting && sitting.where === 'o'){ const [, , mag] = state === 'play' ? inputVector() : [0, 0, 0]; if (mag > 0.3) standUp(); else { oPos.set(sitting.x, sitting.z); } }
  const r = plainOfficeFrame(dt, now);
  if (!inOffice){ standUp(); return r; }
  if (sitting && sitting.where === 'o'){ player.quaternion.setFromEuler(new THREE.Euler(0, sitting.yaw, 0)); applySitPose(); $('prompt').hidden = true; }
  else if (state === 'play' && !(near && near.kind === 'emp')){
    let best = null, bd = 0.95; for (const s of OFFICE_SEATS){ const d = Math.hypot(s.x - oPos.x, s.y - oPos.y); if (d < bd){ bd = d; best = s; } }
    if (best){ near = { kind: 'seat', ref: { x: best.x, z: best.y, yaw: best.yaw, h: best.h }, where: 'o' }; $('prompt').hidden = false; $('promptText').textContent = lang === 'ar' ? '🛋️ اقعد هنا' : '🛋️ Sit down'; }
  }
  placeSitBubble();
  return r;
};
if (typeof myState === 'function'){ const plainMyState = myState; myState = function(){ const s = plainMyState(); if (s && inBuilding) return { i: s.i, n: s.n, c: s.c, k: s.k, a: s.a, w: 'b', b: inBuilding.id, o: [+(sitting ? sitting.x : iPos.x).toFixed(2), +(sitting ? sitting.z : iPos.y).toFixed(2), +(sitting ? sitting.yaw : iYaw).toFixed(2)] }; return s; }; }
(function waitDoors(){ if (state === 'loading' || !pois.length) return setTimeout(waitDoors, 400); prepDoors(); })();
(function doorLoop(){ requestAnimationFrame(doorLoop); doorCheck(); })();

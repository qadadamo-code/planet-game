/* Inside Planet HQ — the real office layout, walkable. Rooms, doors and seats follow the studio's floor plan
   (metres; x → right, y → down, as drawn). Every employee sits at their place and talks in their own role. */

const OFF = new THREE.Vector3(0, -3000, 0);   // the office lives far below the planet; we teleport in
const PW = 19, PH = 13.4;                       // plan size in metres
const ROOMS = [
  { id: 'back',    r: [0, 0, 2.8, 10.5],    c: 0x8E6BC2, n: L("Back corridor", "ممر خلفي") },
  { id: 'bath1',   r: [2.8, 0, 8.5, 1.9],   c: 0x2BB3C6, n: L("Restroom", "حمام خارجي") },
  { id: 'kitchen', r: [2.8, 1.9, 8.5, 5.7], c: 0xE05A5A, n: L("Kitchen", "مطبخ") },
  { id: 'meeting', r: [8.5, 0, 12.3, 3.8],  c: 0x2EA87A, n: L("Meeting room", "غرفة الاجتماعات") },
  { id: 'inner',   r: [12.3, 0, 19, 3.8],   c: 0x7B5CD6, n: L("Inner team room", "غرفة موظفين داخلي") },
  { id: 'hall',    r: [8.5, 3.8, 14.3, 5.7],c: 0xE0A23A, n: L("Rooms corridor", "ممر الغرف") },
  { id: 'mgmt',    r: [14.3, 3.8, 19, 10.5],c: 0xD94C93, n: L("Management", "غرفة الإدارة") },
  { id: 'outer',   r: [2.8, 5.7, 9.1, 10.5],c: 0x5C6B8A, n: L("Outer team room", "غرفة موظفين خارجية") },
  { id: 'recep',   r: [9.1, 5.7, 11.4, 10.5],c: 0xD06AB0, n: L("Reception", "ممر الاستقبال") },
  { id: 'bath2',   r: [11.4, 5.7, 14.3, 10.5],c: 0x3E7BE0, n: L("Management restroom", "حمام الإدارة") },
  { id: 'entry',   r: [0, 10.5, 19, 13.4],  c: 0x3E7BE0, n: L("Entrance & corridor", "مدخل الشركة + الممر") },
];
/* door openings: [x0, y0, x1, y1] on a wall line */
const DOORS = [
  [6.9, 1.9, 8.2, 1.9],   // restroom ↔ kitchen
  [9.0, 3.8, 10.3, 3.8],  // corridor ↔ meeting
  [12.8, 3.8, 14.0, 3.8], // corridor ↔ inner room
  [14.3, 4.0, 14.3, 5.5], // corridor ↔ management
  [14.3, 6.3, 14.3, 7.6], // management ↔ its restroom
  [9.3, 5.7, 11.2, 5.7],  // reception ↔ corridor
  [9.1, 7.0, 9.1, 8.5],   // reception ↔ outer room
  [7.0, 5.7, 8.3, 5.7],   // outer room ↔ kitchen
  [2.8, 3.2, 2.8, 4.4],   // kitchen ↔ back corridor
  [0.3, 10.5, 2.5, 10.5], // back corridor ↔ entrance
  [9.6, 10.5, 11.0, 10.5],// entrance ↔ reception
  [19, 11.3, 19, 12.7],   // the front door (walk out here)
];
/* who sits where (plan metres), and which way they face */
const SEATS = [
  ['emp-024', 3.7, 2.8],                                                            // Aya Arabi — kitchen
  ['emp-019', 13.0, 0.9], ['emp-012', 14.2, 0.9], ['emp-011', 13.0, 2.0], ['emp-018', 14.2, 2.0],   // inner room
  ['emp-020', 16.8, 0.9], ['emp-023', 17.9, 0.9], ['emp-013', 16.8, 2.0], ['emp-008', 17.9, 2.0],
  ['emp-006', 4.0, 6.7], ['emp-021', 4.0, 7.8], ['emp-010', 4.0, 8.9],             // outer room
  ['emp-009', 5.4, 6.7], ['emp-014', 5.4, 7.8], ['emp-017', 5.4, 8.9],
  ['emp-002', 7.9, 6.6], ['emp-003', 7.9, 9.1],
  ['emp-001', 17.2, 8.6],                                                           // Mohammed Qadada — management
  ['emp-005', 9.6, 1.4], ['emp-004', 11.2, 1.4], ['emp-022', 9.6, 2.7], ['emp-007', 11.2, 2.7],      // meeting room
  ['emp-015', 1.4, 3.0], ['emp-016', 1.4, 6.0],                                     // shoot crew by the back door
];
const WELCOME = {
  entry:   L("Welcome to Planet! Reception is straight ahead; management is through the corridor on the right.", "أهلاً بيك في Planet! الاستقبال قدامك، والإدارة من الممر على اليمين."),
  recep:   L("Reception: say hi — every room is open to you.", "الاستقبال: أهلاً وسهلاً — كل الأوض مفتوحة ليك."),
  outer:   L("The outer team room: accounts, content and design work side by side here.", "غرفة الموظفين الخارجية: الحسابات والمحتوى والتصميم شغالين جنب بعض هنا."),
  inner:   L("The inner room: motion, video, design and finance — the people who make it real.", "الغرفة الداخلية: الموشن والمونتاج والتصميم والمالية — الناس اللي بتحوّل الفكرة لحقيقة."),
  meeting: L("The meeting room — this is where your brief becomes a plan.", "غرفة الاجتماعات — هنا البريف بتاعك بيتحوّل لخطة."),
  mgmt:    L("Management: tell us about your project — we'll answer the same day.", "الإدارة: احكيلنا عن مشروعك — هنرد عليك في نفس اليوم."),
  kitchen: L("The kitchen ☕ — coffee is on us.", "المطبخ ☕ — القهوة علينا."),
  hall:    L("Rooms corridor: meeting room ahead, team room and management on the right.", "ممر الغرف: الاجتماعات قدامك، وغرفة الفريق والإدارة على اليمين."),
  back:    L("Back corridor — the shoot crew loads gear here.", "الممر الخلفي — فريق التصوير بيجهّز معداته هنا."),
};

/* each person speaks in the voice of their job */
function crewLines(m){
  const ar = lang === 'ar', nm = t(m.name), first = nm.split(' ')[0], d = m.dept;
  const S = {
    management: [L(`Hello and welcome! I'm ${m.name.en}, ${m.title.en}.`, `أهلاً وسهلاً! أنا ${m.name.ar}، ${m.title.ar}.`),
                 L("My job is to make sure your project has one plan, one team and one person you can always reach.", "شغلي إن مشروعك يكون ليه خطة واحدة، وفريق واحد، وشخص واحد تقدر توصله دايماً.")],
    account_management: [L(`Hi! ${first} from accounts 😊`, `أهلاً! ${first} من فريق الحسابات 😊`),
                 L("I'll be your daily contact: I gather what you need, follow up with the team and keep you posted every step.", "هكون حلقة الوصل اليومية معاك: بجمع اللي محتاجه، وبتابع مع الفريق، وبطمّنك في كل خطوة.")],
    content: [L(`Hey! I'm ${first}, I write ✍️`, `هاي! أنا ${first}، بكتب ✍️`),
                 L("I'll learn how your customers talk, then write your posts, captions and scripts in Arabic and English.", "هتعلّم عملاءك بيتكلموا إزاي، وبعدين أكتب بوستاتك وكابشناتك وسكريبتاتك بالعربي والإنجليزي.")],
    graphic_design: [L(`Hi, ${first} — design 🎨`, `هاي، ${first} — تصميم 🎨`),
                 L("I'll turn the idea into posts, carousels and visuals that look like you and stop the scroll.", "هحوّل الفكرة لبوستات وكاروسيل وتصاميم شبهك وبتوقّف السكرول.")],
    motion: [L(`Yo! ${first}, motion & video 🎬`, `أهلاً! ${first}، موشن وفيديو 🎬`),
                 L("I make things move: animated logos, reels and short videos that hold attention.", "أنا اللي بخلّي الحاجات تتحرك: لوجو متحرك وريلز وفيديوهات قصيرة بتمسك الانتباه.")],
    video_editing: [L(`Hey, ${first} from editing ✂️`, `أهلاً، ${first} من المونتاج ✂️`),
                 L("I cut the footage into films and reels for every platform — colour, sound and subtitles included.", "بقطّع التصوير لأفلام وريلز لكل منصة — بالألوان والصوت والترجمة.")],
    photography: [L(`Hi! ${first}, I shoot 📷`, `أهلاً! ${first}، بصوّر 📷`),
                 L("I'll come to you with the camera and capture your place, your product and your people.", "هاجيلك بالكاميرا وأصوّر مكانك ومنتجك والناس بتوعك.")],
    moderation: [L(`Hello! ${first} — publishing 📅`, `أهلاً! ${first} — النشر والجدولة 📅`),
                 L("Once it's approved, I schedule and publish everything on time, on every platform.", "أول ما الشغل يتعتمد، بجدوله وبنشره في معاده على كل المنصات.")],
    finance: [L(`Welcome! ${first}, finance 📊`, `أهلاً بيك! ${first}، المالية 📊`),
                 L("I keep invoices, payments and logistics clear and simple, so you always know where things stand.", "بخلّي الفواتير والدفعات واللوجستيات واضحة وبسيطة، فتعرف كل حاجة واقفة فين.")],
    admin: [L(`Welcome to Planet! ${first} here ☕`, `نوّرت Planet! أنا ${first} ☕`),
                 L("Tea or coffee? I make sure every guest feels at home here.", "شاي ولا قهوة؟ أنا بتأكد إن كل ضيف حاسس إنه في بيته هنا.")],
  };
  const lines = S[d] || [L(`Hi! I'm ${m.name.en}.`, `أهلاً! أنا ${m.name.ar}.`), L(m.title.en, m.title.ar)];
  return [...lines, L(`(${m.title.en})`, `(${m.title.ar})`)];
}

let inOffice = false, officeBuilt = false, oPos = new THREE.Vector2(10.3, 12.4), oYaw = Math.PI, oRoom = null, oWelcomed = new Set(), oNear = null;
const oWalls = [], oSeats = [], oGroup = new THREE.Group(); oGroup.position.copy(OFF);
const P3 = (x, y, h = 0) => new THREE.Vector3(x - PW/2, h, y - PH/2);

function faceTex(src){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  x.fillStyle = '#F1C9A5'; x.fillRect(0,0,256,256);
  if (src){ const im = new Image(); im.onload = () => { const s = Math.max(256/im.width, 256/im.height); x.drawImage(im, 128 - im.width*s/2, 118 - im.height*s/2, im.width*s, im.height*s); tx.needsUpdate = true; }; im.src = src; }
  return tx;
}
function labelSprite(text, col = '#12153A', border = '#8FB4E3', w = 512){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 96; const x = cv.getContext('2d');
  x.fillStyle = col; x.strokeStyle = border; x.lineWidth = 6; x.beginPath(); x.roundRect ? x.roundRect(4,4,w-8,88,44) : x.rect(4,4,w-8,88); x.fill(); x.stroke();
  x.fillStyle = '#F4F7FC'; x.font = '700 46px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(text, w/2, 50, w - 40);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false })); s.renderOrder = 5; s.scale.set(w/96*0.42, 0.42, 1); return s;
}
function box(w, h, d, color, x, y, z, ink = true){ const m = mesh(new THREE.BoxGeometry(w, h, d), color, ink ? 1 : 0); m.position.set(x, y, z); oGroup.add(m); return m; }

function buildOffice(){
  officeBuilt = true; scene.add(oGroup);
  // base slab like the floor-plan model
  box(PW + 0.6, 0.4, PH + 0.6, 0x1B2150, 0, -0.2, 0);
  for (const R of ROOMS){
    const [x0, y0, x1, y1] = R.r, w = x1 - x0, d = y1 - y0, c = P3((x0 + x1)/2, (y0 + y1)/2);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.06, d - 0.04), new THREE.MeshToonMaterial({ color: new THREE.Color(R.c).lerp(new THREE.Color(0x2A3060), 0.45), gradientMap: grad }));
    fl.position.set(c.x, 0.03, c.z); oGroup.add(fl);
    // walls on all four sides, minus the doors
    [[x0, y0, x1, y0], [x1, y0, x1, y1], [x0, y1, x1, y1], [x0, y0, x0, y1]].forEach(seg => wallWithDoors(seg, R.c));
    const lb = labelSprite(t(R.n), '#12153A', '#' + R.c.toString(16).padStart(6, '0')); lb.position.copy(P3(R.id === 'entry' ? 6 : (x0 + x1)/2, R.id === 'entry' ? 12.2 : (y0 + y1)/2, 2.6)); oGroup.add(lb);
  }
  // furniture
  const desk = (x, y) => { box(1.0, 0.08, 0.6, 0xF4F7FC, P3(x, y).x, 0.74, P3(x, y).z + 0.55); box(0.08, 0.7, 0.5, 0xDCE2EE, P3(x, y).x - 0.42, 0.37, P3(x, y).z + 0.55, false); box(0.08, 0.7, 0.5, 0xDCE2EE, P3(x, y).x + 0.42, 0.37, P3(x, y).z + 0.55, false);
    const sc = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.03), basic(0x12153A)); sc.position.set(P3(x, y).x, 1.0, P3(x, y).z + 0.75); sc.rotation.y = Math.PI; oGroup.add(sc);
    oWalls.push({ a: new THREE.Vector2(x - 0.55, y + 0.55), b: new THREE.Vector2(x + 0.55, y + 0.55) }); };
  const table = P3(10.4, 2.1); box(2.4, 0.08, 1.1, 0xB5835A, table.x, 0.74, table.z); box(0.12, 0.7, 0.12, 0x12153A, table.x, 0.37, table.z, false);
  oWalls.push({ a: new THREE.Vector2(9.2, 2.1), b: new THREE.Vector2(11.6, 2.1) });
  const counter = P3(5.6, 2.3); box(4.4, 0.9, 0.6, 0xF4F7FC, counter.x, 0.45, counter.z); box(0.5, 0.3, 0.3, 0x12153A, counter.x + 1.4, 1.05, counter.z);
  oWalls.push({ a: new THREE.Vector2(3.4, 2.3), b: new THREE.Vector2(7.8, 2.3) });
  [P3(4.4, 0.9), P3(13, 8.6)].forEach(p => { box(0.45, 0.45, 0.55, 0xF4F7FC, p.x, 0.23, p.z); box(0.5, 0.5, 0.15, 0xF4F7FC, p.x, 0.6, p.z - 0.25); });
  const sofa = P3(10.3, 8.4); box(0.8, 0.45, 1.8, 0x2E6BA9, sofa.x, 0.23, sofa.z); box(0.25, 0.8, 1.8, 0x2E6BA9, sofa.x + 0.4, 0.4, sofa.z);
  const big = P3(17.2, 8.6);
  // the team, each at their seat with their real face
  for (const [id, x, y] of SEATS){
    const m = TEAM.find(t2 => t2.id === id); if (!m) continue;
    if (id === 'emp-001'){ box(1.8, 0.08, 0.8, 0xB5835A, big.x, 0.74, big.z + 0.6); oWalls.push({ a: new THREE.Vector2(x - 0.9, y + 0.6), b: new THREE.Vector2(x + 0.9, y + 0.6) }); }
    else if (!['emp-005','emp-004','emp-022','emp-007','emp-015','emp-016','emp-024'].includes(id)) desk(x, y);
    const n = parseInt(id.slice(4)), girl = [2,5,6,7,8,9,10,14,17,19,21,22,24].includes(n);
    const p = person(n * 3, { face: faceTex(m.photo), look: girl ? (n % 2 ? 3 : 5) : [0, 4, 1][n % 3], logo: logoTex(PLANET_C) });
    p.position.copy(P3(x, y)); p.rotation.y = 0; oGroup.add(p);
    const tag = labelSprite(t(m.name)); tag.position.copy(P3(x, y, 2.15)); oGroup.add(tag);
    oSeats.push({ m, g: p, x, y, tag });
  }
  // the front door, glowing
  const door = P3(19, 12); const glow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xF2C94C, transparent: true, opacity: 0.6 })); glow.position.set(door.x + 0.05, 1.1, door.z); oGroup.add(glow);
  const ex = labelSprite(lang === 'ar' ? '🚪 الخروج للكوكب' : '🚪 Back to the planet', '#F2C94C', '#12153A', 560); ex.material.map.image.getContext('2d'); ex.position.set(door.x - 0.6, 2.7, door.z); oGroup.add(ex);
  // our own lights inside
  const l = new THREE.PointLight(0xFFF1D6, 0.6, 40); l.position.copy(P3(9.5, 6.7, 9)); oGroup.add(l);
}
function wallWithDoors([x0, y0, x1, y1], col){
  const horiz = y0 === y1, len = horiz ? x1 - x0 : y1 - y0; let cuts = [];
  for (const [a0, b0, a1, b1] of DOORS){
    if (horiz && b0 === b1 && Math.abs(b0 - y0) < 1e-6){ const s0 = Math.max(x0, Math.min(a0, a1)), s1 = Math.min(x1, Math.max(a0, a1)); if (s1 > s0) cuts.push([s0 - x0, s1 - x0]); }
    if (!horiz && a0 === a1 && Math.abs(a0 - x0) < 1e-6){ const s0 = Math.max(y0, Math.min(b0, b1)), s1 = Math.min(y1, Math.max(b0, b1)); if (s1 > s0) cuts.push([s0 - y0, s1 - y0]); }
  }
  cuts.sort((p, q) => p[0] - q[0]); let t0 = 0; const pieces = [];
  for (const [c0, c1] of cuts){ if (c0 > t0) pieces.push([t0, c0]); t0 = Math.max(t0, c1); } if (t0 < len) pieces.push([t0, len]);
  for (const [p0, p1] of pieces){ if (p1 - p0 < 0.05) continue;
    const a = horiz ? [x0 + p0, y0] : [x0, y0 + p0], b = horiz ? [x0 + p1, y0] : [x0, y0 + p1];
    const mid = P3((a[0] + b[0])/2, (a[1] + b[1])/2), L2 = p1 - p0;
    const m = mesh(new THREE.BoxGeometry(horiz ? L2 : 0.1, 1.1, horiz ? 0.1 : L2), col); m.position.set(mid.x, 0.55, mid.z); oGroup.add(m);
    oWalls.push({ a: new THREE.Vector2(a[0], a[1]), b: new THREE.Vector2(b[0], b[1]) });
  }
}

/* walking inside: plan coordinates, simple circle-vs-segment collision */
const _ab = new THREE.Vector2(), _ap = new THREE.Vector2(), _cl = new THREE.Vector2();
function pushOut(p, rad = 0.28){
  for (const w of oWalls){ _ab.subVectors(w.b, w.a); _ap.subVectors(p, w.a); const tt = clamp(_ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9), 0, 1);
    _cl.copy(w.a).addScaledVector(_ab, tt); const dx = p.x - _cl.x, dy = p.y - _cl.y, d = Math.hypot(dx, dy);
    if (d < rad){ if (d < 1e-6){ p.y += rad; continue; } p.x = _cl.x + dx/d*rad; p.y = _cl.y + dy/d*rad; } }
  for (const s of oSeats){ const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy); if (d < 0.55 && d > 1e-6){ p.x = s.x + dx/d*0.55; p.y = s.y + dy/d*0.55; } }
}

function enterOffice(){
  if (!officeBuilt) buildOffice();
  if (riding) dismount();
  inOffice = true; oPos.set(18.2, 12.0); oYaw = -Math.PI/2; oRoom = null; oWelcomed.clear();
  $('compass').hidden = true; clouds.visible = false; nightStars.visible = false; Sfx.open();
  camera.position.copy(OFF).add(new THREE.Vector3(14, 14, 18));
}
function exitOffice(){
  inOffice = false; $('compass').hidden = false; clouds.visible = true; applyDayNight(); spawn(); Sfx.close(); mini(lang === 'ar' ? '🌍 رجعت للكوكب' : '🌍 Back on the planet');
}

const _wish = new THREE.Vector3(), _cf = new THREE.Vector3(-0.42, 0, -0.91).normalize(), _cr = new THREE.Vector3().crossVectors(_cf, new THREE.Vector3(0, 1, 0)).normalize();
function officeFrame(dt, now){
  if (!inOffice) return false;
  scene.background.set(0x10143A); scene.fog.near = 40; scene.fog.far = 140;
  const ts = now / 1000;
  const [ix, iy, mag] = state === 'play' ? inputVector() : [0, 0, 0];
  let moving = false;
  if (mag > 0.08){
    _wish.copy(_cf).multiplyScalar(iy).addScaledVector(_cr, ix).normalize();
    const sp = (keys.ShiftLeft || keys.ShiftRight || runToggle ? 4.2 : 2.6) * mag * dt;
    const before = oPos.clone(); oPos.x += _wish.x * sp; oPos.y += _wish.z * sp; pushOut(oPos); pushOut(oPos);
    moving = oPos.distanceTo(before) > 0.002;
    const want = Math.atan2(_wish.x, _wish.z); let dA = want - oYaw; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); oYaw += dA * (1 - Math.exp(-14 * dt));
    if (moving && Math.sin(ts * 9) > 0.96) Sfx.step(false, false);
  }
  // out of the front door → back to the planet
  if (oPos.x > 19.15 && oPos.y > 11.2 && oPos.y < 12.8){ exitOffice(); return false; }
  oPos.x = clamp(oPos.x, 0.3, 19.3); oPos.y = clamp(oPos.y, 0.3, 13.1);
  // pose the messenger
  player.position.copy(OFF).add(P3(oPos.x, oPos.y)); player.quaternion.setFromEuler(new THREE.Euler(0, oYaw, 0));
  shadow.position.copy(player.position).add(new THREE.Vector3(0, 0.07, 0)); shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)); shadow.scale.setScalar(1);
  if (mixer){ walkAction.timeScale = moving ? 1.2 : 0; if (!moving){ let d = idleTime - walkAction.time; d -= Math.round(d/clipDur)*clipDur; walkAction.time += d * (1 - Math.exp(-10*dt)); } mixer.update(dt); }
  rig.position.y = moving ? 0 : Math.sin(now * 0.0022) * 0.012;
  // camera: the floor-plan view from the entrance side
  const target = player.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  camera.position.lerp(target.clone().add(new THREE.Vector3(3.6, 8.5, 7.8)), 1 - Math.exp(-4 * dt)); camera.up.set(0, 1, 0); camera.lookAt(target);
  // the team: they look at you and wave when you come close
  oNear = null; let best = 1.9;
  for (const s of oSeats){ const d = Math.hypot(s.x - oPos.x, s.y - oPos.y); animatePerson(s.g, 0, d < 3.2, ts); s.tag.visible = d < 4.5;
    if (d < 4){ const want = Math.atan2(oPos.x - s.x, oPos.y - s.y); let dA = want - s.g.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); s.g.rotation.y += dA * (1 - Math.exp(-5 * dt)); }
    if (d < best){ best = d; oNear = s; } }
  if (state === 'play'){
    near = oNear ? { kind: 'emp', ref: oNear } : null;
    $('prompt').hidden = !near; if (near) $('promptText').textContent = `${t(UI.talk)} ${t(near.ref.m.name)}`;
    // each room says hello the first time you walk in
    const room = ROOMS.find(R => oPos.x >= R.r[0] && oPos.x <= R.r[2] && oPos.y >= R.r[1] && oPos.y <= R.r[3]);
    if (room && room !== oRoom){ oRoom = room; if (!oWelcomed.has(room.id) && WELCOME[room.id]){ oWelcomed.add(room.id); mini(`👋 ${t(room.n)} — ${t(WELCOME[room.id])}`); Sfx.blip(); } }
  }
  return true;
}
function talkToCrew(s){
  const m = s.m;
  if (m.id === 'emp-001') return talk(m.name, crewLines(m), true, () => openExhibit('contact'));
  talk(m.name, crewLines(m), true, () => openExhibit('member', m.id));
}

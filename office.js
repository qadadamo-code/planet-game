/* Inside Planet HQ — the real office layout, walkable. Rooms, doors and seats follow the studio's floor plan
   (metres; x → right, y → down, as drawn). Every employee sits at their place and talks in their own role. */

const OFF = new THREE.Vector3(0, -3000, 0);   // the office lives far below the planet; we teleport in
const PW = 19, PH = 13.4;                       // plan size in metres
const ROOMS = [
  { id: 'back',    r: [0, 0, 2.8, 10.5],    c: 0x8E6BC2, n: L("Photo studio", "استوديو التصوير") },
  // service rooms exist in the layout but aren't shown or named — the restroom is closed off, the kitchen is a quiet coffee corner
  { id: 'bath1',   r: [2.8, 0, 8.5, 1.9],   c: 0x9AA3B8, n: L("", ""), hide: true, sealed: true },
  { id: 'kitchen', r: [2.8, 1.9, 8.5, 5.7], c: 0xC98A5A, n: L("", ""), hide: true },
  { id: 'meeting', r: [8.5, 0, 12.3, 3.8],  c: 0x2EA87A, n: L("Meeting room", "غرفة الاجتماعات") },
  { id: 'inner',   r: [12.3, 0, 19, 3.8],   c: 0x7B5CD6, n: L("Inner team room", "غرفة الفريق الداخلية") },
  { id: 'hall',    r: [8.5, 3.8, 19, 5.7],  c: 0xE0A23A, n: L("Rooms corridor", "ممر الغرف") },
  // management takes its old restroom too: the biggest, best-dressed room in the office
  { id: 'mgmt',    r: [11.4, 5.7, 19, 10.5],c: 0xD94C93, n: L("Management", "غرفة الإدارة") },
  { id: 'outer',   r: [2.8, 5.7, 9.1, 10.5],c: 0x4F8FD6, n: L("Outer team room", "غرفة الفريق الخارجية") },
  { id: 'recep',   r: [9.1, 5.7, 11.4, 10.5],c: 0xD06AB0, n: L("Reception", "الاستقبال") },
  { id: 'entry',   r: [0, 10.5, 19, 13.4],  c: 0x3E7BE0, n: L("Entrance", "مدخل الشركة") },
];
/* door openings: [x0, y0, x1, y1] on a wall line */
const DOORS = [
  [9.0, 3.8, 10.3, 3.8],  // corridor ↔ meeting
  [12.8, 3.8, 14.0, 3.8], // corridor ↔ inner room
  [12.0, 5.7, 14.0, 5.7], // corridor ↔ management (double door)
  [11.4, 6.6, 11.4, 7.8], // reception ↔ management
  [9.3, 5.7, 11.2, 5.7],  // reception ↔ corridor
  [9.1, 7.0, 9.1, 8.5],   // reception ↔ outer room
  [7.0, 5.7, 8.3, 5.7],   // outer room ↔ coffee corner
  [2.8, 3.2, 2.8, 4.4],   // coffee corner ↔ back corridor
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
  ['emp-001', 17.0, 7.2],                                                           // Mohammed Qadada — management
  ['emp-005', 9.6, 1.4], ['emp-004', 11.2, 1.4], ['emp-022', 9.6, 2.7], ['emp-007', 11.2, 2.7],      // meeting room
  ['emp-015', 1.55, 4.4], ['emp-016', 1.55, 6.3],                                   // shoot crew: mid-shoot in the studio
];
const WELCOME = {
  entry:   L("Welcome to Planet! Reception is straight ahead; management is through the corridor on the right.", "أهلاً بيك في Planet! الاستقبال قدامك، والإدارة من الممر على اليمين."),
  recep:   L("Reception: say hi — every room is open to you.", "الاستقبال: أهلاً وسهلاً — كل الأوض مفتوحة ليك."),
  outer:   L("The outer team room: accounts, content and design work side by side here.", "غرفة الموظفين الخارجية: الحسابات والمحتوى والتصميم شغالين جنب بعض هنا."),
  inner:   L("The inner room: motion, video, design and finance — the people who make it real.", "الغرفة الداخلية: الموشن والمونتاج والتصميم والمالية — الناس اللي بتحوّل الفكرة لحقيقة."),
  meeting: L("The meeting room — this is where your brief becomes a plan.", "غرفة الاجتماعات — هنا البريف بتاعك بيتحوّل لخطة."),
  mgmt:    L("Management: take a seat on the sofa and tell us about your project — we'll answer the same day.", "الإدارة: اتفضل اقعد واحكيلنا عن مشروعك — هنرد عليك في نفس اليوم."),
  hall:    L("Rooms corridor: meeting room ahead, team room and management on the right.", "ممر الغرف: الاجتماعات قدامك، وغرفة الفريق والإدارة على اليمين."),
  back:    L("The photo studio 📸 — the crew is shooting a product campaign right now.", "استوديو التصوير 📸 — الفريق بيصوّر حملة لمنتج دلوقتي."),
};

/* each person speaks in the voice of their job */
function crewLines(m){
  const fe = m.name.en.split(' ')[0], fa = m.name.ar.split(' ')[0], d = m.dept;
  const S = {
    management: [L(`Hello and welcome! I'm ${m.name.en}, ${m.title.en}.`, `أهلاً وسهلاً! أنا ${m.name.ar}، ${m.title.ar}.`),
                 L("My job is to make sure your project has one plan, one team and one person you can always reach.", "شغلي إن مشروعك يكون ليه خطة واحدة، وفريق واحد، وشخص واحد تقدر توصله دايماً.")],
    account_management: [L(`Hi! ${fe} from accounts 😊`, `أهلاً! ${fa} من فريق الحسابات 😊`),
                 L("I'll be your daily contact: I gather what you need, follow up with the team and keep you posted every step.", "هكون حلقة الوصل اليومية معاك: بجمع اللي محتاجه، وبتابع مع الفريق، وبطمّنك في كل خطوة.")],
    content: [L(`Hey! I'm ${fe}, I write ✍️`, `هاي! أنا ${fa}، بكتب ✍️`),
                 L("I'll learn how your customers talk, then write your posts, captions and scripts in Arabic and English.", "هتعلّم عملاءك بيتكلموا إزاي، وبعدين أكتب بوستاتك وكابشناتك وسكريبتاتك بالعربي والإنجليزي.")],
    graphic_design: [L(`Hi, ${fe} — design 🎨`, `هاي، ${fa} — تصميم 🎨`),
                 L("I'll turn the idea into posts, carousels and visuals that look like you and stop the scroll.", "هحوّل الفكرة لبوستات وكاروسيل وتصاميم شبهك وبتوقّف السكرول.")],
    motion: [L(`Yo! ${fe}, motion & video 🎬`, `أهلاً! ${fa}، موشن وفيديو 🎬`),
                 L("I make things move: animated logos, reels and short videos that hold attention.", "أنا اللي بخلّي الحاجات تتحرك: لوجو متحرك وريلز وفيديوهات قصيرة بتمسك الانتباه.")],
    video_editing: [L(`Hey, ${fe} from editing ✂️`, `أهلاً، ${fa} من المونتاج ✂️`),
                 L("I cut the footage into films and reels for every platform — colour, sound and subtitles included.", "بقطّع التصوير لأفلام وريلز لكل منصة — بالألوان والصوت والترجمة.")],
    photography: [L(`Hi! ${fe}, I shoot 📷`, `أهلاً! ${fa}، بصوّر 📷`),
                 L("I'll come to you with the camera and capture your place, your product and your people.", "هاجيلك بالكاميرا وأصوّر مكانك ومنتجك والناس بتوعك.")],
    moderation: [L(`Hello! ${fe} — publishing 📅`, `أهلاً! ${fa} — النشر والجدولة 📅`),
                 L("Once it's approved, I schedule and publish everything on time, on every platform.", "أول ما الشغل يتعتمد، بجدوله وبنشره في معاده على كل المنصات.")],
    finance: [L(`Welcome! ${fe}, finance 📊`, `أهلاً بيك! ${fa}، المالية 📊`),
                 L("I keep invoices, payments and logistics clear and simple, so you always know where things stand.", "بخلّي الفواتير والدفعات واللوجستيات واضحة وبسيطة، فتعرف كل حاجة واقفة فين.")],
    admin: [L(`Welcome to Planet! ${fe} here ☕`, `نوّرت Planet! أنا ${fa} ☕`),
                 L("Tea or coffee? I make sure every guest feels at home here.", "شاي ولا قهوة؟ أنا بتأكد إن كل ضيف حاسس إنه في بيته هنا.")],
  };
  const lines = S[d] || [L(`Hi! I'm ${m.name.en}.`, `أهلاً! أنا ${m.name.ar}.`), L(m.title.en, m.title.ar)];
  return [...lines, L(`(${m.title.en})`, `(${m.title.ar})`)];
}

let inOffice = false, officeBuilt = false, oPos = new THREE.Vector2(10.3, 12.4), oYaw = Math.PI, oRoom = null, oWelcomed = new Set(), oNear = null;
const oWalls = [], oSeats = [], oGroup = new THREE.Group(); oGroup.position.copy(OFF);
/* the plan is in metres; the built office is drawn larger than the plan (OS) so rooms feel roomy —
   furniture keeps its real size, so the extra space shows up as room to walk around */
const OS = 1.4;
const P3 = (x, y, h = 0) => new THREE.Vector3((x - PW/2) * OS, h, (y - PH/2) * OS);

function faceTex(src){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  x.fillStyle = '#F1C9A5'; x.fillRect(0,0,256,256);
  if (src){ const im = new Image(); im.onload = () => { const s = Math.max(256/im.width, 256/im.height); x.drawImage(im, 128 - im.width*s/2, 118 - im.height*s/2, im.width*s, im.height*s); tx.needsUpdate = true; }; im.src = src; }
  return tx;
}
function labelSprite(text, col = '#12153A', border = '#8FB4E3', w = 512){
  // text may be a plain string or a bilingual L(); bilingual labels redraw when the language changes
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 96; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = () => { x.clearRect(0, 0, w, 96);
    x.fillStyle = col; x.strokeStyle = border; x.lineWidth = 6; x.beginPath(); x.roundRect ? x.roundRect(4,4,w-8,88,44) : x.rect(4,4,w-8,88); x.fill(); x.stroke();
    const txt = typeof text === 'string' ? text : typeof text === 'function' ? text() : t(text);
    x.fillStyle = '#F4F7FC'; x.font = '700 46px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; x.fillText(txt, w/2, 50, w - 40);
    tx.needsUpdate = true; };
  paint(); if (typeof text !== 'string') langHooks.push(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 5; s.scale.set(w/96*0.42, 0.42, 1); return s;
}
function box(w, h, d, color, x, y, z, ink = true){ const m = mesh(new THREE.BoxGeometry(w, h, d), color, ink ? 1 : 0); m.position.set(x, y, z); oGroup.add(m); return m; }

/* name + role, drawn as one card that appears only when you walk up to someone */
function crewTag(m){
  const w = 560, h = 150, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = () => { x.clearRect(0, 0, w, h);
    x.fillStyle = '#12153A'; x.strokeStyle = '#F2C94C'; x.lineWidth = 6; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, 28) : x.rect(4, 4, w - 8, h - 8); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = lang === 'ar' ? 'rtl' : 'ltr';
    x.fillStyle = '#F4F7FC'; x.font = '800 48px IBM Plex Sans Arabic, sans-serif'; x.fillText(t(m.name), w/2, 52, w - 40);
    x.fillStyle = '#F2C94C'; x.font = '600 32px IBM Plex Sans Arabic, sans-serif'; x.fillText(t(m.title), w/2, 104, w - 40);
    tx.needsUpdate = true; };
  paint(); langHooks.push(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 6; s.scale.set(w/h*0.62, 0.62, 1); return s;
}

/* the photo studio in the back: backdrop, lights, a model holding a client's product */
const STUDIO_MODEL = [0.65, 5.35], STUDIO_FACE = { 'emp-015': STUDIO_MODEL, 'emp-016': STUDIO_MODEL };
function holdCamera(p){ const c = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.14), 0x1A1A1F); c.position.set(0, 1.36, 0.3); p.add(c);
  const lens = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 12), 0x2B2B33, 0); lens.rotation.x = Math.PI/2; lens.position.set(0, 1.36, 0.42); p.add(lens);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })); fl.position.set(0.08, 1.47, 0.3); p.add(fl); p.userData.flash = fl; }
function holdReflector(p){ const r = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0xF4D78A, side: THREE.DoubleSide })); r.position.set(0.3, 1.1, 0.35); r.rotation.y = -0.6; p.add(r); }
function buildStudio(){
  // seamless backdrop on the west wall, curving onto the floor
  const bd = oAt(0.05, 5.35); box(0.06, 1.25, 2.8, 0xF2E9DD, bd.x + 0.06, 0.66, bd.z, false); box(1.1, 0.02, 2.8, 0xF2E9DD, bd.x + 0.6, 0.075, bd.z, false);
  box(0.1, 0.1, 3.0, 0x2B2420, bd.x + 0.08, 1.32, bd.z, false);
  // softboxes on stands, aimed at the model
  [[0.55, 3.75, 0.5], [0.55, 6.95, -0.5]].forEach(([x, y, a]) => { const p = oAt(x, y);
    box(0.04, 1.5, 0.04, 0x2B2420, p.x, 0.75, p.z, false);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.2), new THREE.MeshBasicMaterial({ color: 0xFFF6E0 })); sb.position.set(p.x + 0.05, 1.55, p.z); sb.rotation.y = Math.PI/2 + a; oGroup.add(sb);
    const back = mesh(new THREE.BoxGeometry(0.66, 0.66, 0.08), 0x1A1A1F, 0); back.position.copy(sb.position); back.rotation.copy(sb.rotation); back.translateZ(-0.13); oGroup.add(back);
    const pl = new THREE.PointLight(0xFFF1D6, 0.35, 4); pl.position.set(p.x + 0.3, 1.5, p.z); oGroup.add(pl); oBlock(x - 0.15, y - 0.15, x + 0.15, y + 0.15); });
  // a video camera on a tripod
  { const p = oAt(1.65, 5.35); [-0.12, 0.12].forEach(dz => box(0.03, 1.1, 0.03, 0x2B2420, p.x, 0.55, p.z + dz, false)); box(0.03, 1.1, 0.03, 0x2B2420, p.x + 0.1, 0.55, p.z, false);
    const cam = mesh(new THREE.BoxGeometry(0.42, 0.24, 0.2), 0x1A1A1F); cam.position.set(p.x, 1.18, p.z); oGroup.add(cam);
    const ln = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 12), 0x2B2B33, 0); ln.rotation.z = Math.PI/2; ln.position.set(p.x - 0.28, 1.18, p.z); oGroup.add(ln);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFF3344 })); rec.position.set(p.x + 0.1, 1.33, p.z); oGroup.add(rec); oBlock(1.5, 5.2, 1.8, 5.5); }
  // the model, posing with a product that carries a client's logo
  const mdl = person(77, { look: 3, shirt: 0xE9A0B8 }); mdl.position.copy(oAt(STUDIO_MODEL[0], STUDIO_MODEL[1])); mdl.rotation.y = Math.PI/2; oGroup.add(mdl);
  const prodC = CLIENTS.find(c => c.logo === 'lorya') || CLIENTS[0];
  const prod = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.12), new THREE.MeshBasicMaterial({ map: logoTex(prodC) })); prod.position.set(0.12, 1.12, 0.36); prod.rotation.y = 0.25; mdl.add(prod);
  const cap = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), 0xF2C94C, 0); cap.position.set(0.12, 1.31, 0.36); mdl.add(cap);
  oStudio = mdl; oBlock(0.3, 5.0, 1.0, 5.7);
  // a little kit corner: camera bag and a flight case
  const kb = oAt(2.35, 8.6); box(0.5, 0.35, 0.35, 0x2B2420, kb.x, 0.18, kb.z); box(0.45, 0.5, 0.32, 0x8A8F9C, kb.x, 0.6, kb.z, false); oBlock(2.1, 8.4, 2.6, 8.8);
}
let oStudio = null;

/* ---------- décor kit ---------- */
const WALL_H = 1.3, WALL_C = 0xF3EFE8;
function oFloorTex(kind, base){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const c = new THREE.Color(base), hex = k => '#' + c.clone().offsetHSL(0, 0, k).getHexString();
  x.fillStyle = hex(0); x.fillRect(0, 0, 256, 256);
  if (kind === 'wood'){ for (let r = 0; r < 8; r++){ const off = (r % 2) * 64; x.fillStyle = hex((r * 37 % 5 - 2) * 0.012); x.fillRect(0, r*32, 256, 32);
      x.strokeStyle = hex(-0.08); x.lineWidth = 2; x.beginPath(); x.moveTo(0, r*32); x.lineTo(256, r*32); for (let k = off; k < 256 + 128; k += 128){ x.moveTo(k, r*32); x.lineTo(k, r*32 + 32); } x.stroke(); } }
  else if (kind === 'carpet'){ x.strokeStyle = hex(-0.05); x.lineWidth = 2; for (let k = 0; k <= 256; k += 64){ x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); }
      for (let i = 0; i < 900; i++){ x.fillStyle = hex(Math.random() * 0.06 - 0.03); x.fillRect(Math.random()*256, Math.random()*256, 2, 2); } }
  else { x.strokeStyle = hex(-0.07); x.lineWidth = 3; for (let k = 0; k <= 256; k += 128){ x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); }
      x.fillStyle = hex(0.04); x.fillRect(6, 6, 116, 116); x.fillRect(134, 134, 116, 116); }
  const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
}
const FLOOR = { mgmt: ['wood', 0x9C6B48], meeting: ['wood', 0xB58A62], outer: ['carpet', 0x5E6F96], inner: ['carpet', 0x6B5E9A],
  recep: ['tile', 0xE6DED2], hall: ['tile', 0xDCD6CC], entry: ['tile', 0xE9E3D9], back: ['tile', 0xC9C3BA], kitchen: ['tile', 0xD9CFC2], bath1: ['tile', 0xB9BFCB] };
const oAt = (x, y, h = 0) => P3(x, y, h);
function oBlock(x0, y0, x1, y1){ [[x0,y0,x1,y0],[x1,y0,x1,y1],[x0,y1,x1,y1],[x0,y0,x0,y1]].forEach(([a,b,c,d]) => oWalls.push({ a: new THREE.Vector2(a,b), b: new THREE.Vector2(c,d) })); }
function oPlant(x, y, s = 1){
  const p = oAt(x, y); box(0.36*s, 0.42*s, 0.36*s, 0xD9C6A5, p.x, 0.21*s, p.z);
  [[0,0.78,0,0.3],[0.13,0.62,0.08,0.22],[-0.12,0.66,-0.06,0.24],[0.02,1.0,-0.05,0.2]].forEach(([dx,dy,dz,r],k) => { const m = mesh(new THREE.IcosahedronGeometry(r*s, 0), k % 2 ? 0x3E9A62 : 0x2F7F52); m.position.set(p.x + dx*s, dy*s, p.z + dz*s); oGroup.add(m); });
  oBlock(x - 0.2*s, y - 0.2*s, x + 0.2*s, y + 0.2*s);
}
function oRug(x0, y0, x1, y1, col, border = 0xF2C94C){
  const c = oAt((x0 + x1)/2, (y0 + y1)/2);
  box((x1 - x0)*OS, 0.02, (y1 - y0)*OS, border, c.x, 0.075, c.z, false); box((x1 - x0)*OS - 0.16, 0.022, (y1 - y0)*OS - 0.16, col, c.x, 0.08, c.z, false);
}
/* a picture on a north wall (faces the camera); src is an image path */
function oFrame(x, y, w, h, src, z = 0.78){
  const p = oAt(x, y); box(w + 0.08, h + 0.08, 0.05, 0x2B2420, p.x, z, p.z + 0.08, false);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w); const g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  g.fillStyle = '#F4F7FC'; g.fillRect(0, 0, cv.width, cv.height);
  const im = new Image(); im.onload = () => { const sc = Math.max(cv.width/im.width, cv.height/im.height); g.drawImage(im, cv.width/2 - im.width*sc/2, cv.height/2 - im.height*sc/2, im.width*sc, im.height*sc); tx.needsUpdate = true; }; im.src = src;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx })); pic.position.set(p.x, z, p.z + 0.115); oGroup.add(pic);
}
/* the same on a west wall (faces +x, also towards the camera) */
function oFrameW(x, y, w, h, src, z = 0.78){
  const p = oAt(x, y); box(0.05, h + 0.08, w + 0.08, 0x2B2420, p.x + 0.08, z, p.z, false);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w); const g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  g.fillStyle = '#F4F7FC'; g.fillRect(0, 0, cv.width, cv.height);
  const im = new Image(); im.onload = () => { const sc = Math.max(cv.width/im.width, cv.height/im.height); g.drawImage(im, cv.width/2 - im.width*sc/2, cv.height/2 - im.height*sc/2, im.width*sc, im.height*sc); tx.needsUpdate = true; }; im.src = src;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx })); pic.rotation.y = Math.PI/2; pic.position.set(p.x + 0.115, z, p.z); oGroup.add(pic);
}
function oLamp(x, y){ const p = oAt(x, y); box(0.3, 0.05, 0.3, 0x2B2420, p.x, 0.03, p.z, false); box(0.04, 1.3, 0.04, 0x2B2420, p.x, 0.68, p.z, false);
  const sh = mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.26, 12), 0xFFF1D6); sh.position.set(p.x, 1.42, p.z); oGroup.add(sh); oBlock(x - 0.15, y - 0.15, x + 0.15, y + 0.15); }
function oShelf(x0, x1, y){ const w = (x1 - x0)*OS, p = oAt((x0 + x1)/2, y);
  box(w, 1.2, 0.32, 0xB5835A, p.x, 0.6, p.z); [0.35, 0.7, 1.05].forEach(h => box(w - 0.08, 0.04, 0.3, 0x8A5E3B, p.x, h, p.z + 0.02, false));
  const cols = [0xE76F51, 0x2E6BA9, 0xF2C94C, 0x3E8E7E, 0x8E6BC2, 0xE9A0B8];
  for (let i = 0, k = 0; i < w - 0.2; i += 0.11, k++) [0.48, 0.83].forEach((h, r) => { if ((k + r) % 4 === 3) return; box(0.08, 0.22, 0.2, cols[(k + r*2) % cols.length], p.x - w/2 + 0.12 + i, h, p.z + 0.02, false); });
  oBlock(x0, y - 0.18, x1, y + 0.18); }

function buildOffice(){
  officeBuilt = true; scene.add(oGroup);
  box(PW*OS + 0.6, 0.4, PH*OS + 0.6, 0x1B2150, 0, -0.2, 0);
  for (const R of ROOMS){
    const [x0, y0, x1, y1] = R.r, w = x1 - x0, d = y1 - y0, c = P3((x0 + x1)/2, (y0 + y1)/2);
    const [kind, base] = FLOOR[R.id] || ['tile', 0xDCD6CC], tx = oFloorTex(kind, base); tx.repeat.set(w*OS / (kind === 'tile' ? 1.6 : 2.2), d*OS / (kind === 'tile' ? 1.6 : 2.2));
    const fl = new THREE.Mesh(new THREE.BoxGeometry(w*OS - 0.04, 0.06, d*OS - 0.04), new THREE.MeshToonMaterial({ color: 0xffffff, map: tx, gradientMap: grad }));
    fl.position.set(c.x, 0.03, c.z); oGroup.add(fl);
    [[x0, y0, x1, y0], [x1, y0, x1, y1], [x0, y1, x1, y1], [x0, y0, x0, y1]].forEach(seg => wallWithDoors(seg, R.c));
    if (R.sealed){ box(w*OS, 0.06, d*OS, 0xE4E0D8, c.x, WALL_H + 0.02, c.z); oBlock(x0, y0, x1, y1); }
    if (!R.hide){ const lb = labelSprite(R.n, '#12153A', '#' + R.c.toString(16).padStart(6, '0')); lb.position.copy(P3(R.id === 'entry' ? 6 : (x0 + x1)/2, R.id === 'entry' ? 12.2 : (y0 + y1)/2, 2.6)); oGroup.add(lb); }
  }
  const work = WORK.flatMap(w => w.imgs).map(s2 => 'img/' + s2), pic = k => work[k % work.length];

  // desks: wood top, monitor with a lit screen, a mug and a little plant
  const desk = (x, y) => { const p = oAt(x, y);
    box(1.05, 0.08, 0.62, 0xC79A6E, p.x, 0.74, p.z + 0.55); box(0.08, 0.7, 0.5, 0xEDE7DD, p.x - 0.44, 0.37, p.z + 0.55, false); box(0.08, 0.7, 0.5, 0xEDE7DD, p.x + 0.44, 0.37, p.z + 0.55, false);
    box(0.54, 0.34, 0.04, 0x12153A, p.x, 1.02, p.z + 0.77, false); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.28), basic(0x8FB4E3)); scr.position.set(p.x, 1.02, p.z + 0.748); scr.rotation.y = Math.PI; oGroup.add(scr);
    box(0.06, 0.18, 0.06, 0x12153A, p.x, 0.86, p.z + 0.79, false);
    box(0.08, 0.1, 0.08, [0xE76F51, 0xF2C94C, 0x2E6BA9][Math.abs(Math.round(x*7 + y*3)) % 3], p.x + 0.36, 0.83, p.z + 0.42, false);
    // devices: keyboard, mouse, a computer tower under the desk; every other desk adds a laptop or a drawing tablet
    box(0.42, 0.025, 0.14, 0x2B2B33, p.x, 0.79, p.z + 0.5, false); box(0.06, 0.025, 0.09, 0x2B2B33, p.x + 0.29, 0.79, p.z + 0.5, false);
    box(0.2, 0.42, 0.42, 0x1A1A1F, p.x - 0.3, 0.21, p.z + 0.6, false); const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), basic(0x5FE0FF)); led.position.set(p.x - 0.3, 0.36, p.z + 0.385); oGroup.add(led);
    const v = Math.abs(Math.round(x*5 + y*11)) % 3;
    if (v === 0){ box(0.3, 0.02, 0.22, 0xC0C6D2, p.x - 0.32, 0.79, p.z + 0.45, false); const lid = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.015), basic(0xC0C6D2)); lid.position.set(p.x - 0.32, 0.9, p.z + 0.57); lid.rotation.x = 0.25; oGroup.add(lid);
      const ls = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), basic(0x8FB4E3)); ls.position.set(p.x - 0.32, 0.9, p.z + 0.562); ls.rotation.set(0.25, Math.PI, 0); oGroup.add(ls); }
    else if (v === 1){ box(0.28, 0.02, 0.2, 0x12153A, p.x - 0.3, 0.79, p.z + 0.42, false); box(0.02, 0.02, 0.16, 0x8A8F9C, p.x - 0.18, 0.81, p.z + 0.42, false); }
    else { box(0.16, 0.12, 0.05, 0x1A1A1F, p.x + 0.38, 0.86, p.z + 0.7, false); }
    oWalls.push({ a: new THREE.Vector2(x - 0.55, y + 0.55), b: new THREE.Vector2(x + 0.55, y + 0.55) }); };

  /* ── management: the biggest, best-dressed room ── */
  oRug(12.6, 7.9, 15.4, 10.3, 0x7A3E5C);
  oRug(15.6, 6.3, 18.6, 9.2, 0x2E3557);
  // brand wall behind the CEO's desk
  { const p = oAt(17.1, 5.7); box(3.4, 1.15, 0.06, 0x12153A, p.x, 0.66, p.z + 0.09, false);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: logoTex(PLANET_C) })); lg.position.set(p.x, 0.68, p.z + 0.125); oGroup.add(lg);
    box(3.4, 0.05, 0.08, 0xF2C94C, p.x, 1.22, p.z + 0.1, false); box(3.4, 0.05, 0.08, 0xF2C94C, p.x, 0.1, p.z + 0.1, false); }
  // executive L-desk and chair
  { const p = oAt(17.0, 7.2); box(2.2, 0.1, 0.85, 0x6B4227, p.x, 0.76, p.z + 0.7); box(0.7, 0.1, 1.3, 0x6B4227, p.x + 1.1, 0.76, p.z + 0.35);
    box(2.2, 0.7, 0.1, 0x4A2D1A, p.x, 0.38, p.z + 1.08, false); box(0.6, 0.36, 0.04, 0x12153A, p.x - 0.4, 1.05, p.z + 0.95, false);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.3), basic(0x8FB4E3)); scr.position.set(p.x - 0.4, 1.05, p.z + 0.928); scr.rotation.y = Math.PI; oGroup.add(scr);
    box(0.62, 0.95, 0.12, 0x12153A, p.x, 0.62, p.z - 0.38); box(0.62, 0.12, 0.6, 0x12153A, p.x, 0.48, p.z - 0.12, false);
    oBlock(15.85, 7.65, 18.45, 8.35); }
  // lounge: sofa, armchairs, coffee table
  { const s1 = oAt(12.0, 9.1); box(0.85, 0.42, 2.2, 0xD94C93, s1.x, 0.24, s1.z); box(0.25, 0.85, 2.2, 0xB23A76, s1.x - 0.32, 0.45, s1.z); box(0.85, 0.6, 0.22, 0xB23A76, s1.x, 0.35, s1.z - 1.1); box(0.85, 0.6, 0.22, 0xB23A76, s1.x, 0.35, s1.z + 1.1);
    oBlock(11.55, 7.95, 12.45, 10.25);
    [[14.6, 8.4], [14.6, 9.8]].forEach(([x, y]) => { const a = oAt(x, y); box(0.75, 0.42, 0.75, 0xF2C94C, a.x, 0.24, a.z); box(0.2, 0.75, 0.75, 0xD9AE33, a.x + 0.3, 0.42, a.z); oBlock(x - 0.38, y - 0.38, x + 0.38, y + 0.38); });
    const ct = oAt(13.3, 9.1); box(1.1, 0.06, 0.7, 0x6B4227, ct.x, 0.42, ct.z); box(0.9, 0.36, 0.5, 0x4A2D1A, ct.x, 0.2, ct.z, false);
    box(0.18, 0.2, 0.18, 0xF4F7FC, ct.x - 0.2, 0.55, ct.z); box(0.3, 0.04, 0.22, 0x2E6BA9, ct.x + 0.25, 0.47, ct.z, false); oBlock(12.75, 8.75, 13.85, 9.45); }
  oShelf(18.4, 18.95, 10.1); oShelf(14.1, 15.3, 5.88);
  oFrameW(11.4, 9.0, 1.6, 0.85, pic(3)); 
  oPlant(18.6, 6.1, 1.25); oPlant(18.6, 9.5, 1.1); oPlant(11.75, 6.15, 0.9); oLamp(15.6, 10.1);

  /* ── meeting room ── */
  oRug(8.9, 0.6, 11.9, 3.5, 0x2E5A4A);
  const table = oAt(10.4, 2.1); box(2.6, 0.09, 1.2, 0x6B4227, table.x, 0.76, table.z); box(1.8, 0.7, 0.5, 0x4A2D1A, table.x, 0.38, table.z, false);
  oWalls.push({ a: new THREE.Vector2(9.1, 2.1), b: new THREE.Vector2(11.7, 2.1) });
  { const p = oAt(10.4, 0); box(2.0, 0.95, 0.05, 0x12153A, p.x, 0.75, p.z + 0.08, false); const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.82), new THREE.MeshBasicMaterial({ map: logoTex(PLANET_C) })); tv.position.set(p.x, 0.75, p.z + 0.11); oGroup.add(tv); }
  oPlant(8.8, 0.35, 0.9); oPlant(12.0, 0.35, 0.9);

  /* ── team rooms: rugs, art from our work, plants, lamps ── */
  oRug(12.6, 0.4, 15.0, 3.4, 0x3E3570); oRug(16.2, 0.4, 18.6, 3.4, 0x3E3570);
  oFrame(15.6, 0, 0.9, 0.6, pic(0)); oFrame(18.6, 0, 0.5, 0.6, pic(7)); oPlant(15.6, 3.3, 0.95); oPlant(12.6, 3.5, 0.8);
  oRug(3.3, 6.2, 6.1, 9.9, 0x2F4E7A);
  oFrame(3.9, 5.7, 1.0, 0.65, pic(1)); oFrameW(2.8, 7.9, 1.2, 0.7, pic(4)); oFrameW(2.8, 9.6, 0.8, 0.55, pic(5));
  oPlant(3.15, 10.15, 1.0); oPlant(6.6, 10.2, 0.9); oLamp(6.7, 6.1);

  /* ── coffee corner (no sign): counter, machine, stools ── */
  const counter = oAt(5.6, 2.3); box(4.4, 0.9, 0.6, 0xF4F7FC, counter.x, 0.45, counter.z); box(4.5, 0.06, 0.66, 0x6B4227, counter.x, 0.92, counter.z, false);
  box(0.4, 0.42, 0.32, 0x12153A, counter.x + 1.4, 1.16, counter.z); box(0.3, 0.3, 0.26, 0xC0C6D2, counter.x - 1.2, 1.1, counter.z, false);
  oWalls.push({ a: new THREE.Vector2(3.4, 2.3), b: new THREE.Vector2(7.8, 2.3) });
  [4.6, 5.6, 6.6].forEach(x => { const a = oAt(x, 2.95); box(0.32, 0.06, 0.32, 0xF2C94C, a.x, 0.62, a.z, false); box(0.05, 0.6, 0.05, 0x2B2420, a.x, 0.3, a.z, false); });
  oPlant(8.2, 5.4, 0.85);

  /* ── photo studio in the back ── */
  buildStudio();
  /* ── shared devices: printers, a big screen in each team room ── */
  [[8.5, 10.15], [18.65, 3.45]].forEach(([x, y]) => { const p = oAt(x, y); box(0.5, 0.32, 0.42, 0xE4E7EE, p.x, 0.62, p.z); box(0.5, 0.45, 0.42, 0xC9CED8, p.x, 0.23, p.z, false); box(0.34, 0.02, 0.2, 0xF4F7FC, p.x, 0.79, p.z + 0.05, false); oBlock(x - 0.25, y - 0.21, x + 0.25, y + 0.21); });
  { const p = oAt(5.65, 5.7); box(1.3, 0.75, 0.05, 0x12153A, p.x, 0.8, p.z + 0.09, false); const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.66), new THREE.MeshBasicMaterial({ map: logoTex(PLANET_C) })); sc.position.set(p.x, 0.8, p.z + 0.12); oGroup.add(sc); }

  /* ── reception & entrance ── */
  oRug(9.4, 7.3, 11.1, 9.9, 0x7A3E5C);
  const sofa = oAt(10.3, 8.4); box(0.8, 0.45, 1.8, 0x2E6BA9, sofa.x, 0.23, sofa.z); box(0.25, 0.8, 1.8, 0x245889, sofa.x + 0.4, 0.4, sofa.z);
  oPlant(9.4, 10.2, 0.8); oPlant(11.1, 10.2, 0.8);
  { const p = oAt(5.2, 10.5); box(3.6, 1.0, 0.06, 0x12153A, p.x, 0.72, p.z + 0.09, false);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: logoTex(PLANET_C) })); lg.position.set(p.x - 1.1, 0.72, p.z + 0.125); oGroup.add(lg);
    const nm = labelSprite('Planet', '#12153A', '#F2C94C', 360); nm.material.depthTest = true; nm.scale.multiplyScalar(1.3); nm.position.set(p.x + 0.6, 0.72, p.z + 0.45); oGroup.add(nm); }
  [13, 15, 17].forEach(x => oFrame(x, 10.5, 1.0, 0.65, pic(x)));
  oPlant(3.2, 11.0, 1.1); oPlant(8.6, 11.0, 1.0); oPlant(18.6, 13.0, 1.1); oPlant(12.0, 13.05, 0.9);

  // the team, each at their seat with their real face
  for (const [id, x, y] of SEATS){
    const m = TEAM.find(t2 => t2.id === id); if (!m) continue;
    if (!['emp-001','emp-005','emp-004','emp-022','emp-007','emp-015','emp-016','emp-024'].includes(id)) desk(x, y);
    const n = parseInt(id.slice(4)), girl = [2,5,6,7,8,9,10,14,17,19,21,22,24].includes(n);
    const p = person(n * 3, { face: faceTex(m.photo), look: girl ? (n % 2 ? 3 : 5) : [0, 4, 1][n % 3], logo: logoTex(PLANET_C) });
    p.position.copy(P3(x, y)); p.rotation.y = 0; oGroup.add(p);
    const tag = crewTag(m); tag.position.copy(P3(x, y, 2.3)); tag.visible = false; oGroup.add(tag);
    const st = STUDIO_FACE[id]; if (st) p.rotation.y = Math.atan2(st[0] - x, st[1] - y);
    if (id === 'emp-015') holdCamera(p); if (id === 'emp-016') holdReflector(p);
    oSeats.push({ m, g: p, x, y, tag, fixed: !!st });
  }
  // the front door, glowing
  const door = P3(19, 12); const glow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xF2C94C, transparent: true, opacity: 0.6 })); glow.position.set(door.x + 0.05, 1.1, door.z); oGroup.add(glow);
  const ex = labelSprite(L('🚪 Back to the planet', '🚪 الخروج للكوكب'), '#F2C94C', '#12153A', 560); ex.position.set(door.x - 0.6, 2.7, door.z); oGroup.add(ex);
  // warm lights: one overall, and a soft pool over management and each team room
  const l = new THREE.PointLight(0xFFF1D6, 0.6, 40); l.position.copy(P3(9.5, 6.7, 9)); oGroup.add(l);
  [[15.2, 8.1, 0.45], [5.9, 8.1, 0.3], [15.6, 1.9, 0.3]].forEach(([x, y, k]) => { const pl = new THREE.PointLight(0xFFE2B0, k, 9); pl.position.copy(P3(x, y, 3.2)); oGroup.add(pl); });
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
    const mid = P3((a[0] + b[0])/2, (a[1] + b[1])/2), L2 = (p1 - p0)*OS;
    // warm white wall, the room's colour as a thin band at the top and a skirting at the bottom
    const m = mesh(new THREE.BoxGeometry(horiz ? L2 : 0.12, WALL_H, horiz ? 0.12 : L2), WALL_C); m.position.set(mid.x, WALL_H/2, mid.z); oGroup.add(m);
    box(horiz ? L2 : 0.14, 0.09, horiz ? 0.14 : L2, col, mid.x, WALL_H - 0.02, mid.z, false);
    box(horiz ? L2 : 0.14, 0.08, horiz ? 0.14 : L2, 0xB9AE9E, mid.x, 0.1, mid.z, false);
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
    const sp = (keys.ShiftLeft || keys.ShiftRight || runToggle ? 4.2 : 2.6) * mag * dt / OS;
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
  if (oStudio) animatePerson(oStudio, 0, false, ts);
  for (const s of oSeats) if (s.g.userData.flash) s.g.userData.flash.material.color.setHex((ts % 2.4) < 0.08 ? 0xFFFFFF : 0x555555);
  oNear = null; let best = 1.9;
  for (const s of oSeats){ const d = Math.hypot(s.x - oPos.x, s.y - oPos.y); animatePerson(s.g, 0, !s.fixed && d < 3.2, ts); s.tag.visible = false;
    if (d < 4 && !s.fixed){ const want = Math.atan2(oPos.x - s.x, oPos.y - s.y); let dA = want - s.g.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); s.g.rotation.y += dA * (1 - Math.exp(-5 * dt)); }
    if (d < best){ best = d; oNear = s; } }
  if (oNear) oNear.tag.visible = true;   // only the person you've walked up to shows their name and role
  if (state === 'play'){
    near = oNear ? { kind: 'emp', ref: oNear } : null;
    $('prompt').hidden = !near; if (near) $('promptText').textContent = `${t(UI.talk)} ${t(near.ref.m.name)}`;
    // each room says hello the first time you walk in
    const room = ROOMS.find(R => oPos.x >= R.r[0] && oPos.x <= R.r[2] && oPos.y >= R.r[1] && oPos.y <= R.r[3]);
    if (room && room !== oRoom){ oRoom = room; if (!oWelcomed.has(room.id) && WELCOME[room.id]){ oWelcomed.add(room.id); mini(`👋 ${t(room.n)} — ${t(WELCOME[room.id])}`); Sfx.blip(); } }
  }
  return true;
}
/* the call to action at the end of each conversation: start a brief with the service this person delivers */
const DEPT_CTA = {
  management: ['s8', L("📝 Start your project", "📝 ابدأ مشروعك")],
  account_management: ['s3', L("📝 Start a brief with me", "📝 ابدأ بريفك معايا")],
  content: ['s3', L("✍️ Request content", "✍️ اطلب محتوى")],
  graphic_design: ['s2', L("🎨 Request a design", "🎨 اطلب تصميم")],
  motion: ['s5', L("🎬 Request a video", "🎬 اطلب فيديو")],
  video_editing: ['s5', L("🎬 Request a video", "🎬 اطلب فيديو")],
  photography: ['s5', L("📷 Book a shoot", "📷 احجز جلسة تصوير")],
  moderation: ['s3', L("📅 Plan my posts", "📅 خطّط بوستاتي")],
  finance: ['s8', L("💼 Ask for a quote", "💼 اطلب عرض سعر")],
  admin: [null, L("☕ Visit the office", "☕ زورنا في المكتب")],
};
function crewCta(m){
  const [svc, label] = DEPT_CTA[m.dept] || DEPT_CTA.management, fe = m.name.en.split(' ')[0], fa = m.name.ar.split(' ')[0];
  const msg = L(`Hi Planet 👋 I met ${m.name.en} (${m.title.en}) in your office and I'd like to talk about a project.`,
                `أهلاً Planet 👋 قابلت ${m.name.ar} (${m.title.ar}) في مكتبكم وعايز أتكلم عن مشروع.`);
  return [
    { label, act: () => { if (svc && !brief.svcs.includes(svc)) brief.svcs.push(svc); if (svc && !(brief.wants[svc] || []).length) brief.wants[svc] = SERVICE_GETS[svc].map((_, k) => k); brief.step = 0; openExhibit(svc ? 'brief' : 'contact'); } },
    { label: L(`💬 WhatsApp ${fe}`, `💬 كلّم ${fa} واتساب`), cls: 'wa', act: () => window.open('https://wa.me/201203101104?text=' + encodeURIComponent(t(msg)), '_blank', 'noopener') },
    { label: L("👤 Profile", "👤 البروفايل"), cls: 'ghost', act: () => openExhibit('member', m.id) },
  ];
}
function talkToCrew(s){
  const m = s.m;
  talk(m.name, crewLines(m), true, () => openExhibit(m.id === 'emp-001' ? 'contact' : 'member', m.id), crewCta(m));
}

/* ---------- People who work in each building ----------
   A restaurant has a cashier, a waiter carrying a tray between the tables, a chef at the stove in the kitchen
   and a manager; a clinic has a receptionist, a doctor and a nurse; a travel agency, a shop and an office have
   their own crews — and the guests sitting at the tables. Every client gets its own colours, its own look and
   its own people (seeded from the building, so the same faces greet you every visit). Planet's studios get
   two more of the real team at work beside the host. Everyone can be talked to. */

const IST = { list: [], seated: [] };
const ROOM_SIZE = { resto: [12.5, 9.5], clinic: [12, 9], kiosk: [11, 8], glass: [11, 8], shop: [11, 8], office: [11, 8] };
const M_NAMES = [['Omar', 'عمر'], ['Youssef', 'يوسف'], ['Karim', 'كريم'], ['Mahmoud', 'محمود'], ['Ahmed', 'أحمد'], ['Hassan', 'حسن'], ['Tarek', 'طارق'], ['Ziad', 'زياد'], ['Mostafa', 'مصطفى'], ['Ali', 'علي']];
const F_NAMES = [['Nour', 'نور'], ['Mariam', 'مريم'], ['Salma', 'سلمى'], ['Hana', 'هنا'], ['Laila', 'ليلى'], ['Farida', 'فريدة'], ['Yasmin', 'ياسمين'], ['Dina', 'دينا'], ['Rana', 'رنا'], ['Malak', 'ملك']];
const ROOM_PALS = [ // wall, floor, chairs, accent — every client room gets one, so no two places look the same
  [0xFBE3D3, 0x9C6B48, 0xE76F51, 0xF2C94C], [0xE8F1EC, 0x7E5B42, 0x3E8E7E, 0xF2C94C], [0xF6EEDC, 0xB58A62, 0x2E6BA9, 0xE76F51],
  [0xF3E8F4, 0x8C6E5B, 0x8E6BC2, 0xE9A0B8], [0xEAF2FA, 0x6E6A80, 0x12153A, 0x5FA0E6], [0xFFF3E0, 0xA9744F, 0xC0392B, 0x2B2420]];

function seedOf(s){ let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rngOf(seed){ let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* a person for a role: a random but fixed face, hair (hijab sometimes) and the role's clothes */
function staffLook(r, outfit = {}){
  const pick = n => Math.floor(r() * n);
  const hair = outfit.hair ?? [0, 1, 2, 3, 4, 5, 6, 6, 7, 0, 1][pick(11)];
  const female = [2, 3, 4, 6, 7].includes(hair);
  const o = { body: 1, skin: pick(AV_SKIN.length), hair, hairC: pick(6), top: outfit.top ?? 0, topC: outfit.topC ?? pick(AV_CLOTH.length), pants: outfit.pants ?? [6, 9, 0, 2][pick(4)],
    shoes: [9, 6, 5, 2][pick(4)], beard: female ? 0 : (r() < 0.35 ? 1 + pick(3) : 0), scarf: pick(AV_CLOTH.length), hat: 0, glass: r() < 0.18 ? 1 : 0, topHex: outfit.topHex, pantsHex: outfit.pantsHex };
  const nm = female ? F_NAMES[pick(F_NAMES.length)] : M_NAMES[pick(M_NAMES.length)];
  return { o, female, name: L(nm[0], nm[1]) };
}
function staffFigure(look, extras){
  const out = {}; const parts = buildHuman(look.o, out);
  const g = new THREE.Group(); g.add(parts.body);
  g.userData = { dyn: true, body: parts.body, armL: out.armL, armR: out.armR, legL: out.legL, legR: out.legR, elL: out.elL, elR: out.elR, knL: out.knL, knR: out.knR, head: out.head, k: 0 };
  if (extras) extras(g, out); return g;
}
/* role props */
function chefHat(g, out){ const h = new THREE.Group(); h.position.set(0, 0.44, -0.01); out.head.add(h);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20), toon(0xFFFFFF)); band.position.y = 0.0; h.add(band);
  [[0, 0.16, 0], [-0.1, 0.13, 0.05], [0.1, 0.13, 0.05], [0, 0.13, -0.1]].forEach(([x, y, z]) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), toon(0xFFFFFF)); p.position.set(x, y, z); h.add(p); });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.02), toon(0xF4F7FC)); apron.position.set(0, 0.82, 0.155); out.body.add(apron); }
function stethoscope(g, out){ const s = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 20, Math.PI * 1.3), toon(0x12153A)); s.position.set(0, 1.12, 0.12); s.rotation.set(-0.35, 0, Math.PI * 0.85); out.body.add(s);
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 12), toon(0xC9CED8)); d.position.set(0.06, 0.97, 0.16); d.rotation.x = Math.PI / 2; out.body.add(d); }
function nurseCap(g, out){ const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), toon(0xFFFFFF)); c.position.set(0, 0.43, 0.04); out.head.add(c);
  const x = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xE05A5A })); x.position.set(0, 0.43, 0.095); out.head.add(x); }
function tray(g, out){ const t = new THREE.Group(); t.position.set(0, -0.3, 0.12); out.elR.add(t);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), toon(0xC9CED8)); t.add(plate);
  [[0.06, 0.04, 0xF2C94C], [-0.07, -0.03, 0xE76F51]].forEach(([x, z, c]) => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 10), toon(c)); cup.position.set(x, 0.055, z); t.add(cup); });
  g.userData.carry = true; }
function clipboard(g, out){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), toon(0x8A6A4A)); b.position.set(0, -0.3, 0.1); b.rotation.x = -1.0; out.elL.add(b);
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })); pg.position.set(0, -0.299, 0.112); pg.rotation.x = -1.0; out.elL.add(pg); g.userData.holdL = true; }

/* place someone in the room; kind: idle | patrol | chop | seated | type */
function addStaff(look, x, z, yaw, role, lines, opt = {}){
  const g = staffFigure(look, opt.extras); g.position.set(x, 0, z); g.rotation.y = yaw; iG.add(g);
  const name = opt.name || look.name, tag = crewTag({ name, title: role }); tag.position.set(x, 2.3, z); tag.visible = false; iG.add(tag);
  const s = { g, x, z, yaw, baseYaw: yaw, role, name, lines, tag, kind: opt.kind || 'idle', path: opt.path || null, pi: 0, ph: Math.random() * 6, seat: opt.seat, talkable: opt.talkable !== false };
  if (s.kind === 'seated' || s.kind === 'type'){ sitPose(g, opt.seatH ?? 0.5); }
  if (s.kind !== 'patrol') blk(x - 0.28, z - 0.28, x + 0.28, z + 0.28);
  IST.list.push(s); return s;
}
function sitPose(g, h){ const u = g.userData; u.legL.rotation.x = u.legR.rotation.x = -1.5; u.knL.rotation.x = u.knR.rotation.x = 1.45; u.armL.rotation.x = u.armR.rotation.x = -0.45; u.elL.rotation.x = u.elR.rotation.x = -0.5; g.position.y = h - 0.64 + 0.04; }
/* drop the chair from the free seats so you don't sit on a guest */
function takeSeat(x, z){ for (let i = iSeats.length - 1; i >= 0; i--) if (Math.hypot(iSeats[i].x - x, iSeats[i].z - z) < 0.3) iSeats.splice(i, 1); }
/* a free spot on the floor for a guest or a colleague: away from furniture, the door, the host and the photo spots */
function freeSpot(r, avoid = []){
  for (let k = 0; k < 60; k++){ const x = (r() - 0.5) * (iW - 1.6), z = (r() - 0.5) * (iD - 2.2) - 0.3;
    if (Math.abs(x) < 1.3 && z > iD / 2 - 2.2) continue;
    if (iBlocks.some(([x0, z0, x1, z1]) => x > x0 - 0.55 && x < x1 + 0.55 && z > z0 - 0.55 && z < z1 + 0.55)) continue;
    if (iHost && Math.hypot(iHost.x - x, iHost.z - z) < 1.6) continue;
    if (FUN.spots.some(s => Math.hypot(s.x - x, s.z - z) < 1.4)) continue;
    if (avoid.some(([a, b]) => Math.hypot(a - x, b - z) < 1.4)) continue;
    return [x, z]; }
  return null;
}

/* ---------- the kitchen at the back of every restaurant ---------- */
function kitchen(pal){
  const x0 = iW / 2 - 2.6, z1 = -iD / 2 + 2.5;
  // tiled floor and the pass with its little window and the order bell
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.5), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x, W, H, d) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++){ x.fillStyle = (i + j) % 2 ? '#F4F7FC' : '#C9D3E2'; x.fillRect(i * 16, j * 16, 16, 16); } d(); }) }));
  tiles.rotation.x = -Math.PI / 2; tiles.position.set(x0 + 1.3, 0.02, -iD / 2 + 1.25); iG.add(tiles);
  B(1.9, 1.0, 0.18, 0xF4F7FC, x0 + 0.95, 0.5, z1); B(2.0, 0.06, 0.4, 0xC9CED8, x0 + 0.95, 1.03, z1, false); blk(x0 - 0.1, z1 - 0.2, x0 + 1.95, z1 + 0.2);
  B(0.15, 2.6, 2.5, pal[0], x0, 1.3, -iD / 2 + 1.25); blk(x0 - 0.1, -iD / 2, x0 + 0.1, z1);
  const bell = C(0.05, 0.08, 0.06, 0xF2C94C, x0 + 1.5, 1.09, z1 + 0.05, 12, false);
  [0, 1].forEach(k => { const pl = C(0.13, 0.13, 0.02, 0xF4F7FC, x0 + 0.5 + k * 0.45, 1.07, z1, 16, false); const f = mesh(new THREE.SphereGeometry(0.08, 10, 6), [0xE76F51, 0x7A8B4A][k], 0); f.scale.y = 0.5; f.position.set(x0 + 0.5 + k * 0.45, 1.1, z1); iG.add(f); });
  // the line: a range with four burners and flames, a hood, a steel fridge, and a prep table
  B(1.3, 0.92, 0.7, 0x3A3F4C, x0 + 1.1, 0.46, -iD / 2 + 0.45); B(1.32, 0.04, 0.72, 0x1E2128, x0 + 1.1, 0.94, -iD / 2 + 0.45, false);
  for (let i = 0; i < 4; i++){ const bx = x0 + 0.78 + (i % 2) * 0.62, bz = -iD / 2 + 0.3 + Math.floor(i / 2) * 0.32; C(0.12, 0.12, 0.02, 0x12153A, bx, 0.97, bz, 14, false);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x5FA0E6 : 0xFF9A3C, transparent: true, opacity: 0.85 })); fl.position.set(bx, 1.04, bz); iG.add(fl); IST.flames = IST.flames || []; IST.flames.push(fl); }
  const pan = C(0.16, 0.13, 0.06, 0x2B2B2B, x0 + 0.78, 1.04, -iD / 2 + 0.3, 16, false); IST.pan = pan;
  B(1.3, 0.35, 0.7, 0xC9CED8, x0 + 1.1, 2.15, -iD / 2 + 0.4); B(0.4, 0.5, 0.4, 0xC9CED8, x0 + 1.1, 2.55, -iD / 2 + 0.35, false);
  blk(x0 + 0.4, -iD / 2, x0 + 1.8, -iD / 2 + 0.85);
  B(0.75, 1.9, 0.65, 0xD7DDE6, iW / 2 - 0.45, 0.95, -iD / 2 + 1.6); B(0.03, 0.6, 0.03, 0x8A93A3, iW / 2 - 0.82, 1.2, -iD / 2 + 1.27, false); blk(iW / 2 - 0.85, -iD / 2 + 1.25, iW / 2, -iD / 2 + 1.95);
  return { chefAt: [x0 + 1.1, -iD / 2 + 1.25] };
}

/* ---------- the crew of each kind of place ---------- */
const CREW = {
  resto(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    const k = kitchen(pal);
    out.staff.push(() => addStaff(staffLook(r, { top: 2, topC: 5, pants: 9, hair: [0, 5, 1][Math.floor(r() * 3)] }), k.chefAt[0], k.chefAt[1], Math.PI, L('Head chef', 'الشيف'),
      [L(`Welcome to the kitchen of ${cn.en}! Everything here is cooked fresh to order.`, `أهلاً بيك في مطبخ ${cn.ar}! كل حاجة هنا بتتعمل طازة أول بأول.`),
       L('The secret? Good ingredients, a hot grill, and no shortcuts.', 'السر؟ مكونات حلوة، شواية سخنة، ومفيش استعجال.'),
       L('Planet shoots our dishes for the menu and the Reels — they always make the food look as good as it tastes.', 'Planet بتصوّر أكلنا للمنيو والريلز — ودايماً بيطلع شكله حلو زي طعمه.')], { kind: 'chop', extras: chefHat }));
    const tables = [[1.0, -0.8], [3.0, -0.8], [1.0, 1.4], [3.0, 1.4], [-1.6, 1.4]];
    const path = [[0, 0.3], [2.0, 0.3], [2.0, 2.8], [0, 2.8], [-2.6, 2.8], [-2.6, 0.3]];
    out.staff.push(() => addStaff(staffLook(r, { top: 4, topC: 9, pants: 9 }), path[0][0], path[0][1], 0, L('Waiter', 'الجرسون'),
      [L('Table for one? Sit anywhere you like — I\'ll bring the menu right away.', 'ترابيزة لواحد؟ اقعد في أي مكان يعجبك — والمنيو جاي حالاً.'),
       L(`Try the house special today — everyone at ${cn.en} is talking about it.`, `جرّب طبق اليوم — كل اللي في ${cn.ar} بيتكلموا عنه.`)], { kind: 'patrol', path, extras: tray }));
    out.staff.push(() => { const s = [-iW / 2 + 1.1, iD / 2 - 1.4]; table(s[0], s[1] - 0.55, 0.9, 0.5, 0x6B4227); return addStaff(staffLook(r, { top: 4, topC: [6, 0, 9][Math.floor(r() * 3)] }), s[0], s[1], Math.PI, L('Manager', 'المدير'),
      [L(`I run ${cn.en}. We opened with one idea: food you'd come back for.`, `أنا مدير ${cn.ar}. فتحنا بفكرة واحدة: أكل ترجعله تاني.`),
       L('Planet handles our marketing — the brand, the menus, the social pages and the ads. Our tables have been fuller ever since.', 'Planet ماسكة التسويق بتاعنا — البراند والمنيو والسوشيال والإعلانات. ومن ساعتها الترابيزات مليانة أكتر.')], { kind: 'idle', extras: clipboard }); });
    // the guests: a couple of tables are taken
    out.guests = [[1.0, -1.55, 0], [3.0, 2.15, Math.PI], [-1.6, 0.65, 0], [3.0, -1.55, 0]];
    // a few more tables in the bigger room, along the left wall
    [[-iW / 2 + 1.3, -2.2], [-iW / 2 + 1.3, 2.6 - iD / 2 + 2.6 - 2.6]].slice(0, 1).forEach(([x, z]) => { table(x, z, 0.85, 0.85, 0x6B4227, 0.75, true); chair(x + 0.75, z, -Math.PI / 2, pal[2]); pendant(x, z, pal[3]); });
    return out; },
  clinic(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    out.staff.push(() => addStaff(staffLook(r, { top: 2, topC: 5, pants: 6 }), 3.35, -0.55, -2.4, L('Doctor', 'الدكتور'),
      [L(`Hello! I'm one of the doctors at ${cn.en}. Come in, nothing to worry about.`, `أهلاً! أنا من دكاترة ${cn.ar}. اتفضل، مفيش حاجة تقلق.`),
       L('A check-up every six months keeps small things small. Book your visit at reception.', 'كشف كل ست شهور بيخلي الحاجات الصغيرة تفضل صغيرة. احجز ميعادك من الاستقبال.')], { kind: 'idle', extras: stethoscope }));
    out.staff.push(() => addStaff(staffLook(r, { top: 0, topC: 3, pants: 3, topHex: 0x7FC8B8, pantsHex: 0x7FC8B8 }), 0, -1.6, 0, L('Nurse', 'الممرضة'),
      [L('The doctor will see you shortly — can I get you some water while you wait?', 'الدكتور هيشوفك حالاً — أجيبلك مية وإنت مستني؟'),
       L(`Everything at ${cn.en} is sterilised after every patient.`, `كل حاجة في ${cn.ar} بتتعقّم بعد كل مريض.`)], { kind: 'patrol', path: [[0, -1.6], [2.0, -0.2], [0.4, 0.8], [-2.2, -0.6]], extras: nurseCap }));
    out.staff.push(() => addStaff(staffLook(r, { top: 4, topC: 6 }), iW / 2 - 1.4, iD / 2 - 1.6, Math.PI + 0.6, L('Clinic manager', 'مديرة العيادة'),
      [L(`Our patients find us online now — Planet built ${cn.en}'s pages and campaigns.`, `المرضى بقوا يلاقونا أونلاين — Planet عملت صفحات وحملات ${cn.ar}.`),
       L('Booking used to be phone calls only. Now half of our appointments come from the ads.', 'الحجز كان بالتليفون بس. دلوقتي نص المواعيد جاية من الإعلانات.')], { kind: 'idle', extras: clipboard }));
    out.guests = [[-iW / 2 + 0.6, 0.15, Math.PI / 2], [-iW / 2 + 0.6, 1.65, Math.PI / 2]];
    // a second bed behind a curtain
    { const bx = iW / 2 - 1.2, bz = 0.9; B(0.9, 0.5, 1.8, 0xF4F7FC, bx, 0.25, bz); B(0.86, 0.1, 0.5, 0xBFE3EE, bx, 0.55, bz - 0.6, false); blk(bx - 0.5, bz - 0.95, bx + 0.5, bz + 0.95);
      const cur = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshToonMaterial({ color: 0xBFE3EE, gradientMap: grad, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); cur.position.set(bx - 0.7, 1.05, bz); cur.rotation.y = Math.PI / 2; iG.add(cur);
      C(0.015, 0.015, 1.9, 0xC9CED8, bx - 0.7, 2.05, bz, 4, false).rotation.x = Math.PI / 2; }
    return out; },
  kiosk(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    const dx = -iW / 2 + 1.7, dz = 0.2; desk(dx, dz, Math.PI / 2, 0xF4F7FC, false); chair(dx + 0.95, dz, -Math.PI / 2, pal[2]);
    out.staff.push(() => addStaff(staffLook(r, { top: 2, topC: [0, 6, 3][Math.floor(r() * 3)] }), dx - 0.75, dz, Math.PI / 2, L('Travel advisor', 'مستشار السفر'),
      [L(`Where to? Dubai, Istanbul, Paris — ${cn.en} sorts the flights, the hotel and the visa.`, `على فين؟ دبي، إسطنبول، باريس — ${cn.ar} بتظبط الطيران والفندق والفيزا.`),
       L('Our summer packages sold out in a week — the campaign Planet ran for us did that.', 'باكدجات الصيف خلصت في أسبوع — الحملة اللي عملتها Planet لينا هي السبب.')], { kind: 'type' }));
    out.guests = [[dx + 0.95, dz, -Math.PI / 2]];
    out.staff.push(() => addStaff(staffLook(r, { top: 4, topC: 6 }), iW / 2 - 1.3, iD / 2 - 1.5, Math.PI + 0.5, L('Branch manager', 'مدير الفرع'),
      [L('Most of our customers now message us straight from Instagram.', 'أغلب عملاءنا بقوا يكلمونا على طول من إنستجرام.')], { kind: 'idle', extras: clipboard }));
    return out; },
  glass(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    [-2.4, 0, 2.4].forEach((x, i) => { if (i === 1) return; out.guests = out.guests || []; out.staffSeat = out.staffSeat || []; out.staffSeat.push([x, -1.3 + 0.65, Math.PI]); });
    out.staff.push(() => { const [x, z, y] = out.staffSeat[0]; takeSeat(x, z); return addStaff(staffLook(r, { top: [0, 2][Math.floor(r() * 2)] }), x, z, y, L('Analyst', 'محلل'),
      [L(`The numbers at ${cn.en} have been climbing since the new campaign.`, `أرقام ${cn.ar} طالعة من ساعة الحملة الجديدة.`)], { kind: 'type', seatH: 0.5 }); });
    out.staff.push(() => { const [x, z, y] = out.staffSeat[1]; takeSeat(x, z); return addStaff(staffLook(r, { top: 1 }), x, z, y, L('Designer', 'مصمم'),
      [L('I work on our decks and reports — Planet set up the brand guide we follow.', 'أنا بشتغل على البريزنتيشنز والتقارير — Planet عملت الجايدلاين اللي ماشيين عليه.')], { kind: 'type', seatH: 0.5 }); });
    out.staff.push(() => addStaff(staffLook(r, { top: 4, topC: 0 }), iW / 2 - 1.3, iD / 2 - 1.6, Math.PI + 0.5, L('Director', 'المدير'),
      [L(`${cn.en} is growing — we're hiring this quarter.`, `${cn.ar} بتكبر — وبنوظّف الربع ده.`)], { kind: 'idle', extras: clipboard }));
    return out; },
  shop(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    out.staff.push(() => addStaff(staffLook(r, { top: 0, topHex: pal[3] }), -2.2, -1.6, 0, L('Sales assistant', 'مساعدة المبيعات'),
      [L('Looking for something special? The new collection just arrived.', 'بتدوّر على حاجة مميزة؟ الكوليكشن الجديد لسه نازل.'),
       L(`Every piece at ${cn.en} is photographed by Planet before it goes online.`, `كل قطعة في ${cn.ar} Planet بتصوّرها قبل ما تنزل أونلاين.`)], { kind: 'patrol', path: [[-2.2, -1.6], [2.2, -1.6], [2.2, 0.0], [-2.2, 0.0]] }));
    out.walkers = 1;
    return out; },
  office(p, r, pal, c){
    const cn = c ? c.name : p.name, out = { staff: [] };
    out.staff.push(() => { takeSeat(-2.4, -0.75); return addStaff(staffLook(r, { top: 4, topC: 6 }), -2.4, -0.75, Math.PI, L('Associate', 'مستشار'),
      [L(`At ${cn.en} we explain your rights in plain words — no jargon.`, `في ${cn.ar} بنشرحلك حقك بكلام بسيط — من غير تعقيد.`)], { kind: 'type', seatH: 0.5 }); });
    out.staff.push(() => { takeSeat(0, -0.75); return addStaff(staffLook(r, { top: 2 }), 0, -0.75, Math.PI, L('Secretary', 'السكرتارية'),
      [L('Would you like to book a consultation? I can find you a slot this week.', 'تحب تحجز استشارة؟ أقدر ألاقيلك ميعاد الأسبوع ده.')], { kind: 'type', seatH: 0.5 }); });
    return out; },
};
const HOST_ROLE = { resto: L('Cashier', 'الكاشير'), clinic: L('Reception', 'الاستقبال'), kiosk: L('Travel agent', 'موظف الحجز'), glass: L('Account manager', 'مدير الحسابات'), shop: L('Cashier', 'الكاشير'), office: L('Consultant', 'المستشار') };
const GUEST_LINES = [L('This place is lovely — first time here?', 'المكان ده حلو أوي — أول مرة تيجي؟'), L('I saw their ad on Instagram and had to come.', 'شفت إعلانهم على إنستجرام وقلت لازم آجي.'),
  L('Honestly, the best in the area.', 'بصراحة أحسن مكان في المنطقة.'), L('I come here every week.', 'أنا باجي هنا كل أسبوع.'), L('Their page is so fun to follow.', 'صفحتهم ظريفة أوي بتابعها على طول.')];

function staffRoom(p){
  IST.list.length = 0; IST.flames = []; IST.pan = null;
  const theme = themeOf(p), c = p.client, r = rngOf(seedOf(p.id || (c && c.name.en) || 'x'));
  if (CREW[theme]){
    const pal = ROOM_PALS[seedOf(p.id) % ROOM_PALS.length];
    const plan = CREW[theme](p, r, pal, c);
    // the host becomes a proper person in the role's uniform
    if (iHost && !iHost.m){ const old = iHost.g, look = staffLook(r, { top: theme === 'clinic' ? 0 : theme === 'office' || theme === 'glass' ? 4 : 0, topHex: theme === 'clinic' ? 0x7FC8B8 : pal[3] });
      const g = staffFigure(look); g.position.copy(old.position); g.rotation.copy(old.rotation); iG.remove(old); iG.add(g); iHost.g = g;
      iG.remove(iHost.tag); iHost.tag = crewTag({ name: look.name, title: HOST_ROLE[theme] || L('Your host here', 'المضيف هنا') }); iHost.tag.position.set(iHost.x, 2.3, iHost.z); iHost.tag.visible = false; iG.add(iHost.tag); }
    plan.staff.forEach(f => { try { f(); } catch (e) { console.warn('staff', e); } });
    (plan.guests || []).forEach(([x, z, y], i) => { takeSeat(x, z); addStaff(staffLook(r), x, z, y, L('Guest', 'زبون'), [GUEST_LINES[(seedOf(p.id) + i) % GUEST_LINES.length]], { kind: 'seated', seatH: 0.5 }); });
    for (let i = 0; i < (plan.walkers || 0); i++){ const sp = freeSpot(r); if (sp) addStaff(staffLook(r), sp[0], sp[1], r() * 6, L('Customer', 'زبون'), [GUEST_LINES[(seedOf(p.id) + 3 + i) % GUEST_LINES.length]], { kind: 'idle' }); }
  } else if (TEAM && TEAM.length){ // Planet studios: two more of the team at work beside the host
    const hostId = iHost && iHost.m ? iHost.m.id : '', pool = TEAM.filter(m => m.id !== hostId && m.photo);
    const avoid = [];
    for (let i = 0; i < 2 && pool.length; i++){
      const m = pool[(seedOf(p.id) + i * 7) % pool.length]; pool.splice(pool.indexOf(m), 1);
      const sp = freeSpot(r, avoid); if (!sp) break; avoid.push(sp);
      const n = parseInt(m.id.slice(4)) || i, g = person(n * 3, { face: faceTex(m.photo), logo: logoTex(PLANET_C) });
      g.position.set(sp[0], 0, sp[1]); g.rotation.y = Math.atan2(-sp[0], -sp[1]); iG.add(g); blk(sp[0] - 0.28, sp[1] - 0.28, sp[0] + 0.28, sp[1] + 0.28);
      const tag = crewTag(m); tag.position.set(sp[0], 2.35, sp[1]); tag.visible = false; iG.add(tag);
      IST.list.push({ g, x: sp[0], z: sp[1], yaw: g.rotation.y, baseYaw: g.rotation.y, role: m.title, name: m.name, tag, kind: 'idle', ph: i * 2, talkable: true, team: true,
        lines: [L(`Hi! I'm ${m.name.en}, ${m.title.en} at Planet.`, `أهلاً! أنا ${m.name.ar}، ${m.title.ar} في Planet.`),
                L(`This is ${p.name.en} — ask our host anything, or try the photo spot.`, `ده ${p.name.ar} — اسأل المضيف عن أي حاجة، أو جرّب ركن التصوير.`)] });
    }
  }
}

/* ---------- moving them every frame ---------- */
const _sv = new THREE.Vector2();
function staffFrame(dt, ts){
  for (const s of IST.list){
    const u = s.g.userData, dP = Math.hypot(s.x - iPos.x, s.z - iPos.y);
    if (s.kind === 'seated'){ s.g.position.y += 0; if (u.head) u.head.rotation.y = Math.sin(ts * 0.7 + s.ph) * 0.4; s.tag.visible = dP < 1.8; continue; }
    if (s.kind === 'type'){ if (u.armL){ u.armL.rotation.x = -0.9 + Math.sin(ts * 14 + s.ph) * 0.06; u.armR.rotation.x = -0.9 + Math.cos(ts * 13 + s.ph) * 0.06; u.elL.rotation.x = u.elR.rotation.x = -0.6; }
      s.tag.visible = dP < 1.9; continue; }
    let walking = false;
    if (s.kind === 'patrol' && s.path && !(dP < 1.0 && state === 'play') && state !== 'talk'){
      const [tx, tz] = s.path[s.pi], dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
      if (d < 0.08){ s.pi = (s.pi + 1) % s.path.length; s.wait = 1.2 + Math.random(); }
      else if ((s.wait = (s.wait || 0) - dt) <= 0){ const sp = Math.min(d, 1.05 * dt); s.x += dx / d * sp; s.z += dz / d * sp; walking = true;
        const want = Math.atan2(dx, dz); let dA = want - s.g.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); s.g.rotation.y += dA * (1 - Math.exp(-8 * dt)); }
      s.g.position.set(s.x, 0, s.z); s.walkT = (s.walkT || 0) + (walking ? dt * 7 : 0);
    }
    // turn towards you when you come close, otherwise go back to work
    if (!walking){ const want = dP < 3.2 ? Math.atan2(iPos.x - s.x, iPos.y - s.z) : s.baseYaw; let dA = want - s.g.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); s.g.rotation.y += dA * (1 - Math.exp(-4 * dt)); }
    animatePerson(s.g, walking ? s.walkT : 0, !walking && dP < 2.2 && !s.team && s.kind !== 'chop', ts + s.ph);
    if (s.kind === 'chop' && dP > 2.2 && u.armR){ u.armR.rotation.x = -0.9 + Math.abs(Math.sin(ts * 9)) * -0.6; u.armL.rotation.x = -0.7; if (u.elR) u.elR.rotation.x = -0.5; }
    if (u.carry && u.armR){ u.armR.rotation.z = 0; u.armR.rotation.x = -1.25; if (u.elR) u.elR.rotation.x = -0.35; }
    if (u.holdL && u.armL){ u.armL.rotation.x = -0.7; if (u.elL) u.elL.rotation.x = -0.9; }
    s.tag.position.set(s.x, 2.3, s.z); s.tag.visible = dP < 1.9;
  }
  if (IST.flames) IST.flames.forEach((f, i) => { f.scale.y = 0.75 + Math.abs(Math.sin(ts * 11 + i * 1.7)) * 0.6; f.scale.x = f.scale.z = 0.9 + Math.sin(ts * 7 + i) * 0.1; });
  if (IST.pan){ IST.pan.rotation.z = Math.sin(ts * 3) * 0.08; }
}
function nearestStaff(){ let best = null, bd = 1.5; for (const s of IST.list){ if (!s.talkable) continue; const d = Math.hypot(s.x - iPos.x, s.z - iPos.y); if (d < bd){ bd = d; best = s; } } return best; }

/* ---------- wiring ---------- */
{ const plainBuild = buildRoom; buildRoom = function(p){
    const theme = themeOf(p), sz = ROOM_SIZE[theme];
    if (sz){ const keep = THEMES[theme]; if (!keep._sized){ THEMES[theme] = function(pp){ iW = sz[0]; iD = sz[1]; return keep.apply(this, arguments); }; THEMES[theme]._sized = true; } }
    const r = plainBuild.apply(this, arguments); try { staffRoom(p); } catch (e) { console.warn('staff room', e); } return r; }; }
{ const plainClear = clearRoom; clearRoom = function(){ IST.list.length = 0; IST.flames = []; IST.pan = null; return plainClear.apply(this, arguments); }; }
{ const plainFrame = interiorFrame; interiorFrame = function(dt, now){
    const r = plainFrame.apply(this, arguments); if (!r) return r;
    staffFrame(dt, now / 1000);
    if (state === 'play' && !sitting && (!near || near.kind === 'seat')){
      const s = nearestStaff(), sd = near && near.kind === 'seat' ? Math.hypot(near.ref.x - iPos.x, near.ref.z - iPos.y) : 99; if (s && Math.hypot(s.x - iPos.x, s.z - iPos.y) < sd){ near = { kind: 'istaff', ref: s }; $('prompt').hidden = false; $('promptText').textContent = `${t(UI.talk)} ${t(s.name)} · ${t(s.role)}`; } }
    return r; }; }
{ const plainInteract = interact; interact = function(tk){
    if (tk && tk.kind === 'istaff'){ const s = tk.ref; s.g.rotation.y = Math.atan2(iPos.x - s.x, iPos.y - s.z); return talk(s.name, s.lines, true); }
    return plainInteract.apply(this, arguments); }; }

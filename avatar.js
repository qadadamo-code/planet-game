/* ---------- The character creator: pick a whole person — skin, face, hair or hijab, beard, clothes and shoes —
   or stay the Planet astronaut. The same body is built for me and for the people who see me online. ---------- */
const AV_SKIN = [0xF6D7BE, 0xEDC09A, 0xD9A27A, 0xB57A55, 0x8D5A3B, 0x5E3A26];
const AV_HAIRC = [0x1B120D, 0x3B2416, 0x6A4327, 0xA0703D, 0xD8B36A, 0xB2502E, 0x9AA0A8, 0x2E3A6B];
const AV_CLOTH = [0x2E6BA9, 0xF2C94C, 0xE76F51, 0x3E8E7E, 0x8E6BC2, 0xF4F7FC, 0x12153A, 0xE9A0B8, 0x7A8B4A, 0x2B2B2B, 0xC0392B, 0xA6D0E8];
const AV_BODY = [L('Planet astronaut', 'رائد فضاء Planet'), L('Me, my way', 'أنا بشكلي')];
const AV_HAIR = [L('Short', 'قصير'), L('Curly', 'كيرلي'), L('Long', 'طويل'), L('Bun', 'كعكة'), L('Ponytail', 'ديل حصان'), L('Buzz', 'محلوق'), L('Hijab', 'حجاب'), L('Turban hijab', 'حجاب توربان')];
const AV_TOP = [L('T-shirt', 'تيشيرت'), L('Hoodie', 'هودي'), L('Jacket', 'جاكيت'), L('Abaya / dress', 'عباية / فستان'), L('Suit', 'بدلة'), L('Overalls', 'أوفرول')];
const AV_BEARD = [L('None', 'من غير'), L('Stubble', 'دقن خفيفة'), L('Beard', 'دقن'), L('Moustache', 'شنب')];
/* the old three fields stay, the new ones ride along after an "h" so older visitors still read the hat and glasses */
const AVX = Object.assign({ body: 0, skin: 1, hair: 0, hairC: 0, top: 0, topC: 0, pants: 6, shoes: 9, beard: 0, scarf: 4 }, profile.avx || {});
const avxCode = () => `h${AVX.body}.${AVX.skin}.${AVX.hair}.${AVX.hairC}.${AVX.top}.${AVX.topC}.${AVX.pants}.${AVX.shoes}.${AVX.beard}.${AVX.scarf}.${AV.hat}.${AV.glass}.${AV.hair}`;
function avxParse(s){
  s = String(s || ''); if (s[0] !== 'h') return null;
  const n = s.slice(1).split('.').map(Number), ok = (v, max) => Number.isFinite(v) && v >= 0 && v < max ? v : 0;
  return { body: ok(n[0], 2), skin: ok(n[1], AV_SKIN.length), hair: ok(n[2], AV_HAIR.length), hairC: ok(n[3], AV_HAIRC.length), top: ok(n[4], AV_TOP.length), topC: ok(n[5], AV_CLOTH.length),
    pants: ok(n[6], AV_CLOTH.length), shoes: ok(n[7], AV_CLOTH.length), beard: ok(n[8], AV_BEARD.length), scarf: ok(n[9], AV_CLOTH.length), hat: ok(n[10], 6), glass: ok(n[11], 4), look: Number.isFinite(n[12]) ? n[12] : -1 };
}

/* a soft rounded box for small parts (shoes, bag, hair locks) */
function RS(w, h, d){ const b = Math.min(w, h, d) * 0.42, sw = w - 2*b, sh = h - 2*b, sp = new THREE.Shape(), x0 = -sw/2, y0 = -sh/2;
  sp.moveTo(x0, y0); sp.lineTo(x0 + sw, y0); sp.lineTo(x0 + sw, y0 + sh); sp.lineTo(x0, y0 + sh); sp.lineTo(x0, y0);
  const depth = Math.max(0.001, d - 2*b), g = new THREE.ExtrudeGeometry(sp, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 2 });
  g.translate(0, 0, -depth/2); return g; }
/* one human, rigged like the astronaut (hip → knee, shoulder → elbow, neck) so the same walk, run, jump and
   sit poses drive it; it also carries the person() handles so other visitors animate it the usual way */
function buildHuman(o, out){
  const sk = AV_SKIN[o.skin], hc = AV_HAIRC[o.hairC], tc = o.topHex ?? AV_CLOTH[o.topC], pc = o.pantsHex ?? AV_CLOTH[o.pants], sc = AV_CLOTH[o.shoes], scarf = AV_CLOTH[o.scarf];
  const S = (geo, col, par, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, toon(col)); m.position.set(x, y, z); m.castShadow = SHADOWS; par.add(m); return m; };
  const body = new THREE.Group();
  const hijab = o.hair === 6 || o.hair === 7, dress = o.top === 3, longSleeve = o.top !== 0 && o.top !== 5;
  // legs
  const leg = sd => { const hp = new THREE.Group(); hp.position.set(sd * 0.1, 0.64, 0); body.add(hp);
    S(new THREE.CylinderGeometry(0.088, 0.075, 0.32, 14), dress ? pc : o.top === 5 ? tc : pc, hp, 0, -0.15, 0);
    const kn = new THREE.Group(); kn.position.y = -0.31; hp.add(kn);
    S(new THREE.SphereGeometry(0.074, 12, 10), dress ? pc : o.top === 5 ? tc : pc, kn);
    S(new THREE.CylinderGeometry(0.072, 0.058, 0.27, 14), dress ? pc : o.top === 5 ? tc : pc, kn, 0, -0.14, 0);
    const shoe = S(RS(0.13, 0.09, 0.25), sc, kn, 0, -0.29, 0.04); const sole = S(new THREE.BoxGeometry(0.135, 0.025, 0.255), 0xF4F7FC, kn, 0, -0.33, 0.04);
    return { hp, kn }; };
  const lL = leg(-1), lR = leg(1);
  // hips and torso
  S(new THREE.CylinderGeometry(0.175, 0.165, 0.16, 18), o.top === 5 ? tc : pc, body, 0, 0.68, 0).scale.z = 0.78;
  const torso = S(new THREE.CylinderGeometry(0.205, 0.17, 0.46, 20), o.top === 4 ? tc : tc, body, 0, 0.98, 0); torso.scale.z = 0.72;
  const chest = S(new THREE.SphereGeometry(0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), tc, body, 0, 1.2, 0); chest.scale.set(1, 0.45, 0.72);
  if (o.top === 0){ const n = S(new THREE.TorusGeometry(0.07, 0.016, 6, 16), 0xF4F7FC, body, 0, 1.225, 0.035); n.rotation.x = Math.PI / 2; }
  if (o.top === 1){ // hoodie: hood behind the neck, front pocket and the two strings
    const hood = S(new THREE.TorusGeometry(0.13, 0.06, 8, 18), tc, body, 0, 1.24, -0.05); hood.rotation.x = Math.PI / 2 - 0.3;
    S(new THREE.BoxGeometry(0.22, 0.1, 0.02), new THREE.Color(tc).multiplyScalar(0.85).getHex(), body, 0, 0.86, 0.13);
    [-0.04, 0.04].forEach(x => S(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5), 0xF4F7FC, body, x, 1.12, 0.15)); }
  if (o.top === 2){ // jacket open over a white tee, with a zip line
    S(new THREE.BoxGeometry(0.13, 0.42, 0.02), 0xF4F7FC, body, 0, 1.0, 0.142);
    [-0.075, 0.075].forEach(x => S(new THREE.BoxGeometry(0.018, 0.42, 0.024), new THREE.Color(tc).multiplyScalar(0.7).getHex(), body, x, 1.0, 0.144));
    const col = S(new THREE.TorusGeometry(0.12, 0.035, 6, 18, Math.PI), tc, body, 0, 1.22, 0.02); col.rotation.x = -Math.PI / 2 + 0.2; }
  if (o.top === 4){ // suit: white collar, tie and two buttons
    S(new THREE.BoxGeometry(0.1, 0.16, 0.02), 0xF4F7FC, body, 0, 1.14, 0.142);
    S(new THREE.BoxGeometry(0.045, 0.24, 0.022), 0xC0392B, body, 0, 1.04, 0.147);
    [0.94, 0.85].forEach(y => S(new THREE.SphereGeometry(0.014, 6, 4), 0x12153A, body, 0.06, y, 0.146)); }
  if (o.top === 5){ // overalls: a bib and two straps over a tee
    S(new THREE.BoxGeometry(0.22, 0.22, 0.02), tc, body, 0, 1.0, 0.142);
    [-0.07, 0.07].forEach(x => S(new THREE.BoxGeometry(0.03, 0.3, 0.02), tc, body, x, 1.12, 0.14));
    torso.material = toon(0xF4F7FC); chest.material = toon(0xF4F7FC); }
  if (dress){ // a long abaya / dress that falls to the ankles
    const sk2 = S(new THREE.CylinderGeometry(0.19, 0.32, 0.66, 22, 1, true), tc, body, 0, 0.44, 0); sk2.material = toon(tc); sk2.scale.z = 0.86;
    const hem = S(new THREE.TorusGeometry(0.32, 0.016, 6, 26), new THREE.Color(tc).multiplyScalar(0.75).getHex(), body, 0, 0.115, 0); hem.rotation.x = Math.PI / 2; hem.scale.y = 0.86;
    const belt = S(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 18), 0xF2C94C, body, 0, 0.8, 0); belt.scale.z = 0.74; }
  // arms
  const arm = sd => { const sh = new THREE.Group(); sh.position.set(sd * 0.25, 1.15, 0); body.add(sh);
    S(new THREE.SphereGeometry(0.075, 12, 10), o.top === 5 ? 0xF4F7FC : tc, sh);
    S(new THREE.CylinderGeometry(0.066, 0.058, 0.27, 12), o.top === 5 ? 0xF4F7FC : tc, sh, 0, -0.13, 0);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    S(new THREE.CylinderGeometry(0.056, 0.048, 0.24, 12), longSleeve ? tc : sk, el, 0, -0.11, 0);
    if (longSleeve){ const cuff = S(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12), new THREE.Color(tc).multiplyScalar(0.82).getHex(), el, 0, -0.22, 0); }
    S(new THREE.SphereGeometry(0.058, 12, 10), sk, el, 0, -0.27, 0.01);
    sh.rotation.z = sd * 0.12; return { sh, el }; };
  const aL = arm(-1), aR = arm(1);
  // neck and head
  S(new THREE.CylinderGeometry(0.058, 0.064, 0.1, 12), sk, body, 0, 1.25, 0);
  const head = new THREE.Group(); head.position.set(0, 1.28, 0); body.add(head);
  const skull = S(new THREE.SphereGeometry(0.21, 24, 18), sk, head, 0, 0.21, 0.005); skull.scale.set(1, 1.08, 0.98);
  S(new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), sk, head, 0, 0.16, 0.035).scale.set(0.98, 1, 1);
  if (!hijab) [-1, 1].forEach(sd => S(new THREE.SphereGeometry(0.045, 10, 8), sk, head, sd * 0.205, 0.2, 0).scale.set(0.6, 1, 0.8));
  // the face: big anime eyes with a shine, soft brows, a small nose and a smile, a little blush
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1A1422 }), shineM = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), eyeM); e.position.set(sd * 0.072, 0.215, 0.185); e.scale.set(0.85, 1.35, 0.5); head.add(e);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), shineM); sh.position.set(sd * 0.072 - 0.01, 0.235, 0.205); head.add(sh);
    const br = S(new THREE.BoxGeometry(0.06, 0.012, 0.012), hijab ? 0x3B2416 : new THREE.Color(hc).multiplyScalar(0.85).getHex(), head, sd * 0.075, 0.285, 0.19); br.rotation.z = -sd * 0.12;
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), new THREE.MeshBasicMaterial({ color: 0xF08A8A, transparent: true, opacity: 0.45, depthWrite: false })); bl.position.set(sd * 0.115, 0.15, 0.188); bl.rotation.y = sd * 0.5; head.add(bl); });
  S(new THREE.SphereGeometry(0.018, 8, 6), new THREE.Color(sk).multiplyScalar(0.92).getHex(), head, 0, 0.17, 0.21);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7A2C24 })); smile.position.set(0, 0.11, 0.2); smile.rotation.z = Math.PI; head.add(smile);
  // hair or hijab
  const cap = (r, y, th = 0.55, tilt = -0.22) => { const m = S(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI * th), hc, head, 0, y, -0.005); m.rotation.x = tilt; return m; };
  if (hijab){
    const hc2 = scarf, wrap = S(new THREE.SphereGeometry(0.24, 26, 18, Math.PI * 0.64, Math.PI * 1.72, 0, Math.PI * 0.8), hc2, head, 0, 0.2, -0.005); wrap.scale.set(1, 1.08, 1);
    const band = S(new THREE.TorusGeometry(0.2, 0.022, 8, 24, Math.PI * 1.2), new THREE.Color(hc2).multiplyScalar(0.85).getHex(), head, 0, 0.22, 0.02); band.rotation.set(-0.15, 0, -Math.PI * 0.1); band.rotation.z = Math.PI * 1.4;
    const drape = S(new THREE.CylinderGeometry(0.17, 0.27, 0.26, 22, 1, true), hc2, body, 0, 1.2, -0.01); drape.material = toon(hc2); drape.scale.z = 0.85;
    if (o.hair === 7){ const knot = S(new THREE.SphereGeometry(0.11, 14, 10), hc2, head, 0, 0.42, -0.06); knot.scale.set(1.1, 0.8, 1); }
  } else if (o.hair === 5){ cap(0.215, 0.215, 0.5, -0.15); }
  else {
    cap(0.226, 0.22, 0.55, -0.24);
    const fr = S(new THREE.SphereGeometry(0.12, 14, 10), hc, head, 0.05, 0.36, 0.13); fr.scale.set(1.3, 0.45, 0.6); fr.rotation.z = -0.3;
    if (o.hair === 1) for (let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2; S(new THREE.SphereGeometry(0.075, 10, 8), hc, head, Math.cos(a) * 0.17, 0.33 + (k % 2) * 0.04, Math.sin(a) * 0.15 - 0.03); }
    if (o.hair === 2){ const back = S(RS(0.4, 0.42, 0.13), hc, head, 0, 0.05, -0.12); [-1, 1].forEach(sd => S(RS(0.08, 0.3, 0.1), hc, head, sd * 0.19, 0.08, 0.04)); }
    if (o.hair === 3){ S(new THREE.SphereGeometry(0.095, 14, 10), hc, head, 0, 0.44, -0.12); }
    if (o.hair === 4){ S(new THREE.SphereGeometry(0.06, 10, 8), hc, head, 0, 0.3, -0.22); const tail = S(new THREE.CylinderGeometry(0.055, 0.02, 0.3, 10), hc, head, 0, 0.13, -0.26); tail.rotation.x = 0.35; }
  }
  if (!hijab && o.beard){ const bc = hc;
    if (o.beard === 1 || o.beard === 2){ const b = S(new THREE.SphereGeometry(o.beard === 2 ? 0.2 : 0.192, 20, 12, 0, Math.PI * 2, Math.PI * 0.64, Math.PI * 0.36), bc, head, 0, 0.2, 0.012);
      b.scale.set(1, o.beard === 2 ? 1.2 : 1.02, 1); if (o.beard === 1){ b.material = new THREE.MeshToonMaterial({ color: bc, gradientMap: grad, transparent: true, opacity: 0.55 }); } }
    if (o.beard >= 2){ const m = S(RS(0.1, 0.025, 0.03), bc, head, 0, 0.135, 0.205); } }
  // a small Planet crossbody bag, so every messenger still carries the brand
  { const strap = S(new THREE.TorusGeometry(0.26, 0.014, 6, 30), 0x12153A, body, 0, 0.98, 0); strap.rotation.set(Math.PI / 2, 0.55, 0); strap.scale.set(1, 0.72, 1);
    const bag = S(RS(0.2, 0.15, 0.07), 0xF27A3E, body, 0.18, 0.78, 0.12); bag.rotation.y = -0.4;
    const mk = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); mk.position.set(0.195, 0.79, 0.165); mk.rotation.y = -0.4; body.add(mk); }
  if (o.hat || o.glass){ const a = accessories({ hat: o.hat, glass: o.glass }, 0.22); a.position.set(0, 0.24, 0.0); head.add(a); }
  if (out){ out.body = body; out.head = head; out.armL = aL.sh; out.armR = aR.sh; out.elL = aL.el; out.elR = aR.el; out.legL = lL.hp; out.legR = lR.hp; out.knL = lL.kn; out.knR = lR.kn; out.ph = out.ph || 0; out.blend = out.blend || 0; }
  return { body, head, armL: aL.sh, armR: aR.sh, legL: lL.hp, legR: lR.hp };
}

/* swap my own body between the astronaut and my person */
function disposeTree(o){ o.traverse(m => { if (m.geometry && !m.geometry._rb) m.geometry.dispose(); }); }
let myBodyKey = '';
function rebuildMe(force){
  if (!proc.body) return;
  const key = avxCode(); if (!force && key === myBodyKey) return; myBodyKey = key;
  const old = proc.body; rig.remove(old); disposeTree(old);
  if (myAcc){ if (myAcc.parent) myAcc.parent.remove(myAcc); myAcc = null; }
  headInfo = null; headBone = null;
  if (AVX.body === 1){ const r = buildHuman(Object.assign({}, AVX, { hat: AV.hat, glass: AV.glass }), proc); rig.add(r.body); }
  else { buildProceduralPlayer(); addMessengerPack(); paintMyAvatar(); }
}
/* hats and glasses: inside the human head already; on the astronaut they ride on the helmet */
{ const plainPaint = paintMyAvatar; paintMyAvatar = function(){ if (AVX.body === 1){ rebuildMe(); return; } plainPaint(); }; }
{ const plainMy = myState; myState = function(){ const s = plainMy(); if (s) s.a = avxCode(); return s; }; }
/* other visitors: a whole person when they chose one, the classic townsperson otherwise */
{ const plainDress = dressPeer; dressPeer = function(peer, code){
    const x = avxParse(code);
    if (!x) return plainDress(peer, code);
    if (x.body !== 1){ plainDress(peer, `${x.look}.${x.hat}.${x.glass}`); peer.av = code; return; }
    peer.av = code; const vis = peer.body.visible;
    const nb = new THREE.Group(), inner = buildHuman(x); const holder = new THREE.Group(); holder.scale.setScalar(1 / 1.15); holder.add(inner.body); nb.add(holder);
    nb.userData = { dyn: true, body: inner.body, armL: inner.armL, armR: inner.armR, legL: inner.legL, legR: inner.legR, k: peer.num || 0 };
    nb.scale.setScalar(1.15); nb.visible = vis; if (peer.body.parent) peer.body.parent.remove(peer.body); peer.g.add(nb); peer.body = nb; }; }
function saveAvx(){ profile.avx = Object.assign({}, AVX); saveAvatar(); rebuildMe(); }

/* ---------- a little live preview of the look while choosing ---------- */
const avPrev = { r: null, scene: null, cam: null, fig: null, raf: 0, key: '' };
function avPreviewStart(cv){
  try {
    if (!avPrev.r){ avPrev.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); avPrev.r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      avPrev.scene = new THREE.Scene(); avPrev.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); avPrev.cam.position.set(0, 1.15, 3.6); avPrev.cam.lookAt(0, 0.88, 0);
      avPrev.scene.add(new THREE.HemisphereLight(0xFFF4E2, 0x8EA7C8, 0.6)); const d = new THREE.DirectionalLight(0xFFFFFF, 0.7); d.position.set(2, 4, 3); avPrev.scene.add(d);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ color: 0x12153A, transparent: true, opacity: 0.18 })); disc.rotation.x = -Math.PI / 2; avPrev.scene.add(disc); }
    cv.replaceWith(avPrev.r.domElement); avPrev.r.domElement.className = 'avprev'; avPrev.r.domElement.id = 'avprev';
    const w = 220, h = 250; avPrev.r.setSize(w, h); avPrev.cam.aspect = w / h; avPrev.cam.updateProjectionMatrix();
    avPrev.key = ''; avPreviewPaint(); cancelAnimationFrame(avPrev.raf);
    const loop = t => { if (!document.getElementById('avprev')) return; if (avPrev.fig) avPrev.fig.rotation.y = Math.sin(t * 0.0006) * 0.7; avPrev.r.render(avPrev.scene, avPrev.cam); avPrev.raf = requestAnimationFrame(loop); };
    avPrev.raf = requestAnimationFrame(loop);
  } catch (e) {}
}
function avPreviewPaint(){
  if (!avPrev.scene) return; const key = avxCode(); if (key === avPrev.key) return; avPrev.key = key;
  if (avPrev.fig){ avPrev.scene.remove(avPrev.fig); disposeTree(avPrev.fig); }
  const g = new THREE.Group();
  if (AVX.body === 1){ g.add(buildHuman(Object.assign({}, AVX, { hat: AV.hat, glass: AV.glass })).body); g.position.y = -0.05; }
  else { const save = Object.assign({}, proc), saveRig = rig.children.slice(); buildProceduralPlayer(); const b = proc.body; rig.remove(b); Object.keys(proc).forEach(k => delete proc[k]); Object.assign(proc, save);
    if (AV.hat || AV.glass){ const a = accessories(AV, 0.42); a.position.set(0, 1.04 + 0.36, 0); b.add(a); } g.add(b); g.scale.setScalar(0.92); }
  avPrev.fig = g; avPrev.scene.add(g);
}

/* ---------- the profile panel, now a full character creator ---------- */
openProfile = function(after){
  let pick = netColor; const draft = Object.assign({}, AVX), adraft = { ...AV }, oldX = Object.assign({}, AVX), oldA = { ...AV };
  const chips = (key, list, src = 'x') => `<div class="avrow">${list.map((n, k) => `<button type="button" class="avc" data-s="${src}" data-k="${key}" data-v="${k}">${t(n)}</button>`).join('')}</div>`;
  const sw = (key, pal) => `<div class="avsw">${pal.map((c, k) => `<button type="button" class="avs" data-k="${key}" data-v="${k}" style="background:${hexCss(c)}" aria-label="${key} ${k + 1}"></button>`).join('')}</div>`;
  const badges = myBadges();
  const box = xModal('profilebox', `<h3>${AR() ? '👤 شخصيتك' : '👤 Your character'}</h3>
    <p class="xm-sub">${AR() ? 'اختار شكلك كامل — الزوار التانيين هيشوفوك كده' : 'Build your whole look — other visitors will see you like this'}</p>
    <div class="avtop"><canvas id="avprev" class="avprev" width="220" height="250"></canvas>
      <div class="avside"><input id="pfname" maxlength="20" autocomplete="nickname" placeholder="${AR() ? 'اسمك…' : 'Your name…'}">
      <b class="avh">🧑‍🚀 ${AR() ? 'الشخصية' : 'Character'}</b>${chips('body', AV_BODY)}
      <button type="button" class="avc avrand" id="avrand">🎲 ${AR() ? 'شكل عشوائي' : 'Surprise me'}</button></div></div>
    <div class="avhuman">
      <b class="avh">🎨 ${AR() ? 'لون البشرة' : 'Skin tone'}</b>${sw('skin', AV_SKIN)}
      <b class="avh">💇 ${AR() ? 'الشعر أو الحجاب' : 'Hair or hijab'}</b>${chips('hair', AV_HAIR)}
      <div class="avhairc"><b class="avh">${AR() ? 'لون الشعر' : 'Hair colour'}</b>${sw('hairC', AV_HAIRC)}</div>
      <div class="avscarf"><b class="avh">🧕 ${AR() ? 'لون الحجاب' : 'Hijab colour'}</b>${sw('scarf', AV_CLOTH)}</div>
      <div class="avbeard"><b class="avh">🧔 ${AR() ? 'الدقن' : 'Beard'}</b>${chips('beard', AV_BEARD)}</div>
      <b class="avh">👕 ${AR() ? 'اللبس' : 'Outfit'}</b>${chips('top', AV_TOP)}${sw('topC', AV_CLOTH)}
      <b class="avh">👖 ${AR() ? 'البنطلون' : 'Trousers'}</b>${sw('pants', AV_CLOTH)}
      <b class="avh">👟 ${AR() ? 'الجزمة' : 'Shoes'}</b>${sw('shoes', AV_CLOTH)}
    </div>
    <div class="avastro"><b class="avh">🎽 ${AR() ? 'لونك على الخريطة' : 'Your map colour'}</b><div class="pfcols">${PROFILE_COLORS.map(c => `<button type="button" data-c="${c}" style="background:${hexCss(c)}" aria-label="colour"></button>`).join('')}</div>
      <b class="avh">💇 ${AR() ? 'الشعر (اللي بيشوفه الزوار التانيين)' : 'Hair (as others see you)'}</b>${chips('hair', HAIRS, 'a')}</div>
    <b class="avh">🧢 ${AR() ? 'على راسك' : 'On your head'}</b>${chips('hat', HATS, 'a')}
    <b class="avh">🕶️ ${AR() ? 'نظارة' : 'Glasses'}</b>${chips('glass', GLASSES, 'a')}
    ${badges.length ? `<b class="avh">🏅 ${AR() ? 'بادجاتك' : 'Your badges'}</b><div class="avrow badges">${badges.map(b => `<span class="bdg">${b.icon} ${t(b.name)}</span>`).join('')}</div>` : ''}
    <button type="button" class="xm-go" id="pfsave">${AR() ? 'احفظ' : 'Save'}</button>`, () => { if (!box._saved){ Object.assign(AVX, oldX); Object.assign(AV, oldA); rebuildMe(); paintMyAvatar(); } });
  const inp = box.querySelector('#pfname'); inp.value = profile.nick || '';
  const live = () => { Object.assign(AVX, draft); Object.assign(AV, adraft); avPreviewPaint(); rebuildMe(); if (AVX.body !== 1) paintMyAvatar(); };
  const mark = () => {
    box.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', +b.dataset.c === pick));
    box.querySelectorAll('.avc[data-k]').forEach(b => b.classList.toggle('on', (b.dataset.s === 'a' ? adraft : draft)[b.dataset.k] === +b.dataset.v));
    box.querySelectorAll('.avs').forEach(b => b.classList.toggle('on', draft[b.dataset.k] === +b.dataset.v));
    const human = draft.body === 1, hj = draft.hair === 6 || draft.hair === 7;
    box.querySelector('.avhuman').hidden = !human; box.querySelector('.avastro').hidden = human;
    box.querySelector('.avhairc').hidden = hj; box.querySelector('.avscarf').hidden = !hj; box.querySelector('.avbeard').hidden = hj; };
  mark(); avPreviewStart(box.querySelector('#avprev'));
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pick = +b.dataset.c; mark(); Sfx.click(); });
  box.querySelectorAll('.avc[data-k]').forEach(b => b.onclick = () => { const src = b.dataset.s === 'a' ? adraft : draft, k = b.dataset.k, v = +b.dataset.v;
    src[k] = src === adraft && src[k] === v && k === 'hair' ? -1 : v; mark(); Sfx.click(); live(); });
  box.querySelectorAll('.avs').forEach(b => b.onclick = () => { draft[b.dataset.k] = +b.dataset.v; mark(); Sfx.click(); live(); });
  box.querySelector('#avrand').onclick = () => { const r = n => Math.floor(Math.random() * n);
    Object.assign(draft, { body: 1, skin: r(AV_SKIN.length), hair: r(AV_HAIR.length), hairC: r(AV_HAIRC.length), top: r(AV_TOP.length), topC: r(AV_CLOTH.length), pants: r(AV_CLOTH.length), shoes: r(AV_CLOTH.length), beard: r(3) ? 0 : 1 + r(3), scarf: r(AV_CLOTH.length) });
    adraft.hat = r(4) ? 0 : r(HATS.length); adraft.glass = r(3) ? 0 : r(GLASSES.length); mark(); Sfx.click(); live(); };
  box.querySelector('#pfsave').onclick = () => { box._saved = true; Object.assign(AVX, draft); Object.assign(AV, adraft); saveProfile(inp.value, pick); saveAvx(); Sfx.open(); closeX('profilebox'); mini(AR() ? `✅ أهلاً يا ${profile.nick || 'زائر'}` : `✅ Hi ${profile.nick || 'there'}`); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') box.querySelector('#pfsave').click(); });
};

/* put my saved look on as soon as the world is up */
{ let tries = 0; const wait = () => { if (state !== 'loading' && proc.body){ if (AVX.body === 1) rebuildMe(true); return; } if (++tries < 600) setTimeout(wait, 250); }; wait(); }

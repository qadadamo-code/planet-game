/* Rocket trips: lift off from the pad by HQ, pick a world, orbit it and tap whatever floats around it.
   The Moon (our crew), the Clients' Ring, and the Academy planet. Shares scene/camera/state with game.js. */

const SP = {
  launch: L("3… 2… 1… liftoff!", "3… 2… 1… انطلاق!"),
  pick: L("Where to?", "رايح فين؟"),
  tap: L("Tap anything orbiting the world", "دوس على أي حاجة بتلف حوالين الكوكب"),
  home: L("Back to Planet", "ارجع لكوكب Planet"),
};
const worlds = [];
let launchT = 0, landT = 0, cur = null, orbitA = 0, inSpace = false;
const spaceTap = [];   // sprites you can tap: { s, act }

function spriteFromCanvas(draw, w = 256, h = 256){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  draw(x, () => tx.needsUpdate = true);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, fog: false, depthWrite: false }));
}
function roundPhoto(src, label){
  // label is bilingual: the name under each face follows the game's language
  return spriteFromCanvas((x, done) => {
    let im = null;
    const draw = () => { x.clearRect(0, 0, 256, 256); x.fillStyle = '#2E6BA9'; x.beginPath(); x.arc(128,110,96,0,7); x.fill();
      if (im){ x.save(); x.beginPath(); x.arc(128,110,94,0,7); x.clip(); x.drawImage(im, 32, 14, 192, 192); x.restore(); }
      x.lineWidth = 14; x.strokeStyle = '#F2C94C'; x.beginPath(); x.arc(128,110,96,0,7); x.stroke();
      x.fillStyle = '#12153A'; x.fillRect(18,212,220,40); x.fillStyle = '#F4F7FC'; x.font = '700 26px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; x.fillText(t(label), 128, 240, 210); done(); };
    draw(); langHooks.push(draw);
    if (src){ const i2 = new Image(); i2.onload = () => { im = i2; draw(); }; i2.src = src; }
  });
}
function iconCard(icon, label, col){
  return spriteFromCanvas(x => { x.fillStyle = col; x.strokeStyle = '#12153A'; x.lineWidth = 12; x.beginPath(); x.roundRect ? x.roundRect(10,10,236,236,36) : x.rect(10,10,236,236); x.fill(); x.stroke();
    x.font = '96px serif'; x.textAlign = 'center'; x.fillText(icon, 128, 130); x.fillStyle = '#12153A'; x.font = '800 30px IBM Plex Sans Arabic, sans-serif'; x.direction = 'rtl'; x.fillText(label, 128, 212, 220); });
}
/* space props never take the home planet's fog: they hang far away in its sky */
const spMatC = {};
const spMat = c => spMatC[c] || (spMatC[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: grad, fog: false }));
const spInk = new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide, fog: false });
function spMesh(geo, c, ink = true){ const m = new THREE.Mesh(geo, spMat(c)); if (ink){ const o = new THREE.Mesh(geo, spInk); o.scale.setScalar(1.06); m.add(o); } return m; }
function onSurface(body, obj, dir, radius, lift = 0){ dir = dir.clone().normalize(); obj.position.copy(dir).multiplyScalar(radius + lift); obj.quaternion.setFromUnitVectors(Y, dir); body.add(obj); return obj; }
let spSeed = 11; const spRnd = () => (spSeed = (spSeed * 16807) % 2147483647) / 2147483647;
function spDir(){ const u = spRnd()*2-1, th = spRnd()*Math.PI*2, r = Math.sqrt(1-u*u); return V(r*Math.cos(th), u, r*Math.sin(th)); }
const spGlow = (col, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.setScalar(size); return s; };
const spBlinkers = [], spMovers = [];

function makeWorld(color, radius, pos, opts = {}){
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const body = new THREE.Group(); g.add(body); g.userData.body = body; g.userData.spin = opts.spin || 0.05;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 3), new THREE.MeshToonMaterial({ color, gradientMap: grad, fog: false, flatShading: true })); body.add(m);
  const ink = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide, fog: false })); ink.scale.setScalar(1.035); body.add(ink);
  if (opts.ring){ const r = new THREE.Mesh(new THREE.TorusGeometry(radius*1.7, radius*0.12, 6, 64), spMat(opts.ring)); r.rotation.x = 1.25; g.add(r);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(radius*2.05, radius*0.035, 4, 64), new THREE.MeshBasicMaterial({ color: 0xF4F7FC, transparent: true, opacity: 0.55, fog: false })); r2.rotation.x = 1.25; g.add(r2); }
  // craters
  for (let i = 0; i < (opts.craters || 0); i++){ const s = radius * (0.1 + spRnd()*0.12), c = new THREE.Mesh(new THREE.CylinderGeometry(s, s*0.8, s*0.3, 12), spMat(opts.craterC || 0x2E3557));
    onSurface(body, c, spDir(), radius*0.985); }
  // a thin band of cloud
  if (opts.clouds){ const band = new THREE.Group(); for (let i = 0; i < 9; i++){ const a = i/9*Math.PI*2, c = new THREE.Mesh(new THREE.IcosahedronGeometry(radius*0.16, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
      c.scale.set(1.8, 0.7, 1); c.position.set(Math.cos(a)*radius*1.14, Math.sin(a*3)*radius*0.12, Math.sin(a)*radius*1.14); band.add(c); }
    band.rotation.z = 0.35; g.add(band); spMovers.push({ o: band, ry: 0.06 }); }
  // little moons
  for (let i = 0; i < (opts.moons || 0); i++){ const piv = new THREE.Group(); piv.rotation.set(spRnd()*2, spRnd()*6, spRnd()*2); g.add(piv);
    const mo = spMesh(new THREE.IcosahedronGeometry(radius*0.13, 1), [0xC9D6EA, 0xF2C94C, 0xE9A0B8][i % 3]); mo.position.set(radius*(1.9 + i*0.45), 0, 0); piv.add(mo); spMovers.push({ o: piv, ry: 0.25 - i*0.07 }); }
  // a beacon that blinks on top
  if (opts.beacon){ const mast = spMesh(new THREE.CylinderGeometry(radius*0.025, radius*0.035, radius*0.45, 6), 0xF4F7FC); mast.position.y = radius*0.2;
    const top = new THREE.Group(); top.add(mast); const gl = spGlow(opts.beacon, radius*0.5); gl.position.y = radius*0.45; top.add(gl); spBlinkers.push(gl);
    onSurface(body, top, V(0.2, 1, 0.1), radius*0.98); }
  return g;
}

/* surface details for each world */
const tinyTree = c => { const g = new THREE.Group(); const tr = spMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 6), 0x9B7650); tr.position.y = 0.35; g.add(tr);
  const top = spMesh(new THREE.ConeGeometry(0.55, 1.2, 7), c); top.position.y = 1.2; g.add(top); return g; };
const tinyTower = (h, c, lit) => { const g = new THREE.Group(); const b = spMesh(new THREE.BoxGeometry(0.9, h, 0.9), c); b.position.y = h/2; g.add(b);
  for (let y = 0.6; y < h - 0.3; y += 0.7){ const w = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: lit, fog: false })); w.position.y = y; g.add(w); } return g; };
const tinyDome = (r, c) => { const g = new THREE.Group(); const d = spMesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI*2, 0, Math.PI/2), c); g.add(d);
  const base = spMesh(new THREE.CylinderGeometry(r*1.05, r*1.05, r*0.25, 14), 0xF4F7FC); g.add(base); return g; };
const crystal = c => { const g = new THREE.Group(); for (let k = 0; k < 3; k++){ const s = spMesh(new THREE.ConeGeometry(0.28 + k*0.06, 1.4 - k*0.25, 5), c); s.position.set((k-1)*0.35, 0.6, (k%2)*0.25); s.rotation.z = (k-1)*0.35; g.add(s); } return g; };
function planetFlag(texSrc){ const g = new THREE.Group(); const pole = spMesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), 0xF4F7FC); pole.position.y = 1.5; g.add(pole);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const x = cv.getContext('2d'); x.fillStyle = '#2E6BA9'; x.fillRect(0, 0, 256, 160);
  const tx = new THREE.CanvasTexture(cv), im = new Image(); im.onload = () => { x.filter = 'invert(1)'; x.drawImage(im, 58, 30, 140, 92); x.filter = 'none'; tx.needsUpdate = true; }; im.src = texSrc;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide, fog: false })); f.position.set(0.82, 2.45, 0); g.add(f); return g; }
function frameCard(src, label){
  return spriteFromCanvas((x, done) => { let im = null;
    const draw = () => { x.clearRect(0, 0, 256, 256); x.fillStyle = '#F2C94C'; x.fillRect(8, 8, 240, 196); x.fillStyle = '#12153A'; x.fillRect(20, 20, 216, 172);
      if (im){ const s = Math.max(216/im.width, 172/im.height), w = im.width*s, h = im.height*s; x.save(); x.beginPath(); x.rect(20, 20, 216, 172); x.clip(); x.drawImage(im, 128 - w/2, 106 - h/2, w, h); x.restore(); }
      x.fillStyle = '#12153A'; x.fillRect(18, 212, 220, 38); x.fillStyle = '#F4F7FC'; x.font = '700 24px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; x.fillText(t(label), 128, 239, 210); done(); };
    draw(); langHooks.push(draw); const i2 = new Image(); i2.onload = () => { im = i2; draw(); }; i2.src = src; });
}
function actionCard(icon, label, col){
  return spriteFromCanvas((x, done) => { const draw = () => { x.clearRect(0, 0, 256, 256); x.fillStyle = col; x.strokeStyle = '#12153A'; x.lineWidth = 12; x.beginPath(); x.roundRect ? x.roundRect(10,10,236,236,36) : x.rect(10,10,236,236); x.fill(); x.stroke();
    x.font = '96px serif'; x.textAlign = 'center'; x.fillStyle = '#12153A'; x.fillText(icon, 128, 130); x.font = '800 28px IBM Plex Sans Arabic, sans-serif'; x.direction = lang === 'ar' ? 'rtl' : 'ltr'; x.fillText(t(label), 128, 212, 220); done(); };
    draw(); langHooks.push(draw); });
}

/* worlds are built once the main planet exists; they also hang in the home sky as scenery */
function buildWorlds(){
  const orbit = (w, list, r) => { const og = new THREE.Group(); w.add(og); list.forEach((it, k) => { const a = k/list.length*Math.PI*2, y = (k % 3 - 1) * r * 0.22;
    it.s.position.set(Math.cos(a)*r, y, Math.sin(a)*r); it.s.scale.setScalar(it.size || 5); og.add(it.s); it.w = w; spaceTap.push(it); }); return og; };
  const WA = 'https://wa.me/201203101104';

  // the Moon: our crew, plus a little Planet base with a flag and a rover doing laps
  { const mr = 14, base = new THREE.Group(); moon.add(base);
    const put = (o, d, lift = 0) => { d = d.clone().normalize(); o.position.copy(d).multiplyScalar(mr + lift); o.quaternion.setFromUnitVectors(Y, d); base.add(o); };
    for (let i = 0; i < 14; i++){ const s = 0.8 + spRnd()*1.4, c = new THREE.Mesh(new THREE.CylinderGeometry(s, s*0.75, 0.3, 12), spMat(0x0B3A75)); put(c, spDir(), -0.05); }
    const hub = V(0.15, 0.9, 0.55); put(tinyDome(1.6, 0xF4F7FC), hub); put(tinyDome(1.0, 0x8FB4E3), hub.clone().add(V(0.18, 0, 0.05)));
    put(planetFlag('img/mark.png'), hub.clone().add(V(-0.12, 0.05, 0.08)));
    const ant = new THREE.Group(); const m2 = spMesh(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 6), 0xF4F7FC); m2.position.y = 1.6; ant.add(m2);
    const gl = spGlow(0xE05A5A, 1.6); gl.position.y = 3.3; ant.add(gl); spBlinkers.push(gl); put(ant, hub.clone().add(V(0.05, 0, -0.16)));
    const roverPiv = new THREE.Group(); roverPiv.quaternion.setFromUnitVectors(Y, hub.clone().normalize()); moon.add(roverPiv);
    const rover = new THREE.Group(); const rb = spMesh(new THREE.BoxGeometry(1.1, 0.4, 0.7), 0xF2C94C); rb.position.y = 0.35; rover.add(rb);
    [[-0.4,-0.38],[0.4,-0.38],[-0.4,0.38],[0.4,0.38]].forEach(([x, z]) => { const w = spMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10), 0x12153A, false); w.rotation.x = Math.PI/2; w.position.set(x, 0.18, z); rover.add(w); });
    const cam = spMesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), 0xF4F7FC); cam.position.set(0.3, 0.75, 0); rover.add(cam);
    const arm = new THREE.Group(); rover.position.set(0, mr, 0); rover.rotation.z = 0; arm.add(rover); arm.rotation.x = 0.35; roverPiv.add(arm); spMovers.push({ o: roverPiv, rotAxis: hub.clone().normalize(), sp: 0.25 }); }
  const team = orbit(moon, TEAM.map(m => ({ s: roundPhoto(m.photo, m.name), act: () => openExhibit('member', m.id), size: 6.5 })), 26);
  team.visible = false; worlds.push({ id: 'moon', name: L("The Planet Moon","قمر Planet"), sub: L("Where our crew lives","هنا ساكن طاقمنا"), icon: '🌕', obj: moon, r: 14, spin: team,
    tip: L("Our base is on the bright side — tap a face to meet whoever's behind it", "قاعدتنا على الوش المنوّر — دوس على أي وش وتعرّف على صاحبه") });

  const ring = makeWorld(0xE76F51, 11, new THREE.Vector3(-230, 60, 190), { ring: 0xF2C94C, craters: 4, moons: 2, beacon: 0xF2C94C, spin: 0.04 });
  for (let i = 0; i < 22; i++){ const h = 1 + spRnd()*3.2; onSurface(ring.userData.body, tinyTower(h, [0xF4F7FC, 0x12153A, 0x2E6BA9][i % 3], 0xF2C94C), spDir(), 10.9); }
  const logos = orbit(ring, CLIENTS.map(c => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(c), fog: false })); return { s, act: () => openExhibit('client', c.logo || c.name.en), size: 4.6 }; }), 26);
  logos.visible = false; worlds.push({ id: 'ring', name: L("The Clients' Ring","حلقة العملاء"), sub: L("Every brand we work with, in orbit","كل العلامات اللي بنشتغل معاها، في مدار واحد"), icon: '🪐', obj: ring, r: 11, spin: logos,
    tip: L("A city of brands — every tower is a business we've helped grow", "مدينة علامات — كل برج فيها شغل كبّرناه") });

  const acad = makeWorld(0x3E8E7E, 9, new THREE.Vector3(200, -80, 210), { clouds: true, moons: 1, spin: 0.05 });
  for (let i = 0; i < 26; i++) onSurface(acad.userData.body, tinyTree([0x74B47E, 0x88C38C, 0xF2C94C][i % 3]), spDir(), 8.9);
  { const top = V(0, 1, 0); onSurface(acad.userData.body, tinyDome(2.2, 0xF4F7FC), top, 8.8);
    const cap = new THREE.Group(); const board = spMesh(new THREE.BoxGeometry(3.2, 0.25, 3.2), 0x12153A); board.position.y = 3.2; cap.add(board);
    const crown = spMesh(new THREE.CylinderGeometry(1.0, 1.1, 0.8, 12), 0x12153A); crown.position.y = 2.7; cap.add(crown);
    const tassel = spMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), 0xF2C94C, false); tassel.position.set(1.4, 2.7, 1.4); cap.add(tassel); onSurface(acad.userData.body, cap, top, 8.8); }
  const acts = orbit(acad, [
    { s: iconCard('🎓', 'المسابقة', '#F2C94C'), act: () => openExhibit('quiz') },
    { s: iconCard('📈', 'منتجاتنا', '#8FB4E3'), act: () => openExhibit('products') },
    { s: iconCard('📝', 'اعمل بريفك', '#F4F7FC'), act: () => openExhibit('brief') },
    { s: iconCard('🏅', 'شهادتي', '#E9A0B8'), act: () => openExhibit('cert') },
    { s: iconCard('💡', 'إحنا مين', '#C9F0D2'), act: () => openExhibit('about') },
  ].map(x => ({ ...x, size: 6 })), 19);
  acts.visible = false; worlds.push({ id: 'academy', name: L("The Academy planet","كوكب الأكاديمية"), sub: L("Learn, play and plan your project","اتعلم، العب، وخطّط لمشروعك"), icon: '🎓', obj: acad, r: 9, spin: acts,
    tip: L("Take the quiz, earn your certificate, then plan your project", "حل المسابقة، خد شهادتك، وبعدين خطّط لمشروعك") });

  // new: the Gallery — every case study framed in orbit
  const gal = makeWorld(0x8E6BC2, 10, new THREE.Vector3(-210, -110, -220), { craters: 6, craterC: 0x5B3F8F, moons: 2, beacon: 0xE9A0B8, spin: 0.035 });
  for (let i = 0; i < 12; i++){ const d = spDir(), ped = new THREE.Group(); const p = spMesh(new THREE.CylinderGeometry(0.45, 0.55, 0.8, 8), 0xF4F7FC); p.position.y = 0.4; ped.add(p);
    const st = spMesh(i % 2 ? new THREE.TorusKnotGeometry(0.35, 0.12, 40, 6) : new THREE.IcosahedronGeometry(0.45, 0), [0xF2C94C, 0xE76F51, 0x5FA0E6][i % 3]); st.position.y = 1.3; ped.add(st); spMovers.push({ o: st, ry: 0.8 });
    onSurface(gal.userData.body, ped, d, 9.9); }
  const frames = orbit(gal, WORK.map(w => ({ s: frameCard('img/' + w.imgs[0], w.name), act: () => openExhibit('work', w.id), size: 6.2 })), 24);
  frames.visible = false; worlds.push({ id: 'gallery', name: L("The Gallery planet","كوكب المعرض"), sub: L("Our work, framed in orbit","شغلنا، متبروز في المدار"), icon: '🖼️', obj: gal, r: 10, spin: frames,
    tip: L("Every frame is a real project — tap one to see the story behind it", "كل برواز مشروع حقيقي — دوس عليه واعرف حكايته") });

  // new: the Services station — a ring station with the eight studios
  const svc = makeWorld(0x2E6BA9, 7, new THREE.Vector3(250, 90, -170), { moons: 1, beacon: 0x7FE8FF, spin: 0.06 });
  { const st = new THREE.Group(); const tor = spMesh(new THREE.TorusGeometry(13, 0.7, 8, 48), 0xF4F7FC); st.add(tor);
    for (let k = 0; k < 8; k++){ const a = k/8*Math.PI*2, pod = spMesh(new THREE.BoxGeometry(2.2, 1.4, 1.4), [0xF2C94C, 0xE76F51, 0x3E8E7E, 0x8E6BC2][k % 4]); pod.position.set(Math.cos(a)*13, 0, Math.sin(a)*13); pod.rotation.y = -a; st.add(pod);
      const spoke = spMesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), 0xC9D6EA, false); spoke.rotation.z = Math.PI/2; spoke.position.set(Math.cos(a)*9.6, 0, Math.sin(a)*9.6); spoke.rotation.y = -a; st.add(spoke); }
    const pan = spMesh(new THREE.BoxGeometry(9, 0.12, 2.2), 0x2E6BA9); pan.position.y = 9.5; st.add(pan); st.rotation.x = 0.35; svc.add(st); spMovers.push({ o: st, ry: 0.08 }); }
  const SV_IC = { s1: '🧭', s2: '🎨', s3: '📱', s4: '📣', s5: '🎬', s6: '💻', s7: '📈', s8: '💼' };
  const studios = orbit(svc, POIS.filter(p => p.svc).map(p => ({ s: actionCard(SV_IC[p.id] || '⭐', p.name, '#F4F7FC'), act: () => openExhibit('service', p.id), size: 5.6 })), 19);
  studios.visible = false; worlds.push({ id: 'services', name: L("The Services station","محطة الخدمات"), sub: L("Eight studios in one orbit","تمن استوديوهات في مدار واحد"), icon: '🛰️', obj: svc, r: 7, spin: studios,
    tip: L("Tap a studio to see what you get from it", "دوس على أي استوديو وشوف هتاخد منه إيه") });

  // new: the Star Catcher — a little arcade game
  const stw = makeWorld(0xF2C94C, 8, new THREE.Vector3(30, 210, -260), { craters: 5, craterC: 0xC99A2E, moons: 3, spin: 0.07 });
  for (let i = 0; i < 18; i++) onSurface(stw.userData.body, crystal([0x7FE8FF, 0xFF9BE2, 0xF4F7FC][i % 3]), spDir(), 7.9);
  const halo = spGlow(0xF2C94C, 40); halo.material.opacity = 0.45; stw.add(halo);
  worlds.push({ id: 'stars', name: L("The Star Catcher","كوكب صيد النجوم"), sub: L("A 30-second game: catch the shooting stars","لعبة ٣٠ ثانية: اصطاد النجوم"), icon: '☄️', obj: stw, r: 8, spin: null, game: true,
    tip: L("Press start, then tap the stars before they fade — gold ones are worth 3, avoid the red rocks", "دوس ابدأ، واصطاد النجوم قبل ما تختفي — الدهبي بـ٣، وابعد عن الصخر الأحمر") });

  // new: the Contact satellite — every way to reach us
  const con = makeWorld(0xE9A0B8, 6.5, new THREE.Vector3(-60, -190, 230), { craters: 3, craterC: 0xC56F90, beacon: 0x2EA87A, spin: 0.06 });
  for (let i = 0; i < 6; i++){ const d = spDir(), dish = new THREE.Group(); const stem = spMesh(new THREE.CylinderGeometry(0.08, 0.1, 1, 6), 0xF4F7FC); stem.position.y = 0.5; dish.add(stem);
    const bowl = spMesh(new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI*2, 0, Math.PI/2.4), 0xF4F7FC); bowl.position.y = 1.1; bowl.rotation.x = Math.PI; bowl.rotation.z = 0.5; dish.add(bowl); onSurface(con.userData.body, dish, d, 6.4); }
  const links = orbit(con, [
    { s: actionCard('💬', L('WhatsApp', 'واتساب'), '#C9F0D2'), act: () => window.open(WA + '?text=' + encodeURIComponent(t(L("Hi Planet 👋 I found you in space!", "أهلاً Planet 👋 لقيتكم في الفضاء!"))), '_blank', 'noopener') },
    { s: actionCard('📸', L('Instagram', 'إنستجرام'), '#E9A0B8'), act: () => window.open('https://instagram.com/planet4cm', '_blank', 'noopener') },
    { s: actionCard('📞', L('Call us', 'كلّمنا'), '#F2C94C'), act: () => { location.href = 'tel:+201203101104'; } },
    { s: actionCard('📝', L('Your brief', 'بريفك'), '#F4F7FC'), act: () => openExhibit('brief') },
    { s: actionCard('📍', L('Visit us', 'زورنا'), '#8FB4E3'), act: () => openExhibit('contact') },
  ].map(x => ({ ...x, size: 5.4 })), 16);
  links.visible = false; worlds.push({ id: 'contact', name: L("The Contact satellite","قمر التواصل"), sub: L("Every way to reach us","كل طرق التواصل معانا"), icon: '📡', obj: con, r: 6.5, spin: links,
    tip: L("One tap and you're talking to the team", "ضغطة واحدة وتبقى بتكلّم الفريق") });
}

/* animate the worlds: they turn, moons orbit, beacons blink */
function animateWorlds(dt, ts){
  for (const w of worlds){ const b = w.obj.userData && w.obj.userData.body; if (b) b.rotation.y += dt * w.obj.userData.spin; }
  for (const m of spMovers){ if (m.rotAxis) m.o.rotateOnAxis(Y, dt * m.sp); else m.o.rotation.y += dt * m.ry; }
  for (const g of spBlinkers) g.material.opacity = (Math.sin(ts * 3 + g.id) > 0.2) ? 0.95 : 0.15;
}

/* ---------- the Star Catcher game ---------- */
const SG = { on: false, t: 0, score: 0, best: +(store.get('pm-stars-best') || 0), targets: [], next: 0, combo: 0 };
const sgTex = {};
function sgSprite(kind){
  const map = sgTex[kind] || (sgTex[kind] = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); const col = kind === 'gold' ? '255,206,60' : kind === 'rock' ? '224,90,90' : '160,220,255';
    gr.addColorStop(0, `rgba(255,255,255,1)`); gr.addColorStop(0.35, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    x.font = '64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(kind === 'gold' ? '🌟' : kind === 'rock' ? '🪨' : '⭐', 64, 66); return new THREE.CanvasTexture(cv); })());
  return new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }));
}
function sgStart(){
  if (!cur || !cur.game) return;
  sgClear(); SG.on = true; SG.t = 30; SG.score = 0; SG.next = 0.4; SG.combo = 0; Sfx.open(); showSpaceMenu();
}
function sgClear(){ for (const tg of SG.targets) scene.remove(tg.s); SG.targets.length = 0; }
function sgEnd(){
  SG.on = false; sgClear();
  const best = SG.score > SG.best; if (best){ SG.best = SG.score; store.set('pm-stars-best', String(SG.score)); }
  Sfx.finish(); toast(lang === 'ar' ? `☄️ ${SG.score} نقطة` : `☄️ ${SG.score} points`, best ? (lang === 'ar' ? '🏆 رقم قياسي جديد!' : '🏆 New best!') : (lang === 'ar' ? `أحسن نتيجة: ${SG.best}` : `Best: ${SG.best}`));
  if (typeof sendChat === 'function' && typeof netLive !== 'undefined' && netLive && SG.score > 0) sendChat(lang === 'ar' ? `☄️ جبت ${SG.score} نقطة في صيد النجوم!` : `☄️ I scored ${SG.score} in the Star Catcher!`);
  showSpaceMenu();
}
function sgFrame(dt){
  if (!SG.on) return;
  if (state !== 'space' || !cur || !cur.game){ SG.on = false; sgClear(); return; }
  SG.t -= dt; SG.next -= dt;
  const c = cur.obj.getWorldPosition(V()), camR = V().subVectors(camera.position, c).normalize();
  if (SG.next <= 0){ SG.next = 0.35 + Math.random() * 0.45 * (SG.t / 30 + 0.4);
    const roll = Math.random(), kind = roll < 0.15 ? 'gold' : roll < 0.3 ? 'rock' : 'star', s = sgSprite(kind);
    const side = V().crossVectors(camR, Y).normalize(), upv = V().crossVectors(side, camR).normalize();
    const p = c.clone().addScaledVector(side, (Math.random()*2 - 1) * cur.r * 2.4).addScaledVector(upv, (Math.random()*2 - 1) * cur.r * 1.3).addScaledVector(camR, cur.r * (1.2 + Math.random()));
    s.position.copy(p); s.scale.setScalar(kind === 'gold' ? 3.2 : 3.8); scene.add(s);
    SG.targets.push({ s, kind, life: kind === 'gold' ? 1.3 : 2.1, age: 0, v: V().addScaledVector(side, (Math.random()*2 - 1) * 3).addScaledVector(upv, -1.5 - Math.random()*2) }); }
  for (let i = SG.targets.length - 1; i >= 0; i--){ const tg = SG.targets[i]; tg.age += dt; tg.s.position.addScaledVector(tg.v, dt);
    tg.s.material.opacity = Math.min(1, tg.age * 4, (tg.life - tg.age) * 3);
    if (tg.age > tg.life){ scene.remove(tg.s); SG.targets.splice(i, 1); if (tg.kind !== 'rock') SG.combo = 0; } }
  const el = document.getElementById('sghud'); if (el) el.textContent = `⏱ ${Math.max(0, Math.ceil(SG.t))} · ☄️ ${SG.score}${SG.combo > 2 ? ' · 🔥x' + SG.combo : ''}`;
  if (SG.t <= 0) sgEnd();
}
function sgHit(sprite){
  const k = SG.targets.findIndex(tg => tg.s === sprite); if (k < 0) return false;
  const tg = SG.targets[k]; scene.remove(tg.s); SG.targets.splice(k, 1);
  if (tg.kind === 'rock'){ SG.score = Math.max(0, SG.score - 2); SG.combo = 0; Sfx.land(); if (navigator.vibrate) navigator.vibrate(60); }
  else { SG.combo++; SG.score += (tg.kind === 'gold' ? 3 : 1) + (SG.combo >= 5 ? 1 : 0); Sfx.collect(); }
  burst(tg.s.position.clone(), tg.kind === 'rock' ? 0xE05A5A : 0xF2C94C, 24, 5, 0.6); return true;
}

function startLaunch(){
  if (!worlds.length) buildWorlds();
  if (riding) dismount();
  state = 'launch'; launchT = 0; inSpace = true; releaseAll();
  ['hud', 'prompt', 'homebtn'].forEach(id => { const e = $(id); if (e) e.hidden = true; });
  player.visible = false; rocket.userData.flame.material.opacity = 1; Sfx.finish(); toast(t(SP.launch));
}
function spaceLook(on){
  if (on){ skyMesh.material.color.set(0x141A3A); nightStars.visible = true; scene.background.set(0x0A0F26); clouds.visible = false; }
  else { clouds.visible = true; applyDayNight(); }
}
function showSpaceMenu(){
  const box = $('spacebar'); box.hidden = false;
  box.innerHTML = `<b>🚀 ${t(SP.pick)}</b><div class="wbtns">${worlds.map(w => `<button type="button" class="panel wbtn ${cur === w ? 'on' : ''}" data-w="${w.id}"><span>${w.icon}</span><b>${t(w.name)}</b><small>${t(w.sub)}</small></button>`).join('')}</div>
    <p>${cur && cur.tip ? t(cur.tip) : t(SP.tap)}</p>${cur && cur.game ? (SG.on ? `<b id="sghud" class="sghud"></b>` : `<button type="button" class="panel sgstart" id="sgstart">▶️ ${lang === 'ar' ? 'ابدأ اللعبة' : 'Start the game'}${SG.best ? ` · 🏆 ${SG.best}` : ''}</button>`) : ''}
    <button type="button" class="panel home" id="sphome">🏠 ${t(SP.home)}</button>`;
  const sb = $('sgstart'); if (sb) sb.onclick = sgStart;
  box.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { if (SG.on){ SG.on = false; sgClear(); } cur = worlds.find(w => w.id === b.dataset.w); Sfx.open(); showSpaceMenu(); });
  $('sphome').onclick = startLanding;
}
function startLanding(){ SG.on = false; sgClear(); $('spacebar').hidden = true; state = 'landing'; landT = 0; Sfx.close(); }

/* returns true while it owns the camera */
function spaceFrame(dt, ts){
  for (const w of worlds) if (w.spin){ w.spin.rotation.y += dt * 0.12; w.spin.visible = inSpace && cur === w; }
  animateWorlds(dt, ts);
  if (!inSpace) return false;
  sgFrame(dt);
  scene.fog.near = 900; scene.fog.far = 2400;
  const rk = rocket, up = rk.userData.dir;
  if (state === 'launch'){
    launchT += dt; const h = Math.max(0, launchT - 0.6); rk.position.copy(rk.userData.base).addScaledVector(up, h*h*4);
    rk.rotation.y += dt * 0.4 * h;
    const side = V().crossVectors(up, Y).normalize(); if (side.lengthSq() < 0.1) side.set(1,0,0);
    const look = rk.position.clone().addScaledVector(up, 3);
    camera.position.lerp(rk.userData.base.clone().addScaledVector(up, 6 + h*h*2.6).addScaledVector(side, 16), 1 - Math.exp(-3*dt)); camera.up.copy(up); camera.lookAt(look);
    if (launchT > 2.2) spaceLook(true);
    if (launchT > 3.4){ state = 'space'; cur = cur || worlds[0]; rk.visible = false; showSpaceMenu(); }
    return true;
  }
  if (state === 'space' || (state === 'exhibit' && inSpace)){
    const c = cur.obj.getWorldPosition(V()); orbitA += dt * 0.08;
    const want = c.clone().add(V(Math.cos(orbitA)*cur.r*5.2, cur.r*1.6, Math.sin(orbitA)*cur.r*5.2));
    camera.position.lerp(want, 1 - Math.exp(-1.6*dt)); camera.up.set(0,1,0); camera.lookAt(c.clone().add(V(0, cur.r * 0.9, 0)));   // the world sits below the menu
    return true;
  }
  if (state === 'landing'){
    landT += dt; const k = smooth01(landT / 2.6); if (landT > 1 && !clouds.visible) spaceLook(false);
    rk.visible = true; rk.position.copy(rk.userData.base).addScaledVector(up, (1 - k) * 60);
    const side = V().crossVectors(up, Y).normalize(); if (side.lengthSq() < 0.1) side.set(1,0,0);
    camera.position.lerp(rk.userData.base.clone().addScaledVector(up, 8).addScaledVector(side, 18), 1 - Math.exp(-2.4*dt)); camera.up.copy(up); camera.lookAt(rk.position);
    if (landT > 2.8){
      rk.position.copy(rk.userData.base); rk.rotation.set(0,0,0); rk.quaternion.setFromUnitVectors(Y, up); rk.userData.flame.material.opacity = 0;
      inSpace = false; player.visible = true; state = 'play'; ['hud', 'homebtn'].forEach(id => { const e = $(id); if (e) e.hidden = false; }); Sfx.land(); canvas.focus();
    }
    return true;
  }
  return false;
}

/* tap what orbits the world */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('click', e => {
  if (state !== 'space' || !cur) return;
  const b = canvas.getBoundingClientRect(); ndc.set((e.clientX - b.left)/b.width*2 - 1, -(e.clientY - b.top)/b.height*2 + 1);
  ray.setFromCamera(ndc, camera);
  if (SG.on){ const gh = ray.intersectObjects(SG.targets.map(x => x.s)); if (gh.length) sgHit(gh[0].object); return; }
  const hits = ray.intersectObjects(spaceTap.filter(x => x.w === cur.obj).map(x => x.s));
  if (hits.length){ const it = spaceTap.find(x => x.s === hits[0].object); Sfx.click(); it.act(); }
});
canvas.addEventListener('pointermove', e => {
  if (state !== 'space') return;
  const b = canvas.getBoundingClientRect(); ndc.set((e.clientX - b.left)/b.width*2 - 1, -(e.clientY - b.top)/b.height*2 + 1);
  ray.setFromCamera(ndc, camera); canvas.style.cursor = cur && ray.intersectObjects(spaceTap.filter(x => x.w === cur.obj).map(x => x.s)).length ? 'pointer' : '';
});

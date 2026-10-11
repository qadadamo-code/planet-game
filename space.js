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
  return spriteFromCanvas((x, done) => {
    const ring = () => { x.lineWidth = 14; x.strokeStyle = '#F2C94C'; x.beginPath(); x.arc(128,110,96,0,7); x.stroke();
      x.fillStyle = '#12153A'; x.fillRect(18,212,220,40); x.fillStyle = '#F4F7FC'; x.font = '700 26px Tajawal, sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(label, 128, 240, 210); done(); };
    x.fillStyle = '#2E6BA9'; x.beginPath(); x.arc(128,110,96,0,7); x.fill(); ring();
    if (!src) return; const im = new Image(); im.onload = () => { x.save(); x.beginPath(); x.arc(128,110,94,0,7); x.clip(); x.drawImage(im, 32, 14, 192, 192); x.restore(); ring(); }; im.src = src;
  });
}
function iconCard(icon, label, col){
  return spriteFromCanvas(x => { x.fillStyle = col; x.strokeStyle = '#12153A'; x.lineWidth = 12; x.beginPath(); x.roundRect ? x.roundRect(10,10,236,236,36) : x.rect(10,10,236,236); x.fill(); x.stroke();
    x.font = '96px serif'; x.textAlign = 'center'; x.fillText(icon, 128, 130); x.fillStyle = '#12153A'; x.font = '800 30px Tajawal, sans-serif'; x.direction = 'rtl'; x.fillText(label, 128, 212, 220); });
}
function makeWorld(color, radius, pos, ringed){
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 3), new THREE.MeshToonMaterial({ color, gradientMap: grad, fog: false, flatShading: true })); g.add(m);
  const ink = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide, fog: false })); ink.scale.setScalar(1.035); g.add(ink);
  if (ringed){ const r = new THREE.Mesh(new THREE.TorusGeometry(radius*1.7, radius*0.12, 6, 64), new THREE.MeshToonMaterial({ color: 0xF2C94C, gradientMap: grad, fog: false })); r.rotation.x = 1.25; g.add(r); }
  return g;
}

/* worlds are built once the main planet exists; they also hang in the home sky as scenery */
function buildWorlds(){
  const orbit = (w, list, r) => { const og = new THREE.Group(); w.add(og); list.forEach((it, k) => { const a = k/list.length*Math.PI*2, y = (k % 3 - 1) * r * 0.22;
    it.s.position.set(Math.cos(a)*r, y, Math.sin(a)*r); it.s.scale.setScalar(it.size || 5); og.add(it.s); it.w = w; spaceTap.push(it); }); return og; };

  const team = orbit(moon, TEAM.map(m => ({ s: roundPhoto(m.photo, m.name.ar), act: () => openExhibit('member', m.id), size: 6.5 })), 26);
  team.visible = false; worlds.push({ id: 'moon', name: L("The Planet Moon","قمر Planet"), sub: L("Where our crew lives","هنا ساكن طاقمنا"), icon: '🌕', obj: moon, r: 14, spin: team });

  const ring = makeWorld(0xE76F51, 11, new THREE.Vector3(-230, 60, 190), true);
  const logos = orbit(ring, CLIENTS.map(c => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTex(c), fog: false })); return { s, act: () => openExhibit('client', c.logo || c.name.en), size: 4.6 }; }), 26);
  logos.visible = false; worlds.push({ id: 'ring', name: L("The Clients' Ring","حلقة العملاء"), sub: L("Every brand we work with, in orbit","كل العلامات اللي بنشتغل معاها، في مدار واحد"), icon: '🪐', obj: ring, r: 11, spin: logos });

  const acad = makeWorld(0x3E8E7E, 9, new THREE.Vector3(200, -80, 210));
  const acts = orbit(acad, [
    { s: iconCard('🎓', 'المسابقة', '#F2C94C'), act: () => openExhibit('quiz') },
    { s: iconCard('📈', 'منتجاتنا', '#8FB4E3'), act: () => openExhibit('products') },
    { s: iconCard('📝', 'اعمل بريفك', '#F4F7FC'), act: () => openExhibit('brief') },
    { s: iconCard('🏅', 'شهادتي', '#E9A0B8'), act: () => openExhibit('cert') },
    { s: iconCard('💡', 'إحنا مين', '#C9F0D2'), act: () => openExhibit('about') },
  ].map(x => ({ ...x, size: 6 })), 19);
  acts.visible = false; worlds.push({ id: 'academy', name: L("The Academy planet","كوكب الأكاديمية"), sub: L("Learn, play and plan your project","اتعلم، العب، وخطّط لمشروعك"), icon: '🎓', obj: acad, r: 9, spin: acts });
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
    <p>${t(SP.tap)}</p><button type="button" class="panel home" id="sphome">🏠 ${t(SP.home)}</button>`;
  box.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { cur = worlds.find(w => w.id === b.dataset.w); Sfx.open(); showSpaceMenu(); });
  $('sphome').onclick = startLanding;
}
function startLanding(){ $('spacebar').hidden = true; state = 'landing'; landT = 0; Sfx.close(); }

/* returns true while it owns the camera */
function spaceFrame(dt, ts){
  for (const w of worlds) if (w.spin){ w.spin.rotation.y += dt * 0.12; w.spin.visible = inSpace && cur === w; }
  if (!inSpace) return false;
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
    camera.position.lerp(want, 1 - Math.exp(-1.6*dt)); camera.up.set(0,1,0); camera.lookAt(c);
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
  const hits = ray.intersectObjects(spaceTap.filter(x => x.w === cur.obj).map(x => x.s));
  if (hits.length){ const it = spaceTap.find(x => x.s === hits[0].object); Sfx.click(); it.act(); }
});
canvas.addEventListener('pointermove', e => {
  if (state !== 'space') return;
  const b = canvas.getBoundingClientRect(); ndc.set((e.clientX - b.left)/b.width*2 - 1, -(e.clientY - b.top)/b.height*2 + 1);
  ray.setFromCamera(ndc, camera); canvas.style.cursor = cur && ray.intersectObjects(spaceTap.filter(x => x.w === cur.obj).map(x => x.s)).length ? 'pointer' : '';
});

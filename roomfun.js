/* Things to do inside the buildings. Every Planet studio has a photo spot marked on the floor, and the photo
   comes out styled like the studio's own work: a green-screen take in Motion & Video, a Reel in Content, a
   campaign poster, a website, a sponsored ad, a strategy board, a magazine cover. Branding also makes you a
   little identity card. Client buildings get a screen playing the work we did for them, a spot that opens it,
   and a photo with their logo. Coordinates are in each room's own space (see THEMES in interiors.js). */

const FUN = { spots: [], markers: [], timers: [], backdrop: null, busy: false };
const AR2 = () => lang === 'ar';

/* where you stand, where the camera is, and how the picture is dressed — per studio */
const SHOTS = {
  video:    { stand: [-1.8, -2.55], cam: [-1.8, 1.3, -0.1], look: [-1.8, 1.0, -2.55], style: 'rec',
              label: L('🎬 Stand on the green screen — take a shot', '🎬 اقف قدام الكروما — خد لقطة'), title: L('On set at Planet Motion & Video', 'في استوديو الموشن والفيديو') },
  content:  { stand: [-2.0, -1.0], sit: [-2.0, -1.74, 0], cam: [-2.0, 1.3, 0.3], look: [-2.0, 0.8, -1.74], style: 'reel', fov: 68,
              label: L('🤳 Sit in front of the phone — shoot a Reel', '🤳 اقعد قدام الموبايل — صوّر ريل'), title: L('Content & Social', 'المحتوى والسوشيال') },
  design:   { stand: [1.4, -2.55], cam: [1.0, 1.45, 0.5], look: [1.4, 1.05, -2.55], style: 'frame', extra: 'identity',
              label: L('🎨 Branding corner — photo or your own identity', '🎨 ركن الهوية — صورة أو اعمل هويتك'), title: L('In the Branding studio', 'في استوديو الهوية البصرية') },
  campaign: { stand: [0, -2.6], cam: [-0.6, 1.45, -0.3], look: [0, 1.05, -2.6], style: 'poster',
              label: L('📢 Be the face of the next campaign', '📢 كون وش الحملة الجاية'), title: L('Creative Campaigns', 'الحملات الإبداعية') },
  web:      { stand: [2.0, -2.5], cam: [0.9, 1.45, 0.4], look: [2.0, 1.05, -2.5], style: 'browser',
              label: L('💻 Put yourself on a website', '💻 حط نفسك على موقع'), title: L('Web Design', 'تصميم المواقع') },
  ads:      { stand: [1.3, -2.6], cam: [2.2, 1.5, 0.7], look: [1.2, 1.0, -2.6], style: 'ad',
              label: L('📈 Star in a sponsored ad', '📈 اعمل إعلان ممول عن نفسك'), title: L('Performance Ads', 'الإعلانات الممولة') },
  lounge:   { stand: [0, -2.4], cam: [0, 1.5, 0.0], look: [0, 1.05, -2.4], style: 'cover',
              label: L('📰 Make the cover of Planet Business', '📰 اطلع على غلاف المجلة'), title: L('Consulting', 'الاستشارات التسويقية') },
  war:      { stand: [-1.6, -2.9], cam: [-1.2, 1.55, -0.2], look: [-1.6, 1.1, -2.9], style: 'board',
              label: L('🧭 A photo at the strategy board', '🧭 صورة قدام لوحة الاستراتيجية'), title: L('Brand Strategy', 'استراتيجية العلامة') },
};
// any other room: you stand in the middle facing the door, and the photo shows the room behind you
const DOOR_SHOT = { stand: [0, 1.0], cam: [0, 1.5, 3.2], look: [0, 1.05, 0.8], style: 'frame' };
// client rooms: a screen with our work for them, on a wall that's free in that room
const SCREEN_AT = {
  resto:  { wall: 'left',  a: 0,    y: 1.5,  w: 1.8, h: 1.2 },
  clinic: { wall: 'left',  a: 0.5,  y: 1.75, w: 1.5, h: 1.0 },
  kiosk:  { wall: 'right', a: 0,    y: 1.5,  w: 1.8, h: 1.2 },
  glass:  { wall: 'left',  a: -0.6, y: 1.5,  w: 1.8, h: 1.2 },
  shop:   { wall: 'back',  a: 2.65, y: 1.45, w: 1.3, h: 0.95 },
  office: { wall: 'right', a: 1.6,  y: 1.5,  w: 1.3, h: 0.9 },
};

/* ---------- the floor marker that says "something to do here" ---------- */
function emojiSprite(emo){
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#12153A'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.strokeStyle = '#F2C94C'; x.lineWidth = 8; x.stroke();
  x.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emo, 64, 70);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false })); s.scale.setScalar(0.55); return s;
}
function addSpot(x, z, emo, label, act){
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 32), new THREE.MeshBasicMaterial({ color: 0xF2C94C, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.set(x, 0.03, z); iG.add(ring);
  const ic = emojiSprite(emo); ic.position.set(x, 2.05, z); iG.add(ic);
  const spot = { x, z, label, act, ring, ic }; FUN.spots.push(spot); FUN.markers.push(ring, ic); return spot;
}

/* ---------- the work screen in client rooms ---------- */
function workScreen(c, at){
  const imgs = clientGallery(c); if (!imgs.length) return null;
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 430; const x = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv);
  let k = 0;
  const draw = () => { const src = 'img/' + imgs[k % imgs.length]; const im = new Image();
    im.onload = () => { x.fillStyle = '#12153A'; x.fillRect(0, 0, 640, 430); const s = Math.min(640 / im.width, 380 / im.height); x.drawImage(im, 320 - im.width*s/2, 190 - im.height*s/2, im.width*s, im.height*s);
      x.fillStyle = '#F2C94C'; x.fillRect(0, 380, 640, 50); x.fillStyle = '#12153A'; x.font = '800 26px "IBM Plex Sans Arabic",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.direction = AR2() ? 'rtl' : 'ltr'; x.fillText(AR2() ? `شغلنا مع ${c.name.ar} · ${k % imgs.length + 1}/${imgs.length}` : `Our work for ${c.name.en} · ${k % imgs.length + 1}/${imgs.length}`, 320, 406, 600);
      tex.needsUpdate = true; };
    im.src = src; k++; };
  draw(); FUN.timers.push(setInterval(draw, 3500));
  const { wall, a, y, w, h } = at;
  if (wall === 'back'){ B(w + 0.14, h + 0.14, 0.06, 0x12153A, a, y, -iD/2 + 0.07, false); iPlane(tex, w, h, a, y, -iD/2 + 0.11); return { x: a, z: -iD/2 + 1.1 }; }
  const sx = wall === 'left' ? -iW/2 : iW/2, s = wall === 'left' ? 1 : -1;
  B(0.06, h + 0.14, w + 0.14, 0x12153A, sx + s * 0.07, y, a, false); iPlane(tex, w, h, sx + s * 0.11, y, a, s * Math.PI/2);
  return { x: sx + s * 1.1, z: a };
}

/* ---------- dressing each room ---------- */
function dressRoom(p){
  const theme = themeOf(p), c = p.client;
  if (theme === 'video'){ // the chroma-key backdrop: hidden, and swapped in only for the shot
    const tex = new THREE.CanvasTexture(document.createElement('canvas'));
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.15), new THREE.MeshBasicMaterial({ map: tex })); bd.position.set(-1.8, 1.1, -iD/2 + 0.14); bd.visible = false; iG.add(bd); FUN.backdrop = bd; }
  const shot = SHOTS[theme] || { ...DOOR_SHOT, style: c ? 'brand' : 'frame',
    label: c ? L(`📸 A photo at ${c.name.en}`, `📸 صورة في ${c.name.ar}`) : L(`📸 A photo in ${p.name.en}`, `📸 صورة في ${p.name.ar}`), title: c ? c.name : p.name };
  addSpot(shot.stand[0], shot.stand[1], shot.extra ? '🎨' : shot.style === 'rec' ? '🎬' : shot.style === 'reel' ? '🤳' : '📸', shot.label,
    () => shot.extra ? identityChooser(shot, p) : roomShot(shot, p));
  if (c && SCREEN_AT[theme]){ const s = workScreen(c, SCREEN_AT[theme]);
    if (s) addSpot(s.x, s.z, '🖼️', L(`🖼️ See our work for ${c.name.en}`, `🖼️ شوف شغلنا مع ${c.name.ar}`), () => openExhibit('client', c.logo)); }
}

/* ---------- taking the photo ---------- */
const ASPECT = { reel: 9/16, rec: 16/9, browser: 1.25, ad: 1, cover: 0.75 };
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]).add(INT_OFF);
function placeForShot(shot){
  if (shot.sit){ const [sx, sz, sy] = shot.sit; if (!sitting) sitting = { x: sx, z: sz, yaw: sy, h: 0.46, where: 'b', back: iPos.clone() };
    $('sitbubble') && ($('sitbubble').hidden = true); }
  else { if (sitting) standUp(); iPos.set(shot.stand[0], shot.stand[1]); iYaw = Math.atan2(shot.cam[0] - shot.stand[0], shot.cam[2] - shot.stand[1]); }
}
function roomShot(shot, p){
  if (FUN.busy || !inBuilding) return;
  FUN.busy = true; placeForShot(shot); $('prompt').hidden = true; state = 'xmodal';
  if (typeof anEvent === 'function') anEvent('photo', themeOf(p));
  let n = 3; const cd = document.createElement('div'); cd.className = 'photocd'; document.body.appendChild(cd);
  const tick = () => { placeForShot(shot); cd.textContent = n ? String(n) : (shot.style === 'rec' ? '🎬' : '📸'); Sfx.blip(); if (n-- > 0) return setTimeout(tick, 750); setTimeout(() => { cd.remove(); capture(shot, p); }, 120); };
  tick();
}
async function capture(shot, p){
  // the room's markers stay out of the picture; the green screen becomes somewhere else
  FUN.markers.forEach(m => m.visible = false); if (iHost) iHost.tag.visible = false;
  let backdropSrc = null;
  if (shot.style === 'rec' && FUN.backdrop){ backdropSrc = pickBackdrop(); try { await paintBackdrop(backdropSrc); FUN.backdrop.visible = true; } catch (e) {} }
  // the player, posed where the shot wants them
  if (sitting){ player.position.copy(INT_OFF).add(new THREE.Vector3(sitting.x, 0, sitting.z)); player.quaternion.setFromEuler(new THREE.Euler(0, sitting.yaw, 0)); applySitPose(); }
  else { player.position.copy(INT_OFF).add(new THREE.Vector3(iPos.x, 0, iPos.y)); player.quaternion.setFromEuler(new THREE.Euler(0, iYaw, 0)); }
  const cp = camera.position.clone(), cq = camera.quaternion.clone(), cu = camera.up.clone(), fov = camera.fov;
  // render at the picture's own shape, so a tall phone and a wide laptop take the same photo
  const aspect = ASPECT[shot.style] || 0.8, rh = 960, rw = Math.round(rh * aspect), pr = renderer.getPixelRatio(), asp = camera.aspect;
  renderer.setPixelRatio(1); renderer.setSize(rw, rh, false);
  camera.position.copy(V3(shot.cam)); camera.up.set(0, 1, 0); camera.lookAt(V3(shot.look)); camera.fov = shot.fov || 52; camera.aspect = aspect; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const out = compose(renderer.domElement, shot, p);
  camera.position.copy(cp); camera.quaternion.copy(cq); camera.up.copy(cu); camera.fov = fov; camera.aspect = asp; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); resize();
  FUN.markers.forEach(m => m.visible = true); if (FUN.backdrop) FUN.backdrop.visible = false;
  Sfx.finish(); const fl = document.createElement('div'); fl.className = 'photoflash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 500);
  state = 'play'; FUN.busy = false;
  const room = t(shot.title || p.name);
  const done = cv => showPhoto(cv, () => roomShot(shot, p), AR2() ? `أنا في ${room} على كوكب Planet 🪐 game.theplanetco.com` : `Me at ${room} on Planet 🪐 game.theplanetco.com`);
  out.ready.then(() => done(out.cv));
}

/* green screen: one of our pieces, or space */
function pickBackdrop(){
  const pool = []; for (const c of CLIENTS){ const g = clientGallery(c); if (g.length) pool.push('img/' + g[Math.floor(Math.random() * g.length)]); }
  return Math.random() < 0.25 || !pool.length ? null : pool[Math.floor(Math.random() * pool.length)];
}
function paintBackdrop(src){
  return new Promise(res => { const cv = document.createElement('canvas'); cv.width = 620; cv.height = 430; const x = cv.getContext('2d');
    const fin = () => { const m = FUN.backdrop.material; m.map.dispose(); m.map = new THREE.CanvasTexture(cv); m.needsUpdate = true; res(); };
    if (!src){ const g = x.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#06091A'); g.addColorStop(1, '#2E3557'); x.fillStyle = g; x.fillRect(0, 0, 620, 430);
      for (let i = 0; i < 140; i++){ x.fillStyle = `rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random() * 620, Math.random() * 430, 2, 2); }
      x.fillStyle = '#5E9F5E'; x.beginPath(); x.arc(470, 330, 120, 0, 7); x.fill(); x.fillStyle = '#5FA0E6'; x.beginPath(); x.arc(440, 300, 60, 0, 7); x.globalAlpha = 0.5; x.fill(); x.globalAlpha = 1; return fin(); }
    const im = new Image(); im.onload = () => { const s = Math.max(620 / im.width, 430 / im.height); x.drawImage(im, 310 - im.width*s/2, 215 - im.height*s/2, im.width*s, im.height*s); fin(); };
    im.onerror = () => { x.fillStyle = '#12153A'; x.fillRect(0, 0, 620, 430); fin(); }; im.src = src; });
}

/* ---------- dressing the picture ---------- */
const FONT = '"IBM Plex Sans Arabic","Montserrat",sans-serif';
function loadImg(src){ return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function crop(src, out, x0, y0, w, h){ // fill (x0,y0,w,h) of out with the centre of src, cover-style
  const sw = src.width, sh = src.height, s = Math.max(w / sw, h / sh), cw = w / s, ch = h / s;
  out.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x0, y0, w, h);
}
function rr(x, X, Y, W, H, r){ x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function txt(x, s, X, Y, size, color, weight = 800, align){ x.font = `${weight} ${size}px ${FONT}`; x.fillStyle = color; x.textAlign = align || (AR2() ? 'right' : 'left'); x.direction = AR2() ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, X, Y); }
const nickOf = () => (profile.nick || (AR2() ? 'زائر Planet' : 'Planet visitor'));
const startX = W => AR2() ? W - 50 : 50;

function compose(src, shot, p){
  const W = 1080, cv = document.createElement('canvas'), x = cv.getContext('2d'); let ready = Promise.resolve();
  const style = shot.style, room = t(shot.title || p.name), nick = nickOf();
  const brandBar = (H, title, sub, logoSrc) => { // the shared bottom strip: where, who, Planet
    x.fillStyle = '#12153A'; x.fillRect(0, H, W, 170); x.fillStyle = '#F2C94C'; x.fillRect(0, H, W, 10);
    const tx = AR2() ? W - 40 : 200;
    txt(x, title, tx, H + 74, 42, '#F4F7FC'); txt(x, sub, tx, H + 118, 30, '#C9D6EA', 600); txt(x, `game.theplanetco.com · ${new Date().toLocaleDateString(AR2() ? 'ar-EG' : 'en-GB')}`, tx, H + 154, 24, '#8FA3C4', 600);
    ready = Promise.all([loadImg('logo.png'), logoSrc ? loadImg(logoSrc) : null]).then(([pl, cl]) => {
      const lx = AR2() ? 30 : 30; x.fillStyle = '#F4F7FC'; x.beginPath(); x.arc(lx + 70, H + 88, 66, 0, 7); x.fill();
      const im = cl || pl; if (im){ const s = Math.min(104 / im.width, 104 / im.height); x.drawImage(im, lx + 70 - im.width*s/2, H + 88 - im.height*s/2, im.width*s, im.height*s); } });
  };

  if (style === 'reel'){ // 9:16 with the Reels interface over it
    const H = Math.round(W * 16 / 9); cv.width = W; cv.height = H; crop(src, x, 0, 0, W, H);
    const g = x.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); x.fillStyle = g; x.fillRect(0, H * 0.6, W, H * 0.4);
    const g2 = x.createLinearGradient(0, 0, 0, 220); g2.addColorStop(0, 'rgba(0,0,0,.5)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(0, 0, W, 220);
    txt(x, 'Reels', 50, 110, 56, '#fff', 800, 'left'); txt(x, '📷', W - 50, 110, 50, '#fff', 400, 'right');
    const icons = [['❤️', '12.4K'], ['💬', '318'], ['↗️', '1.2K'], ['🔖', '']]; const rx = AR2() ? 90 : W - 90;
    icons.forEach(([ic, n], i) => { const y = H - 760 + i * 150; txt(x, ic, rx, y, 64, '#fff', 400, 'center'); if (n) txt(x, n, rx, y + 46, 30, '#fff', 700, 'center'); });
    const tx = startX(W); x.fillStyle = '#F2C94C'; x.beginPath(); x.arc(AR2() ? W - 80 : 80, H - 330, 36, 0, 7); x.fill();
    txt(x, AR2() ? `@${nick}` : `@${nick}`, AR2() ? W - 135 : 135, H - 318, 38, '#fff');
    txt(x, AR2() ? 'متابعة' : 'Follow', AR2() ? W - 135 - x.measureText(`@${nick}`).width - 60 : 135 + x.measureText(`@${nick}`).width + 60, H - 318, 30, '#fff', 700);
    txt(x, AR2() ? 'من استوديو المحتوى على كوكب Planet 🪐✨' : 'From the Content studio on Planet 🪐✨', tx, H - 250, 36, '#fff', 600);
    txt(x, AR2() ? '#بلانت #محتوى #ريلز' : '#Planet #content #reels', tx, H - 200, 32, '#C9D6EA', 600);
    txt(x, '🎵 Planet · original audio', tx, H - 140, 30, '#fff', 600);
    txt(x, 'game.theplanetco.com', W / 2, H - 60, 26, 'rgba(255,255,255,.75)', 600, 'center');
  } else if (style === 'rec'){ // the camera's viewfinder
    const H = Math.round(W * 9 / 16); cv.width = W; cv.height = H + 170; crop(src, x, 0, 0, W, H);
    x.strokeStyle = '#fff'; x.lineWidth = 6; const m = 40, l = 70;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([X, Y, sx, sy]) => { x.beginPath(); x.moveTo(X, Y + sy * l); x.lineTo(X, Y); x.lineTo(X + sx * l, Y); x.stroke(); });
    x.fillStyle = '#FF3344'; x.beginPath(); x.arc(m + 40, m + 48, 14, 0, 7); x.fill(); txt(x, 'REC', m + 66, m + 60, 34, '#fff', 800, 'left');
    const tc = new Date(); txt(x, `00:${String(tc.getMinutes()).padStart(2, '0')}:${String(tc.getSeconds()).padStart(2, '0')}:12`, W - m - 20, m + 60, 32, '#fff', 700, 'right');
    txt(x, '4K · 25fps · ISO 800', m + 20, H - m - 20, 26, 'rgba(255,255,255,.85)', 700, 'left'); txt(x, '🔋 87%', W - m - 20, H - m - 20, 26, '#fff', 700, 'right');
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; for (const f of [1/3, 2/3]){ x.beginPath(); x.moveTo(W * f, 0); x.lineTo(W * f, H); x.stroke(); x.beginPath(); x.moveTo(0, H * f); x.lineTo(W, H * f); x.stroke(); }
    brandBar(H, AR2() ? '🎬 أكشن! في استوديو الموشن والفيديو' : '🎬 Action! In the Motion & Video studio', nick);
  } else if (style === 'poster'){ // a campaign poster
    const H = Math.round(W * 5 / 4); cv.width = W; cv.height = H + 170; crop(src, x, 0, 0, W, H);
    x.fillStyle = 'rgba(18,21,58,.82)'; x.fillRect(0, 0, W, 230); x.fillStyle = '#F2C94C'; x.fillRect(0, 230, W, 12);
    txt(x, AR2() ? 'الحملة الجاية؟' : 'The next campaign?', W / 2, 105, 70, '#F2C94C', 900, 'center');
    txt(x, AR2() ? `بطولة ${nick} ✨` : `Starring ${nick} ✨`, W / 2, 180, 50, '#F4F7FC', 800, 'center');
    x.fillStyle = '#E76F51'; rr(x, W / 2 - 230, H - 140, 460, 92, 46); x.fill(); txt(x, AR2() ? 'قريباً على كل الشاشات' : 'Coming to every screen', W / 2, H - 80, 36, '#fff', 800, 'center');
    brandBar(H, AR2() ? '📢 وش حملة من Planet' : '📢 The face of a Planet campaign', AR2() ? 'استوديو الحملات الإبداعية' : 'Creative Campaigns studio');
  } else if (style === 'browser'){ // a website hero
    const H = Math.round(W * 0.8); cv.width = W; cv.height = H + 110 + 170;
    x.fillStyle = '#E9ECF2'; x.fillRect(0, 0, W, 110); [['#FF5F57', 40], ['#FEBC2E', 80], ['#28C840', 120]].forEach(([c, X]) => { x.fillStyle = c; x.beginPath(); x.arc(X, 55, 13, 0, 7); x.fill(); });
    x.fillStyle = '#fff'; rr(x, 170, 28, W - 220, 54, 27); x.fill();
    const slug = String(nick).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '') || 'you'; txt(x, `🔒 ${slug}.theplanetco.com`, 200, 66, 28, '#3B4256', 600, 'left');
    crop(src, x, 0, 110, W, H); const g = x.createLinearGradient(0, 110, 0, 110 + H); g.addColorStop(0, 'rgba(18,21,58,.55)'); g.addColorStop(.5, 'rgba(18,21,58,0)'); x.fillStyle = g; x.fillRect(0, 110, W, H);
    txt(x, AR2() ? `أهلاً، أنا ${nick}` : `Hi, I'm ${nick}`, startX(W), 220, 64, '#fff', 900); txt(x, AR2() ? 'موقعي اتعمل في استوديو المواقع على كوكب Planet' : 'My site, made in the Web studio on Planet', startX(W), 280, 32, '#E9ECF2', 600);
    x.fillStyle = '#F2C94C'; rr(x, AR2() ? W - 330 : 50, 310, 280, 76, 38); x.fill(); txt(x, AR2() ? 'ابدأ دلوقتي ←' : 'Get started →', AR2() ? W - 190 : 190, 360, 32, '#12153A', 800, 'center');
    brandBar(110 + H, AR2() ? '💻 موقع باسمك من Planet' : '💻 A website with your name on it', AR2() ? 'استوديو تصميم المواقع' : 'Web Design studio');
  } else if (style === 'ad'){ // a sponsored post
    const H = W; cv.width = W; cv.height = 150 + H + 170 + 170; x.fillStyle = '#fff'; x.fillRect(0, 0, W, cv.height);
    const nameX = AR2() ? W - 150 : 150; txt(x, 'Planet', nameX, 72, 38, '#12153A'); txt(x, AR2() ? 'ممول · 🌍' : 'Sponsored · 🌍', nameX, 115, 28, '#65676B', 600);
    txt(x, '•••', AR2() ? 50 : W - 50, 80, 40, '#65676B', 800, AR2() ? 'left' : 'right');
    crop(src, x, 0, 150, W, H);
    x.fillStyle = '#F0F2F5'; x.fillRect(0, 150 + H, W, 170); txt(x, 'GAME.THEPLANETCO.COM', startX(W), 150 + H + 55, 26, '#65676B', 600);
    txt(x, AR2() ? `${nick} جرّب Planet — وإنت؟` : `${nick} tried Planet — your turn?`, startX(W), 150 + H + 110, 38, '#050505');
    x.fillStyle = '#E4E6EB'; rr(x, AR2() ? 40 : W - 300, 150 + H + 50, 260, 76, 12); x.fill(); txt(x, AR2() ? 'اعرف أكتر' : 'Learn more', AR2() ? 170 : W - 170, 150 + H + 100, 32, '#050505', 800, 'center');
    txt(x, AR2() ? '👍❤️ ١٢ ألف وصول · ٤٫٢٪ تفاعل · تكلفة النقرة ٠٫٨ ج' : '👍❤️ 12K reach · 4.2% engagement · 0.8 EGP per click', W / 2, 150 + H + 160, 28, '#65676B', 600, 'center');
    brandBar(150 + H + 170, AR2() ? '📈 إعلان ممول عنك من Planet' : '📈 Your own sponsored ad', AR2() ? 'استوديو الإعلانات الممولة' : 'Performance Ads studio');
    ready = ready.then(() => loadImg('logo.png')).then(im => { x.fillStyle = '#F4F7FC'; x.beginPath(); x.arc(AR2() ? W - 80 : 80, 80, 48, 0, 7); x.fill(); if (im) x.drawImage(im, (AR2() ? W - 80 : 80) - 36, 44, 72, 72); });
  } else if (style === 'cover'){ // the magazine
    const H = Math.round(W * 4 / 3); cv.width = W; cv.height = H; crop(src, x, 0, 0, W, H);
    const g = x.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, 'rgba(18,21,58,.85)'); g.addColorStop(1, 'rgba(18,21,58,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 380);
    txt(x, 'PLANET', W / 2, 190, 190, '#F2C94C', 900, 'center'); txt(x, 'B U S I N E S S', W / 2, 250, 40, '#fff', 700, 'center');
    const g2 = x.createLinearGradient(0, H - 520, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.8)'); x.fillStyle = g2; x.fillRect(0, H - 520, W, 520);
    txt(x, AR2() ? 'شخصية العدد' : 'PERSON OF THE ISSUE', startX(W), H - 330, 34, '#F2C94C', 800);
    txt(x, nick, startX(W), H - 250, 84, '#fff', 900);
    txt(x, AR2() ? '«خطة واحدة للسنة… والأرقام اتحركت»' : '"One plan for the year — and the numbers moved"', startX(W), H - 180, 36, '#E9ECF2', 600);
    txt(x, AR2() ? `العدد ${new Date().getMonth() + 1} · ${new Date().getFullYear()} · game.theplanetco.com` : `Issue ${new Date().getMonth() + 1} · ${new Date().getFullYear()} · game.theplanetco.com`, startX(W), H - 70, 26, '#C9D6EA', 600);
    x.fillStyle = '#fff'; x.fillRect(AR2() ? 50 : W - 210, H - 170, 160, 100); x.fillStyle = '#12153A'; for (let i = 0; i < 30; i++) x.fillRect((AR2() ? 60 : W - 200) + i * 5, H - 160, (i % 3) + 1, 70);
  } else if (style === 'board'){ // the strategy board, with notes
    const H = Math.round(W * 5 / 4); cv.width = W; cv.height = H + 170; crop(src, x, 0, 0, W, H);
    const notes = AR2() ? [['إحنا لمين؟', '#F2C94C'], ['ليه إحنا؟', '#E9A0B8'], ['الهدف: ٣ شهور', '#8FB4E3'], [`القائد: ${nick}`, '#C9F0D2']] : [['Who for?', '#F2C94C'], ['Why us?', '#E9A0B8'], ['Goal: 3 months', '#8FB4E3'], [`Lead: ${nick}`, '#C9F0D2']];
    notes.forEach(([s, c], i) => { const X = i % 2 ? W - 330 : 40, Y = i < 2 ? 50 : H - 250; x.save(); x.translate(X + 140, Y + 95); x.rotate((i % 2 ? 1 : -1) * 0.06); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(-134, -84, 290, 200); x.fillStyle = c; x.fillRect(-140, -95, 290, 200); x.restore();
      txt(x, s, X + 145, Y + 110, 38, '#12153A', 800, 'center'); });
    brandBar(H, AR2() ? '🧭 في غرفة الاستراتيجية' : '🧭 In the Strategy room', nick);
  } else { // 'frame' / 'brand': the photo with the bottom strip
    const H = Math.round(W * 5 / 4); cv.width = W; cv.height = H + 170; crop(src, x, 0, 0, W, H);
    const c = p.client; brandBar(H, (style === 'brand' ? (AR2() ? `📍 زرت ${room}` : `📍 Visiting ${room}`) : `📍 ${room}`), AR2() ? `${nick} · على كوكب Planet 🪐` : `${nick} · on Planet 🪐`, style === 'brand' && c ? `img/logos/${c.logo}.png` : null);
  }
  return { cv, ready: Promise.resolve().then(() => ready) };
}

/* ---------- Branding: make yourself a little identity ---------- */
const PALETTES = [['#12153A', '#F2C94C', '#E76F51'], ['#2E6BA9', '#8FB4E3', '#F4F7FC'], ['#3E8E7E', '#C9F0D2', '#12153A'], ['#8E6BC2', '#E9A0B8', '#FFF4EC'], ['#E76F51', '#F2C94C', '#2B2420'], ['#0E1530', '#7FE8FF', '#FF9BE2']];
const SHAPES = ['circle', 'square', 'hex', 'drop'];
function identityChooser(shot, p){
  const box = xModal('idbox', `<h3>🎨 ${AR2() ? 'ركن الهوية البصرية' : 'The Branding corner'}</h3>
    <p class="xm-sub">${AR2() ? 'خد صورة في الاستوديو، أو خلّي الفريق يعملك هوية سريعة باسمك.' : 'Take a photo in the studio, or let the team make you a quick identity.'}</p>
    <div class="xm-acts"><button type="button" data-a="photo">📸 ${AR2() ? 'صورة' : 'Photo'}</button><button type="button" data-a="id">🎨 ${AR2() ? 'اعمل هويتي' : 'Make my identity'}</button></div>`);
  box.querySelector('[data-a="photo"]').onclick = () => { closeX('idbox'); setTimeout(() => roomShot(shot, p), 150); };
  box.querySelector('[data-a="id"]').onclick = () => { closeX('idbox'); setTimeout(identityMaker, 150); };
}
function identityMaker(){
  if (typeof anEvent === 'function') anEvent('photo', 'identity');
  let pal = Math.floor(Math.random() * PALETTES.length), shape = Math.floor(Math.random() * SHAPES.length), name = String(profile.nick || (AR2() ? 'اسمك' : 'You')).slice(0, 18);
  const box = xModal('idmaker', `<h3>🎨 ${AR2() ? 'هويتك من Planet' : 'Your identity, by Planet'}</h3>
    <label class="xm-lab">${AR2() ? 'الاسم على اللوجو' : 'Name on the logo'} <input id="idname" maxlength="18" class="xm-in"></label>
    <canvas id="idcv" width="1080" height="1080" style="width:100%;border-radius:12px;display:block;margin:10px 0"></canvas>
    <div class="xm-acts"><button type="button" data-a="pal">🎨 ${AR2() ? 'ألوان تانية' : 'New colours'}</button><button type="button" data-a="shape">🔷 ${AR2() ? 'شكل تاني' : 'New shape'}</button>
    <button type="button" data-a="share">📤 ${AR2() ? 'شارك' : 'Share'}</button><a data-a="dl" download="planet-identity.png">⬇️ ${AR2() ? 'نزّلها' : 'Download'}</a></div>`);
  const cv = box.querySelector('#idcv'), x = cv.getContext('2d'), inp = box.querySelector('#idname'); inp.value = name;
  const mark = (cx, cy, r, c) => { x.fillStyle = c; const sh = SHAPES[shape]; x.beginPath();
    if (sh === 'circle') x.arc(cx, cy, r, 0, 7); else if (sh === 'square') rr(x, cx - r, cy - r, 2 * r, 2 * r, r * 0.28);
    else if (sh === 'hex'){ for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i - Math.PI / 6; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
    else { x.moveTo(cx, cy - r); x.bezierCurveTo(cx + r * 1.1, cy - r * 0.2, cx + r * 0.8, cy + r, cx, cy + r); x.bezierCurveTo(cx - r * 0.8, cy + r, cx - r * 1.1, cy - r * 0.2, cx, cy - r); }
    x.fill(); };
  const draw = () => { const [a, b, c] = PALETTES[pal], nm = name || '·', init = [...nm.trim()][0] || '·';
    x.fillStyle = c; x.fillRect(0, 0, 1080, 1080);
    mark(540, 400, 230, a); x.font = `900 230px ${FONT}`; x.fillStyle = b; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(init.toUpperCase(), 540, 412);
    txt(x, nm, 540, 760, 92, a, 900, 'center'); txt(x, AR2() ? 'هوية بصرية · Planet' : 'Visual identity · Planet', 540, 830, 34, a, 600, 'center');
    [a, b, c].forEach((col, i) => { x.fillStyle = col; rr(x, 300 + i * 170, 900, 140, 90, 18); x.fill(); x.strokeStyle = a; x.lineWidth = 4; x.stroke(); txt(x, col.slice(1).toUpperCase(), 370 + i * 170, 1030, 24, a, 700, 'center'); });
    box.querySelector('[data-a="dl"]').href = cv.toDataURL('image/png'); };
  inp.oninput = () => { name = inp.value.slice(0, 18); draw(); }; inp.addEventListener('keydown', e => e.stopPropagation());
  box.querySelector('[data-a="pal"]').onclick = () => { pal = (pal + 1) % PALETTES.length; draw(); };
  box.querySelector('[data-a="shape"]').onclick = () => { shape = (shape + 1) % SHAPES.length; draw(); };
  box.querySelector('[data-a="share"]').onclick = async () => { try { const blob = await new Promise(r => cv.toBlob(r, 'image/png')), f = new File([blob], 'planet-identity.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Planet', text: AR2() ? 'هويتي من استوديو Planet 🎨 game.theplanetco.com' : 'My identity from the Planet studio 🎨 game.theplanetco.com' });
    else box.querySelector('[data-a="dl"]').click(); } catch (e) {} };
  draw(); document.fonts && document.fonts.ready.then(draw);
}

/* ---------- wiring ---------- */
{ const plainBuild = buildRoom; buildRoom = function(p){ const r = plainBuild.apply(this, arguments); try { dressRoom(p); } catch (e) { console.warn('room extras', e); } return r; }; }
{ const plainClear = clearRoom; clearRoom = function(){ FUN.timers.forEach(clearInterval); FUN.timers.length = 0; FUN.spots.length = 0; FUN.markers.length = 0; FUN.backdrop = null; return plainClear.apply(this, arguments); }; }
{ const plainFrame = interiorFrame; interiorFrame = function(dt, now){
    const r = plainFrame.apply(this, arguments); if (!r) return r;
    const ts = now / 1000; FUN.spots.forEach((s, i) => { s.ic.position.y = 2.0 + Math.sin(ts * 2 + i) * 0.07; s.ring.material.opacity = 0.55 + Math.sin(ts * 3 + i) * 0.3; });
    // standing on a marker wins, even with the host nearby — step off it to talk to them
    if (state === 'play' && !sitting){
      let best = null, bd = 0.85; for (const s of FUN.spots){ const d = Math.hypot(s.x - iPos.x, s.z - iPos.y); if (d < bd){ bd = d; best = s; } }
      if (best){ near = { kind: 'ispot', ref: best, label: best.label }; $('prompt').hidden = false; $('promptText').textContent = t(best.label); }
    }
    return r; }; }
{ const plainInteract = interact; interact = function(tk){ if (tk && tk.kind === 'ispot') return tk.ref.act(); return plainInteract.apply(this, arguments); }; }

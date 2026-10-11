'use strict';
/* =====================================================================
   Planet Messenger — a walkable tiny planet for Planet (theplanetco.com)
   three.js r128 · cel-shaded · Arabic first
   ===================================================================== */

/* ---------- basics ---------- */
const $ = id => document.getElementById(id);
const store = { get(k){ try{ return localStorage.getItem(k) }catch(e){ return null } }, set(k,v){ try{ localStorage.setItem(k,v) }catch(e){} } };
let lang = store.get('pm-lang') === 'en' ? 'en' : 'ar';
const t = o => o[lang];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const nextFrame = () => new Promise(r => setTimeout(r, 16));   // not rAF: a background tab would stall loading
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const smooth01 = x => { x = clamp(x,0,1); return x*x*(3-2*x); };
let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;   // deterministic world

/* ---------- save ---------- */
const save = (() => { let s = {}; try{ s = JSON.parse(store.get('pm-save') || '{}') }catch(e){} return Object.assign({ d:[], p:[], s:[], fin:false }, s); })();
const persist = () => store.set('pm-save', JSON.stringify(save));

/* ---------- sound: real recordings (CC0 — see CREDITS.md) ---------- */
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, on = store.get('pm-sound') !== 'off';
  const buf = {}, raw = {};
  const NAMES = ['blip','click','open','close','jump','land','collect','deliver','discover','finish',
    ...[0,1,2,3,4].map(i => 'step_grass_'+i), ...[0,1,2,3,4].map(i => 'step_stone_'+i)];
  // start downloading right away; decode once the player presses Begin (browsers need a click first)
  const fetches = {};
  const get = (url, tries = 3) => fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).catch(() => tries > 1 ? new Promise(res => setTimeout(res, 400)).then(() => get(url, tries - 1)) : null);
  // big loops first, then the effects one after another (gentle on slow connections)
  fetches.music = get('audio/music.mp3'); fetches.birds = get('audio/birds.mp3');
  NAMES.reduce((p, n) => p.then(() => (fetches[n] = get(`audio/${n}.mp3`))), Promise.resolve());
  async function decode(n){ while (!fetches[n]) await new Promise(r => setTimeout(r, 50)); const ab = await fetches[n]; if (!ab) return null; try { return await ctx.decodeAudioData(ab.slice(0)); } catch(e){ return null; } }
  function loop(b, gainNode, vol){ if (!b) return; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, ctx.currentTime, 1.5); s.connect(g); g.connect(gainNode); s.start(); }
  async function init(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 1; musicGain.connect(master);
    NAMES.forEach(async n => { buf[n] = await decode(n); });
    decode('music').then(b => loop(b, musicGain, 0.32));
    decode('birds').then(b => loop(b, master, 0.28));
  }
  function play(n, vol = 0.5, rate = 1){ if (!ctx || !buf[n]) return; const s = ctx.createBufferSource(); s.buffer = buf[n]; s.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(); }
  let lastBlip = 0;
  return {
    init, get on(){ return on },
    toggle(){ on = !on; store.set('pm-sound', on ? 'on' : 'off'); if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08); return on; },
    duck(v){ if (musicGain) musicGain.gain.setTargetAtTime(Math.max(v, 0.75), ctx.currentTime, 0.4); },
    wake(){ if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    step(run, grass){ play((grass ? 'step_grass_' : 'step_stone_') + (Math.random()*5|0), run ? 0.38 : 0.26, 0.92 + Math.random()*0.16); },
    blip(){ const n = performance.now(); if (n - lastBlip < 70) return; lastBlip = n; play('blip', 0.12, 0.9 + Math.random()*0.25); },
    click(){ play('click', 0.35); }, open(){ play('open', 0.45); }, close(){ play('close', 0.4); },
    jump(){ play('jump', 0.4, 1.15); }, land(){ play('land', 0.35); },
    collect(){ play('collect', 0.45, 1 + Math.random()*0.1); },
    discover(){ play('discover', 0.4); }, deliver(){ play('deliver', 0.55); },
    finish(){ play('finish', 0.6); },
  };
})();

/* ---------- renderer ---------- */
const R = 44;   // wider world: the 21 places plus a building for every client
const canvas = $('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8FBCE3);
scene.fog = new THREE.Fog(0xA6CBEA, 90, 220);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
scene.add(camera);
const camLight = new THREE.DirectionalLight(0xffffff, 0.42); camLight.position.set(-4, 6, 10); camera.add(camLight);
const sunLight = new THREE.DirectionalLight(0xFFF1D6, 0.38); sunLight.position.set(-320, 220, -420); scene.add(sunLight);
const hemi = new THREE.HemisphereLight(0xE4F0FF, 0x6F8E6A, 0.45); scene.add(hemi);

const grad = new THREE.DataTexture(new Uint8Array([120,195,255]), 3, 1, THREE.LuminanceFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const matCache = {};
const toon = c => matCache[c] || (matCache[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }));
const INK = new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide });
const basicCache = {};
const basic = c => basicCache[c] || (basicCache[c] = new THREE.MeshBasicMaterial({ color: c }));
function mesh(geo, color, out = 1){
  const m = new THREE.Mesh(geo, toon(color));
  if (out){ geo.computeBoundingSphere(); const o = new THREE.Mesh(geo, INK); o.scale.setScalar(1 + 0.038*out/geo.boundingSphere.radius); m.add(o); }
  return m;
}
/* outline for loaded models: push back-faces out along the normal (works for skinned meshes too) */
function inkPush(width, skinning){
  const m = new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide, skinning: !!skinning });
  m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`); };
  return m;
}

const Y = new THREE.Vector3(0,1,0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function randDir(){ const u = rnd()*2-1, th = rnd()*Math.PI*2, r = Math.sqrt(1-u*u); return new THREE.Vector3(r*Math.cos(th), u, r*Math.sin(th)); }
function orient(obj, dir, yaw = 0){ obj.quaternion.setFromUnitVectors(Y, dir); obj.rotateY(yaw); }
function placeAt(obj, dir, yaw = 0, lift = 0){ dir = dir.clone().normalize(); obj.position.copy(dir).multiplyScalar(R + heightAt(dir) + lift); orient(obj, dir, yaw); return obj; }
/* make an object face a world point (rotate about its own up) */
function faceToward(obj, worldPoint){ obj.updateMatrixWorld(true); const loc = obj.worldToLocal(worldPoint.clone()); obj.rotateY(Math.atan2(loc.x, loc.z)); }

/* ---------- world layout ---------- */
const N_POI = POIS.length;
const poiDirs = (() => { const pts = [], ga = Math.PI*(3-Math.sqrt(5));
  for (let i=0;i<N_POI;i++){ const y = 1 - (i+0.5)/N_POI*2, r = Math.sqrt(1-y*y), th = ga*i + 0.6; pts.push(new THREE.Vector3(Math.cos(th)*r, y, Math.sin(th)*r)); }
  // each client district takes a tight group of neighbouring spots, so restaurants sit with restaurants, clinics with clinics
  const out = new Array(N_POI), free = new Set(pts.keys()), groups = {};
  POIS.forEach((p, i) => { if (p.district) (groups[p.district] = groups[p.district] || []).push(i); });
  const keys = Object.keys(groups); const seeds = keys.map((_, k) => Math.round((k + 0.5) * N_POI / keys.length) % N_POI);
  keys.forEach((dk, k) => { let seed = seeds[k]; if (!free.has(seed)) seed = [...free][0];
    const near = [...free].sort((a, b) => pts[seed].angleTo(pts[a]) - pts[seed].angleTo(pts[b]));
    groups[dk].forEach((pi, j) => { out[pi] = pts[near[j]]; free.delete(near[j]); }); });
  const rest = [...free]; POIS.forEach((p, i) => { if (!out[i]) out[i] = pts[rest.shift()]; });
  return out; })();
/* roads: minimum spanning tree + a few shortcuts so it reads as a town, not a tree */
const EDGES = (() => {
  const inT = [0], E = [], has = (a,b) => E.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a));
  while (inT.length < N_POI){ let best = null;
    for (const a of inT) for (let b=0;b<N_POI;b++){ if (inT.includes(b)) continue; const d = poiDirs[a].angleTo(poiDirs[b]); if (!best || d < best[2]) best = [a,b,d]; }
    E.push([best[0], best[1]]); inT.push(best[1]); }
  for (let a=0;a<N_POI;a++){ const ds = poiDirs.map((d,b) => [b, poiDirs[a].angleTo(d)]).filter(x => x[0]!==a).sort((x,y) => x[1]-y[1]);
    const [b, ang] = ds[1]; if (ang < 0.75 && !has(a,b)) E.push([a,b]); }
  return E; })();
const ADJ = poiDirs.map(() => []); EDGES.forEach(([a,b],i) => { ADJ[a].push(i); ADJ[b].push(i); });
const edgeN = EDGES.map(([a,b]) => new THREE.Vector3().crossVectors(poiDirs[a], poiDirs[b]).normalize());
const _q = V();
const edgeCap = EDGES.map(([a,b]) => ({ c: poiDirs[a].clone().add(poiDirs[b]).normalize(), cos: Math.cos(poiDirs[a].angleTo(poiDirs[b])/2 + 14/R) }));
function roadDist(d){ let m = 1e9;
  for (let i=0;i<EDGES.length;i++){ if (d.dot(edgeCap[i].c) < edgeCap[i].cos) continue;   // far from this road: skip the trig
    const a = poiDirs[EDGES[i][0]], b = poiDirs[EDGES[i][1]], n = edgeN[i], off = d.dot(n);
    _q.copy(d).addScaledVector(n, -off).normalize(); const ab = a.angleTo(b);
    const v = Math.abs(a.angleTo(_q) + _q.angleTo(b) - ab) < 1e-3 ? Math.asin(Math.min(1, Math.abs(off)))*R : Math.min(d.angleTo(a), d.angleTo(b))*R;
    if (v < m) m = v; }
  return m; }
function poiDist(d){ let best = -2, i0 = -1; for (let i=0;i<N_POI;i++){ const v = d.dot(poiDirs[i]); if (v > best){ best = v; i0 = i; } } return [Math.acos(clamp(best,-1,1))*R, i0]; }
function rawN(x,y,z){ return Math.sin(x*.19+1.3)*Math.sin(y*.17+.2)*Math.sin(z*.21+2.1) + .5*Math.sin(x*.41+z*.37+y*.13+.7) + .28*Math.sin(y*.83+x*.61+1.1)*Math.sin(z*.77+.4); }
function terrainInfo(d){
  const [pd] = poiDist(d), rd = roadDist(d);
  const m = smooth01(Math.min(pd - 8, rd - 2.4) / 7);
  const n = rawN(d.x*R, d.y*R, d.z*R) * m;
  let h = 0;
  if (n > 0.82) h = -1.1; else if (n > 0.6) h = -(n-0.6)/0.22*1.1;
  else if (n < -0.32) h = Math.pow((-0.32-n)/1.25, 1.25)*6.5;
  return { n, h, pd, rd };
}
const heightAt = d => terrainInfo(d).h;
const SEA = -0.38;

/* ---------- static batching: many small meshes → a few big ones ---------- */
const planet = new THREE.Group(); scene.add(planet);
const buckets = new Map();
function bake(root, target = planet){
  root.updateMatrixWorld(true); const keep = [];
  (function walk(o){
    if (o !== root && (o.isSprite || o.isInstancedMesh || o.isPoints || o.userData.dyn)){ keep.push(o); return; }
    if (o.isMesh && !o.isSkinnedMesh){
      const mat = o.material; let key = null;
      if (mat === INK) key = 'ink';
      else if (mat.isMeshToonMaterial && !mat.map && !mat.vertexColors && !mat.transparent) key = 't' + mat.color.getHex();
      else if (mat.isMeshBasicMaterial && !mat.transparent && !mat.map) key = 'b' + mat.color.getHex() + mat.side;
      if (key){ let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        g.applyMatrix4(o.matrixWorld); const id = target.uuid + key;
        if (!buckets.has(id)) buckets.set(id, { mat, geos: [], target }); buckets.get(id).geos.push(g); }
      else keep.push(o);
    }
    for (const c of [...o.children]) walk(c);
  })(root);
  for (const o of keep){ o.parent && o.parent.remove(o); o.matrixWorld.decompose(o.position, o.quaternion, o.scale); target.add(o); }
  if (root.parent) root.parent.remove(root);
}
function flush(){
  for (const { mat, geos, target } of buckets.values()){
    for (let i=0;i<geos.length;i+=4000){ const m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos.slice(i, i+4000)), mat); m.matrixAutoUpdate = false; target.add(m); }
  }
  buckets.clear();
}

/* ---------- terrain + ocean ---------- */
const DETAIL = isTouch ? 96 : 128;
let oceanMat = null;
function buildTerrain(){
  let g0 = new THREE.IcosahedronGeometry(1, DETAIL); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  g0 = THREE.BufferGeometryUtils.mergeVertices(g0, 1e-5);
  const P = g0.attributes.position, idx = g0.index.array, nv = P.count;
  const vh = new Float32Array(nv), vn = new Float32Array(nv), vr = new Float32Array(nv), vp = new Float32Array(nv), d = V();
  for (let i=0;i<nv;i++){ d.fromBufferAttribute(P, i).normalize(); const s = terrainInfo(d); vh[i] = s.h; vn[i] = s.n; vr[i] = s.rd; vp[i] = s.pd; P.setXYZ(i, d.x, d.y, d.z); }
  const pos = new Float32Array(idx.length*3), col = new Float32Array(idx.length*3);
  const C = h => new THREE.Color(h);
  const G = [C(0x93C786), C(0x84BC79), C(0xA2CF92), C(0x78B171)], road = C(0x9EA4B8), curb = C(0xF1F3F7), tileA = C(0xF4EEE2), tileB = C(0xE7DDC9),
        sand = C(0xF2E5C2), foam = C(0xFFFFFF), seabed = C(0x7CCAD3), rock = C(0xB1B7C6), rock2 = C(0x9EA5B6), snow = C(0xFFFFFF), meadow = C(0xD6E4A0);
  const m = V();
  for (let f=0; f<idx.length; f+=3){
    const a = idx[f], b = idx[f+1], c = idx[f+2];
    const h = (vh[a]+vh[b]+vh[c])/3, n = (vn[a]+vn[b]+vn[c])/3, rd = Math.min(vr[a],vr[b],vr[c]), pd = (vp[a]+vp[b]+vp[c])/3;
    m.set(P.getX(a)+P.getX(b)+P.getX(c), P.getY(a)+P.getY(b)+P.getY(c), P.getZ(a)+P.getZ(b)+P.getZ(c)).multiplyScalar(R/3);
    let cl;
    if (pd < 5.2) cl = ((Math.floor(m.x*1.3)+Math.floor(m.y*1.3)+Math.floor(m.z*1.3)) & 1) ? tileA : tileB;
    else if (rd < 1.1) cl = road; else if (rd < 1.45) cl = curb;
    else if (h < SEA - 0.05) cl = seabed; else if (h < SEA + 0.18) cl = foam; else if (n > 0.48) cl = sand;
    else if (h > 4.6) cl = snow; else if (h > 2.6) cl = (f/3)%3 ? rock : rock2;
    else { const k = Math.sin(m.x*0.33+1)*Math.sin(m.z*0.29) + Math.sin(m.y*0.41+m.x*0.17)*0.5; cl = k > 0.95 ? meadow : k > 0.2 ? G[2] : k > -0.45 ? G[0] : G[1]; }
    [a,b,c].forEach((v,k) => { const r = R + vh[v]; pos[(f+k)*3] = P.getX(v)*r; pos[(f+k)*3+1] = P.getY(v)*r; pos[(f+k)*3+2] = P.getZ(v)*r; cl.toArray(col, (f+k)*3); });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const terr = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad })); terr.matrixAutoUpdate = false; planet.add(terr);
  // ocean with gentle waves
  oceanMat = new THREE.MeshToonMaterial({ color: 0x5FB8D2, gradientMap: grad, transparent: true, opacity: 0.86 });
  oceanMat.onBeforeCompile = s => { s.uniforms.uT = { value: 0 }; oceanMat.userData.s = s;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * (sin(position.x*0.9+uT*1.3)*sin(position.z*0.8+uT)*0.06);'); };
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(R + SEA, 128, 96), oceanMat));
}

/* ---------- sky ---------- */
function buildSky(){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0,0,0,1024); gr.addColorStop(0,'#3F7FC0'); gr.addColorStop(.35,'#6FA6DA'); gr.addColorStop(.5,'#A6CBEA'); gr.addColorStop(.62,'#8FBCE3'); gr.addColorStop(1,'#4F8BC8');
  x.fillStyle = gr; x.fillRect(0,0,2048,1024);
  // painted cloud banks, soft and layered like a gouache sky
  const puff = (cx,cy,w) => { for (let i=0;i<9;i++){ const r = w*(0.18+rnd()*0.22), px = cx + (rnd()-0.5)*w, py = cy + (rnd()-0.5)*w*0.18;
      const g = x.createRadialGradient(px,py-r*0.2,0,px,py,r); g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(.7,'rgba(255,255,255,.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px,py,r,0,7); x.fill(); }
    x.fillStyle = 'rgba(150,185,220,.18)'; x.fillRect(cx - w*0.5, cy + w*0.06, w, 3); };
  for (let i=0;i<14;i++) puff(rnd()*2048, 360 + rnd()*280, 140 + rnd()*200);
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(700, 48, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.BackSide, depthWrite: false, fog: false })); scene.add(skyMesh);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFF4D8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.set(-320, 220, -420); sun.scale.set(260,260,1); scene.add(sun); sunSprite = sun;
  // night sky stars, only shown after dark
  const n = 900, arr = new Float32Array(n*3); for (let i=0;i<n;i++){ const d = randDir().multiplyScalar(640); arr.set([d.x,d.y,d.z], i*3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  nightStars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false })); nightStars.visible = false; scene.add(nightStars);
}
let skyMesh = null, sunSprite = null, nightStars = null, lampHalos = [];
/* day or night from the visitor's own clock (19:00–06:00 is night); the 🌙 button overrides it */
let dnMode = store.get('pm-dn') || 'auto';
function isNight(){ if (dnMode !== 'auto') return dnMode === 'night'; const h = new Date().getHours(); return h >= 19 || h < 6; }
function applyDayNight(){
  const n = isNight();
  if (skyMesh) skyMesh.material.color.set(n ? 0x2A3466 : 0xFFFFFF);
  if (sunSprite){ sunSprite.material.color.set(n ? 0xCFE0FF : 0xFFF4D8); sunSprite.scale.setScalar(n ? 90 : 260); }
  if (nightStars) nightStars.visible = n;
  scene.background.set(n ? 0x141B3D : 0x8FBCE3); scene.fog.color.set(n ? 0x1E2752 : 0xA6CBEA);
  hemi.intensity = n ? 0.26 : 0.45; sunLight.intensity = n ? 0.1 : 0.38; sunLight.color.set(n ? 0x9DB4FF : 0xFFF1D6); camLight.intensity = n ? 0.34 : 0.42;
  lampHalos.forEach(h => { h.material.opacity = n ? 0.9 : 0.3; h.scale.setScalar(n ? 2.6 : 1.4); });
  const b = $('dn'); if (b) b.textContent = dnMode === 'auto' ? (n ? '🌙' : '☀️') : dnMode === 'night' ? '🌙' : '☀️';
}
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.35,'rgba(255,255,255,.45)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); })();

/* ---------- props ---------- */
const SKIN = [0xF1C9A5,0xD9A27A,0xB57A55,0xF3D2B5], SHIRT = [0x2E6BA9,0xF2C94C,0xE76F51,0x3E8E7E,0x8E6BC2,0xF4F7FC,0x12153A,0xE9A0B8], HAIR = [0x2B1B12,0x12153A,0x5A3A22,0x0E0E10,0x8A5A2B];
function person(k, opt = {}){
  const p = new THREE.Group(), body = new THREE.Group(); p.add(body); const pick = (a,o) => a[(k*7+o) % a.length];
  const legL = new THREE.Group(), legR = new THREE.Group();
  [legL,legR].forEach((l,i) => { l.position.set(i?0.11:-0.11, 0.55, 0); const m = mesh(new THREE.CylinderGeometry(0.09,0.09,0.55,8), 0x23284D, 0); m.position.y = -0.27; l.add(m);
    const sh = mesh(new THREE.BoxGeometry(0.16,0.1,0.24), 0x2B1B12, 0); sh.position.set(0,-0.55,0.04); l.add(sh); body.add(l); });
  const tor = mesh(new THREE.CylinderGeometry(0.24,0.27,0.6,12), opt.shirt ?? pick(SHIRT,0)); tor.position.y = 0.85; body.add(tor);
  const hd = mesh(new THREE.SphereGeometry(0.26,16,12), pick(SKIN,1)); hd.position.y = 1.38; body.add(hd);
  // looks: 0 short hair · 1 cap · 2 hijab · 3 long hair · 4 short + glasses · 5 long hair + bun
  const look = opt.look ?? (k % 6), hairC = pick(HAIR,2);
  if (look === 2){ const hj = mesh(new THREE.SphereGeometry(0.31,16,12,Math.PI*0.62,Math.PI*1.76,0,Math.PI*0.78), pick([0x2E6BA9,0x8E6BC2,0xE9A0B8,0x3E8E7E,0x12153A,0xF2C94C],5), 0); hj.position.y = 1.38; body.add(hj);
    const dr = mesh(new THREE.CylinderGeometry(0.2,0.3,0.28,14), hj.material.color.getHex(), 0); dr.position.y = 1.12; body.add(dr); }
  else { const hr = mesh(new THREE.SphereGeometry(0.28,16,10,0,Math.PI*2,0,Math.PI*0.55), hairC, 0); hr.position.y = 1.42; hr.rotation.x = -0.25; body.add(hr);
    if (look === 3 || look === 5){ const lh = mesh(new THREE.BoxGeometry(0.46,0.5,0.16), hairC, 0); lh.position.set(0,1.22,-0.16); body.add(lh); }
    if (look === 5){ const bun = mesh(new THREE.SphereGeometry(0.11,10,8), hairC, 0); bun.position.set(0,1.66,-0.12); body.add(bun); } }
  if (look === 1){ const cap = mesh(new THREE.CylinderGeometry(0.27,0.28,0.12,14), pick(SHIRT,3)); cap.position.y = 1.56; body.add(cap); const brim = mesh(new THREE.BoxGeometry(0.3,0.03,0.22), pick(SHIRT,3), 0); brim.position.set(0,1.52,0.25); body.add(brim); }
  if (opt.face){ // a real photo as the face, for the Planet crew
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.235, 24), new THREE.MeshBasicMaterial({ map: opt.face })); f.position.set(0,1.38,0.262); body.add(f); }
  else {
    if (look === 4){ [-0.09,0.09].forEach(x => { const gl = mesh(new THREE.TorusGeometry(0.06,0.015,6,12), 0x12153A, 0); gl.position.set(x,1.41,0.25); body.add(gl); }); }
    [-0.09,0.09].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6), basic(0x0E0E10)); e.position.set(x,1.4,0.24); body.add(e); });
    const sm = new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,6,12,Math.PI), basic(0x6B2A20)); sm.position.set(0,1.31,0.245); sm.rotation.z = Math.PI; body.add(sm); }
  if (opt.logo){ // the company this person represents, printed on the shirt
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.3), new THREE.MeshBasicMaterial({ map: opt.logo })); patch.position.set(0,0.9,0.262); body.add(patch); }
  const armL = new THREE.Group(), armR = new THREE.Group();
  [armL,armR].forEach((a,i) => { a.position.set(i?0.31:-0.31, 1.08, 0); const m = mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,8), opt.shirt ?? pick(SHIRT,0), 0); m.position.y = -0.25; a.add(m);
    const h = mesh(new THREE.SphereGeometry(0.07,8,6), pick(SKIN,1), 0); h.position.y = -0.52; a.add(h); body.add(a); });
  p.userData = { dyn: true, body, armL, armR, legL, legR, k };
  return p;
}
function animatePerson(p, walkT, waving, now){
  const u = p.userData, s = Math.sin(walkT)*0.55;
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s*0.8;
  u.body.position.y = Math.abs(Math.cos(walkT))*0.04 + (walkT ? 0 : Math.sin(now*2 + u.k)*0.015);
  if (waving){ u.armR.rotation.x = 0; u.armR.rotation.z = -2.5 + Math.sin(now*9)*0.4; } else { u.armR.rotation.z = 0; u.armR.rotation.x = s*0.8; }
}
function mailbox(){ const g = new THREE.Group(); const post = mesh(new THREE.CylinderGeometry(0.05,0.05,0.9,6), 0x12153A, 0); post.position.y = 0.45; g.add(post);
  const box = mesh(new THREE.BoxGeometry(0.42,0.36,0.56), 0x2E6BA9); box.position.y = 1.05; g.add(box);
  const top = mesh(new THREE.CylinderGeometry(0.21,0.21,0.56,12,1,false,0,Math.PI), 0x2E6BA9); top.rotation.set(0,Math.PI/2,Math.PI/2); top.position.y = 1.23; g.add(top);
  const slot = mesh(new THREE.BoxGeometry(0.3,0.05,0.02), 0xF2C94C, 0); slot.position.set(0,1.1,0.29); g.add(slot);
  const flag = mesh(new THREE.BoxGeometry(0.03,0.22,0.12), 0xE76F51, 0); flag.position.set(0.23,1.25,0); g.add(flag); return g; }
function bush(k, s = 1){ const g = new THREE.Group(), cs = [0x74B47E,0x88C38C,0x67A873];
  for (let i=0;i<3;i++){ const b = mesh(new THREE.IcosahedronGeometry((0.32+((k+i)%3)*0.08)*s,0), cs[(k+i)%3]); b.position.set((i-1)*0.32*s, (0.28+(i%2)*0.08)*s, (i%2)*0.15*s); g.add(b); }
  if (k%2) for (let i=0;i<3;i++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,4), toon([0xF2C94C,0xF4F7FC,0xE76F51][i])); f.position.set((i-1)*0.3*s, 0.62*s, 0.22*s); g.add(f); }
  return g; }
function bench(){ const g = new THREE.Group(); const seat = mesh(new THREE.BoxGeometry(1.3,0.08,0.4), 0xB5835A); seat.position.y = 0.45; g.add(seat);
  const back = mesh(new THREE.BoxGeometry(1.3,0.35,0.06), 0xB5835A); back.position.set(0,0.72,-0.18); g.add(back);
  [-0.55,0.55].forEach(x => { const l = mesh(new THREE.BoxGeometry(0.06,0.45,0.38), 0x12153A, 0); l.position.set(x,0.22,0); g.add(l); }); return g; }
function lamp(){ const g = new THREE.Group(); const p = mesh(new THREE.CylinderGeometry(0.05,0.07,2.6,6), 0x12153A, 0); p.position.y = 1.3; g.add(p);
  const arm = mesh(new THREE.BoxGeometry(0.5,0.05,0.05), 0x12153A, 0); arm.position.set(0.22,2.58,0); g.add(arm);
  const head = mesh(new THREE.ConeGeometry(0.2,0.2,8), 0x12153A, 0); head.position.set(0.45,2.5,0); g.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8), basic(0xFFE7A0)); bulb.position.set(0.45,2.4,0); g.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFD98A, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
  halo.scale.set(1.4,1.4,1); halo.position.copy(bulb.position); g.add(halo); return g; }
function tree(k){
  const g = new THREE.Group(), h = 1.6 + rnd()*1.6;
  const tr = mesh(new THREE.CylinderGeometry(0.11,0.17,1.0,6), 0x8A6347); tr.position.y = 0.5; g.add(tr);
  if (k === 0){ [0,1,2].forEach(i => { const c = mesh(new THREE.ConeGeometry(0.85-i*0.2, h*0.55, 8), [0x5C9E78,0x68AC82,0x78BA8C][i]); c.position.y = 0.9 + i*h*0.28; g.add(c); }); }
  else if (k === 1){ const cs = [0x74B47E,0x88C38C,0x67A873]; [[0,1.35,0,0.78],[0.42,1.15,0.15,0.52],[-0.38,1.2,-0.1,0.55],[0.05,1.8,-0.05,0.5]].forEach(([x,y,z,r],i) => { const b = mesh(new THREE.IcosahedronGeometry(r,0), cs[i%3]); b.position.set(x, y*h/1.9+0.25, z); g.add(b); }); }
  else { const b = mesh(new THREE.IcosahedronGeometry(0.75,0), 0xE9A0B8); b.position.y = 1.5; b.scale.y = 1.1; g.add(b); const b2 = mesh(new THREE.IcosahedronGeometry(0.5,0), 0xF2B8CB); b2.position.set(0.35,1.9,0.1); g.add(b2); }
  return g;
}
function palm(){ const g = new THREE.Group(); for (let i=0;i<6;i++){ const s = mesh(new THREE.CylinderGeometry(0.13-i*0.01,0.15-i*0.01,0.5,6), 0x9B7650); s.position.set(i*0.05,0.25+i*0.48,0); s.rotation.z = -0.05*i; g.add(s); }
  for (let i=0;i<6;i++){ const l = mesh(new THREE.BoxGeometry(1.4,0.04,0.32), 0x4E9A55); l.position.set(0.3,3.0,0); l.rotation.set(0, i*Math.PI/3, -0.35); l.translateX(0.6); g.add(l); } return g; }

/* ---------- canvas signs and markers ---------- */
function signTex(p){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; const x = cv.getContext('2d');
  x.fillStyle = '#12153A'; x.beginPath(); if (x.roundRect) x.roundRect(8,8,496,184,22); else x.rect(8,8,496,184); x.fill();
  x.strokeStyle = '#8FB4E3'; x.lineWidth = 6; x.stroke();
  x.textAlign = 'center'; x.fillStyle = '#F2C94C'; x.font = '900 60px Orbitron, Arial Black, sans-serif';
  const cx = p.client ? 340 : 256, mw = p.client ? 320 : 470;
  x.fillText((p.n ? p.n + ' ' : '') + p.sign, cx, 90, mw);
  x.fillStyle = '#F4F7FC'; x.font = '700 50px IBM Plex Sans Arabic, sans-serif'; x.direction = 'rtl'; x.fillText(p.name.ar, cx, 160, mw);
  const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; return tx;
}
function markerTex(done){
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.lineWidth = 7; x.strokeStyle = '#12153A'; x.lineJoin = 'round';
  if (!done){ x.fillStyle = '#F2C94C'; x.beginPath(); x.moveTo(14,30); x.lineTo(114,26); x.lineTo(112,100); x.lineTo(16,102); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.moveTo(14,30); x.lineTo(64,70); x.lineTo(114,26); x.stroke(); }
  else { x.fillStyle = '#2E6BA9'; x.beginPath(); x.arc(64,64,48,0,7); x.fill(); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.moveTo(40,66); x.lineTo(58,82); x.lineTo(90,46); x.stroke(); }
  return new THREE.CanvasTexture(cv);
}
function stoneTex(i){
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#F4F7FC'; x.fillRect(0,0,256,128); x.fillStyle = '#2E6BA9'; x.font = '900 64px Orbitron, Arial Black'; x.textAlign = 'center'; x.fillText('0' + (i+1), 128, 84);
  return new THREE.CanvasTexture(cv);
}

/* ---------- buildings ---------- */
function building(kind){
  const g = new THREE.Group(); let r = 2.2;
  const body = (w,h,d,col,y=0) => { const m = mesh(new THREE.BoxGeometry(w,h,d), col); m.position.y = y + h/2; g.add(m); return m; };
  const door = z => { const m = mesh(new THREE.BoxGeometry(0.6,1.0,0.1), 0x12153A, 0); m.position.set(0,0.5,z); g.add(m); const k = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,4), basic(0xF2C94C)); k.position.set(0.18,0.5,z+0.06); g.add(k); };
  const win = (x,y,z,s=0.44) => { const f = mesh(new THREE.BoxGeometry(s+0.1,s+0.1,0.06), 0xF4F7FC, 0); f.position.set(x,y,z); g.add(f); const m = new THREE.Mesh(new THREE.BoxGeometry(s,s,0.08), basic(0xFFE29A)); m.position.set(x,y,z+0.01); g.add(m); };
  const pyr = (s,h,y,col) => { const m = mesh(new THREE.ConeGeometry(s,h,4), col); m.rotation.y = Math.PI/4; m.position.y = y + h/2; g.add(m); };
  const tank = (x,y,z) => { const m = mesh(new THREE.CylinderGeometry(0.3,0.3,0.55,10), 0xF4F7FC); m.position.set(x,y+0.28,z); g.add(m); };
  const dish = (x,y,z) => { const d = mesh(new THREE.SphereGeometry(0.35,12,8,0,Math.PI*2,0,Math.PI/2), 0xDCE2EE); d.rotation.x = -1; d.position.set(x,y+0.25,z); g.add(d); };
  const awning = (w,y,z,col) => { const a = mesh(new THREE.BoxGeometry(w,0.07,0.6), col); a.position.set(0,y,z+0.25); a.rotation.x = 0.35; g.add(a); };
  switch (kind){
    case 'hq': body(4.4,3,3.8,0xF4F7FC); door(1.91); win(-1.3,1.9,1.91); win(1.3,1.9,1.91); win(-1.3,0.9,1.91,0.5);
      { const d = mesh(new THREE.SphereGeometry(1.8,24,12,0,Math.PI*2,0,Math.PI/2), 0x2E6BA9); d.position.y = 3; g.add(d);
        const a = mesh(new THREE.CylinderGeometry(0.06,0.06,1.6), 0x12153A, 0); a.position.y = 5.4; g.add(a);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.24,12,8), basic(0xF2C94C)); b.position.y = 6.25; g.add(b); } r = 3.1; break;
    case 'tower': body(2.2,4.2,2.2,0xF4F7FC); door(1.11); win(0,2.2,1.11); win(0,3.3,1.11); win(0.9,3.3,1.11,0.3); pyr(1.8,1.5,4.2,0x2E6BA9);
      { const f = mesh(new THREE.CylinderGeometry(0.04,0.04,1.3), 0x12153A, 0); f.position.y = 6.3; g.add(f); const fl = mesh(new THREE.BoxGeometry(0.7,0.4,0.05), 0xF2C94C); fl.position.set(0.36,6.7,0); g.add(fl); } awning(1.2,1.2,1.1,0xF2C94C); break;
    case 'house': body(3,2,2.6,0xF4F7FC); door(1.31); win(-0.95,1.2,1.31); win(0.95,1.2,1.31); pyr(2.3,1.5,2,0x2E6BA9);
      { const ch = mesh(new THREE.BoxGeometry(0.35,0.8,0.35), 0xE76F51); ch.position.set(0.8,3.0,-0.4); g.add(ch); } awning(1.0,1.15,1.3,0xF2C94C); break;
    case 'screen': body(3.2,2.4,2.4,0xE4EBF6); door(1.21); win(-1.05,1.4,1.21); tank(-0.9,2.4,-0.6); dish(0.9,2.4,-0.6);
      { const s = mesh(new THREE.BoxGeometry(2.6,1.5,0.14), 0x12153A); s.position.set(0,3.6,0.2); g.add(s); const s2 = new THREE.Mesh(new THREE.BoxGeometry(2.3,1.2,0.16), basic(0x5FA0E6)); s2.position.set(0,3.6,0.22); g.add(s2);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.18), basic(0xE76F51)); h.position.set(-0.6,3.7,0.24); g.add(h);
        const p = mesh(new THREE.CylinderGeometry(0.08,0.08,0.9), 0x12153A, 0); p.position.set(0,2.75,0.2); g.add(p); } awning(1.0,1.15,1.2,0x2E6BA9); break;
    case 'billboard': body(2.6,1.8,2.4,0xF4F7FC); door(1.21); win(0.8,1.1,1.21); tank(-0.7,1.8,0.3);
      [-1,1].forEach(x => { const p = mesh(new THREE.CylinderGeometry(0.08,0.08,2.8), 0x12153A, 0); p.position.set(x,2.6,-0.8); g.add(p); });
      { const b = mesh(new THREE.BoxGeometry(3.6,1.7,0.18), 0xF2C94C); b.position.set(0,4.0,-0.8); g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(3.2,1.3,0.2), basic(0x2E6BA9)); s.position.set(0,4.0,-0.79); g.add(s);
        const st = new THREE.Mesh(new THREE.CircleGeometry(0.45,5), basic(0xF2C94C)); st.position.set(0,4.0,-0.68); g.add(st); } r = 2.4; break;
    case 'studio': body(3.4,2,2.8,0xF4F7FC); door(1.41); win(-1.1,1.2,1.41);
      { const roof = mesh(new THREE.CylinderGeometry(1.4,1.4,3.4,16,1,false,0,Math.PI), 0x2E6BA9); roof.rotation.z = Math.PI/2; roof.position.y = 2; g.add(roof);
        const cam = mesh(new THREE.BoxGeometry(0.7,0.5,0.9), 0x12153A); cam.position.set(2.1,0.9,1.6); g.add(cam); const l = mesh(new THREE.CylinderGeometry(0.22,0.22,0.3,12), 0x8FB4E3); l.rotation.x = Math.PI/2; l.position.set(2.1,0.9,2.15); g.add(l);
        const tri = mesh(new THREE.CylinderGeometry(0.03,0.03,0.7), 0x12153A, 0); tri.position.set(2.1,0.35,1.6); g.add(tri);
        const clap = mesh(new THREE.BoxGeometry(0.5,0.35,0.05), 0x12153A); clap.position.set(-1.6,0.6,1.5); clap.rotation.y = 0.4; g.add(clap); } r = 2.5; break;
    case 'dome': { const d = mesh(new THREE.SphereGeometry(1.9,24,12,0,Math.PI*2,0,Math.PI/2), 0xF4F7FC); g.add(d); door(1.85);
      const ring = mesh(new THREE.TorusGeometry(1.92,0.13,8,32), 0x2E6BA9, 0); ring.rotation.x = Math.PI/2; ring.position.y = 0.7; g.add(ring);
      const top = mesh(new THREE.CylinderGeometry(0.3,0.3,0.4,12), 0x2E6BA9); top.position.y = 2.0; g.add(top); } r = 2.3; break;
    case 'lab': body(2.8,1.6,2.8,0xE4EBF6); door(1.41); win(0.9,1.0,1.41);
      { const d = mesh(new THREE.SphereGeometry(1.15,16,10,0,Math.PI*2,0,Math.PI/2), 0x8FB4E3); d.position.y = 1.6; g.add(d);
        const ds = mesh(new THREE.SphereGeometry(0.8,16,8,0,Math.PI*2,0,Math.PI/2), 0xF2C94C); ds.rotation.x = -0.9; ds.position.set(1.3,2.6,-0.6); g.add(ds);
        for (let i=0;i<3;i++){ const k = mesh(new THREE.BoxGeometry(0.7,1.0,0.5), [0x2E6BA9,0xF2C94C,0x3E8E7E][i]); k.position.set(-1.6+i*1.6,0.5,2.6); g.add(k); const sc = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.35,0.02), basic(0xBFE0FF)); sc.position.set(-1.6+i*1.6,0.7,2.86); g.add(sc); } } r = 2.4; break;
    case 'academy': body(4.2,2.2,2.6,0xF4F7FC); door(1.31); [-1.4,-0.7,0.7,1.4].forEach(x => win(x,1.3,1.31,0.4)); pyr(2.9,1.2,2.2,0xE76F51);
      { const bell = mesh(new THREE.BoxGeometry(0.8,1.0,0.8), 0xF4F7FC); bell.position.set(0,3.6,0); g.add(bell); const bp = mesh(new THREE.ConeGeometry(0.65,0.6,4), 0xE76F51); bp.rotation.y = Math.PI/4; bp.position.set(0,4.4,0); g.add(bp);
        const board = mesh(new THREE.BoxGeometry(1.4,0.9,0.08), 0x2F4F3A); board.position.set(-2.8,0.9,1.3); board.rotation.y = 0.5; g.add(board); } r = 2.9; break;
    case 'terminal': body(4.4,1.6,2.4,0xF4F7FC); door(1.21); [-1.5,-0.5,0.5,1.5].forEach(x => win(x,1.0,1.21,0.5));
      { const tw = mesh(new THREE.CylinderGeometry(0.35,0.5,3.4,8), 0xE4EBF6); tw.position.set(-1.6,3.3,-0.4); g.add(tw);
        const cab = mesh(new THREE.CylinderGeometry(0.85,0.6,0.8,8), 0x2E6BA9); cab.position.set(-1.6,5.2,-0.4); g.add(cab);
        const rw = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.04,9), basic(0x3A4262)); rw.position.set(3.6,0.03,0); g.add(rw);
        for (let i=-3;i<=3;i++){ const s = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.05,0.7), basic(0xF4F7FC)); s.position.set(3.6,0.05,i*1.2); g.add(s); }
        { const pl = makePlane(); pl.position.set(3.6,0.55,-2.5); g.add(pl); } } r = 2.7; break;
    case 'gallery': body(5,2,2,0xF4F7FC);
      [-1.7,0,1.7].forEach((x,i) => { const fr = mesh(new THREE.BoxGeometry(1.4,1.2,0.12), 0x12153A); fr.position.set(x,1.1,1.02); g.add(fr);
        const art = new THREE.Mesh(new THREE.BoxGeometry(1.2,1.0,0.14), basic([0xF2C94C,0x2E6BA9,0xE76F51][i])); art.position.set(x,1.1,1.03); g.add(art);
        const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3,i+3), basic(0xF4F7FC)); blob.position.set(x+0.15,1.15,1.11); g.add(blob); });
      { const roof = mesh(new THREE.BoxGeometry(5.4,0.2,2.4), 0x2E6BA9); roof.position.y = 2.1; g.add(roof); } r = 3.0; break;
    case 'garden': for (let i=0;i<10;i++){ const a = i/10*Math.PI*2; if (i===0) continue; const h = mesh(new THREE.BoxGeometry(1.4,0.7,0.5), 0x4E8C58); h.position.set(Math.sin(a)*3.8,0.35,Math.cos(a)*3.8); h.rotation.y = a; g.add(h); }
      { const arch = mesh(new THREE.TorusGeometry(1.0,0.12,8,20,Math.PI), 0xF4F7FC); arch.position.set(0,1.1,3.8); g.add(arch); const tr = tree(2); g.add(tr); } r = 1.2; break;
    case 'monument': { const base = mesh(new THREE.CylinderGeometry(1.8,2.1,0.6,8), 0xDCE2EE); base.position.y = 0.3; g.add(base);
      for (let i=0;i<7;i++){ const b = mesh(new THREE.BoxGeometry(1.4-i*0.12,0.9,1.4-i*0.12), [0xF4F7FC,0x2E6BA9,0xF2C94C,0xF4F7FC,0x2E6BA9,0xE76F51,0xF4F7FC][i]); b.position.y = 1.05 + i*0.9; b.rotation.y = i*0.25; g.add(b); }
      const st = mesh(new THREE.OctahedronGeometry(0.5,0), 0xF2C94C); st.position.y = 7.5; g.add(st); } r = 2.2; break;
    case 'fountain': { const basin = mesh(new THREE.CylinderGeometry(2.4,2.6,0.6,20), 0xDCE2EE); basin.position.y = 0.3; g.add(basin);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.1,20), toon(0x5FA0E6)); water.position.y = 0.58; g.add(water);
      const col = mesh(new THREE.CylinderGeometry(0.25,0.35,1.6,10), 0xF4F7FC); col.position.y = 1.2; g.add(col);
      const bowl = mesh(new THREE.CylinderGeometry(0.9,0.4,0.35,14), 0xF4F7FC); bowl.position.y = 2.1; g.add(bowl);
      const spray = makeFountainSpray(); spray.position.y = 2.3; g.add(spray); } r = 2.8; break;
    case 'office': body(3.4,3.4,2.6,0xE4EBF6); door(1.31); [[-1.1,1.3],[1.1,1.3],[-1.1,2.5],[0,2.5],[1.1,2.5]].forEach(([x,y]) => win(x,y,1.31)); tank(-0.9,3.4,-0.5); dish(0.9,3.4,-0.5); awning(1.2,1.2,1.3,0xE76F51); break;
    case 'cafe': body(3,1.8,2.4,0xF7E9D4); door(1.21); win(-0.95,1.1,1.21); win(0.95,1.1,1.21); awning(3.2,1.7,1.25,0xE76F51);
      { const roof = mesh(new THREE.BoxGeometry(3.3,0.2,2.7), 0xB5835A); roof.position.y = 1.9; g.add(roof);
        [[-1.6,2.6],[1.6,2.6]].forEach(([x,z]) => { const tb = mesh(new THREE.CylinderGeometry(0.4,0.4,0.06,12), 0xF4F7FC); tb.position.set(x,0.75,z); g.add(tb); const l = mesh(new THREE.CylinderGeometry(0.05,0.05,0.75), 0x12153A, 0); l.position.set(x,0.38,z); g.add(l);
          const um = mesh(new THREE.ConeGeometry(0.9,0.4,8), [0xF2C94C,0x2E6BA9][x>0?1:0]); um.position.set(x,2.0,z); g.add(um); const up = mesh(new THREE.CylinderGeometry(0.03,0.03,1.3), 0x12153A, 0); up.position.set(x,1.4,z); g.add(up);
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,0.12,8), basic(0xF4F7FC)); cup.position.set(x+0.1,0.84,z); g.add(cup); }); } r = 2.3; break;
    case 'observatory': body(3,1.6,3,0xE4EBF6); door(1.51);
      { const d = mesh(new THREE.SphereGeometry(1.5,20,12,0,Math.PI*2,0,Math.PI/2), 0xF4F7FC); d.position.y = 1.6; g.add(d);
        const slit = mesh(new THREE.BoxGeometry(0.45,1.5,1.6), 0x12153A, 0); slit.position.set(0,2.3,0.3); slit.rotation.x = -0.6; g.add(slit);
        const tel = mesh(new THREE.CylinderGeometry(0.18,0.26,1.8,10), 0x2E6BA9); tel.position.set(0,3.0,0.6); tel.rotation.x = -0.7; g.add(tel); } r = 2.3; break;
    case 'resto': body(3.2,2,2.6,0xF7E9D4); door(1.31); win(-1.0,1.2,1.31); win(1.0,1.2,1.31); awning(3.4,1.85,1.35,0xE76F51);
      { const roof = mesh(new THREE.BoxGeometry(3.5,0.25,2.9), 0xB5835A); roof.position.y = 2.1; g.add(roof);
        const chim = mesh(new THREE.CylinderGeometry(0.18,0.18,0.8,8), 0x12153A); chim.position.set(1.1,2.6,-0.6); g.add(chim);
        [-1.7,1.7].forEach(x => { const tb = mesh(new THREE.CylinderGeometry(0.35,0.35,0.06,12), 0xF4F7FC); tb.position.set(x,0.7,2.3); g.add(tb); const l = mesh(new THREE.CylinderGeometry(0.05,0.05,0.7), 0x12153A, 0); l.position.set(x,0.35,2.3); g.add(l); }); } r = 2.3; break;
    case 'clinic': body(3.4,2.6,2.6,0xF4F7FC); door(1.31); [-1.1,1.1].forEach(x => win(x,1.4,1.31)); win(0,2.15,1.31,0.36);
      { const top = mesh(new THREE.BoxGeometry(3.6,0.2,2.8), 0x3E8E7E); top.position.y = 2.7; g.add(top);
        const cv = mesh(new THREE.BoxGeometry(0.9,0.3,0.12), 0x3E8E7E, 0); cv.position.set(0,3.25,0); g.add(cv); const ch = mesh(new THREE.BoxGeometry(0.3,0.9,0.12), 0x3E8E7E, 0); ch.position.set(0,3.25,0); g.add(ch); } r = 2.3; break;
    case 'kiosk': body(2.8,1.8,2.4,0xE4EBF6); door(1.21); win(0.9,1.1,1.21);
      { const gl = mesh(new THREE.SphereGeometry(0.9,16,12), 0x5FA0E6); gl.position.y = 2.9; g.add(gl); const rg = mesh(new THREE.TorusGeometry(1.1,0.06,6,24), 0xF2C94C, 0); rg.position.y = 2.9; rg.rotation.x = 1.2; g.add(rg);
        const st = mesh(new THREE.CylinderGeometry(0.1,0.1,0.5), 0x12153A, 0); st.position.y = 2.05; g.add(st); } r = 2.1; break;
    case 'glass': body(2.4,5.2,2.4,0x8FB4E3); door(1.21); for (let y=1.5;y<5;y+=0.9){ win(-0.55,y,1.21,0.42); win(0.55,y,1.21,0.42); }
      { const cap = mesh(new THREE.BoxGeometry(2.6,0.25,2.6), 0x12153A); cap.position.y = 5.3; g.add(cap); } r = 1.9; break;
    case 'shop': body(3.2,2.2,2.4,0xF4F7FC); door(1.21); { const sw = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.9,0.08), basic(0xBFE0FF)); sw.position.set(0,1.0,1.22); g.add(sw); }
      awning(3.4,1.7,1.25,0xF2C94C); { const roof = mesh(new THREE.BoxGeometry(3.4,0.3,2.6), 0x12153A); roof.position.y = 2.35; g.add(roof); } r = 2.2; break;
    case 'lighthouse': { for (let i=0;i<5;i++){ const s = mesh(new THREE.CylinderGeometry(1.0-i*0.12,1.1-i*0.12,1.2,14), i%2 ? 0xE76F51 : 0xF4F7FC); s.position.y = 0.6+i*1.2; g.add(s); }
      const cab = mesh(new THREE.CylinderGeometry(0.6,0.6,0.8,10), 0x12153A, 0); cab.position.y = 6.4; g.add(cab);
      const lt = new THREE.Mesh(new THREE.SphereGeometry(0.4,12,8), basic(0xFFE7A0)); lt.position.y = 6.4; g.add(lt);
      const rf = mesh(new THREE.ConeGeometry(0.85,0.8,10), 0x2E6BA9); rf.position.y = 7.2; g.add(rf);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6,12,16,1,true), new THREE.MeshBasicMaterial({ color: 0xFFE7A0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      beam.geometry.translate(0,-6,0); beam.rotation.z = Math.PI/2; const piv = new THREE.Group(); piv.position.y = 6.4; piv.add(beam); piv.userData.dyn = true; piv.userData.spin = true; g.add(piv);
      door(1.05); } r = 1.7; break;
  }
  return { g, r };
}
function makePlane(){
  const p = new THREE.Group(); p.userData.dyn = true;
  const f = mesh(new THREE.CylinderGeometry(0.32,0.22,2.6,12), 0xF4F7FC); f.rotation.x = Math.PI/2; p.add(f);
  const nose = mesh(new THREE.SphereGeometry(0.32,12,8), 0xF4F7FC); nose.position.z = 1.3; p.add(nose);
  const w = mesh(new THREE.BoxGeometry(3,0.07,0.6), 0x2E6BA9); w.position.z = 0.1; p.add(w);
  const tail = mesh(new THREE.BoxGeometry(0.07,0.6,0.45), 0x2E6BA9); tail.position.set(0,0.35,-1.15); p.add(tail);
  const ts = mesh(new THREE.BoxGeometry(1.1,0.06,0.35), 0x2E6BA9); ts.position.set(0,0.1,-1.15); p.add(ts);
  for (let i=0;i<4;i++){ const wn = new THREE.Mesh(new THREE.CircleGeometry(0.07,8), basic(0x12153A)); wn.position.set(0.33,0.08,0.6-i*0.35); wn.rotation.y = Math.PI/2; p.add(wn); }
  return p;
}
const sprays = [];
function makeFountainSpray(){
  const n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n*3); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xCFE6FF, size: 0.12, transparent: true, opacity: 0.85 }));
  pts.userData = { dyn: true, ph: Array.from({ length: n }, () => Math.random()), ang: Array.from({ length: n }, () => Math.random()*Math.PI*2) }; pts.frustumCulled = false; sprays.push(pts); return pts;
}

/* ---------- world population ---------- */
const obstacles = [];          // { d: unit dir, r: radius }
const talkables = [];          // { d, r, kind, ref }
const pois = [];
const markers = [];
const cullList = [];        // dynamic things hidden when far away (no occlusion culling on a sphere)
const signs = [];
const lampsList = [];
const stars = [];
const npcs = [];               // standing NPCs (animated)
const spinners = [];
let hqModel = null, vanModel = null;

/* place a prop next to a building using the building's layout, then drop it onto the curved ground */
function propAt(g, obj, x, z, yaw = 0){
  const wp = g.localToWorld(V(x, 0, z)); placeAt(obj, wp.clone().normalize());
  const f = g.localToWorld(V(Math.sin(yaw), 0, Math.cos(yaw))).sub(g.position); faceToward(obj, obj.position.clone().add(f)); return obj;
}
function addObstacle(d, r){ obstacles.push({ d: d.clone().normalize(), r }); }
function clearOf(d, minPoi = 9, minRoad = 2, minObs = 1.2){ const [pd] = poiDist(d); if (pd < minPoi) return false; if (roadDist(d) < minRoad) return false;
  for (const o of obstacles) if (d.dot(o.d) > Math.cos((minObs + o.r)/R)) return false; return true; }

function buildPois(){
  POIS.forEach((p, i) => {
    const dir = poiDirs[i], built = building(p.kind), g = built.g; let r = built.r;
    const sc = 1.25; g.scale.setScalar(sc);
    placeAt(g, dir, 0);
    // face the first road neighbour
    const e = EDGES[ADJ[i][0]], nb = e[0] === i ? e[1] : e[0];
    faceToward(g, poiDirs[nb].clone().multiplyScalar(R));
    if (p.kind === 'hq' && hqModel){ while (g.children.length) g.remove(g.children[0]); const m = hqModel.clone(); g.add(m);
      const sz = new THREE.Box3().setFromObject(hqModel).getSize(V()); r = Math.max(sz.x, sz.z)/2 + 0.2; }
    // extras in front of the door
    g.updateMatrixWorld(true);
    const npc = propAt(g, person(i + 3, { logo: logoTex(p.client || PLANET_C) }), -1.4, r + 1.1, 0); if (npc){ planet.add(npc); npcs.push(npc); }
    // a real signboard standing in front of the building (no more floating labels); clients get their logo on it
    { const sb = propAt(g, signBoard(p), r * 0.95 + 0.6, r + 1.2, -0.45); bake(sb); planet.children.slice(-2).forEach(o => cullList.push(o)); addObstacle(sb.position.clone().normalize(), 0.5); }
    if (p.svc){ const mb = propAt(g, mailbox(), 1.4, r + 0.6); bake(mb); addObstacle(mb.position.clone().normalize(), 0.3); }
    [[-r-0.8,0.8],[r+0.8,-0.6]].forEach(([x,z],k) => bake(propAt(g, bush(i+k), x, z, k)));
    if (!p.client && i % 3 === 0){ const bn = propAt(g, bench(), r+1.8, 1.6, -Math.PI/2); bake(bn); addObstacle(bn.position.clone().normalize(), 0.6); }
    // sign + marker
    const sign = null;
    const tall = { glass: 7.2, clinic: 5.2, kiosk: 5.2, hq: 7.4, tower: 7.6, monument: 9.6, lighthouse: 9.2, terminal: 7.2, academy: 6.2, billboard: 6.2 }[p.kind] || 5.4;
    let marker = null;
    if (p.svc){ marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex(save.d.includes(p.id)) })); marker.scale.set(1.15,1.15,1); marker.position.y = tall + 1.3; marker.userData.base = tall + 1.3; g.add(marker); markers.push(marker); fitSprite(marker, 22, 46); }
    planet.add(g);
    if (p.kind === 'lighthouse') g.traverse(o => { if (o.userData.spin) spinners.push(o); });
    const rec = { ...p, i, dir, pos: dir.clone().multiplyScalar(R), r: r*sc, group: g, npc, marker, sign, done: save.d.includes(p.id) };
    pois.push(rec);
    if (p.kind !== 'garden') addObstacle(dir, r*sc);
    talkables.push({ d: dir, r: r*sc + 2.6, kind: 'poi', ref: rec });
    // process stones around the garden
    if (p.kind === 'garden'){
      for (let k=0;k<6;k++){ const a = k/6*Math.PI*2 + 0.3; const st = new THREE.Group();
        const m = mesh(new THREE.BoxGeometry(0.9,1.3,0.35), 0xB7C4DA); m.position.y = 0.65; m.rotation.x = -0.1; st.add(m);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.75,0.38), new THREE.MeshBasicMaterial({ map: stoneTex(k) })); face.position.set(0,0.95,0.19); face.rotation.x = -0.1; face.userData.dyn = true; st.add(face);
        g.updateMatrixWorld(true); propAt(g, st, Math.sin(a)*2.6, Math.cos(a)*2.6, a); bake(st); const wp = st.position.clone().normalize();
        addObstacle(wp, 0.5); talkables.push({ d: wp, r: 1.9, kind: 'stone', ref: k }); }
    }
    bake(g, planet);
    if (marker){ marker.userData.basePos = marker.position.clone(); marker.userData.up = dir.clone(); }
    if (npc) cullList.push(npc); if (marker) cullList.push(marker);
  });
}

/* a client's logo on a little totem in front of its building */
const logoTexCache = {};
const PLANET_C = { logo: 'planet', src: 'img/mark.png', name: L('Planet', 'Planet') };
function logoTex(c){
  if (logoTexCache[c.logo]) return logoTexCache[c.logo];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv);
  const paint = img => { x.fillStyle = '#ffffff'; x.fillRect(0,0,256,256); x.strokeStyle = '#12153A'; x.lineWidth = 14; x.strokeRect(7,7,242,242);
    if (img){ const s = Math.min(190/img.width, 190/img.height); x.drawImage(img, 128 - img.width*s/2, 128 - img.height*s/2, img.width*s, img.height*s); }
    else { x.fillStyle = '#12153A'; x.font = '900 120px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(c.name.en.slice(0,1), 128, 132); }
    tx.needsUpdate = true; };
  paint(null);
  if (c.logo){ const im = new Image(); im.onload = () => paint(im); im.src = c.src || `img/logos/${c.logo}.png`; }
  return logoTexCache[c.logo] = tx;
}
function signBoard(p){
  const g = new THREE.Group();
  [-1.25, 1.25].forEach(x => { const post = mesh(new THREE.CylinderGeometry(0.07,0.09,1.9,6), 0x12153A, 0); post.position.set(x,0.95,0); g.add(post); });
  const box = mesh(new THREE.BoxGeometry(3.2,1.3,0.14), 0x12153A); box.position.y = 2.35; g.add(box);
  const tx = signTex(p), m = new THREE.MeshBasicMaterial({ map: tx });
  [0.08, -0.08].forEach((z, k) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(3.1,1.21), m); f.position.set(0,2.35,z); if (k) f.rotation.y = Math.PI; f.userData.dyn = true; g.add(f); });
  if (p.client && p.client.logo){ const im = new Image(); im.onload = () => { const x = tx.image.getContext('2d'); x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect ? x.roundRect(22,22,156,156,18) : x.rect(22,22,156,156); x.fill();
      const s2 = Math.min(136/im.width, 136/im.height); x.drawImage(im, 100 - im.width*s2/2, 100 - im.height*s2/2, im.width*s2, im.height*s2); tx.needsUpdate = true; }; im.src = `img/logos/${p.client.logo}.png`; }
  return g;
}
function logoStand(c){
  const g = new THREE.Group(); const post = mesh(new THREE.CylinderGeometry(0.07,0.09,1.6,6), 0x12153A, 0); post.position.y = 0.8; g.add(post);
  const box = mesh(new THREE.BoxGeometry(1.5,1.5,0.16), 0xF4F7FC); box.position.y = 2.1; g.add(box);
  const m = new THREE.MeshBasicMaterial({ map: logoTex(c) });
  [0.09, -0.09].forEach((z, k) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.36,1.36), m); f.position.set(0,2.1,z); if (k) f.rotation.y = Math.PI; f.userData.dyn = true; g.add(f); });
  return g;
}
/* a gateway at the edge of each client district, so you know whose neighbourhood you're walking into */
function districtTex(D){
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 220; const x = cv.getContext('2d');
  const col = '#' + D.color.toString(16).padStart(6, '0');
  x.fillStyle = '#12153A'; x.fillRect(0,0,1024,220); x.fillStyle = col; x.fillRect(0,0,1024,26); x.fillRect(0,194,1024,26);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#F4F7FC'; x.font = '800 78px IBM Plex Sans Arabic, sans-serif'; x.direction = 'rtl';
  x.fillText(D.icon + ' ' + D.name.ar, 512, 98, 980); x.direction = 'ltr'; x.fillStyle = '#F2C94C'; x.font = '800 34px Montserrat, sans-serif'; x.fillText(D.name.en.toUpperCase(), 512, 162, 980);
  const t2 = new THREE.CanvasTexture(cv); t2.anisotropy = 4; return t2;
}
function buildDistrictGates(){
  for (const [dk, D] of Object.entries(DISTRICTS)){
    const ids = pois.filter(p => p.district === dk); if (!ids.length) continue;
    const c = ids.reduce((a, p) => a.add(p.dir), V()).normalize();
    // the gate stands on the road that leads into the district, just outside its first building
    const first = ids.reduce((a, p) => a.dir.angleTo(c) > p.dir.angleTo(c) ? a : p);
    let spot = null;
    for (const ei of ADJ[first.i]){ const [a, b] = EDGES[ei], other = a === first.i ? b : a; if (pois[other].district === dk) continue;
      const d = first.dir.clone().lerp(poiDirs[other], 9/(first.dir.angleTo(poiDirs[other])*R)).normalize(); spot = { d, ei }; break; }
    if (!spot) continue;
    const g = new THREE.Group(), w = 7.2;
    [-w/2, w/2].forEach(x => { const p = mesh(new THREE.CylinderGeometry(0.2,0.24,4.4,8), 0x12153A); p.position.set(x,2.2,0); g.add(p);
      const cap = mesh(new THREE.SphereGeometry(0.34,10,8), D.color); cap.position.set(x,4.55,0); g.add(cap); });
    const beam = mesh(new THREE.BoxGeometry(w+0.6,1.6,0.3), 0xF4F7FC); beam.position.y = 3.7; g.add(beam);
    const m = new THREE.MeshBasicMaterial({ map: districtTex(D) });
    [0.16, -0.16].forEach((z, k) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(w+0.3,1.4), m); f.position.set(0,3.7,z); if (k) f.rotation.y = Math.PI; f.userData.dyn = true; g.add(f); });
    placeAt(g, spot.d); faceToward(g, first.pos.clone()); bake(g);
    planet.children.slice(-2).forEach(o => cullList.push(o));
    const side = edgeN[spot.ei]; [1, -1].forEach(sg => addObstacle(spot.d.clone().addScaledVector(side, sg*(w/2)/R).normalize(), 0.35));
  }
}

/* ---------- the Planet car and the rocket pad, parked by HQ ---------- */
const markTex = new THREE.TextureLoader().load('img/mark.png');
/* cars: a modern hatchback, or a hover car "from the future". The outer group keeps its identity (it is
   what gets parked, ridden and collided with); the model inside can be swapped with setCarStyle(). */
function makeCar(col = 0x2E6BA9, stripeC = 0xF2C94C, future = false){
  const g = new THREE.Group(); g.userData.dyn = true; g.userData.car = { col, stripeC, future: false };
  setCarStyle(g, future); return g;
}
function setCarStyle(g, future){
  const c = g.userData.car; if (g.userData.model && c.future === future) return;
  if (g.userData.model) g.remove(g.userData.model);
  c.future = future; const m = future ? futureCarModel(c.col, c.stripeC) : modernCarModel(c.col, c.stripeC); g.add(m); g.userData.model = m;
}
function modernCarModel(col, stripeC){
  const g = new THREE.Group();
  // low body with a sloped nose and tail
  const body = mesh(new THREE.BoxGeometry(1.62, 0.42, 2.9), col); body.position.y = 0.52; g.add(body);
  const nose = mesh(new THREE.BoxGeometry(1.6, 0.2, 0.9), col, 0); nose.position.set(0, 0.78, 1.0); nose.rotation.x = 0.16; g.add(nose);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 2.5), basic(0x1A1D2E)); sill.position.y = 0.33; g.add(sill);
  // tapered glass cabin (a four-sided frustum turned square to the car)
  const cabG = new THREE.CylinderGeometry(0.62, 0.86, 0.48, 4, 1); cabG.rotateY(Math.PI/4); cabG.scale(1.12, 1, 1.7);
  const cab = mesh(cabG, 0x1C2440); cab.position.set(0, 0.96, -0.2); g.add(cab);
  const shine = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: 0xBFE3FF, transparent: true, opacity: 0.55 })); shine.position.set(0, 1.21, -0.1); g.add(shine);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.05), basic(col)); roof.position.set(0, 1.215, -0.25); g.add(roof);
  // racing stripe, spoiler, mirrors
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 2.92), basic(stripeC)); stripe.position.set(0, 0.74, 0); g.add(stripe);
  const sp = mesh(new THREE.BoxGeometry(1.5, 0.06, 0.28), 0x1A1D2E, 0); sp.position.set(0, 0.98, -1.35); g.add(sp);
  [-0.5, 0.5].forEach(x => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), basic(0x1A1D2E)); st.position.set(x, 0.86, -1.33); g.add(st); });
  [-0.86, 0.86].forEach(x => { const mr = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), col, 0); mr.position.set(x, 0.92, 0.38); g.add(mr); });
  // LED light bars
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.04), basic(0xEAF6FF)); head.position.set(0, 0.62, 1.46); g.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.04), basic(0xFF3B4E)); tail.position.set(0, 0.66, -1.46); g.add(tail);
  // the Planet mark on the doors
  [-0.82, 0.82].forEach(x => { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.36), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); d.position.set(x, 0.53, 0.05); d.rotation.y = x > 0 ? Math.PI/2 : -Math.PI/2; g.add(d); });
  // wheels: tyre + alloy rim
  [[-0.78, 0.95], [0.78, 0.95], [-0.78, -0.95], [0.78, -0.95]].forEach(([x, z]) => { const w = new THREE.Group(); w.position.set(x, 0.34, z); w.userData.wheel = true;
    const ty = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16), 0x16171F, 0); ty.rotation.z = Math.PI/2; w.add(ty);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 6), basic(0xC9D2E3)); rim.rotation.z = Math.PI/2; w.add(rim); g.add(w); });
  return g;
}
function futureCarModel(col, stripeC){
  const g = new THREE.Group(), hov = new THREE.Group(); g.add(hov); g.userData.hover = hov;
  // a sleek pod body hovering on light
  const bodyG = new THREE.SphereGeometry(1, 20, 12); bodyG.scale(0.85, 0.32, 1.55);
  const body = mesh(bodyG, col); body.position.y = 0.72; hov.add(body);
  const canopyG = new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI*2, 0, Math.PI/2); canopyG.scale(1, 0.75, 1.5);
  const canopy = new THREE.Mesh(canopyG, new THREE.MeshBasicMaterial({ color: 0x7FE8FF, transparent: true, opacity: 0.55 })); canopy.position.set(0, 0.86, -0.1); hov.add(canopy);
  [-1, 1].forEach(sx => { const fin = mesh(new THREE.BoxGeometry(0.06, 0.42, 0.6), stripeC, 0); fin.position.set(sx*0.62, 0.98, -1.2); fin.rotation.z = sx*0.35; hov.add(fin);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 2.2), basic(0x5FF2FF)); neon.position.set(sx*0.84, 0.7, 0); hov.add(neon); });
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), basic(0xEAF6FF)); nose.position.set(0, 0.68, 1.53); hov.add(nose);
  const thr = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), basic(0xFF6BD6)); thr.position.set(0, 0.72, -1.56); thr.rotation.y = Math.PI; hov.add(thr);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); logo.position.set(0, 0.97, 0.9); logo.rotation.x = -1.2; hov.add(logo);
  // glowing hover pads underneath
  [[-0.5, 0.8], [0.5, 0.8], [-0.5, -0.8], [0.5, -0.8]].forEach(([x, z]) => { const pad = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), new THREE.MeshBasicMaterial({ color: 0x5FF2FF, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    pad.rotation.x = Math.PI/2; pad.position.set(x, 0.42, z); hov.add(pad); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5FF2FF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); glow.scale.set(2.6, 1.0, 1); glow.position.y = 0.15; g.add(glow);
  return g;
}
function animateCars(now){
  for (const rec of cars){ const h = rec.car.userData.model && rec.car.userData.model.userData.hover; if (h) h.position.y = 0.12 + Math.sin(now * 0.003 + rec.car.id) * 0.06; }
}
function makeRocket(){
  const g = new THREE.Group(); g.userData.dyn = true;
  const body = mesh(new THREE.CylinderGeometry(0.75,0.85,4.2,18), 0xF4F7FC); body.position.y = 2.9; g.add(body);
  const band = mesh(new THREE.CylinderGeometry(0.77,0.77,0.5,18), 0x2E6BA9, 0); band.position.y = 3.6; g.add(band);
  const nose = mesh(new THREE.ConeGeometry(0.75,1.6,18), 0xE76F51); nose.position.y = 5.8; g.add(nose);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.3,16), basic(0x8FB4E3)); win.position.set(0,4.4,0.8); g.add(win);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.58), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); logo.position.set(0,2.5,0.86); g.add(logo);
  for (let i=0;i<3;i++){ const f = mesh(new THREE.BoxGeometry(0.12,1.2,0.9), 0x2E6BA9); const a = i/3*Math.PI*2; f.position.set(Math.sin(a)*0.85,1.3,Math.cos(a)*0.85); f.rotation.y = a; g.add(f); }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFB347, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  flame.scale.set(2.4,3.4,1); flame.position.y = 0.2; g.add(flame); g.userData.flame = flame;
  const padM = mesh(new THREE.CylinderGeometry(2.2,2.4,0.3,20), 0x9EA4B8); padM.position.y = 0.15; padM.userData.pad = true; g.add(padM);
  return g;
}
let car = null, riding = false, rocket = null, rocketTk = null;
const cars = [];   // every parked Planet car: { car, tk }
function parkCar(c, d, fwd){
  c.parent && c.parent.remove(c); placeAt(c, d); faceToward(c, d.clone().addScaledVector(fwd, 0.1).normalize().multiplyScalar(R)); planet.add(c);
  let rec = cars.find(x => x.car === c);
  if (!rec){ rec = { car: c, tk: { d: d.clone(), r: 2.6, kind: 'car' } }; rec.tk.ref = rec; cars.push(rec); } else rec.tk.d.copy(d);
  if (!talkables.includes(rec.tk)) talkables.push(rec.tk);
}
/* a parking spot beside the road next to a place on the planet */
function carSpotNear(p, sideSign = 1){
  const e = EDGES[ADJ[p.i][0]], nb = e[0] === p.i ? e[1] : e[0];
  const tow = poiDirs[nb].clone().sub(p.dir); tow.addScaledVector(p.dir, -tow.dot(p.dir)).normalize();
  const side = V().crossVectors(p.dir, tow).normalize().multiplyScalar(sideSign);
  return [p.dir.clone().addScaledVector(tow.clone().multiplyScalar(0.35).add(side.clone().multiplyScalar(0.94)).normalize(), (p.r + 7.5)/R).normalize(), tow];
}
const CAR_COLORS = [[0x2E6BA9, 0xF2C94C], [0xE76F51, 0xF4F7FC], [0xF2C94C, 0x12153A], [0x3E8E7E, 0xF2C94C], [0x8E6BC2, 0xF4F7FC], [0xE9A0B8, 0x12153A], [0x12153A, 0xF2C94C]];
function placeVehicles(){
  const hq = pois[0], e = EDGES[ADJ[0][0]], nb = e[0] === 0 ? e[1] : e[0];
  const tow = poiDirs[nb].clone().sub(hq.dir); tow.addScaledVector(hq.dir, -tow.dot(hq.dir)).normalize();
  const side = V().crossVectors(hq.dir, tow).normalize();
  // the Planet car by HQ, the rocket pad on the far side
  const [cd, ct] = carSpotNear(hq); parkCar(makeCar(...CAR_COLORS[0]), cd, ct);
  const rd = hq.dir.clone().addScaledVector(side.clone().negate().add(tow.clone().multiplyScalar(-0.3)).normalize(), (hq.r + 9)/R).normalize();
  rocket = makeRocket(); placeAt(rocket, rd); planet.add(rocket); addObstacle(rd, 2.2);
  rocketTk = { d: rd, r: 4.6, kind: 'rocket' }; talkables.push(rocketTk); rocket.userData.base = rocket.position.clone(); rocket.userData.dir = rd.clone();
  // more cars around the planet: one in every client district, so there is always a ride nearby
  const seen = new Set(); let k = 1;
  for (const p of pois){ if (!p.district || seen.has(p.district)) continue; seen.add(p.district);
    const [d, f] = carSpotNear(p, k % 2 ? -1 : 1); parkCar(makeCar(...CAR_COLORS[k % CAR_COLORS.length], k % 3 === 0), d, f); k++; }
}
function mountCar(rec){ car = rec.car; setTimeout(paintFutureBtn, 0); talkables.splice(talkables.indexOf(rec.tk), 1); riding = true; $('ride').innerHTML = '🚗 ' + (lang === 'ar' ? 'انزل' : 'Get out'); car.parent.remove(car); car.position.set(0,0,0); car.quaternion.identity(); player.add(car); rig.visible = false; camDist = Math.max(camDist, 8); Sfx.open(); mini(lang === 'ar' ? '🚗 اضغط E عشان تنزل' : '🚗 Press E to get out'); $('ride').hidden = false; }
function dismount(){ riding = false; setTimeout(paintFutureBtn, 0); player.remove(car); parkCar(car, pDir.clone(), pFwd.clone()); rig.visible = true; Sfx.close(); $('ride').hidden = true;
  // step out to the side of the car
  const side = V().crossVectors(pDir, pFwd).normalize(); pDir.addScaledVector(side, 2.2/R).normalize(); }
$('ride').onclick = () => { if (riding && state === 'play') dismount(); };
/* while driving: switch between today's car and the one from the future */
function paintFutureBtn(){ let b = $('futurebtn');
  if (!b){ b = document.createElement('button'); b.id = 'futurebtn'; b.type = 'button'; b.className = 'panel tbtn'; const tl = document.querySelector('.tools'); if (tl) tl.prepend(b); else document.body.appendChild(b);
    b.onclick = () => { if (!riding || !car) return; setCarStyle(car, !car.userData.car.future); Sfx.open(); paintFutureBtn();
      burst(player.position.clone().addScaledVector(pDir, 1), car.userData.car.future ? 0x5FF2FF : 0xF2C94C, 30, 3, 0.7);
      mini(car.userData.car.future ? (lang === 'ar' ? '✨ عربية من المستقبل!' : '✨ A car from the future!') : (lang === 'ar' ? '🚗 رجعنا للعربية العادية' : '🚗 Back to a regular car')); }; }
  b.hidden = !riding; if (riding && car){ const fut = car.userData.car.future; b.textContent = fut ? '🚗' : '✨';
    const lbl = fut ? (lang === 'ar' ? 'عربية عادية' : 'Regular car') : (lang === 'ar' ? 'عربية المستقبل' : 'Future car'); b.title = lbl; b.setAttribute('aria-label', lbl); }
}

/* bumping into other cars: both get knocked apart, with a thump */
let knock = V(), knockT = 0, lastThump = 0;
function carObstacles(){
  const list = [];
  for (const rec of cars) if (rec.car !== car && rec.car.parent) list.push({ pos: rec.car.getWorldPosition(V()), rec });
  for (const v of vehicles) list.push({ pos: v.g.position.clone(), van: v });
  if (typeof peers !== 'undefined') for (const p of peers.values()) if (p.riding && p.g.visible && !p.ps) list.push({ pos: p.g.position.clone() });
  return list;
}
function carBump(dt){
  const me = player.position;
  for (const o of carObstacles()){
    const d = o.pos.distanceTo(me); if (d > 2.6 || d < 1e-4) continue;
    // push us out along the ground, away from the other car
    const away = me.clone().sub(o.pos); const up2 = pDir; away.addScaledVector(up2, -away.dot(up2)).normalize();
    pDir.addScaledVector(away, (2.6 - d) / R).normalize();
    knock.copy(away).multiplyScalar(9); knockT = 0.35;
    // a parked car gets shoved too
    if (o.rec){ const od = o.pos.clone().normalize(), f = new THREE.Vector3(0, 0, 1).applyQuaternion(o.rec.car.getWorldQuaternion(new THREE.Quaternion()));
      od.addScaledVector(away, -0.9 / R).normalize(); if (walkable(od)) parkCar(o.rec.car, od, f); }
    if (o.van){ o.van.ghost = 1.2; }
    if (performance.now() - lastThump > 450){ lastThump = performance.now(); Sfx.land(); burst(o.pos.clone().lerp(me, 0.5), 0xF4F7FC, 14, 2.2, 0.5); if (navigator.vibrate) navigator.vibrate(40); }
  }
  if (knockT > 0){ knockT -= dt; const n = pDir.clone().addScaledVector(knock, dt / R).normalize(); if (walkable(n)) pDir.copy(n); knock.multiplyScalar(Math.exp(-8 * dt)); }
}

/* floating labels and icons keep a sensible size on screen: never huge up close, never specks far away */
const fitSprites = [];
function fitSprite(s, minPx, maxPx){ s.userData.fit = { w: s.scale.x, h: s.scale.y, minPx, maxPx }; fitSprites.push(s); return s; }
const _fs = V(), _fw = V();
function fitSpritesFrame(){
  const px = renderer.domElement.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (let i = fitSprites.length - 1; i >= 0; i--){ const s = fitSprites[i]; if (!s.parent){ continue; }
    const f = s.userData.fit; s.getWorldPosition(_fw); const d = Math.max(0.5, _fw.distanceTo(camera.position));
    s.parent.getWorldScale(_fs); const onScreen = f.h * _fs.y * px / d;
    const k = onScreen > f.maxPx ? f.maxPx / onScreen : onScreen < f.minPx ? f.minPx / onScreen : 1;
    s.scale.set(f.w * k, f.h * k, 1); }
}

function buildRoadside(){
  // street lamps + benches along the roads
  EDGES.forEach(([ia,ib], ei) => {
    const a = poiDirs[ia], b = poiDirs[ib], n = edgeN[ei], L = a.angleTo(b)*R, steps = Math.max(3, Math.floor(L/12));
    for (let k=1;k<steps;k++){ const tt = k/steps, dir = a.clone().lerp(b, tt).normalize(); if (poiDist(dir)[0] < 7) continue;
      const side = k % 2 ? 1 : -1, p = dir.clone().addScaledVector(n, side*1.75/R).normalize();
      const l = lamp(); placeAt(l, p); faceToward(l, dir.clone().multiplyScalar(R)); l.rotateY(-Math.PI/2); bake(l); addObstacle(p, 0.25); lampsList.push(p);
    }
  });
}

const boardTex = {};
function buildBillboards(){
  const loader = new THREE.TextureLoader(); let k = 0;
  EDGES.forEach(([ia,ib], ei) => {
    const a = poiDirs[ia], b = poiDirs[ib], L = a.angleTo(b)*R; if (L < 22) return;
    const w = WORK[k++ % WORK.length], side = ei % 2 ? 1 : -1;
    const mid = a.clone().lerp(b, 0.5).normalize(), p = mid.clone().addScaledVector(edgeN[ei], side*3.4/R).normalize();
    if (!clearOf(p, 8, 2.2, 1.6)) return;
    const g = new THREE.Group();
    [-1.2, 1.2].forEach(x => { const post = mesh(new THREE.CylinderGeometry(0.09,0.11,2.2,6), 0x12153A, 0); post.position.set(x,1.1,0); g.add(post); });
    const frame = mesh(new THREE.BoxGeometry(3.5,2.4,0.18), 0xF4F7FC); frame.position.y = 3.3; g.add(frame);
    const plate = mesh(new THREE.BoxGeometry(2.2,0.42,0.2), 0x12153A, 0); plate.position.y = 1.86; g.add(plate);
    const url = 'img/' + w.imgs[0], tex = boardTex[url] || (boardTex[url] = loader.load(url));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.12), new THREE.MeshBasicMaterial({ map: tex })); face.position.set(0,3.3,0.1); face.userData.dyn = true; g.add(face);
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.1; back.userData.dyn = true; g.add(back);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.1,0.36), new THREE.MeshBasicMaterial({ map: boardLabel(w) })); lab.position.set(0,1.86,0.11); lab.userData.dyn = true; g.add(lab);
    placeAt(g, p); faceToward(g, mid.clone().multiplyScalar(R)); bake(g);
    planet.children.slice(-3).forEach(o => cullList.push(o));
    addObstacle(p, 1.4); talkables.push({ d: p, r: 3.4, kind: 'board', ref: w });
  });
}
function boardLabel(w){ const c = document.createElement('canvas'); c.width = 512; c.height = 88; const x = c.getContext('2d');
  x.fillStyle = '#12153A'; x.fillRect(0,0,512,88); x.fillStyle = '#F2C94C'; x.font = '800 44px IBM Plex Sans Arabic, Montserrat, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(w.name.en.toUpperCase(), 256, 46); return new THREE.CanvasTexture(c); }

function buildNature(){
  const okLand = (d, poi = 9, road = 2.4) => { const s = terrainInfo(d); return s.h > SEA + 0.25 && s.n < 0.45 && s.pd > poi && s.rd > road ? s : null; };
  // groves: trees gather in clusters and leave open meadows between them
  const AREA = (R/30)**2, groves = Math.round((isTouch ? 10 : 14) * AREA);
  for (let gI=0, tries=0; gI<groves && tries<800; tries++){
    const c = randDir(); if (!okLand(c, 12, 4)) continue; gI++;
    const n = 5 + (rnd()*7|0), hill = terrainInfo(c).h > 2.2;
    for (let k=0;k<n;k++){ const d = c.clone().add(randDir().multiplyScalar(rnd()*5.5/R)).normalize(); if (!okLand(d) || !clearOf(d, 9, 2.4, 0.7)) continue;
      const kind = hill ? 0 : (rnd() < 0.06 ? 2 : (rnd() < 0.35 ? 0 : 1));
      const tr = tree(kind); placeAt(tr, d, rnd()*6, -0.05); tr.scale.setScalar(0.9 + rnd()*0.55); bake(tr); addObstacle(d, 0.45); }
  }
  for (let i=0, p=0; i<3000 && p<Math.round(26*AREA); i++){ const d = randDir(); if (!okLand(d, 10, 3) || !clearOf(d, 10, 3, 3)) continue;
    const tr = tree(rnd() < 0.5 ? 1 : 0); placeAt(tr, d, rnd()*6, -0.05); tr.scale.setScalar(1 + rnd()*0.4); bake(tr); addObstacle(d, 0.45); p++; }
  // palms on the beaches
  for (let i=0, p=0; i<4000 && p<Math.round(16*AREA); i++){ const d = randDir(), s = terrainInfo(d); if (s.n < 0.48 || s.n > 0.58 || s.h < SEA + 0.25 || s.pd < 9 || s.rd < 2.4) continue; if (!clearOf(d,9,2.4,2)) continue;
    const pl = palm(); placeAt(pl, d, rnd()*6); bake(pl); addObstacle(d, 0.35); p++; }
  // a few rocks and bushes
  for (let i=0, p=0; i<4000 && p<Math.round(45*AREA); i++){ const d = randDir(), s = okLand(d, 8, 2); if (!s || !clearOf(d,8,2,1.5)) continue;
    if (rnd() < 0.4){ const r = mesh(new THREE.DodecahedronGeometry(0.3+rnd()*0.4,0), s.h > 2 ? 0x9EA5B6 : 0xC3CAD6); placeAt(r, d, rnd()*6, 0.08); bake(r); addObstacle(d, 0.35); }
    else { const b = bush(p); placeAt(b, d, rnd()*6); bake(b); } p++; }
  // instanced grass + flowers, small and sparse
  const tuft = new THREE.ConeGeometry(0.035,0.15,4); tuft.translate(0,0.075,0);
  const fl = new THREE.IcosahedronGeometry(0.06,0); fl.translate(0,0.09,0);
  const NG = Math.round((isTouch ? 1800 : 3200) * AREA), NF = Math.round(600 * AREA);
  const im = new THREE.InstancedMesh(tuft, toon(0x86BE7E), NG), fm = new THREE.InstancedMesh(fl, new THREE.MeshToonMaterial({ gradientMap: grad }), NF);
  const o = new THREE.Object3D(), col = new THREE.Color(); let gi = 0, fi = 0; const FC = [0xF7D96A,0xFFFFFF,0xF2A0A8,0xBBD3F2];
  for (let i=0; i<90000 && (gi<NG || fi<NF); i++){
    const d = randDir(), s = terrainInfo(d); if (s.h < SEA + 0.25 || s.n > 0.45 || s.h > 2.6 || s.rd < 1.6 || s.pd < 5.5) continue;
    placeAt(o, d, rnd()*6); o.scale.setScalar(0.7 + rnd()*0.7); o.updateMatrix();
    if (rnd() < 0.82 && gi < NG) im.setMatrixAt(gi++, o.matrix); else if (fi < NF){ fm.setMatrixAt(fi, o.matrix); fm.setColorAt(fi++, col.setHex(FC[rnd()*FC.length|0])); }
  }
  im.count = gi; fm.count = fi; planet.add(im, fm);
}

/* stars to collect */
const starGeo = (() => { const s = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? 0.17 : 0.4; i ? s.lineTo(Math.cos(a)*r, Math.sin(a)*r) : s.moveTo(Math.cos(a)*r, Math.sin(a)*r); } return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }).translate(0,0,-0.06); })();
function buildStars(){
  for (let i=0, tries=0; stars.length < 40 && tries < 20000; tries++){
    const d = randDir(), s = terrainInfo(d); if (s.h < SEA + 0.2 || s.pd < 6) continue; if (!clearOf(d, 6, 0, 1.2)) continue;
    if (stars.some(x => x.d.angleTo(d)*R < 9)) continue;
    const g = new THREE.Group(); g.userData.dyn = true; const m = mesh(starGeo, 0xF2C94C, 2); m.position.y = 1.1; g.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF2C94C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 })); halo.scale.set(1.2,1.2,1); halo.position.y = 1.1; g.add(halo);
    placeAt(g, d); planet.add(g);
    const idx = stars.length, got = save.s.includes(idx); g.visible = !got;
    stars.push({ d, g, m, got, idx }); i++; if (!got) cullList.push(g);
  }
}

/* clouds, birds, planes, satellite */
const clouds = new THREE.Group(); scene.add(clouds);
const birds = [];
const extraPlanes = [];
let plane = null, planeOrbit = null, sat = null, moon = null, moonOrb = null;
function buildSkyLife(){
  for (let i=0;i<14;i++){ const c = new THREE.Group(), n = 3 + (rnd()*3|0);
    for (let k=0;k<n;k++){ const s = mesh(new THREE.IcosahedronGeometry(1.0 + rnd()*0.9, 1), 0xffffff, 0); s.position.set((k - n/2)*1.4, rnd()*0.5, rnd()*0.8); s.scale.y = 0.75; c.add(s); }
    const d = randDir(); c.position.copy(d).multiplyScalar(R + 13 + rnd()*5); orient(c, d, rnd()*6); bake(c, clouds); }
  for (let f=0; f<4; f++){ const flock = new THREE.Group(), axis = randDir(), r = R + 9 + f*1.6;
    for (let k=0;k<5;k++){ const b = new THREE.Group(); const wl = mesh(new THREE.BoxGeometry(0.5,0.04,0.16), 0x12153A, 0), wr = wl.clone();
      wl.position.x = -0.24; wr.position.x = 0.24; b.add(wl, wr); b.position.set((k%2?1:-1)*Math.ceil(k/2)*0.8, 0, -Math.ceil(k/2)*0.7); b.userData = { wl, wr, ph: rnd()*6 }; flock.add(b); }
    const piv = new THREE.Group(); piv.quaternion.setFromUnitVectors(Y, axis); flock.position.set(r,0,0); flock.rotation.y = 0; piv.add(flock); scene.add(piv);
    birds.push({ piv, flock, speed: 0.06 + f*0.012 }); }
  planeOrbit = new THREE.Group(); planeOrbit.rotation.set(0.9, 0, 0.4); scene.add(planeOrbit);
  plane = makePlane(); plane.position.set(0, 0, R + 15); plane.rotation.set(0, Math.PI/2, 0); planeOrbit.add(plane); plane.scale.setScalar(1.6);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,6,6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); trail.rotation.x = Math.PI/2; trail.position.z = -4.2; plane.add(trail);
  { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const x = cv.getContext('2d');
    x.fillStyle = '#0E4C92'; x.fillRect(0,0,1024,512); for (let i=0;i<40;i++){ x.fillStyle = `rgba(255,255,255,${0.04 + rnd()*0.08})`; x.beginPath(); x.arc(rnd()*1024, rnd()*512, 8 + rnd()*30, 0, 7); x.fill(); }
    const tx = new THREE.CanvasTexture(cv), img = new Image(); img.onload = () => { x.filter = 'invert(1)'; x.drawImage(img, 512 - 130, 256 - 84, 260, 168); x.filter = 'none'; tx.needsUpdate = true; }; img.src = 'img/mark.png';
    moon = new THREE.Mesh(new THREE.SphereGeometry(14, 40, 24), new THREE.MeshBasicMaterial({ map: tx, fog: false }));
    moonOrb = new THREE.Group(); moonOrb.rotation.set(0.5, 0, 0.25); moon.position.set(R + 170, 30, 0); moon.rotation.y = -Math.PI/2; moonOrb.add(moon); scene.add(moonOrb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5FA0E6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false })); halo.scale.setScalar(50); moon.add(halo); }
  // more traffic in the sky: one plane tows a banner for our clients
  [[0.2, 1.2, -0.6, R + 19, 0.09, true], [1.6, 0.3, 0.9, R + 23, -0.07, false]].forEach(([a, b, c2, rad, sp, banner]) => {
    const orb = new THREE.Group(); orb.rotation.set(a, b, c2); scene.add(orb); const pl = makePlane(); pl.position.set(0, 0, rad); pl.rotation.set(0, Math.PI/2, 0); pl.scale.setScalar(1.5); orb.add(pl);
    if (banner){ const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160; const x = cv.getContext('2d'); x.fillStyle = '#F2C94C'; x.fillRect(0,0,1024,160); x.fillStyle = '#12153A'; x.font = '800 74px IBM Plex Sans Arabic, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillText('Planet ✦ أكتر من 370 علامة', 512, 84, 980);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide })); flag.position.set(0, 0, -6.4); flag.rotation.y = Math.PI/2; pl.add(flag);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,2.6,4), basic(0x12153A)); rope.rotation.x = Math.PI/2; rope.position.z = -2.4; pl.add(rope); }
    extraPlanes.push({ orb, sp }); });
  sat = new THREE.Group(); sat.add(mesh(new THREE.BoxGeometry(1.2,1.2,1.6), 0xF4F7FC)); const panel = mesh(new THREE.BoxGeometry(5,0.1,1.2), 0x2E6BA9); sat.add(panel);
  const dish = mesh(new THREE.SphereGeometry(0.6,16,8,0,Math.PI*2,0,Math.PI/2), 0xF2C94C); dish.position.y = 0.7; sat.add(dish);
  const sOrb = new THREE.Group(); sOrb.rotation.set(0.3, 0, -0.5); sat.position.set(R + 24, 0, 0); sOrb.add(sat); scene.add(sOrb); sat.userData.orb = sOrb;
}

/* ---------- traffic: vans and townsfolk on the road graph ---------- */
const vehicles = [], walkers = [];
function edgePoint(ei, s, lane, out){ const [ia,ib] = EDGES[ei], a = poiDirs[ia], b = poiDirs[ib], ang = a.angleTo(b), tt = clamp(s/(ang*R), 0, 1);
  const d = out || V(); d.copy(a).multiplyScalar(Math.sin((1-tt)*ang)).addScaledVector(b, Math.sin(tt*ang)).divideScalar(Math.sin(ang)).normalize();
  d.addScaledVector(edgeN[ei], lane/R).normalize(); return d; }
function makeVan(){
  const g = new THREE.Group(); g.userData.dyn = true;
  if (vanModel){ g.add(vanModel.clone()); return g; }
  const b = mesh(new THREE.BoxGeometry(1.2,1.0,2.4), 0xF4F7FC); b.position.y = 0.75; g.add(b);
  const c = mesh(new THREE.BoxGeometry(1.15,0.7,0.8), 0xF4F7FC); c.position.set(0,0.6,1.5); g.add(c);
  const st = new THREE.Mesh(new THREE.BoxGeometry(1.22,0.2,2.42), basic(0x2E6BA9)); st.position.y = 0.7; g.add(st);
  [[-0.6,0.9],[0.6,0.9],[-0.6,-0.8],[0.6,-0.8]].forEach(([x,z]) => { const w = mesh(new THREE.CylinderGeometry(0.28,0.28,0.2,12), 0x12153A, 0); w.rotation.z = Math.PI/2; w.position.set(x,0.28,z); g.add(w); });
  return g;
}
function residentLine(c, i){
  const n = c.name, opts = [
    L(`Hi! I'm with ${n.en}. Planet does our marketing — come see what they made for us!`, `أهلاً! أنا من ${n.ar}. Planet هما اللي بيعملولنا التسويق — تعالى شوف عملولنا إيه!`),
    L(`${n.en} here 👋 We're one of 370+ brands on this planet.`, `${n.ar} هنا 👋 إحنا واحدة من أكتر من 370 علامة على الكوكب ده.`),
    L(`Lovely day on Planet! I'm from ${n.en} — want to see our posts and campaigns?`, `يوم حلو على Planet! أنا من ${n.ar} — تحب تشوف بوستاتنا وحملاتنا؟`),
  ]; return opts[i % opts.length];
}
function spawnTraffic(){
  for (let i=0;i<3;i++){ const v = makeVan(); planet.add(v); cullList.push(v); vehicles.push({ g: v, e: (i*7) % EDGES.length, s: 3, dir: i%2 ? 1 : -1, speed: 0, max: 6 + rnd()*2, honk: 0 }); }
  /* one resident per client — every client walks the planet, none repeated, none left out */
  CLIENTS.forEach((c, i) => { const p = person(20 + i, { logo: logoTex(c) }); planet.add(p); cullList.push(p); walkers.push({ g: p, c, e: (i*5+1) % EDGES.length, s: 2 + rnd()*14, dir: i%2 ? 1 : -1, walkT: rnd()*6, line: residentLine(c, i), pause: 0 }); });
}
function advanceOnGraph(o, step){
  const [ia,ib] = EDGES[o.e], L = poiDirs[ia].angleTo(poiDirs[ib])*R;
  o.s += step * o.dir;
  if (o.s > L || o.s < 0){ const node = o.s > L ? ib : ia, opts = ADJ[node].filter(x => x !== o.e), ne = opts.length ? opts[(rnd()*opts.length)|0] : o.e;
    o.e = ne; const [na] = EDGES[ne]; o.dir = na === node ? 1 : -1; o.s = o.dir > 0 ? 0.01 : poiDirs[EDGES[ne][0]].angleTo(poiDirs[EDGES[ne][1]])*R - 0.01; }
}
const _a = V(), _b = V(), _c = V(), _m = new THREE.Matrix4();
function poseOnGraph(o, lane, lift){
  const d = edgePoint(o.e, o.s, lane*o.dir, _a), ahead = edgePoint(o.e, o.s + 0.5*o.dir, lane*o.dir, _b);
  const up = d, fwd = _c.copy(ahead).sub(d); fwd.addScaledVector(up, -fwd.dot(up)).normalize(); const right = V().crossVectors(up, fwd);
  _m.makeBasis(right, up, fwd); o.g.quaternion.setFromRotationMatrix(_m); o.g.position.copy(d).multiplyScalar(R + Math.max(0, heightAt(d)) + lift);
  return d;
}

/* ---------- the messenger ---------- */
const player = new THREE.Group(); scene.add(player);
const rig = new THREE.Group(); player.add(rig);
let mixer = null, walkAction = null, idleTime = 0, clipDur = 1, charLoaded = false;
const proc = {};
function buildProceduralPlayer(){
  const torso = mesh(new THREE.CylinderGeometry(0.3,0.34,0.62,12), 0xF4F7FC); torso.position.y = 0.88; rig.add(torso);
  const head = mesh(new THREE.SphereGeometry(0.34,20,14), 0xF4F7FC); head.position.y = 1.45; rig.add(head);
  const visor = mesh(new THREE.SphereGeometry(0.25,20,12), 0x12153A, 0); visor.scale.set(1,0.75,0.6); visor.position.set(0,1.45,0.2); rig.add(visor);
  const bag = mesh(new THREE.BoxGeometry(0.5,0.5,0.28), 0x2E6BA9); bag.position.set(0,0.95,-0.32); rig.add(bag);
  const flap = mesh(new THREE.BoxGeometry(0.5,0.12,0.3), 0xF2C94C, 0); flap.position.set(0,1.18,-0.32); rig.add(flap);
  const ring = mesh(new THREE.TorusGeometry(0.27,0.06,8,20), 0x2E6BA9, 0); ring.rotation.x = Math.PI/2; ring.position.y = 1.17; rig.add(ring);
  const limb = (x,y,len,col) => { const pv = new THREE.Group(); pv.position.set(x,y,0); const m = mesh(new THREE.CylinderGeometry(0.1,0.09,len,8), col); m.position.y = -len/2; pv.add(m); rig.add(pv); return pv; };
  proc.legL = limb(-0.14,0.58,0.58,0xC9D6EA); proc.legR = limb(0.14,0.58,0.58,0xC9D6EA); proc.armL = limb(-0.4,1.12,0.5,0xF4F7FC); proc.armR = limb(0.4,1.12,0.5,0xF4F7FC);
  [proc.legL, proc.legR].forEach(l => { const b = mesh(new THREE.BoxGeometry(0.22,0.14,0.32), 0x12153A, 0); b.position.set(0,-0.56,0.05); l.add(b); });
}
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6,24), new THREE.MeshBasicMaterial({ color: 0x12153A, transparent: true, opacity: 0.3, depthWrite: false }));
shadow.renderOrder = 2; scene.add(shadow);

/* ---------- loading models ---------- */
function loadGLB(url, onProg){ return new Promise(res => new THREE.GLTFLoader().load(url, g => res(g), e => onProg && e.total && onProg(e.loaded/e.total), () => res(null))); }
function toonify(root, outlineW){
  const outs = [];
  root.traverse(o => { if (!o.isMesh) return; const old = o.material;
    if (old.map){ old.map.encoding = THREE.LinearEncoding; old.map.needsUpdate = true; }
    o.material = new THREE.MeshToonMaterial({ color: 0xffffff, map: old.map || null, gradientMap: grad, skinning: !!o.isSkinnedMesh });
    o.frustumCulled = false;
    if (outlineW) outs.push(o); });
  for (const o of outs){
    let ol;
    if (o.isSkinnedMesh){ ol = new THREE.SkinnedMesh(o.geometry, inkPush(outlineW, true)); ol.bind(o.skeleton, o.bindMatrix); }
    else ol = new THREE.Mesh(o.geometry, inkPush(outlineW, false));
    ol.frustumCulled = false; o.parent.add(ol); ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
  }
}
/* skinned meshes: measure the skeleton, not the (unskinned) geometry box */
function fitSkinned(root, h){
  root.updateMatrixWorld(true); const ps = []; root.traverse(o => { if (o.isBone) ps.push(o.getWorldPosition(V())); });
  if (!ps.length) return fitHeight(root, h);
  let lo = Math.min(...ps.map(p => p.y)), hi = Math.max(...ps.map(p => p.y));
  const s = h / ((hi - lo) * 1.06); root.scale.multiplyScalar(s); root.updateMatrixWorld(true);
  const ps2 = []; root.traverse(o => { if (o.isBone) ps2.push(o.getWorldPosition(V())); });
  lo = Math.min(...ps2.map(p => p.y)); const cx = ps2.reduce((a,p) => a + p.x, 0)/ps2.length, cz = ps2.reduce((a,p) => a + p.z, 0)/ps2.length;
  root.position.y -= lo - 0.05; root.position.x -= cx; root.position.z -= cz;
  return root.scale.x;
}
function fitHeight(obj, h){ obj.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(obj), size = box.getSize(V()); const s = h / size.y; obj.scale.multiplyScalar(s); obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj); obj.position.y -= b2.min.y; const c = b2.getCenter(V()); obj.position.x -= c.x; obj.position.z -= c.z; return s; }
async function loadModels(progress){
  const parts = [0,0,0], upd = () => progress(parts.reduce((a,b)=>a+b,0)/3);
  const [ch, hq, van] = await Promise.all([
    loadGLB('models/char.glb', p => { parts[0] = p; upd(); }),
    loadGLB('models/hq.glb', p => { parts[1] = p; upd(); }),
    loadGLB('models/van.glb', p => { parts[2] = p; upd(); }),
  ]);
  if (ch){
    const root = ch.scene; const holder = new THREE.Group(); holder.add(root);
    fitSkinned(root, 1.7); toonify(root, 0);
    root.rotation.y = CHAR_YAW; rig.add(holder); charLoaded = true;
    if (ch.animations.length){ mixer = new THREE.AnimationMixer(root); const clip = ch.animations[0]; clipDur = clip.duration; walkAction = mixer.clipAction(clip); walkAction.play();
      // find the frame where the feet are closest together → idle pose
      let lf = null, rf = null; root.traverse(o => { if (o.isBone){ const n = o.name.toLowerCase(); if (n.includes('left') && n.includes('foot')) lf = lf || o; if (n.includes('right') && n.includes('foot')) rf = rf || o; } });
      if (lf && rf){ let best = 1e9; for (let k=0;k<48;k++){ const tt = k/48*clipDur; walkAction.time = tt; mixer.update(0); root.updateMatrixWorld(true);
        const dd = lf.getWorldPosition(V()).distanceTo(rf.getWorldPosition(V())); if (dd < best){ best = dd; idleTime = tt; } } }
      walkAction.time = idleTime; walkAction.timeScale = 0; mixer.update(0); }
  }
  if (!charLoaded) buildProceduralPlayer();
  // the messenger carries Planet's mark on their back
  { const pack = new THREE.Group(); const box = mesh(new THREE.BoxGeometry(0.42,0.5,0.2), 0x2E6BA9); pack.add(box);
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.22), new THREE.MeshBasicMaterial({ color: 0xffffff })); patch.position.set(0,0.04,-0.105); patch.rotation.y = Math.PI; pack.add(patch);
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.31,0.2), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); mk.position.set(0,0.04,-0.108); mk.rotation.y = Math.PI; pack.add(mk);
    pack.position.set(0, charLoaded ? BACKPACK_Y : 0.95, charLoaded ? BACKPACK_Z : -0.32); rig.add(pack); }
  if (hq){ const root = hq.scene; const holder = new THREE.Group(); holder.add(root); const s = fitHeight(root, 8.2); toonify(root, 0.03/s); root.position.y -= 0.5; root.rotation.y = HQ_YAW; hqModel = holder; hqModel.userData.dyn = true; }
  if (van){ const root = van.scene; const holder = new THREE.Group(); holder.add(root); const s = fitHeight(root, 1.55); toonify(root, 0.025/s); root.rotation.y = VAN_YAW; vanModel = holder; }
}
const CHAR_YAW = 0, HQ_YAW = 0, VAN_YAW = Math.PI/2, BACKPACK_Y = 1.12, BACKPACK_Z = -0.2;

/* ---------- input ---------- */
const keys = {};
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;   // typing (chat, brief) never moves the player
  if (e.repeat && keys[e.code]) return;
  keys[e.code] = true;
  if (['KeyE','Enter','NumpadEnter'].includes(e.code)){ if (!(e.code !== 'KeyE' && e.target.closest && e.target.closest('a,button'))){ act(); if (state !== 'title') e.preventDefault(); } }
  if (e.code === 'Space'){ if (state === 'talk') { advance(); e.preventDefault(); } else if (state === 'play'){ jumpReq = true; e.preventDefault(); } }
  if (e.code === 'KeyJ' && (state === 'play' || state === 'journal')) toggleJournal();
  if (e.code === 'Escape'){ if (state === 'journal') toggleJournal(); }
  if (state === 'play' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const releaseAll = () => { for (const k in keys) keys[k] = false; joy.x = joy.y = 0; joy.id = null; $('knob').style.transform = ''; };
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); else Sfx.wake(); });
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => Sfx.wake(), { passive: true, capture: true }));
addEventListener('pageshow', () => Sfx.wake()); addEventListener('focus', () => Sfx.wake());

const joy = { x: 0, y: 0, id: null };
const stick = $('stick'), knob = $('knob');
stick.addEventListener('pointerdown', e => { e.preventDefault(); joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveJoy(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
['pointerup','pointercancel','lostpointercapture'].forEach(ev => stick.addEventListener(ev, endJoy));
function moveJoy(e){ const b = stick.getBoundingClientRect(); let x = (e.clientX-b.left-b.width/2)/(b.width/2), y = (e.clientY-b.top-b.height/2)/(b.height/2);
  const l = Math.hypot(x,y); if (l > 1){ x /= l; y /= l; } joy.x = x; joy.y = y; knob.style.transform = `translate(${x*38}px,${y*38}px)`; }
$('tjump').addEventListener('pointerdown', e => { e.preventDefault(); if (state === 'play') jumpReq = true; });

/* camera drag */
let runToggle = false;
let camYawDelta = 0, camH = 2.6, camDist = 5.6, lastDrag = -1e9;
const drag = { id: null, x: 0, y: 0 };
canvas.addEventListener('pointerdown', e => { if (state !== 'play' && state !== 'talk') return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  camYawDelta += dx * 0.006; camH = clamp(camH + dy * 0.012, 1.2, 6.5); lastDrag = performance.now(); });
['pointerup','pointercancel'].forEach(ev => canvas.addEventListener(ev, e => { if (e.pointerId === drag.id) drag.id = null; }));
canvas.addEventListener('wheel', e => { if (state !== 'play') return; camDist = clamp(camDist + e.deltaY*0.006, 3.5, 13); e.preventDefault(); }, { passive: false });

/* ---------- UI: language, hud, journal ---------- */
const langHooks = [];   // canvas labels baked into 3D sprites redraw themselves here when the language changes
function applyLang(){
  document.body.classList.toggle('ar', lang === 'ar');
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = lang;
  $('lang').textContent = lang === 'ar' ? 'EN' : 'عربي';
  document.querySelectorAll('[data-t]').forEach(el => { const v = UI[el.dataset.t]; if (v) el.innerHTML = t(v); });   // a missing key (stale cached file) must not stop the game from starting
  $('keys').innerHTML = t(UI.keys);
  langHooks.forEach(f => f());
  updateHud(); if (dlg.active) renderLine(true); if (state === 'journal') renderJournal(); if (state === 'exhibit' && xRender) xRender();
}
$('lang').onclick = () => { Sfx.click(); lang = lang === 'en' ? 'ar' : 'en'; store.set('pm-lang', lang); applyLang(); };
function syncSnd(){ $('sndwave').hidden = !Sfx.on; $('sndoff').hidden = Sfx.on; }
$('snd').onclick = () => { Sfx.init(); Sfx.toggle(); syncSnd(); Sfx.click(); };
const SVCS = POIS.filter(p => p.svc);
const pips = $('pips'); SVCS.forEach(() => pips.appendChild(Object.assign(document.createElement('span'), { className: 'pip' })));
function updateHud(){
  const n = save.d.length; $('count').textContent = `${n}/${SVCS.length}`; [...pips.children].forEach((p,i) => p.classList.toggle('on', i < n));
  $('stars').textContent = `${save.s.length}/40`; $('places').textContent = `${save.p.length}/${N_POI}`;
}
let jtab = 'briefs';
function toggleJournal(){ if (state === 'journal'){ $('journal').hidden = true; state = 'play'; canvas.focus(); return; } if (state !== 'play') return; Sfx.open(); releaseAll(); state = 'journal'; $('journal').hidden = false; renderJournal(); }
$('jbtn').onclick = () => toggleJournal(); $('jclose').onclick = () => toggleJournal();
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { jtab = b.dataset.tab; Sfx.click(); renderJournal(); });
function renderJournal(){
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === jtab));
  const body = $('jbody'); body.innerHTML = '';
  const stat = document.createElement('div'); stat.className = 'stat';
  stat.innerHTML = `<div><b>${save.d.length}/8</b>${t(UI.briefsTitle)}</div><div><b>${save.p.length}/${N_POI}</b>${t(UI.placesTitle)}</div><div><b>${save.s.length}/40</b>${t(UI.starsTitle)}</div>`;
  body.appendChild(stat);
  if (jtab === 'help'){ const h = document.createElement('div'); h.className = 'help'; h.innerHTML = t(UI.help); body.appendChild(h);
    const r = document.createElement('button'); r.className = 'go'; r.textContent = lang === 'ar' ? 'ابدأ من الأول (امسح التقدّم)' : 'Start over (clear progress)'; r.onclick = () => { store.set('pm-save', '{}'); location.reload(); };
    const c = document.createElement('button'); c.className = 'go'; c.textContent = lang === 'ar' ? '🏅 شهادتي' : '🏅 My certificate'; c.onclick = () => { toggleJournal(); openExhibit('cert'); };
    const bq = document.createElement('button'); bq.className = 'go'; bq.textContent = lang === 'ar' ? '📝 اعمل بريفك' : '📝 Build your brief'; bq.onclick = () => { toggleJournal(); openExhibit('brief'); };
    body.append(c, bq, r); return; }
  const list = jtab === 'briefs' ? pois.filter(p => p.svc) : pois;
  list.forEach(p => { const done = jtab === 'briefs' ? p.done : save.p.includes(p.i);
    const it = document.createElement('div'); it.className = 'item' + (done ? ' done' : '');
    const known = jtab === 'briefs' || done;
    it.innerHTML = `<span class="ic">${done ? '✓' : (p.n || '•')}</span><span class="tx">${known ? t(p.name) : '???'}<small>${known ? t(p.lines[0]).slice(0, 90) : (lang === 'ar' ? 'لسه ما اكتشفتهوش' : 'Not discovered yet')}</small></span>`;
    const go = document.createElement('button'); go.className = 'go'; go.type = 'button'; go.textContent = t(UI.guideMe);
    go.onclick = () => { guide = p; Sfx.click(); toggleJournal(); mini(`${t(UI.guide)}: ${known ? t(p.name) : '???'}`); };
    it.appendChild(go);
    if (known && jtab === 'places'){ const fly = document.createElement('button'); fly.className = 'go van'; fly.type = 'button'; fly.textContent = lang === 'ar' ? '🚐 وصّلني' : '🚐 Take me';
      fly.onclick = () => { toggleJournal(); travelTo(p); }; it.appendChild(fly); } body.appendChild(it); });
}
function travelTo(p){
  const from = player.position.clone(); spawn(p); Sfx.jump();
  burst(from, 0xF2C94C, 40, 4, 0.8); setTimeout(() => burst(pDir.clone().multiplyScalar(R + 1), 0x8FB4E3, 50, 5, 1), 60);
  mini(`🚐 ${t(p.name)}`); guide = null;
}
function toast(text, sub){ const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; if (sub){ const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); } document.body.appendChild(el); setTimeout(() => el.remove(), 1900); }
function mini(text){ document.querySelectorAll('.mini').forEach(e => e.remove()); const el = document.createElement('div'); el.className = 'mini'; el.textContent = text; document.body.appendChild(el); setTimeout(() => el.remove(), 2700); }

/* ---------- dialogue ---------- */
let state = 'loading';         // loading | title | intro | play | talk | journal | exhibit | finale | final
const dlg = { active: false, speaker: null, lines: [], i: 0, shown: 0, timer: null, done: null, studio: false };
/* cta: optional buttons shown under the last line — [{ label: L(), act: fn, cls }] */
function talk(speaker, lines, studio, done, cta){
  Sfx.open(); releaseAll();
  Object.assign(dlg, { active: true, speaker, lines, i: 0, studio, done, cta: cta || null });
  state = 'talk'; $('dialog').hidden = false; $('prompt').hidden = true; renderLine();
}
function renderLine(keepFull){
  const sp = $('speaker'); sp.textContent = t(dlg.speaker); sp.classList.toggle('studio', !!dlg.studio);
  $('pager').textContent = dlg.lines.length > 1 ? `${dlg.i+1}/${dlg.lines.length}` : '';
  const full = t(dlg.lines[dlg.i]); clearInterval(dlg.timer); renderCta();
  if (keepFull || reduce){ dlg.shown = full.length; $('line').textContent = full; return; }
  dlg.shown = 0; $('line').textContent = '';
  dlg.timer = setInterval(() => { dlg.shown += 2; if (dlg.shown % 6 === 0) Sfx.blip(); $('line').textContent = full.slice(0, dlg.shown); if (dlg.shown >= full.length) clearInterval(dlg.timer); }, 16);
}
function renderCta(){
  const box = $('dlgcta'); if (!box) return;
  const last = dlg.cta && dlg.i === dlg.lines.length - 1; box.hidden = !last; if (!last) return box.innerHTML = '';
  box.innerHTML = dlg.cta.map((c, k) => `<button type="button" class="dcta ${c.cls || ''}" data-k="${k}">${t(c.label)}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); const c = dlg.cta[+b.dataset.k];
    clearInterval(dlg.timer); dlg.active = false; dlg.done = null; $('dialog').hidden = true; box.hidden = true; state = 'play'; Sfx.click(); c.act(); });
}
function advance(){
  if (!dlg.active) return;
  const full = t(dlg.lines[dlg.i]);
  if (dlg.shown < full.length){ clearInterval(dlg.timer); dlg.shown = full.length; $('line').textContent = full; return; }
  if (++dlg.i < dlg.lines.length) return renderLine();
  dlg.active = false; $('dialog').hidden = true; state = 'play'; Sfx.close(); const d = dlg.done; dlg.done = null; d && d();
}
$('dialog').addEventListener('click', advance);

let near = null, guide = null;
function act(){
  if (state === 'talk') return advance();
  if (state === 'play' && riding) return dismount();
  if (state === 'play' && near) return interact(near);
}
{ let lastAct = 0; const fire = e => { if (performance.now() - lastAct < 400) return; lastAct = performance.now(); e.preventDefault(); act(); };
  $('prompt').addEventListener('pointerup', fire); $('prompt').addEventListener('click', fire); }
function interact(tk){
  if (tk.kind === 'stone'){ const s = STONES[tk.ref][lang]; return talk(L(STONES[tk.ref].en[0], STONES[tk.ref].ar[0]), [L(STONES[tk.ref].en[1], STONES[tk.ref].ar[1])], true); }
  if (tk.kind === 'board') return openExhibit('client', tk.ref.logo || tk.ref.name.en);
  if (tk.kind === 'emp') return talkToCrew(tk.ref);
  if (tk.kind === 'car') return mountCar(tk.ref);
  if (tk.kind === 'rocket') return talk(L('Planet Rocket','صاروخ Planet'), [L("Fuelled and ready. Seven worlds orbit Planet: the Moon where our crew lives, the Clients' Ring, the Academy, the Gallery of our work, the Services station, a whole planet for Fly 29 — and the Star Catcher, if you fancy a game.", "الوقود مليان. فيه سبع عوالم حوالين Planet: القمر اللي ساكن فيه طاقمنا، وحلقة العملاء، والأكاديمية، ومعرض شغلنا، ومحطة الخدمات، وكوكب كامل لـ Fly 29 — وكوكب صيد النجوم لو عايز تلعب.")], true, () => startLaunch());
  if (tk.kind === 'walker'){ tk.ref.pause = 6; const c = tk.ref.c; return talk(c ? c.name : L('Townsperson', 'واحد من سكان الكوكب'), [tk.ref.line], true, c ? () => openExhibit('client', c.logo) : null); }
  const p = tk.ref;
  if (p.svc && !p.done){
    talk(UI.me, [L(`Delivery for the ${p.name.en} studio! One brief, as promised.`, `توصيلة لاستوديو ${p.name.ar}! بريف واحد زي ما اتفقنا.`)], false, () =>
      talk(p.name, p.lines, true, () => {
        p.done = true; save.d.push(p.id); persist(); Sfx.deliver(); p.marker.material.map = markerTex(true); p.marker.material.needsUpdate = true; updateHud(); toast(t(UI.delivered), `${save.d.length}/8`);
        burst(p.marker.getWorldPosition(V()), 0xF2C94C);
        if (guide === p) guide = null;
        const allDone = save.d.length === SVCS.length;
        setTimeout(() => openExhibit('service', p.id, allDone ? () => talk(UI.me, [L("That's all eight. Back to HQ!", "كده التمانية خلصوا. يلا على المقر!")]) : null), 700);
      }));
  } else if (p.id === 'hq' && save.d.length === SVCS.length){
    talk(p.name, [L("Every brief delivered. That's how Planet works: one team, one plan, one person you can call.", "كل البريفات اتسلّمت. هي دي طريقة Planet: فريق واحد، خطة واحدة، وشخص واحد تكلّمه."),
                  L("Marketing that gets you noticed. And turns interest into customers.", "تسويق يخلّي الناس تشوفك. ويحوّل الاهتمام لعملاء.")], true, startFinale);
  } else if (p.id === 'hq') talk(p.name, [p.lines[0], L("Come in — the whole team is inside. Every room will say hello.", "اتفضّل جوّه — الفريق كله موجود. كل أوضة هترحّب بيك.")], true, () => enterOffice());
  else talk(p.name, p.lines, true, exhibitFor(p));
}

/* ---------- particles: delivery bursts + fireworks ---------- */
const bursts = [];
function burst(pos, color, n = 60, speed = 6, life = 1.2){
  const geo = new THREE.BufferGeometry(), arr = new Float32Array(n*3), vel = [];
  for (let i=0;i<n;i++){ arr.set([pos.x,pos.y,pos.z], i*3); vel.push(randDir().multiplyScalar(speed*(0.4+Math.random()*0.6))); }
  geo.setAttribute('position', new THREE.BufferAttribute(arr,3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts); bursts.push({ pts, vel, t: 0, life, g: pos.clone().normalize() });
}
function updateBursts(dt){
  for (let i=bursts.length-1;i>=0;i--){ const b = bursts[i]; b.t += dt; const a = b.pts.geometry.attributes.position;
    for (let k=0;k<b.vel.length;k++){ b.vel[k].addScaledVector(b.g, -6*dt).multiplyScalar(0.985); a.array[k*3] += b.vel[k].x*dt; a.array[k*3+1] += b.vel[k].y*dt; a.array[k*3+2] += b.vel[k].z*dt; }
    a.needsUpdate = true; b.pts.material.opacity = 1 - b.t/b.life;
    if (b.t > b.life){ scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i,1); } }
}
let finaleT = 0;
function startFinale(){ state = 'finale'; finaleT = 0; save.fin = true; persist(); Sfx.finish(); Sfx.duck(0.5); $('prompt').hidden = true; }
function showFinal(){ state = 'final'; $('final').hidden = false; $('keep').focus(); }
$('keep').onclick = () => { $('final').hidden = true; state = 'play'; Sfx.duck(1); Sfx.close(); };
document.querySelectorAll('.copy').forEach(b => b.onclick = async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t(UI.copied); setTimeout(() => b.textContent = t(UI.copy), 1400); }
  catch(e){ const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
});

/* ---------- player state ---------- */
const pDir = V(), pFwd = V(), camFwd = V();
let jumpReq = false, jy = 0, vy = 0, grounded = true, walkT = 0, animSpeed = 0, lastStepSign = 1, introT = 0;
function spawn(hq = pois[0]){
  const e = EDGES[ADJ[hq.i][0]], nb = e[0] === hq.i ? e[1] : e[0];
  const tow = poiDirs[nb].clone().sub(hq.dir); tow.addScaledVector(hq.dir, -tow.dot(hq.dir)).normalize();
  const side = V().crossVectors(hq.dir, tow).normalize();
  pDir.copy(hq.dir).addScaledVector(tow.clone().multiplyScalar(0.55).add(side.multiplyScalar(0.84)).normalize(), (hq.r + 4.5)/R).normalize();
  pFwd.copy(hq.dir).sub(pDir); pFwd.addScaledVector(pDir, -pFwd.dot(pDir)).normalize();   // face HQ, camera stays outside it
  camFwd.copy(pFwd);
}

/* ---------- main update ---------- */
const up = V(), tmp = V(), tmp2 = V(), right = V(), mtx = new THREE.Matrix4(), look = V(), camUp = V(0,1,0);
function inputVector(){
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  const l = Math.hypot(ix, iy); if (l > 1){ ix /= l; iy /= l; } return [ix, iy, Math.min(1, l)];
}
const walkable = d => heightAt(d) > SEA + 0.12;
function resolve(d){
  for (let pass=0; pass<2; pass++) for (const o of obstacles){ const dt0 = d.dot(o.d); if (dt0 < 0.985) continue; const ang = Math.acos(Math.min(1, dt0))*R, rr = o.r + 0.32;
    if (ang < rr){ tmp2.copy(d).sub(o.d); tmp2.addScaledVector(o.d, -tmp2.dot(o.d)); if (tmp2.lengthSq() < 1e-10) tmp2.set(1,0,0); tmp2.normalize(); d.copy(o.d).multiplyScalar(Math.cos(rr/R)).addScaledVector(tmp2, Math.sin(rr/R)).normalize(); } }
  return d;
}
function updatePlayer(dt, now){
  up.copy(pDir);
  // keep the camera heading tangent
  camFwd.addScaledVector(up, -camFwd.dot(up)); if (camFwd.lengthSq() < 1e-6) camFwd.copy(pFwd); camFwd.normalize();
  if (camYawDelta){ camFwd.applyAxisAngle(up, -camYawDelta); camYawDelta = 0; }
  const camRight = right.crossVectors(camFwd, up).normalize();
  const [ix, iy, mag] = state === 'play' ? inputVector() : [0,0,0];
  const run = keys.ShiftLeft || keys.ShiftRight || runToggle;
  let moved = 0;
  if (mag > 0.08){
    const wish = tmp.copy(camFwd).multiplyScalar(iy).addScaledVector(camRight, ix).normalize();
    if (pFwd.dot(wish) < -0.98) pFwd.addScaledVector(camRight, 0.2);
    pFwd.lerp(wish, 1 - Math.exp(-14*dt)).addScaledVector(up, -pFwd.dot(up)).normalize();
    const speed = (riding ? (run ? 17 : 12) : run ? 7.8 : 4.4) * mag, stepLen = speed * dt;
    const tryDir = dirv => { const nd = V().copy(pDir).addScaledVector(dirv, stepLen/R).normalize(); resolve(nd); return walkable(nd) ? nd : null; };
    let nd = tryDir(pFwd);
    if (!nd){ for (const a of [0.6, -0.6, 1.2, -1.2]){ nd = tryDir(V().copy(pFwd).applyAxisAngle(up, a)); if (nd) break; } }
    if (nd){ moved = pDir.angleTo(nd)*R; pDir.copy(nd); }
  }
  if (riding) carBump(dt);
  // the ground under us may have pushed us out of an obstacle while idle
  if (!moved) resolve(pDir);
  up.copy(pDir); pFwd.addScaledVector(up, -pFwd.dot(up)).normalize();
  animSpeed = THREE.MathUtils.lerp(animSpeed, moved/dt, 1 - Math.exp(-12*dt));
  // jump
  if (jumpReq && grounded && !riding){ vy = 7.6; grounded = false; Sfx.jump(); } jumpReq = false;
  if (!grounded){ jy += vy*dt; vy -= 22*dt; if (jy <= 0){ jy = 0; vy = 0; grounded = true; Sfx.land(); } }
  // walk cycle / footsteps
  const moving = animSpeed > 0.4 && grounded && !riding;
  if (riding && car) car.traverse(o => { if (o.userData.wheel) o.rotation.x += moved * 3; });
  if (moving){ const before = Math.sin(walkT); walkT += dt * animSpeed * 2.1; if (Math.sign(Math.sin(walkT)) !== Math.sign(before)) Sfx.step(animSpeed > 6, terrainInfo(pDir).rd > 1.5); }
  // pose
  const h = Math.max(heightAt(pDir), SEA + 0.12);
  right.crossVectors(up, pFwd).normalize(); mtx.makeBasis(right, up, pFwd); player.quaternion.setFromRotationMatrix(mtx);
  player.position.copy(up).multiplyScalar(R + h + jy);
  if (mixer){
    if (moving){ walkAction.timeScale = THREE.MathUtils.lerp(walkAction.timeScale, clamp(animSpeed/4.0, 0.6, 1.9), 1 - Math.exp(-10*dt)); }
    else { walkAction.timeScale = 0; let d = idleTime - walkAction.time; d -= Math.round(d/clipDur)*clipDur; walkAction.time += d * (1 - Math.exp(-10*dt)); }
    mixer.update(dt); rig.position.y = moving ? 0 : Math.sin(now*0.0022)*0.012;   // now is in ms: a slow breath, not a shiver
    if (!grounded) rig.rotation.x = -0.12; else rig.rotation.x *= 0.8;
  } else if (proc.legL){
    const sw = moving ? Math.sin(walkT)*0.6 : 0; proc.legL.rotation.x = sw; proc.legR.rotation.x = -sw; proc.armL.rotation.x = -sw*0.8; proc.armR.rotation.x = sw*0.8;
    rig.position.y = moving ? Math.abs(Math.cos(walkT))*0.06 : Math.sin(now*0.0022)*0.01;
  }
  shadow.position.copy(up).multiplyScalar(R + h + 0.04); shadow.quaternion.setFromUnitVectors(V(0,0,1), up); shadow.scale.setScalar(1 - Math.min(0.5, jy*0.15));
  // camera auto-follow while walking (not right after a manual drag)
  if (moved && now - lastDrag > 1600 && pFwd.dot(camFwd) > -0.35) camFwd.lerp(pFwd, 1 - Math.exp(-1.7*dt)).normalize();
  return moved;
}
function updateCamera(dt, k){
  const base = tmp.copy(pDir).multiplyScalar(R + Math.max(heightAt(pDir), SEA + 0.12));
  const want = tmp2.copy(base).addScaledVector(pDir, camH).addScaledVector(camFwd, -camDist);
  // never dip under the ground
  const wd = want.clone().normalize(), minR = R + Math.max(heightAt(wd), SEA) + 0.9; if (want.length() < minR) want.setLength(minR);
  // travel around the planet, never through it: interpolate direction and distance separately
  const cl = camera.position.length(), cd = camera.position.clone().divideScalar(cl || 1);
  cd.lerp(want.clone().normalize(), k).normalize(); camera.position.copy(cd).multiplyScalar(cl + (want.length() - cl)*k);
  camUp.lerp(pDir, k).normalize(); camera.up.copy(camUp);
  look.copy(base).addScaledVector(pDir, 1.4 + jy*0.5).addScaledVector(camFwd, 2.6); camera.lookAt(look);
}

/* nearest thing to talk to */
function findNear(){
  let best = null, bd = 1e9;
  for (const tk of talkables){ const d = pDir.angleTo(tk.d)*R; if (d < tk.r && d < bd){ bd = d; best = tk; } }
  for (const w of walkers){ const wd = w.g.position.clone().normalize(), d = pDir.angleTo(wd)*R; if (d < 1.9 && d < bd){ bd = d; best = { kind: 'walker', ref: w, d: wd }; } }
  return best;
}
function currentTarget(){
  if (guide) return guide;
  const open = pois.filter(p => p.svc && !p.done);
  if (!open.length) return pois[0];
  let best = null, bd = 1e9; for (const p of open){ const d = p.dir.angleTo(pDir); if (d < bd){ bd = d; best = p; } } return best;
}

/* ---------- frame loop ---------- */
let last = performance.now(), cullTick = 0;
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now; const ts = now/1000;
  if (oceanMat && oceanMat.userData.s) oceanMat.userData.s.uniforms.uT.value = ts;
  clouds.rotation.y += dt*0.008; clouds.rotation.x += dt*0.002;
  if (planeOrbit) planeOrbit.rotation.y += dt*0.13; for (const e of extraPlanes) e.orb.rotation.y += dt*e.sp;
  if (sat) sat.userData.orb.rotation.y -= dt*0.05;
  for (const b of birds){ b.piv.rotateY(dt*b.speed); b.flock.children.forEach(x => { const f = Math.sin(ts*8 + x.userData.ph)*0.5; x.userData.wl.rotation.z = f; x.userData.wr.rotation.z = -f; }); }
  for (const s of spinners) s.rotation.y += dt*0.8;
  for (const sp of sprays){ const a = sp.geometry.attributes.position, u = sp.userData; for (let i=0;i<u.ph.length;i++){ const p = (u.ph[i] + ts*0.6) % 1; const r = p*1.5; a.setXYZ(i, Math.cos(u.ang[i])*r, 2.2*p - 3.4*p*p + 0.2, Math.sin(u.ang[i])*r); } a.needsUpdate = true; }
  markers.forEach((m,i) => { if (m.userData.basePos) m.position.copy(m.userData.basePos).addScaledVector(m.userData.up, Math.sin(ts*2.4 + i)*0.18); });
  for (const st of stars){ if (st.got) continue; st.m.rotation.y = ts*2; st.m.position.y = 1.1 + Math.sin(ts*2 + st.idx)*0.15; }

  // traffic
  for (const v of vehicles){
    const vp = v.g.position, vf = v.g.getWorldDirection(tmp2);
    const ahead = (p, r) => vp.distanceTo(p) < r && tmp.copy(p).sub(vp).dot(vf) > 0;
    v.ghost = Math.max(0, (v.ghost || 0) - dt);
    const blocked = state !== 'title' && !v.ghost && ahead(player.position, 3.4);
    v.speed = THREE.MathUtils.lerp(v.speed, blocked ? 0 : v.max, 1 - Math.exp(-3*dt));
    if (blocked){ v.honk += dt; v.wait = (v.wait || 0) + dt;  if (v.wait > 4.5){ v.ghost = 2.5; v.wait = 0; } } else { v.honk = Math.min(v.honk, 0); v.wait = 0; }
    advanceOnGraph(v, v.speed*dt); poseOnGraph(v, -0.55, 0);
  }
  for (const w of walkers){
    const close = state !== 'title' && w.g.position.distanceTo(player.position) < 3;
    if (close || w.pause > 0){ w.pause = Math.max(0, w.pause - dt); animatePerson(w.g, 0, close, ts); poseOnGraph(w, -1.9, 0); if (close) faceToward(w.g, player.position); continue; }
    advanceOnGraph(w, 1.3*dt); w.walkT += dt*6; poseOnGraph(w, -1.9, 0); animatePerson(w.g, w.walkT, false, ts);
  }
  // standing NPCs wave when you come close
  for (const n of npcs){ const d = n.getWorldPosition(tmp).distanceTo(player.position); animatePerson(n, 0, state !== 'title' && d < 10, ts); }
  if ((++cullTick & 3) === 0){ for (const o of cullList){ { const dc = o.position.distanceTo(camera.position); o.visible = !o.userData.hidden && dc < (o.isSprite ? 40 : 46) && dc > 1.9; } } }
  // signs fade with distance
  for (const s of signs){ const d = s.getWorldPosition(tmp).distanceTo(camera.position); s.material.opacity = clamp(1 - (d - 16)/7, 0, 1); s.visible = s.material.opacity > 0.01; }

  { const far = state === 'title' || state === 'loading' || (state === 'intro' && introT < 1.4), fn = far ? 90 : state === 'finale' ? 40 : 30, ff = far ? 220 : state === 'finale' ? 140 : 88, kf = 1 - Math.exp(-1.5*dt);
    scene.fog.near += (fn - scene.fog.near)*kf; scene.fog.far += (ff - scene.fog.far)*kf; }
  if (moonOrb) moonOrb.rotation.y += dt*0.012;
  if (typeof spaceFrame === 'function' && spaceFrame(dt, ts)){ /* space.js drives the camera */ }
  else if (typeof officeFrame === 'function' && officeFrame(dt, now)){ /* office.js: inside HQ */ }
  else if (state === 'title' || state === 'loading'){
    const a = ts*0.08; camera.position.set(Math.sin(a)*R*3.2, R*0.95, Math.cos(a)*R*3.2); camera.up.set(0,1,0); camera.lookAt(0,0,0);
  } else if (state === 'finale'){
    finaleT += dt; const hq = pois[0];
    const center = hq.dir.clone().multiplyScalar(R), side = V().crossVectors(hq.dir, Y).normalize(); if (side.lengthSq() < 0.1) side.set(1,0,0);
    const a = finaleT*0.35, off = side.clone().applyAxisAngle(hq.dir, a).multiplyScalar(16).addScaledVector(hq.dir, 9 + finaleT*0.6);
    camera.position.lerp(center.clone().add(off), 1 - Math.exp(-2*dt)); camera.up.copy(hq.dir); camera.lookAt(center.clone().addScaledVector(hq.dir, 4));
    if (Math.random() < dt*3.2){ const p = hq.dir.clone().multiplyScalar(R + 12 + Math.random()*6).add(randDir().multiplyScalar(6)); burst(p, [0xF2C94C,0x8FB4E3,0xE76F51,0xF4F7FC,0x2E6BA9][Math.random()*5|0], 90, 7, 1.6); }
    if (finaleT > 7 && $('final').hidden) showFinal();
    updatePlayer(dt, now);
  } else {
    const moved = updatePlayer(dt, now);
    if (state === 'intro'){ introT += dt; updateCamera(dt, 1 - Math.exp(-(0.6 + introT)*dt)); if (introT > 2.4){ state = 'play'; introDone(); } }
    else updateCamera(dt, 1 - Math.exp(-6*dt));
    if (state === 'play'){
      near = findNear();
      $('prompt').hidden = !near;
      if (near && near.label) $('promptText').textContent = t(near.label);
      else if (near){ const nm = near.kind === 'poi' ? t(near.ref.name) : near.kind === 'stone' ? t(L(STONES[near.ref].en[0], STONES[near.ref].ar[0])) : near.kind === 'board' ? t(near.ref.name) : near.kind === 'car' ? (lang === 'ar' ? 'عربية Planet' : 'the Planet car') : near.kind === 'rocket' ? (lang === 'ar' ? 'صاروخ Planet' : 'the Planet rocket') : (near.kind === 'walker' && near.ref.c ? (lang === 'ar' ? 'واحد من ' : 'someone from ') + t(near.ref.c.name) : t(L('Townsperson','واحد من السكان')));
        $('promptText').textContent = `${near.kind === 'stone' ? t(UI.visit) : near.kind === 'board' ? (lang === 'ar' ? 'شوف شغل' : 'See work for') : near.kind === 'car' || near.kind === 'rocket' ? (lang === 'ar' ? 'اركب' : 'Ride') : near.kind === 'poi' && near.ref.id === 'hq' ? (lang === 'ar' ? 'ادخل' : 'Enter') : t(UI.talk)} ${nm}`; }
      // discovery
      const [pd, pi] = poiDist(pDir);
      if (pd < 11 && !save.p.includes(pi)){ save.p.push(pi); persist(); updateHud(); Sfx.discover(); mini(`📍 ${t(UI.found)}: ${t(pois[pi].name)}`); }
      // stars
      for (const st of stars){ if (st.got) continue; if (st.d.angleTo(pDir)*R < 1.3 && jy < 1.6){ st.got = true; st.g.visible = false; st.g.userData.hidden = true; save.s.push(st.idx); persist(); updateHud(); Sfx.collect();
        burst(st.m.getWorldPosition(V()), 0xF2C94C, 40, 4, 0.9); mini(`★ ${t(UI.star)} ${save.s.length}/40`); if (save.s.length === 40) toast(t(UI.allStars)); } }
      // compass
      const tg = currentTarget(), v = tmp.copy(tg.dir).sub(pDir); v.addScaledVector(pDir, -v.dot(pDir));
      const sr = tmp2.crossVectors(camFwd, pDir), ang = Math.atan2(v.dot(sr), v.dot(camFwd));
      $('arrow').style.transform = `rotate(${ang}rad)`;
      $('target').textContent = `${guide ? t(UI.guide) : save.d.length === SVCS.length ? t(UI.back) : t(UI.next)}: ${t(tg.name)}`;
      $('dist').textContent = `${Math.round(pDir.angleTo(tg.dir)*R*2)} m`;
      if (guide && pDir.angleTo(guide.dir)*R < guide.r + 3) guide = null;
    } else $('prompt').hidden = true;
  }
  updateBursts(dt); animateCars(now); fitSpritesFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize(){ const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.fov = w < h ? 66 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); if (window.visualViewport) visualViewport.addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250));

/* ---------- start ---------- */
$('begin').onclick = () => {
  if (state !== 'title') return;
  Sfx.init(); Sfx.open(); camera.position.copy(pDir).multiplyScalar(R*2.7).addScaledVector(camFwd, -R); $('title').hidden = true; $('hud').hidden = false; $('jbtn').hidden = false; state = 'intro'; introT = 0; canvas.focus();
};
function introDone(){
  setTimeout(() => { const k = $('keys'); if (k) k.style.transition = 'opacity 1s', k.style.opacity = 0; }, 20000);
  const first = !save.d.length && !save.p.length;
  const lines = first ? [L("Looks like I overslept… today's deliveries won't deliver themselves.", "شكلي نمت كتير… توصيلات النهارده مش هتوصّل نفسها."),
                         L("Eight briefs in my bag — one for each Planet studio. The compass up top points to the next one, and the journal (J) has everything else.", "تمن بريفات في شنطتي — واحد لكل استوديو في Planet. البوصلة اللي فوق بتشاور على اللي جاي، والدفتر (J) فيه كل حاجة تانية.")]
                      : [L(`Back on the planet. ${save.d.length}/8 briefs delivered so far.`, `رجعت للكوكب تاني. سلّمت ${save.d.length}/8 بريفات لحد دلوقتي.`)];
  talk(UI.me, lines);
}

(async function boot(){
  applyLang(); syncSnd(); resize();
  const bar = $('loadbar'), setP = p => bar.style.width = Math.round(p*100) + '%';
  requestAnimationFrame(frame);
  await Promise.race([Promise.all([document.fonts.load('900 60px Orbitron'), document.fonts.load('700 50px IBM Plex Sans Arabic')]), new Promise(r => setTimeout(r, 2500))]);
  await loadModels(p => setP(p*0.55)); setP(0.6); await nextFrame();
  buildSky(); buildTerrain(); setP(0.72); await nextFrame();
  buildPois(); buildDistrictGates(); buildRoadside(); buildBillboards(); setP(0.8); await nextFrame();
  buildNature(); placeVehicles(); buildStars(); buildSkyLife(); if (typeof buildWorlds === 'function') buildWorlds(); spawnTraffic(); setP(0.92); await nextFrame();
  flush(); planet.children.forEach(o => { if (o.isSprite && !signs.includes(o) && !markers.includes(o)) cullList.push(o); if (o.isSprite && o.material.map === glowTex) lampHalos.push(o); }); applyDayNight(); spawn(); updateHud(); setP(1);
  await nextFrame();
  $('loading').style.opacity = 0; setTimeout(() => $('loading').hidden = true, 600);
  $('title').hidden = false; state = 'title'; $('begin').focus();
})();

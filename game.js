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
const R = 56;   // a bigger world: room to walk between districts, and sky to fly the shuttle over it
const canvas = $('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
/* sharpness follows the device: start high, and drop the pixel ratio a notch whenever frames run slow */
const DPR_MAX = Math.min(devicePixelRatio, isTouch ? 1.6 : 2), DPR_MIN = Math.min(DPR_MAX, 1);
let dprNow = Math.min(DPR_MAX, isTouch ? 1.35 : 1.75);
renderer.setPixelRatio(dprNow);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8FBCE3);
scene.fog = new THREE.Fog(0xC9DFD6, 90, 220);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
scene.add(camera);
/* light: a warm low sun that always rakes across the messenger from the same side (so every corner of the
   planet looks lit on purpose), a cool sky fill, and a faint fill from the camera so nothing goes muddy */
const camLight = new THREE.DirectionalLight(0xFFFFFF, 0.16); camLight.position.set(-5, 7, 9); camera.add(camLight);
const sunLight = new THREE.DirectionalLight(0xFFD9A0, 0.74); sunLight.position.set(-320, 220, -420); scene.add(sunLight); scene.add(sunLight.target);
const hemi = new THREE.HemisphereLight(0xC4DEFA, 0x6E7E48, 0.4); scene.add(hemi);
const SHADOWS = !isTouch;
if (SHADOWS){ renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048); const sc = sunLight.shadow.camera; sc.left = sc.bottom = -16; sc.right = sc.top = 16; sc.near = 1; sc.far = 90;
  sunLight.shadow.bias = -0.0008; sunLight.shadow.normalBias = 0.03; }

/* a soft ramp instead of hard bands: lit faces glow, the shadow side stays light and colourful (painted, not inked) */
/* cel shading in clear bands, like a hand-inked comic: a shadow tone, a mid tone and the lit tone,
   with only a sliver of blend between them so the edges stay crisp but never alias */
const grad = (() => { const n = 64, a = new Uint8Array(n); for (let i=0;i<n;i++){ const x = i/(n-1), s1 = Math.min(1, Math.max(0, (x - 0.33) / 0.05)), s2 = Math.min(1, Math.max(0, (x - 0.66) / 0.05));
    a[i] = Math.round(255 * (0.6 + 0.2 * s1 + 0.2 * s2)); }
  const tx = new THREE.DataTexture(a, n, 1, THREE.LuminanceFormat); tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.needsUpdate = true; return tx; })();
/* the house style, applied to every cel-shaded surface at once: a warm rim of light on the edges
   that face away from the camera, and a touch more colour. One shared shader, so one compile. */
const STYLE_FRAG = `
  { float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
    float rim = smoothstep(0.42, 0.0, ndv);
    gl_FragColor.rgb += rim * 0.16 * vec3(1.0, 0.92, 0.78);
    float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, 1.12);
    // split tone: shadows lean teal, highlights lean warm gold — the storybook look
    gl_FragColor.rgb += mix(vec3(-0.02, 0.015, 0.035), vec3(0.035, 0.018, -0.02), smoothstep(0.25, 0.85, lum)); }
  #include <tonemapping_fragment>`;
function houseStyle(s){ s.fragmentShader = s.fragmentShader.replace('#include <tonemapping_fragment>', STYLE_FRAG); }
THREE.MeshToonMaterial.prototype.onBeforeCompile = houseStyle;
const matCache = {};
const toon = c => matCache[c] || (matCache[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }));
const INK = new THREE.MeshBasicMaterial({ color: 0x2E3557, side: THREE.BackSide });
const basicCache = {};
const basic = c => basicCache[c] || (basicCache[c] = new THREE.MeshBasicMaterial({ color: c }));
function mesh(geo, color, out = 1){
  const m = new THREE.Mesh(geo, toon(color));
  // no ink outlines any more: shapes read through soft light and shadow, like a painted diorama
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
  const m = smooth01(Math.min(pd - 11, rd - 2.4) / 8);   // a wider flat apron round every place: no lakes at the door
  const n = rawN(d.x*R, d.y*R, d.z*R) * m;
  let h = 0;
  if (n > 0.82) h = -1.1; else if (n > 0.6) h = -(n-0.6)/0.22*1.1;
  else if (n < -0.32) h = Math.pow((-0.32-n)/1.25, 1.25)*6.5;
  return { n, h, pd, rd };
}
const heightAt = d => terrainInfo(d).h;
const SEA = -0.38;
const RING = 8.4;   // radius of the roundabout round every place (road centre line)
const RN = i => i === 0 ? 11.4 : RING;   // HQ is a big building: its roundabout is wider
const E0 = ei => RN(EDGES[ei][0]), E1 = ei => RN(EDGES[ei][1]);   // ring radius at either end of a road

/* ---------- static batching: many small meshes → a few big ones ---------- */
const planet = new THREE.Group(); scene.add(planet);
const buckets = new Map();
/* the planet is cut into six regions (cube faces) so whole regions on the far side get frustum-culled */
const _rp = new THREE.Vector3();
function regionOf(p){ const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z); return ax >= ay && ax >= az ? (p.x > 0 ? 0 : 1) : ay >= az ? (p.y > 0 ? 2 : 3) : (p.z > 0 ? 4 : 5); }
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
        g.applyMatrix4(o.matrixWorld); const id = target.uuid + key + regionOf(_rp.setFromMatrixPosition(o.matrixWorld));
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
    for (let i=0;i<geos.length;i+=4000){ const m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos.slice(i, i+4000)), mat); m.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = SHADOWS; target.add(m); }
  }
  buckets.clear();
}

/* ---------- terrain + ocean ---------- */
const DETAIL = isTouch ? 96 : 136;
let oceanMat = null;
function buildTerrain(){
  let g0 = new THREE.IcosahedronGeometry(1, DETAIL); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  g0 = THREE.BufferGeometryUtils.mergeVertices(g0, 1e-5);
  const P = g0.attributes.position, idx = g0.index.array, nv = P.count;
  const vh = new Float32Array(nv), vn = new Float32Array(nv), vr = new Float32Array(nv), vp = new Float32Array(nv), vi = new Int16Array(nv), d = V();
  for (let i=0;i<nv;i++){ d.fromBufferAttribute(P, i).normalize(); const s = terrainInfo(d); vh[i] = s.h; vn[i] = s.n; vr[i] = s.rd; vp[i] = s.pd; vi[i] = poiDist(d)[1]; P.setXYZ(i, d.x, d.y, d.z); }
  const pos = new Float32Array(idx.length*3), col = new Float32Array(idx.length*3);
  const C = h => new THREE.Color(h);
  const G = [C(0x74B04F), C(0x66A247), C(0x84BC5A), C(0x5A9643)], road = C(0xA9A39A), curb = C(0xEDE6D8), tileA = C(0xF1E7D4), tileB = C(0xE4D5BC),
        sand = C(0xF0DDB0), foam = C(0xF6FBF8), seabed = C(0x6CC3C9), rock = C(0xC9B08C), rock2 = C(0xB59A78), snow = C(0xFFFFFF), meadow = C(0xB9CC62);
  const m = V();
  for (let f=0; f<idx.length; f+=3){
    const a = idx[f], b = idx[f+1], c = idx[f+2];
    const h = (vh[a]+vh[b]+vh[c])/3, n = (vn[a]+vn[b]+vn[c])/3, rd = Math.min(vr[a],vr[b],vr[c]), pd = (vp[a]+vp[b]+vp[c])/3;
    m.set(P.getX(a)+P.getX(b)+P.getX(c), P.getY(a)+P.getY(b)+P.getY(c), P.getZ(a)+P.getZ(b)+P.getZ(c)).multiplyScalar(R/3);
    let cl;
    const RR = RN(vi[a]), ringD = Math.abs(pd - RR);
    if (pd < RR - 1.45) cl = ((Math.floor(m.x*1.3)+Math.floor(m.y*1.3)+Math.floor(m.z*1.3)) & 1) ? tileA : tileB;   // the paved square
    else if (ringD < 1.1) cl = road; else if (ringD < 1.45) cl = curb;                                                // the roundabout
    else if (rd < 1.1 && pd > RR) cl = road; else if (rd < 1.45 && pd > RR) cl = curb;
    else if (h < SEA - 0.05) cl = seabed; else if (h < SEA + 0.18) cl = foam; else if (n > 0.48) cl = sand;
    else if (h > 4.6) cl = snow; else if (h > 2.6) cl = (f/3)%3 ? rock : rock2;
    else { const k = Math.sin(m.x*0.33+1)*Math.sin(m.z*0.29) + Math.sin(m.y*0.41+m.x*0.17)*0.5; cl = k > 0.95 ? meadow : k > 0.2 ? G[2] : k > -0.45 ? G[0] : G[1]; }
    [a,b,c].forEach((v,k) => { const r = R + vh[v]; pos[(f+k)*3] = P.getX(v)*r; pos[(f+k)*3+1] = P.getY(v)*r; pos[(f+k)*3+2] = P.getZ(v)*r; cl.toArray(col, (f+k)*3); });
  }
  // split into six chunks by region so the far side of the planet is culled instead of drawn
  const terrMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad }), chunks = [[],[],[],[],[],[]], cp = V();
  for (let f = 0; f < pos.length; f += 9){ cp.set(pos[f]+pos[f+3]+pos[f+6], pos[f+1]+pos[f+4]+pos[f+7], pos[f+2]+pos[f+5]+pos[f+8]); chunks[regionOf(cp)].push(f); }
  for (const list of chunks){ if (!list.length) continue; const P2 = new Float32Array(list.length*9), C2 = new Float32Array(list.length*9);
    list.forEach((f, i) => { P2.set(pos.subarray(f, f+9), i*9); C2.set(col.subarray(f, f+9), i*9); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g.setAttribute('color', new THREE.BufferAttribute(C2, 3)); g.computeVertexNormals();
    const terr = new THREE.Mesh(g, terrMat); terr.matrixAutoUpdate = false; terr.receiveShadow = SHADOWS; planet.add(terr); }
  // ocean with gentle waves
  oceanMat = new THREE.MeshToonMaterial({ color: 0x3FB0C4, gradientMap: grad, transparent: true, opacity: 0.84 });
  oceanMat.onBeforeCompile = s => { houseStyle(s); s.uniforms.uT = { value: 0 }; oceanMat.userData.s = s;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * (sin(position.x*0.9+uT*1.3)*sin(position.z*0.8+uT)*0.06);'); };
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(R + SEA, isTouch ? 80 : 112, isTouch ? 56 : 80), oceanMat));
}

/* ---------- sky ---------- */
function buildSky(){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0,0,0,1024); gr.addColorStop(0,'#2A7FC4'); gr.addColorStop(.3,'#5FA9D8'); gr.addColorStop(.44,'#A6D4E2'); gr.addColorStop(.5,'#F6E2B2'); gr.addColorStop(.56,'#B8DCD8'); gr.addColorStop(1,'#3E86BE');
  x.fillStyle = gr; x.fillRect(0,0,2048,1024);
  // painted cloud banks, soft and layered like a gouache sky
  const puff = (cx,cy,w) => { for (let i=0;i<9;i++){ const r = w*(0.18+rnd()*0.22), px = cx + (rnd()-0.5)*w, py = cy + (rnd()-0.5)*w*0.18;
      const g = x.createRadialGradient(px,py-r*0.2,0,px,py,r); g.addColorStop(0,'rgba(255,255,255,.78)'); g.addColorStop(.7,'rgba(255,255,255,.42)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px,py,r,0,7); x.fill(); }
    x.fillStyle = 'rgba(150,185,220,.18)'; x.fillRect(cx - w*0.5, cy + w*0.06, w, 3); };
  for (let i=0;i<10;i++) puff(rnd()*2048, 380 + rnd()*240, 120 + rnd()*170);
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
  if (sunSprite){ sunSprite.material.color.set(n ? 0xCFE0FF : 0xFFE7B8); sunSprite.scale.setScalar(n ? 90 : 170); }
  if (nightStars) nightStars.visible = n;
  scene.background.set(n ? 0x141B3D : 0x9FCFE0); scene.fog.color.set(n ? 0x1E2752 : 0xC9DFD6);
  hemi.intensity = n ? 0.3 : 0.4; sunLight.intensity = n ? 0.22 : 0.74; sunLight.color.set(n ? 0x9DB4FF : 0xFFD9A0); camLight.intensity = n ? 0.3 : 0.16;
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
/* storybook nature, after the reference art: trees with thick twisting trunks that taper and flare into
   roots, soft round canopies in layered greens, and moss hanging off the branches */
function taperTube(curve, r0, r1, segs = 10, radial = 7){
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), P = g.attributes.position, c = V(), p = V();
  for (let i = 0; i <= segs; i++){ curve.getPointAt(i / segs, c); const r = r0 + (r1 - r0) * (i / segs);
    for (let k = 0; k <= radial; k++){ const vi = i * (radial + 1) + k; p.fromBufferAttribute(P, vi).sub(c).multiplyScalar(r).add(c); P.setXYZ(vi, p.x, p.y, p.z); } }
  g.computeVertexNormals(); return g;
}
const LEAF = [0x4F8F4A, 0x5FA052, 0x6DAE58, 0x447F45], BARK = [0x7A5A43, 0x6B4E3A, 0x86664B];
function canopyBlob(g, x, y, z, r, col, sq = 0.78){ const b = mesh(new THREE.SphereGeometry(r, 14, 10), col); b.position.set(x, y, z); b.scale.set(1, sq, 1); g.add(b); return b; }
function mossStrands(g, x, y, z, spread, n){ for (let i = 0; i < n; i++){ const L = 0.5 + rnd() * 1.1, m = mesh(new THREE.CylinderGeometry(0.025, 0.012, L, 5), rnd() < 0.5 ? 0x7C9C3E : 0x6A8C38);
  m.position.set(x + (rnd() - 0.5) * spread, y - L / 2, z + (rnd() - 0.5) * spread); g.add(m); } }
function tree(k){
  const g = new THREE.Group(), h = 2.2 + rnd() * 1.8;
  if (k === 0){ // a soft conifer
    const tr = mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.0, 8), BARK[1]); tr.position.y = 0.5; g.add(tr);
    [0, 1, 2, 3].forEach(i => { const c = mesh(new THREE.ConeGeometry(1.05 - i * 0.22, h * 0.42, 12), [0x3E7A55, 0x478760, 0x51936A, 0x5C9E72][i]); c.position.y = 1.0 + i * h * 0.22; g.add(c); });
    return g; }
  if (k === 2){ // a blossom tree
    const cur = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.15, 0.8, 0.05), V(-0.1, 1.5, 0)]); g.add(mesh(taperTube(cur, 0.17, 0.08), BARK[0]));
    [[0, 1.9, 0, 0.8], [0.45, 1.7, 0.2, 0.55], [-0.4, 1.75, -0.15, 0.58], [0.05, 2.3, 0, 0.5]].forEach(([x, y, z, r], i) => canopyBlob(g, x, y, z, r, i % 2 ? 0xF2B8CB : 0xE9A0B8, 0.85));
    return g; }
  // the storybook broadleaf: a leaning, twisting trunk, root flares, big soft canopy, hanging moss
  const lean = (rnd() - 0.5) * 0.9, top = V(lean, h * 0.62, (rnd() - 0.5) * 0.5);
  const cur = new THREE.CatmullRomCurve3([V(0, -0.1, 0), V(-lean * 0.4, h * 0.22, 0.08), V(lean * 0.3, h * 0.42, -0.06), top]);
  g.add(mesh(taperTube(cur, 0.26, 0.11, 12, 8), BARK[(rnd() * 3) | 0]));
  for (let r = 0; r < 4; r++){ const a = r / 4 * Math.PI * 2 + rnd(); const rc = new THREE.CatmullRomCurve3([V(0, 0.45, 0), V(Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3), V(Math.cos(a) * 0.62, -0.05, Math.sin(a) * 0.62)]);
    g.add(mesh(taperTube(rc, 0.12, 0.04, 5, 6), BARK[0])); }
  // a side branch
  { const a = rnd() * 6, bc = new THREE.CatmullRomCurve3([top.clone().multiplyScalar(0.7), V(Math.cos(a) * 0.7, h * 0.6, Math.sin(a) * 0.7), V(Math.cos(a) * 1.1, h * 0.72, Math.sin(a) * 1.1)]);
    g.add(mesh(taperTube(bc, 0.08, 0.04, 5, 6), BARK[1])); canopyBlob(g, Math.cos(a) * 1.15, h * 0.78, Math.sin(a) * 1.15, 0.62, LEAF[2]); }
  const cy = h * 0.72 + 0.4, col = LEAF[(rnd() * 4) | 0];
  canopyBlob(g, top.x, cy, top.z, 1.05, col);
  [[0.7, -0.1, 0.3, 0.75], [-0.65, -0.05, -0.25, 0.72], [0.15, 0.45, -0.1, 0.7], [-0.2, -0.15, 0.6, 0.6]].forEach(([x, y, z, r], i) => canopyBlob(g, top.x + x, cy + y, top.z + z, r, i % 2 ? LEAF[2] : col));
  mossStrands(g, top.x, cy - 0.55, top.z, 1.5, 4 + ((rnd() * 4) | 0));
  return g;
}
/* a giant tree that arches right over a road, like the gateway in the reference */
function archTree(span, hgt){
  const g = new THREE.Group();
  const cur = new THREE.CatmullRomCurve3([V(-span, -0.2, 0), V(-span * 0.85, hgt * 0.55, 0.3), V(-span * 0.35, hgt, -0.2), V(span * 0.3, hgt * 1.02, 0.25), V(span * 0.85, hgt * 0.55, -0.3), V(span, -0.2, 0)]);
  const tube = taperTube(cur, 0.75, 0.75, 40, 10), P = tube.attributes.position;   // thick at both feet, slimmer over the top
  { const c = V(), p = V(); for (let i = 0; i <= 40; i++){ cur.getPointAt(i / 40, c); const f = 0.5 + 0.5 * Math.abs(i / 20 - 1) ** 1.6;
      for (let k = 0; k <= 10; k++){ const vi = i * 11 + k; p.fromBufferAttribute(P, vi).sub(c).multiplyScalar(f).add(c); P.setXYZ(vi, p.x, p.y, p.z); } } tube.computeVertexNormals(); }
  g.add(mesh(tube, 0x6E5440));
  [-1, 1].forEach(sd => { for (let r = 0; r < 3; r++){ const a = r * 2.1 + sd; const rc = new THREE.CatmullRomCurve3([V(sd * span, 1.0, 0), V(sd * span + Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7), V(sd * span + Math.cos(a) * 1.4, -0.1, Math.sin(a) * 1.4)]);
    g.add(mesh(taperTube(rc, 0.32, 0.08, 6, 6), 0x6E5440)); } });
  for (let i = 0; i < 7; i++){ const t = 0.22 + i / 6 * 0.56, pt = cur.getPointAt(t); canopyBlob(g, pt.x, pt.y + 0.7, pt.z + (rnd() - 0.5) * 0.8, 1.1 + rnd() * 0.6, LEAF[i % 4], 0.7);
    mossStrands(g, pt.x, pt.y - 0.3, pt.z, 1.2, 3); }
  return g;
}
/* weathered sandstone with a cap of moss */
function rockGeo(r, seed){ let g = new THREE.IcosahedronGeometry(r, 1); g = g.toNonIndexed(); const P = g.attributes.position, p = V();
  const key = q => `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`, off = {};
  for (let i = 0; i < P.count; i++){ p.fromBufferAttribute(P, i); const kk = key(p); if (off[kk] === undefined) off[kk] = 0.78 + rnd() * 0.42; p.multiplyScalar(off[kk]); P.setXYZ(i, p.x, p.y, p.z); }
  g.computeVertexNormals(); return g; }
function rock(size, mossy = true){ const g = new THREE.Group(), geo = rockGeo(size); const r = mesh(geo, rnd() < 0.5 ? 0xD3A56E : 0xC4925C); r.scale.y = 0.72; r.position.y = size * 0.38; g.add(r);
  if (mossy){ const m = mesh(geo.clone(), 0x7FA84A); m.scale.set(0.98, 0.3, 0.98); m.position.y = size * 0.66; g.add(m); } return g; }
function rockPillar(hgt){ const g = new THREE.Group(); let y = 0, w = 1.6;
  while (y < hgt){ const s = w * (0.8 + rnd() * 0.3); const r = mesh(rockGeo(s), [0xD9A96A, 0xC98F55, 0xE0B47A][(rnd() * 3) | 0]); r.scale.y = 0.62; r.position.set((rnd() - 0.5) * 0.4, y + s * 0.5, (rnd() - 0.5) * 0.4); g.add(r); y += s * 0.95; w *= 0.86; }
  const cap = mesh(rockGeo(w * 1.3), 0x7FA84A); cap.scale.y = 0.35; cap.position.y = y + 0.1; g.add(cap); mossStrands(g, 0, y, 0, w * 1.6, 5); return g; }
function crystals(){ const g = new THREE.Group(); const base = mesh(rockGeo(0.45), 0x8A7A6A); base.scale.y = 0.5; g.add(base);
  for (let i = 0; i < 5; i++){ const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), basic(i % 2 ? 0x7FF0E0 : 0xA6F6EC)); c.scale.set(0.7, 2.4 + rnd() * 1.6, 0.7);
    c.position.set((rnd() - 0.5) * 0.6, 0.45 + c.scale.y * 0.1, (rnd() - 0.5) * 0.6); c.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); g.add(c); } return g; }
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

/* soft-edged boxes: every wall and roof slab gets a rounded bevel so it catches light like a painted
   diorama instead of reading as a sharp CAD block. Thin trim stays a plain box (the bevel would vanish). */
const _rbCache = new Map();
function RB(w, h, d){
  const m = Math.min(w, h, d); if (m < 0.3) return new THREE.BoxGeometry(w, h, d);
  const key = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3); if (_rbCache.has(key)) return _rbCache.get(key);
  const b = Math.min(0.13, m * 0.16), sw = w - 2*b, sh = h - 2*b, rc = Math.min(b, sw/2 - 0.001, sh/2 - 0.001);
  const sp = new THREE.Shape(), x0 = -sw/2, y0 = -sh/2;
  sp.moveTo(x0 + rc, y0); sp.lineTo(x0 + sw - rc, y0); sp.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + rc);
  sp.lineTo(x0 + sw, y0 + sh - rc); sp.quadraticCurveTo(x0 + sw, y0 + sh, x0 + sw - rc, y0 + sh);
  sp.lineTo(x0 + rc, y0 + sh); sp.quadraticCurveTo(x0, y0 + sh, x0, y0 + sh - rc); sp.lineTo(x0, y0 + rc); sp.quadraticCurveTo(x0, y0, x0 + rc, y0);
  const depth = Math.max(0.001, d - 2*b);
  const g = new THREE.ExtrudeGeometry(sp, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 3 });
  g.translate(0, 0, -depth/2); g._rb = true; _rbCache.set(key, g); return g;
}
/* ---------- buildings ---------- */
function building(kind){
  const g = new THREE.Group(); let r = 2.2;
  const body = (w,h,d,col,y=0) => { const m = mesh(RB(w,h,d), col); m.position.y = y + h/2; g.add(m); return m; };
  const door = z => { const m = mesh(RB(0.6,1.0,0.1), 0x12153A, 0); m.position.set(0,0.5,z); g.add(m); const k = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,4), basic(0xF2C94C)); k.position.set(0.18,0.5,z+0.06); g.add(k); };
  const win = (x,y,z,s=0.44) => { const f = mesh(RB(s+0.1,s+0.1,0.06), 0xF4F7FC, 0); f.position.set(x,y,z); g.add(f); const m = new THREE.Mesh(RB(s,s,0.08), basic(0xFFE29A)); m.position.set(x,y,z+0.01); g.add(m); };
  const pyr = (s,h,y,col) => { const m = mesh(new THREE.ConeGeometry(s,h,4), col); m.rotation.y = Math.PI/4; m.position.y = y + h/2; g.add(m); };
  const tank = (x,y,z) => { const m = mesh(new THREE.CylinderGeometry(0.3,0.3,0.55,10), 0xF4F7FC); m.position.set(x,y+0.28,z); g.add(m); };
  const dish = (x,y,z) => { const d = mesh(new THREE.SphereGeometry(0.35,12,8,0,Math.PI*2,0,Math.PI/2), 0xDCE2EE); d.rotation.x = -1; d.position.set(x,y+0.25,z); g.add(d); };
  const awning = (w,y,z,col) => { const a = mesh(RB(w,0.07,0.6), col); a.position.set(0,y,z+0.25); a.rotation.x = 0.35; g.add(a); };
  switch (kind){
    case 'hq': body(4.4,3,3.8,0xF4F7FC); door(1.91); win(-1.3,1.9,1.91); win(1.3,1.9,1.91); win(-1.3,0.9,1.91,0.5);
      { const d = mesh(new THREE.SphereGeometry(1.8,24,12,0,Math.PI*2,0,Math.PI/2), 0x2E6BA9); d.position.y = 3; g.add(d);
        const a = mesh(new THREE.CylinderGeometry(0.06,0.06,1.6), 0x12153A, 0); a.position.y = 5.4; g.add(a);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.24,12,8), basic(0xF2C94C)); b.position.y = 6.25; g.add(b); } r = 3.1; break;
    case 'tower': body(2.2,4.2,2.2,0xF4F7FC); door(1.11); win(0,2.2,1.11); win(0,3.3,1.11); win(0.9,3.3,1.11,0.3); pyr(1.8,1.5,4.2,0x2E6BA9);
      { const f = mesh(new THREE.CylinderGeometry(0.04,0.04,1.3), 0x12153A, 0); f.position.y = 6.3; g.add(f); const fl = mesh(RB(0.7,0.4,0.05), 0xF2C94C); fl.position.set(0.36,6.7,0); g.add(fl); } awning(1.2,1.2,1.1,0xF2C94C); break;
    case 'house': body(3,2,2.6,0xF4F7FC); door(1.31); win(-0.95,1.2,1.31); win(0.95,1.2,1.31); pyr(2.3,1.5,2,0x2E6BA9);
      { const ch = mesh(RB(0.35,0.8,0.35), 0xE76F51); ch.position.set(0.8,3.0,-0.4); g.add(ch); } awning(1.0,1.15,1.3,0xF2C94C); break;
    case 'screen': body(3.2,2.4,2.4,0xE4EBF6); door(1.21); win(-1.05,1.4,1.21); tank(-0.9,2.4,-0.6); dish(0.9,2.4,-0.6);
      { const s = mesh(RB(2.6,1.5,0.14), 0x12153A); s.position.set(0,3.6,0.2); g.add(s); const s2 = new THREE.Mesh(RB(2.3,1.2,0.16), basic(0x5FA0E6)); s2.position.set(0,3.6,0.22); g.add(s2);
        const h = new THREE.Mesh(RB(0.5,0.4,0.18), basic(0xE76F51)); h.position.set(-0.6,3.7,0.24); g.add(h);
        const p = mesh(new THREE.CylinderGeometry(0.08,0.08,0.9), 0x12153A, 0); p.position.set(0,2.75,0.2); g.add(p); } awning(1.0,1.15,1.2,0x2E6BA9); break;
    case 'billboard': body(2.6,1.8,2.4,0xF4F7FC); door(1.21); win(0.8,1.1,1.21); tank(-0.7,1.8,0.3);
      [-1,1].forEach(x => { const p = mesh(new THREE.CylinderGeometry(0.08,0.08,2.8), 0x12153A, 0); p.position.set(x,2.6,-0.8); g.add(p); });
      { const b = mesh(RB(3.6,1.7,0.18), 0xF2C94C); b.position.set(0,4.0,-0.8); g.add(b); const s = new THREE.Mesh(RB(3.2,1.3,0.2), basic(0x2E6BA9)); s.position.set(0,4.0,-0.79); g.add(s);
        const st = new THREE.Mesh(new THREE.CircleGeometry(0.45,5), basic(0xF2C94C)); st.position.set(0,4.0,-0.68); g.add(st); } r = 2.4; break;
    case 'studio': body(3.4,2,2.8,0xF4F7FC); door(1.41); win(-1.1,1.2,1.41);
      { const roof = mesh(new THREE.CylinderGeometry(1.4,1.4,3.4,16,1,false,0,Math.PI), 0x2E6BA9); roof.rotation.z = Math.PI/2; roof.position.y = 2; g.add(roof);
        const cam = mesh(RB(0.7,0.5,0.9), 0x12153A); cam.position.set(2.1,0.9,1.6); g.add(cam); const l = mesh(new THREE.CylinderGeometry(0.22,0.22,0.3,12), 0x8FB4E3); l.rotation.x = Math.PI/2; l.position.set(2.1,0.9,2.15); g.add(l);
        const tri = mesh(new THREE.CylinderGeometry(0.03,0.03,0.7), 0x12153A, 0); tri.position.set(2.1,0.35,1.6); g.add(tri);
        const clap = mesh(RB(0.5,0.35,0.05), 0x12153A); clap.position.set(-1.6,0.6,1.5); clap.rotation.y = 0.4; g.add(clap); } r = 2.5; break;
    case 'dome': { const d = mesh(new THREE.SphereGeometry(1.9,24,12,0,Math.PI*2,0,Math.PI/2), 0xF4F7FC); g.add(d); door(1.85);
      const ring = mesh(new THREE.TorusGeometry(1.92,0.13,8,32), 0x2E6BA9, 0); ring.rotation.x = Math.PI/2; ring.position.y = 0.7; g.add(ring);
      const top = mesh(new THREE.CylinderGeometry(0.3,0.3,0.4,12), 0x2E6BA9); top.position.y = 2.0; g.add(top); } r = 2.3; break;
    case 'lab': body(2.8,1.6,2.8,0xE4EBF6); door(1.41); win(0.9,1.0,1.41);
      { const d = mesh(new THREE.SphereGeometry(1.15,16,10,0,Math.PI*2,0,Math.PI/2), 0x8FB4E3); d.position.y = 1.6; g.add(d);
        const ds = mesh(new THREE.SphereGeometry(0.8,16,8,0,Math.PI*2,0,Math.PI/2), 0xF2C94C); ds.rotation.x = -0.9; ds.position.set(1.3,2.6,-0.6); g.add(ds);
        for (let i=0;i<3;i++){ const k = mesh(RB(0.7,1.0,0.5), [0x2E6BA9,0xF2C94C,0x3E8E7E][i]); k.position.set(-1.6+i*1.6,0.5,2.6); g.add(k); const sc = new THREE.Mesh(RB(0.5,0.35,0.02), basic(0xBFE0FF)); sc.position.set(-1.6+i*1.6,0.7,2.86); g.add(sc); } } r = 2.4; break;
    case 'academy': body(4.2,2.2,2.6,0xF4F7FC); door(1.31); [-1.4,-0.7,0.7,1.4].forEach(x => win(x,1.3,1.31,0.4)); pyr(2.9,1.2,2.2,0xE76F51);
      { const bell = mesh(RB(0.8,1.0,0.8), 0xF4F7FC); bell.position.set(0,3.6,0); g.add(bell); const bp = mesh(new THREE.ConeGeometry(0.65,0.6,4), 0xE76F51); bp.rotation.y = Math.PI/4; bp.position.set(0,4.4,0); g.add(bp);
        const board = mesh(RB(1.4,0.9,0.08), 0x2F4F3A); board.position.set(-2.8,0.9,1.3); board.rotation.y = 0.5; g.add(board); } r = 2.9; break;
    case 'terminal': body(4.4,1.6,2.4,0xF4F7FC); door(1.21); [-1.5,-0.5,0.5,1.5].forEach(x => win(x,1.0,1.21,0.5));
      { const tw = mesh(new THREE.CylinderGeometry(0.35,0.5,3.4,8), 0xE4EBF6); tw.position.set(-1.6,3.3,-0.4); g.add(tw);
        const cab = mesh(new THREE.CylinderGeometry(0.85,0.6,0.8,8), 0x2E6BA9); cab.position.set(-1.6,5.2,-0.4); g.add(cab);
        const rw = new THREE.Mesh(RB(2.2,0.04,9), basic(0x3A4262)); rw.position.set(3.6,0.03,0); g.add(rw);
        for (let i=-3;i<=3;i++){ const s = new THREE.Mesh(RB(0.15,0.05,0.7), basic(0xF4F7FC)); s.position.set(3.6,0.05,i*1.2); g.add(s); }
        { const pl = makePlane(); pl.position.set(3.6,0.55,-2.5); g.add(pl); } } r = 2.7; break;
    case 'gallery': body(5,2,2,0xF4F7FC);
      [-1.7,0,1.7].forEach((x,i) => { const fr = mesh(RB(1.4,1.2,0.12), 0x12153A); fr.position.set(x,1.1,1.02); g.add(fr);
        const art = new THREE.Mesh(RB(1.2,1.0,0.14), basic([0xF2C94C,0x2E6BA9,0xE76F51][i])); art.position.set(x,1.1,1.03); g.add(art);
        const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3,i+3), basic(0xF4F7FC)); blob.position.set(x+0.15,1.15,1.11); g.add(blob); });
      { const roof = mesh(RB(5.4,0.2,2.4), 0x2E6BA9); roof.position.y = 2.1; g.add(roof); } r = 3.0; break;
    case 'garden': for (let i=0;i<10;i++){ const a = i/10*Math.PI*2; if (i===0) continue; const h = mesh(RB(1.4,0.7,0.5), 0x4E8C58); h.position.set(Math.sin(a)*3.8,0.35,Math.cos(a)*3.8); h.rotation.y = a; g.add(h); }
      { const arch = mesh(new THREE.TorusGeometry(1.0,0.12,8,20,Math.PI), 0xF4F7FC); arch.position.set(0,1.1,3.8); g.add(arch); const tr = tree(2); g.add(tr); } r = 1.2; break;
    case 'monument': { const base = mesh(new THREE.CylinderGeometry(1.8,2.1,0.6,8), 0xDCE2EE); base.position.y = 0.3; g.add(base);
      for (let i=0;i<7;i++){ const b = mesh(RB(1.4-i*0.12,0.9,1.4-i*0.12), [0xF4F7FC,0x2E6BA9,0xF2C94C,0xF4F7FC,0x2E6BA9,0xE76F51,0xF4F7FC][i]); b.position.y = 1.05 + i*0.9; b.rotation.y = i*0.25; g.add(b); }
      const st = mesh(new THREE.OctahedronGeometry(0.5,0), 0xF2C94C); st.position.y = 7.5; g.add(st); } r = 2.2; break;
    case 'fountain': { const basin = mesh(new THREE.CylinderGeometry(2.4,2.6,0.6,20), 0xDCE2EE); basin.position.y = 0.3; g.add(basin);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.1,20), toon(0x5FA0E6)); water.position.y = 0.58; g.add(water);
      const col = mesh(new THREE.CylinderGeometry(0.25,0.35,1.6,10), 0xF4F7FC); col.position.y = 1.2; g.add(col);
      const bowl = mesh(new THREE.CylinderGeometry(0.9,0.4,0.35,14), 0xF4F7FC); bowl.position.y = 2.1; g.add(bowl);
      const spray = makeFountainSpray(); spray.position.y = 2.3; g.add(spray); } r = 2.8; break;
    case 'office': body(3.4,3.4,2.6,0xE4EBF6); door(1.31); [[-1.1,1.3],[1.1,1.3],[-1.1,2.5],[0,2.5],[1.1,2.5]].forEach(([x,y]) => win(x,y,1.31)); tank(-0.9,3.4,-0.5); dish(0.9,3.4,-0.5); awning(1.2,1.2,1.3,0xE76F51); break;
    case 'cafe': body(3,1.8,2.4,0xF7E9D4); door(1.21); win(-0.95,1.1,1.21); win(0.95,1.1,1.21); awning(3.2,1.7,1.25,0xE76F51);
      { const roof = mesh(RB(3.3,0.2,2.7), 0xB5835A); roof.position.y = 1.9; g.add(roof);
        [[-1.6,2.6],[1.6,2.6]].forEach(([x,z]) => { const tb = mesh(new THREE.CylinderGeometry(0.4,0.4,0.06,12), 0xF4F7FC); tb.position.set(x,0.75,z); g.add(tb); const l = mesh(new THREE.CylinderGeometry(0.05,0.05,0.75), 0x12153A, 0); l.position.set(x,0.38,z); g.add(l);
          const um = mesh(new THREE.ConeGeometry(0.9,0.4,8), [0xF2C94C,0x2E6BA9][x>0?1:0]); um.position.set(x,2.0,z); g.add(um); const up = mesh(new THREE.CylinderGeometry(0.03,0.03,1.3), 0x12153A, 0); up.position.set(x,1.4,z); g.add(up);
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,0.12,8), basic(0xF4F7FC)); cup.position.set(x+0.1,0.84,z); g.add(cup); }); } r = 2.3; break;
    case 'observatory': body(3,1.6,3,0xE4EBF6); door(1.51);
      { const d = mesh(new THREE.SphereGeometry(1.5,20,12,0,Math.PI*2,0,Math.PI/2), 0xF4F7FC); d.position.y = 1.6; g.add(d);
        const slit = mesh(RB(0.45,1.5,1.6), 0x12153A, 0); slit.position.set(0,2.3,0.3); slit.rotation.x = -0.6; g.add(slit);
        const tel = mesh(new THREE.CylinderGeometry(0.18,0.26,1.8,10), 0x2E6BA9); tel.position.set(0,3.0,0.6); tel.rotation.x = -0.7; g.add(tel); } r = 2.3; break;
    case 'resto': body(3.2,2,2.6,0xF7E9D4); door(1.31); win(-1.0,1.2,1.31); win(1.0,1.2,1.31); awning(3.4,1.85,1.35,0xE76F51);
      { const roof = mesh(RB(3.5,0.25,2.9), 0xB5835A); roof.position.y = 2.1; g.add(roof);
        const chim = mesh(new THREE.CylinderGeometry(0.18,0.18,0.8,8), 0x12153A); chim.position.set(1.1,2.6,-0.6); g.add(chim);
        [-1.7,1.7].forEach(x => { const tb = mesh(new THREE.CylinderGeometry(0.35,0.35,0.06,12), 0xF4F7FC); tb.position.set(x,0.7,2.3); g.add(tb); const l = mesh(new THREE.CylinderGeometry(0.05,0.05,0.7), 0x12153A, 0); l.position.set(x,0.35,2.3); g.add(l); }); } r = 2.3; break;
    case 'clinic': body(3.4,2.6,2.6,0xF4F7FC); door(1.31); [-1.1,1.1].forEach(x => win(x,1.4,1.31)); win(0,2.15,1.31,0.36);
      { const top = mesh(RB(3.6,0.2,2.8), 0x3E8E7E); top.position.y = 2.7; g.add(top);
        const cv = mesh(RB(0.9,0.3,0.12), 0x3E8E7E, 0); cv.position.set(0,3.25,0); g.add(cv); const ch = mesh(RB(0.3,0.9,0.12), 0x3E8E7E, 0); ch.position.set(0,3.25,0); g.add(ch); } r = 2.3; break;
    case 'kiosk': body(2.8,1.8,2.4,0xE4EBF6); door(1.21); win(0.9,1.1,1.21);
      { const gl = mesh(new THREE.SphereGeometry(0.9,16,12), 0x5FA0E6); gl.position.y = 2.9; g.add(gl); const rg = mesh(new THREE.TorusGeometry(1.1,0.06,6,24), 0xF2C94C, 0); rg.position.y = 2.9; rg.rotation.x = 1.2; g.add(rg);
        const st = mesh(new THREE.CylinderGeometry(0.1,0.1,0.5), 0x12153A, 0); st.position.y = 2.05; g.add(st); } r = 2.1; break;
    case 'glass': body(2.4,5.2,2.4,0x8FB4E3); door(1.21); for (let y=1.5;y<5;y+=0.9){ win(-0.55,y,1.21,0.42); win(0.55,y,1.21,0.42); }
      { const cap = mesh(RB(2.6,0.25,2.6), 0x12153A); cap.position.y = 5.3; g.add(cap); } r = 1.9; break;
    case 'shop': body(3.2,2.2,2.4,0xF4F7FC); door(1.21); { const sw = new THREE.Mesh(RB(2.4,0.9,0.08), basic(0xBFE0FF)); sw.position.set(0,1.0,1.22); g.add(sw); }
      awning(3.4,1.7,1.25,0xF2C94C); { const roof = mesh(RB(3.4,0.3,2.6), 0x12153A); roof.position.y = 2.35; g.add(roof); } r = 2.2; break;
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
/* ---------- client storefronts: each brand gets its own building in its colours ---------- */
const BRAND = { alashi: 0xCC2424, aljamalla: 0xF2A60C, alshawa: 0xE46C3C, alzaytouna: 0x1C7A48, belalhanif: 0x0C9CE4, 'best-one': 0x9C243C,
  fly29: 0x0C54B4, gms: 0xD9B21E, 'implant-gate': 0x0E6A6A, mavirealty: 0x2484CC, qidra: 0x8A2424, 'seha-practo': 0x3C849C, tadawa: 0x0C6C84,
  terhal: 0x3C9CE4, uber: 0x1F2230, unitedinvestment: 0x14304F, value: 0x0C546C, westeros: 0xE9B62C };
function brandColor(p){ const D = DISTRICTS[p.district]; return (p.client && BRAND[p.client.logo]) || (D ? D.color : 0x2E6BA9); }
function clientBuilding(p){
  const g = new THREE.Group(), bc = brandColor(p), seed = [...(p.client.logo || p.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const pick = (a, o = 0) => a[(seed + o) % a.length];
  const box = (w,h,d,col,x=0,y=0,z=0,out=1) => { const m = mesh(RB(w,h,d), col, out); m.position.set(x,y+h/2,z); g.add(m); return m; };
  const glow = (w,h,x,y,z,col=0xFFE29A) => { const m = new THREE.Mesh(RB(w,h,0.06), basic(col)); m.position.set(x,y,z); g.add(m); return m; };
  const win = (x,y,z,w=0.62,h=0.72,frame=0xF4F7FC,glass=0xFFE29A) => { box(w+0.12,h+0.12,0.08,frame,x,y-h/2-0.06,z,0); glow(w,h,x,y,z+0.03,glass);
    box(w+0.2,0.06,0.16,frame,x,y-h/2-0.12,z+0.04,0); box(0.04,h,0.07,frame,x,y-h/2,z+0.05,0); };
  const door = (z, col = bc, w = 0.72) => { box(w+0.2,1.32,0.1,col,0,0,z,0); box(w,1.18,0.12,0x23284D,0,0,z+0.01,0);
    glow(w-0.2,0.32,0,0.88,z+0.08,0xBFE3F2); const k = new THREE.Mesh(new THREE.SphereGeometry(0.045,6,4), basic(0xF2C94C)); k.position.set(w/2-0.12,0.6,z+0.1); g.add(k);
    box(w+0.5,0.1,0.5,0xDCD6C8,0,0,z+0.22,0); };
  const awning = (w,y,z,n=7) => { const sw = w/n; for (let i=0;i<n;i++){ const a = mesh(RB(sw,0.06,0.72), i%2 ? 0xF7F5EF : bc, 0); a.position.set(-w/2+sw*(i+0.5), y, z+0.3); a.rotation.x = 0.38; g.add(a); }
    const v = mesh(RB(w,0.16,0.04), bc, 0); v.position.set(0, y-0.18, z+0.64); g.add(v); };
  const plant = (x,z,s=1) => { box(0.36*s,0.34*s,0.36*s,0xC2643F,x,0,z,0); const b = mesh(new THREE.IcosahedronGeometry(0.3*s,0), pick([0x5FA86A,0x74B47E,0x4E9A55],x>0?1:0)); b.position.set(x,0.58*s,z); g.add(b); };
  const logoPanel = (y, z, s = 1.05) => { box(s+0.18,s+0.18,0.1,bc,0,y-(s+0.18)/2,z,0);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(s,s), new THREE.MeshBasicMaterial({ map: logoTex(p.client) })); lp.position.set(0,y,z+0.065); lp.userData.dyn = true; lp.userData.logo = true; g.add(lp); };
  let r = 2.3;
  switch (p.district){
    case 'food': { const W = 3.3, H = 2.35, D = 2.6, wall = pick([0xF7E6CC,0xF4DCC4,0xFBEEDB,0xEFE0C8]);
      box(W+0.3,0.18,D+0.3,0xE2DACB); box(W,H,D,wall,0,0.18);
      box(W+0.14,0.16,D+0.14,0xF7F5EF,0,0.18+H); door(D/2, bc); win(-1.08,1.25,D/2,0.7,0.78); win(1.08,1.25,D/2,0.7,0.78);
      awning(W+0.2,2.02,D/2); logoPanel(H+0.72, D/2-0.2, 0.9);
      { const rf = mesh(new THREE.ConeGeometry(2.55,1.05,4), pick([0xC2643F,0xB5835A,0x9C5A3C])); rf.rotation.y = Math.PI/4; rf.scale.set(1,1,0.86); rf.position.y = 0.18+H+0.16+0.52; g.add(rf); }
      { const ch = box(0.34,0.9,0.34,0x8C5A3C,1.0,H+0.3,-0.6); }
      for (let i=0;i<9;i++){ const b = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,4), basic(0xFFE7A0)); b.position.set(-W/2+0.25+i*(W-0.5)/8, 2.3 - Math.sin(i/8*Math.PI)*0.12, D/2+0.06); g.add(b); }
      [-1.3,1.3].forEach((x,k) => { const z = D/2+0.95; box(0.62,0.05,0.62,0xF7F5EF,x,0.68,z,0); box(0.06,0.68,0.06,0x23284D,x,0,z,0);
        box(0.05,1.35,0.05,0x23284D,x,0.72,z,0); const um = mesh(new THREE.ConeGeometry(0.62,0.32,8), k ? bc : 0xF7F5EF); um.position.set(x,2.12,z); g.add(um);
        [-0.42,0.42].forEach(dx => box(0.26,0.42,0.26,0x8C5A3C,x+dx,0,z,0)); });
      r = 2.4; break; }
    case 'health': { const W = 3.5, H = 2.7, D = 2.6;
      box(W+0.3,0.16,D+0.3,0xE6EAF0); box(W,H,D,0xF7FAFC,0,0.16); box(0.55,H+0.2,D+0.06,bc,-W/2+0.27,0.16);
      box(W+0.12,0.22,D+0.12,0xE9EEF4,0,0.16+H); door(D/2, bc, 0.9);
      glow(1.0,0.7,-1.0+0.25,1.35,D/2+0.02,0xCDEBF7); glow(0.9,0.7,1.1,1.35,D/2+0.02,0xCDEBF7); glow(2.6,0.42,0.2,2.3,D/2+0.02,0xCDEBF7);
      box(1.9,0.08,1.0,bc,0,1.66,D/2+0.42,0); [-0.85,0.85].forEach(x => box(0.07,1.66,0.07,0xDCE2EE,x,0,D/2+0.86,0));
      logoPanel(H+0.85, 0.3, 0.95);
      { const cx = W/2+0.02; const c1 = new THREE.Mesh(RB(0.1,0.62,0.2), basic(0x2FBF71)); c1.position.set(cx+0.03,2.05,0.6); g.add(c1); const c2 = new THREE.Mesh(RB(0.1,0.2,0.62), basic(0x2FBF71)); c2.position.set(cx+0.03,2.05,0.6); g.add(c2); }
      plant(-1.45,D/2+0.55); plant(1.45,D/2+0.55); box(1.2,0.1,0.9,0xDCD6C8,0,0,D/2+0.55,0);
      r = 2.4; break; }
    case 'travel': { const W = 3.1, H = 2.3, D = 2.5;
      box(W+0.3,0.16,D+0.3,0xE6E0D2); box(W,H,D,pick([0xFDF6EA,0xEAF4FB,0xF4F1FB]),0,0.16); box(W+0.14,0.18,D+0.14,bc,0,0.16+H);
      door(D/2, bc); win(-1.05,1.35,D/2,0.66,0.8,0xF4F7FC,0x9FD4F2); win(1.05,1.35,D/2,0.66,0.8,0xF4F7FC,0xFFD9A0);
      awning(W,2.05,D/2,5); logoPanel(H+0.62, D/2-0.12, 0.66);
      { const gl = mesh(new THREE.SphereGeometry(0.85,18,12), 0x5FA0E6); gl.position.y = H+1.35; g.add(gl);
        const l1 = mesh(new THREE.SphereGeometry(0.4,8,6), 0x74B47E, 0); l1.scale.set(1,0.6,0.5); l1.position.set(0.35,H+1.55,0.6); g.add(l1);
        const rg = mesh(new THREE.TorusGeometry(1.05,0.06,6,28), bc, 0); rg.position.y = H+1.35; rg.rotation.x = 1.2; g.add(rg);
        box(0.12,0.5,0.12,0x23284D,0,H+0.16,0,0); }
      [[1.55,0xE76F51,0.5],[1.85,bc,0.38],[1.62,0xF2C94C,0.3]].forEach(([x,c,h],k) => box(0.5,h,0.3,c,x,k===2?0.88:k===1?0.5:0,D/2+0.5,0));
      { const tail = mesh(RB(0.1,0.9,0.7), bc); tail.position.set(-W/2-0.05,H-0.2,0); tail.rotation.z = 0.15; g.add(tail); }
      { const pm = palm(); pm.scale.setScalar(0.62); pm.position.set(-1.6,0,D/2+0.6); g.add(pm); }
      r = 2.3; break; }
    case 'money': { const W = 2.5, D = 2.5, F = 5;
      box(W+0.5,0.2,D+0.5,0xDCE2EE);
      for (let f=0; f<F; f++){ const y = 0.2 + f*1.0; box(W,0.18,D,0xF4F7FC,0,y);
        const gc = f % 2 ? 0x8FC3E8 : 0x7AB2DE; const gb = new THREE.Mesh(RB(W-0.08,0.82,D-0.08), toon(gc)); gb.position.set(0,y+0.18+0.41,0); g.add(gb);
        [-0.42,0.42].forEach(x => glow(0.56,0.5,x,y+0.62,D/2-0.03,f===0?0xFFE29A:0xCFE9FA)); }
      [-W/2, -W/6, W/6, W/2].forEach(x => box(0.09,F*1.0,0.14,bc,x,0.2,D/2+0.02,0));
      box(W+0.16,0.3,D+0.16,bc,0,0.2+F*1.0); box(W*0.6,0.5,D*0.6,0xF4F7FC,0,0.5+F*1.0);
      box(1.6,0.08,0.8,bc,0,1.02,D/2+0.4,0); door(D/2, 0x23284D, 0.8);
      logoPanel(0.2+F*1.0+1.4, 0, 1.05);
      r = 1.9; break; }
    case 'shop': { const W = 3.3, H = 2.4, D = 2.5, wall = pick([0xF7F5EF,0xF5EEE3,0xEEF1F6]);
      box(W+0.3,0.16,D+0.3,0xE2DACB); box(W,H,D,wall,0,0.16); box(W+0.18,0.62,0.14,bc,0,0.16+H-0.05,D/2+0.02);
      box(W+0.1,0.28,D+0.1,0x23284D,0,0.16+H);
      door(D/2, 0x23284D, 0.7);
      [-1.12,1.12].forEach((x,k) => { box(1.15,1.25,0.08,0x23284D,x,0.42,D/2,0); glow(1.0,1.1,x,1.05,D/2+0.03,0xDDEFFB);
        [[ -0.28,0.34,bc],[0.12,0.26,0xF2C94C],[0.32,0.42,0xE9A0B8]].forEach(([dx,h,c]) => box(0.22,h,0.18,c,x+dx,0.5,D/2-0.12,0)); });
      awning(W+0.1,1.9,D/2,9); logoPanel(H+0.95, 0, 1.0);
      plant(-1.55,D/2+0.55,0.8); plant(1.55,D/2+0.55,0.8);
      r = 2.3; break; }
    default: { const W = 3.4, H = 2.5, D = 2.5;   // pro: a columned practice
      box(W+0.6,0.14,D+0.9,0xE6E0D2,0,0,0.2); box(W+0.3,0.14,D+0.6,0xEDE8DC,0,0.14,0.15);
      box(W,H,D,0xF4F1EA,0,0.28); box(W+0.2,0.2,D+0.2,bc,0,0.28+H);
      door(D/2, bc, 0.72); [-1.2,1.2].forEach(x => { win(x,1.45,D/2,0.5,0.95,0xF4F7FC,0xFFE29A); });
      [-1.5,-0.62,0.62,1.5].forEach(x => { const c = mesh(new THREE.CylinderGeometry(0.13,0.15,H,10), 0xFBFAF6); c.position.set(x,0.28+H/2,D/2+0.45); g.add(c); });
      box(W+0.3,0.18,0.62,0xFBFAF6,0,0.28+H-0.02,D/2+0.42,0);
      { const ped = mesh(new THREE.CylinderGeometry(1,1,1,3), bc); ped.rotation.set(-Math.PI/2, 0, 0); ped.scale.set((W+0.3)/1.732, 0.62, 0.5); ped.position.set(0,0.28+H+0.18+0.25,D/2+0.42); g.add(ped); }
      logoPanel(0.28+H+1.15, 0, 0.9);
      r = 2.4; break; }
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
function addObstacle(d, r, top){ obstacles.push({ d: d.clone().normalize(), r, top }); }   // top: climbable height (rocks, benches); undefined = a wall
function clearOf(d, minPoi = 9, minRoad = 2, minObs = 1.2){ const [pd] = poiDist(d); if (pd < minPoi) return false; if (roadDist(d) < minRoad) return false;
  for (const o of obstacles) if (d.dot(o.d) > Math.cos((minObs + o.r)/R)) return false; return true; }

function buildPois(){
  POIS.forEach((p, i) => {
    const dir = poiDirs[i], built = p.client ? clientBuilding(p) : building(p.kind), g = built.g; let r = built.r;
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
    const logos = []; g.traverse(o => { if (o.userData.logo) logos.push(o); });
    bake(g, planet); logos.forEach(o => cullList.push(o));
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
  for (const rec of cars){ const h = rec.car.userData.model && rec.car.userData.model.userData.hover; if (!h) continue;
    if (rec.car.userData.ship){ const flying = rec.car === car && riding, k = flying ? clamp(flyY / 3, 0, 1) : 0;
      h.position.y = k * Math.sin(now * 0.002) * 0.12; h.rotation.z += ((flying ? clamp(-turnRate * 0.12, -0.45, 0.45) : 0) - h.rotation.z) * 0.12; h.rotation.x += ((flying ? clamp(animSpeed * 0.006, 0, 0.14) : 0) - h.rotation.x) * 0.1;
      rec.car.userData.legs.scale.y = 1 - k * 0.92; rec.car.userData.glow.material.opacity = 0.35 + k * 0.5 + (flying ? Math.sin(now * 0.03) * 0.08 : 0); }
    else h.position.y = 0.12 + Math.sin(now * 0.003 + rec.car.id) * 0.06; }
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
/* a little Planet shuttle: board it and it lifts off — fly over the rooftops, Space (or the jump button)
   climbs higher, and it lands by itself before you step out */
function makeShip(col = 0xF2602F){
  const g = new THREE.Group(); g.userData.dyn = true; g.userData.ship = true;
  const m = new THREE.Group(), hov = new THREE.Group(); m.add(hov); m.userData.hover = hov; g.add(m); g.userData.model = m;
  const W = 0xF2F5FA, sm = (geo, c) => { const o = new THREE.Mesh(geo, toon(c)); o.castShadow = SHADOWS; return o; };
  const hullG = new THREE.SphereGeometry(1, 32, 20); hullG.scale(1.05, 0.5, 1.7);
  const hull = sm(hullG, W); hull.position.y = 0.9; hov.add(hull);
  const belly = sm(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), 0xC9D0DB); belly.scale.set(1.0, 0.36, 1.62); belly.position.y = 0.86; hov.add(belly);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), toon(col)); stripe.rotation.x = Math.PI/2; stripe.scale.set(1.07, 1.72, 1); stripe.position.y = 0.9; hov.add(stripe);
  const glassG = new THREE.SphereGeometry(0.62, 28, 16, 0, Math.PI*2, 0, Math.PI/2); glassG.scale(1, 0.85, 1.25);
  const canopy = new THREE.Mesh(glassG, new THREE.MeshPhongMaterial({ color: 0x8ED8F2, specular: 0xFFFFFF, shininess: 100, transparent: true, opacity: 0.45, depthWrite: false })); canopy.position.set(0, 1.2, 0.25); canopy.renderOrder = 3; hov.add(canopy);
  [-1, 1].forEach(sd => { const wingG = new THREE.BoxGeometry(1.15, 0.08, 0.7); const wing = sm(wingG, W); wing.position.set(sd*1.25, 0.82, -0.35); wing.rotation.z = sd * -0.18; wing.rotation.y = sd * 0.25; hov.add(wing);
    const tip = sm(new THREE.BoxGeometry(0.1, 0.36, 0.5), col); tip.position.set(sd*1.8, 0.95, -0.45); hov.add(tip);
    const pod = sm(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 16), 0xDDE2EA); pod.rotation.x = Math.PI/2; pod.position.set(sd*0.78, 0.72, -1.25); hov.add(pod);
    const fire = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), basic(0x7FE6FF)); fire.position.set(sd*0.78, 0.72, -1.71); fire.rotation.y = Math.PI; hov.add(fire); });
  const fin = sm(new THREE.BoxGeometry(0.08, 0.62, 0.7), col); fin.position.set(0, 1.35, -1.25); fin.rotation.x = -0.35; hov.add(fin);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); logo.position.set(0, 1.08, 1.38); logo.rotation.x = -0.75; hov.add(logo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7FE6FF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); glow.scale.set(2.2, 2.2, 1); glow.position.set(0, 0.72, -1.9); hov.add(glow); g.userData.glow = glow;
  // landing legs fold away in flight
  const legs = new THREE.Group(); [[-0.6, 0.7], [0.6, 0.7], [0, -1.0]].forEach(([x, z]) => { const l = sm(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), 0x7A8394); l.position.set(x, 0.32, z); legs.add(l);
    const f = sm(new THREE.CylinderGeometry(0.14, 0.16, 0.05, 12), 0x5A6274); f.position.set(x, 0.03, z); legs.add(f); }); hov.add(legs); g.userData.legs = legs;
  return g;
}
let flyY = 0, flyHigh = false, landing = false, flyTarget = 10.5, altBtn = 0;
const FLY_MIN = 2.5, FLY_MAX = 42;
let lastRide = null;   // { rec, at } — the car I last got out of, so I come back out beside it
/* where every Planet car was left, kept across visits: a car waits where you parked it */
function saveCarSpots(){ try { localStorage.setItem('pm-cars', JSON.stringify(cars.map(r => riding && r.car === car ? null : [r.tk.d.toArray().map(v => +v.toFixed(5)), new THREE.Vector3(0, 0, 1).applyQuaternion(r.car.quaternion).toArray().map(v => +v.toFixed(4))]))); } catch (e) {} }
function restoreCarSpots(){ let a = null; try { a = JSON.parse(localStorage.getItem('pm-cars') || 'null'); } catch (e) {}
  if (!Array.isArray(a)) return; a.forEach((x, i) => { const rec = cars[i]; if (!rec || !x || !Array.isArray(x[0])) return; const d = new THREE.Vector3().fromArray(x[0]).normalize(); if (!walkable(d)) return;
    const f = new THREE.Vector3().fromArray(x[1]); f.addScaledVector(d, -f.dot(d)); if (f.lengthSq() < 1e-6) return; parkCar(rec.car, d, f.normalize()); }); }
/* step out next to the car I arrived in (used when leaving a building or the office) */
let enterStamp = 0;
function besideMyCar(near, maxDist = 18){
  if (!lastRide || lastRide.at < enterStamp - 120000 || !lastRide.rec.car.parent || riding) return false;
  const d = lastRide.rec.tk.d; if (near && near.angleTo(d) * R > maxDist) return false;
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(lastRide.rec.car.quaternion); f.addScaledVector(d, -f.dot(d)).normalize();
  const side = V().crossVectors(d, f).normalize();
  for (const s of [1, -1, 1.6, -1.6]){ const nd = d.clone().addScaledVector(side, 2.2 * s / R).normalize(); if (walkable(nd)){ pDir.copy(nd); pFwd.copy(f); camFwd.copy(f); return true; } }
  return false;
}
let car = null, riding = false, rocket = null, rocketTk = null;
const cars = [];   // every parked Planet car: { car, tk }
function parkCar(c, d, fwd){
  c.parent && c.parent.remove(c); placeAt(c, d); faceToward(c, d.clone().addScaledVector(fwd, 0.1).normalize().multiplyScalar(R)); planet.add(c);
  let rec = cars.find(x => x.car === c);
  if (!rec){ rec = { car: c, tk: { d: d.clone(), r: 2.6, kind: 'car' } }; rec.tk.ref = rec; cars.push(rec); } else rec.tk.d.copy(d);
  if (!talkables.includes(rec.tk)) talkables.push(rec.tk);
  if (vehiclesReady) saveCarSpots();
}
let vehiclesReady = false;
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
  { // the shuttle waits on open grass behind HQ, clear of signs and billboards
    let sd = null; for (let k = 0; k < 24 && !sd; k++){ const a = Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k/2) * 0.32, dirv = tow.clone().applyAxisAngle(hq.dir, a);
      const d = hq.dir.clone().addScaledVector(dirv, (hq.r + 8 + (k % 3)) / R).normalize(); if (walkable(d) && clearOf(d, hq.r + 5, 3, 2.6)) sd = d; }
    if (!sd) sd = carSpotNear(hq, -1)[0];
    parkCar(makeShip(), sd, tow); }
  // more cars around the planet: one in every client district, so there is always a ride nearby
  const seen = new Set(); let k = 1;
  for (const p of pois){ if (!p.district || seen.has(p.district)) continue; seen.add(p.district);
    const [d, f] = carSpotNear(p, k % 2 ? -1 : 1); parkCar(makeCar(...CAR_COLORS[k % CAR_COLORS.length], k % 3 === 0), d, f); k++; }
  restoreCarSpots(); vehiclesReady = true;
}
function mountCar(rec){ car = rec.car; setTimeout(paintFutureBtn, 0); talkables.splice(talkables.indexOf(rec.tk), 1); riding = true; car.parent.remove(car); car.position.set(0,0,0); car.quaternion.identity(); player.add(car); Sfx.open(); $('ride').hidden = false;
  if (car.userData.ship){ flyY = 0; flyHigh = false; landing = false; flyTarget = 10.5; paintAltBtns(); rig.visible = true; rig.position.set(0, 0.62, 0.15); rig.scale.setScalar(0.82); camDist = Math.max(camDist, 9.5);
    $('ride').innerHTML = '🛸 ' + (lang === 'ar' ? 'انزل' : 'Land'); mini(lang === 'ar' ? '🛸 طير! Space أو ▲ يعلّي · Q أو ▼ ينزّل · E تهبط' : '🛸 Fly! Space or ▲ climbs · Q or ▼ descends · E lands'); }
  else { rig.visible = false; camDist = Math.max(camDist, 8); $('ride').innerHTML = '🚗 ' + (lang === 'ar' ? 'انزل' : 'Get out'); mini(lang === 'ar' ? '🚗 اضغط E عشان تنزل' : '🚗 Press E to get out'); } }
/* stepping out of the shuttle mid-air: it glides down first, then you hop out */
function requestDismount(){ if (car && car.userData.ship && flyY > 0.15){ landing = true; flyHigh = false; mini(lang === 'ar' ? '🛬 بننزل…' : '🛬 Landing…'); return; } dismount(); }
function dismount(){ lastRide = { rec: cars.find(r => r.car === car), at: performance.now() }; if (!lastRide.rec) lastRide = null; riding = false; altBtn = 0; landing = false; flyY = 0; rig.position.set(0, 0, 0); rig.scale.setScalar(1); setTimeout(paintFutureBtn, 0); player.remove(car); parkCar(car, pDir.clone(), pFwd.clone()); rig.visible = true; Sfx.close(); $('ride').hidden = true; paintAltBtns();
  // step out to the side of the car
  const side = V().crossVectors(pDir, pFwd).normalize(); pDir.addScaledVector(side, 2.2/R).normalize(); }
$('ride').onclick = () => { if (riding && state === 'play') requestDismount(); };
/* climb and descend buttons while flying the shuttle (hold to keep going) */
function paintAltBtns(){
  let w = $('altbtns');
  if (!w){ w = document.createElement('div'); w.id = 'altbtns'; w.innerHTML = '<button type="button" class="panel" data-a="1" aria-label="up">▲</button><button type="button" class="panel" data-a="-1" aria-label="down">▼</button><b id="altread"></b>'; document.body.appendChild(w);
    w.querySelectorAll('button').forEach(b => { const a = +b.dataset.a;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); altBtn = a; landing = false; b.setPointerCapture && b.setPointerCapture(e.pointerId); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => { if (altBtn === a) altBtn = 0; })); }); }
  w.hidden = !(riding && car && car.userData.ship);
}
/* while driving: switch between today's car and the one from the future */
function paintFutureBtn(){ let b = $('futurebtn');
  if (!b){ b = document.createElement('button'); b.id = 'futurebtn'; b.type = 'button'; b.className = 'panel tbtn'; const tl = document.querySelector('.tools'); if (tl) tl.prepend(b); else document.body.appendChild(b);
    b.onclick = () => { if (!riding || !car || !car.userData.car) return; setCarStyle(car, !car.userData.car.future); Sfx.open(); paintFutureBtn();
      burst(player.position.clone().addScaledVector(pDir, 1), car.userData.car.future ? 0x5FF2FF : 0xF2C94C, 30, 3, 0.7);
      mini(car.userData.car.future ? (lang === 'ar' ? '✨ عربية من المستقبل!' : '✨ A car from the future!') : (lang === 'ar' ? '🚗 رجعنا للعربية العادية' : '🚗 Back to a regular car')); }; }
  b.hidden = !riding || !car || !car.userData.car; if (riding && car && car.userData.car){ const fut = car.userData.car.future; b.textContent = fut ? '🚗' : '✨';
    const lbl = fut ? (lang === 'ar' ? 'عربية عادية' : 'Regular car') : (lang === 'ar' ? 'عربية المستقبل' : 'Future car'); b.title = lbl; b.setAttribute('aria-label', lbl); }
}

/* bumping into other cars: both get knocked apart, with a thump */
let knock = V(), knockT = 0, lastThump = 0;
function carObstacles(){
  const list = [];
  for (const rec of cars) if (rec.car !== car && rec.car.parent) list.push({ pos: rec.car.getWorldPosition(V()), rec });
  for (const v of vehicles) list.push({ pos: v.g.position.clone(), van: v });
  if (typeof bus !== 'undefined' && bus && bus.visible) list.push({ pos: bus.position.clone(), r: 3.4 });
  if (typeof peers !== 'undefined') for (const p of peers.values()) if (p.riding && p.g.visible && !p.ps) list.push({ pos: p.g.position.clone() });
  return list;
}
function carBump(dt){
  const me = player.position;
  for (const o of carObstacles()){
    const rr = o.r || 2.6, d = o.pos.distanceTo(me); if (d > rr || d < 1e-4) continue;
    // push us out along the ground, away from the other car
    const away = me.clone().sub(o.pos); const up2 = pDir; away.addScaledVector(up2, -away.dot(up2)).normalize();
    pDir.addScaledVector(away, (rr - d) / R).normalize();
    knock.copy(away).multiplyScalar(9); knockT = 0.35;
    // a parked car gets shoved too
    if (o.rec){ const od = o.pos.clone().normalize(), f = new THREE.Vector3(0, 0, 1).applyQuaternion(o.rec.car.getWorldQuaternion(new THREE.Quaternion()));
      od.addScaledVector(away, -0.9 / R).normalize(); if (walkable(od)) parkCar(o.rec.car, od, f); }
    if (o.van){ o.van.ghost = 1.2; o.van.kick = (o.van.kick || V()).addScaledVector(away, -1.1); o.van.spin = (o.van.spin || 0) + (Math.random() - 0.5) * 0.9; o.van.speed *= 0.2; }
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

/* road paint: a dashed centre line on every road, a zebra crossing where it meets each roundabout,
   and a dashed line round the roundabouts — so the streets read as streets, with places to cross */
function buildRoadMarks(){
  const white = basic(0xF4F1E8), dash = new THREE.BoxGeometry(0.14, 0.02, 0.9), zeb = new THREE.BoxGeometry(0.3, 0.02, 1.5);
  const put = (geo, d, fwdPt) => { const m = new THREE.Mesh(geo, white); placeAt(m, d, 0, 0.035); faceToward(m, fwdPt.clone().multiplyScalar(R)); bake(m); };
  EDGES.forEach((_, ei) => { const L = edgeLen(ei), a = E0(ei) + 3.4, b = L - E1(ei) - 3.4; if (b <= a) return;
    for (let s0 = a; s0 < b; s0 += 2.2){ const d = edgePoint(ei, s0, 0); if (heightAt(d) < SEA + 0.2) continue; put(dash, d, edgePoint(ei, s0 + 1, 0)); }
    for (const s0 of [E0(ei) + 2.1, L - E1(ei) - 2.1]) for (const k of [-0.9, -0.3, 0.3, 0.9]){ const d = edgePoint(ei, s0, k); put(zeb, d, edgePoint(ei, s0 + 1, k)); } });
  for (let i = 0; i < poiDirs.length; i++){ const RR = RN(i), n = Math.round(Math.PI * 2 * RR / 2.3);
    for (let k = 0; k < n; k++){ const th = k / n * Math.PI * 2, d = ringDir(i, th, RR); if (roadDist(d) < 1.6) continue; put(dash, d, ringDir(i, th + 0.1, RR)); } }
}
function buildRoadside(){
  // street lamps + benches along the roads
  EDGES.forEach(([ia,ib], ei) => {
    const a = poiDirs[ia], b = poiDirs[ib], n = edgeN[ei], L = a.angleTo(b)*R, steps = Math.max(3, Math.floor(L/12));
    for (let k=1;k<steps;k++){ const tt = k/steps, dir = a.clone().lerp(b, tt).normalize(); { const [pd0, pi0] = poiDist(dir); if (pd0 < RN(pi0) + 2.5) continue; }
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
  // groves: big storybook trees gather in clusters and leave open meadows between them
  const AREA = (R/30)**2, groves = Math.round((isTouch ? 8 : 11) * AREA);
  for (let gI=0, tries=0; gI<groves && tries<900; tries++){
    const c = randDir(); if (!okLand(c, 12, 4)) continue; gI++;
    const n = 4 + (rnd()*6|0), hill = terrainInfo(c).h > 2.2;
    for (let k=0;k<n;k++){ const d = c.clone().add(randDir().multiplyScalar(rnd()*6/R)).normalize(); if (!okLand(d) || !clearOf(d, 9, 2.6, 1.1)) continue;
      const kind = hill ? 0 : (rnd() < 0.07 ? 2 : (rnd() < 0.25 ? 0 : 1)), sc = kind === 1 ? 1.15 + rnd()*0.7 : 0.95 + rnd()*0.5;
      const tr = tree(kind); placeAt(tr, d, rnd()*6, -0.08); tr.scale.setScalar(sc); bake(tr); addObstacle(d, 0.4 * sc); }
  }
  for (let i=0, p=0; i<3000 && p<Math.round(18*AREA); i++){ const d = randDir(); if (!okLand(d, 10, 3) || !clearOf(d, 10, 3, 3)) continue;
    const sc = 1.1 + rnd()*0.6, tr = tree(rnd() < 0.7 ? 1 : 0); placeAt(tr, d, rnd()*6, -0.08); tr.scale.setScalar(sc); bake(tr); addObstacle(d, 0.4 * sc); p++; }
  // giant trees arching over a few of the longer roads — gateways into the wild parts of the planet
  { const order = EDGES.map((e, i) => [i, poiDirs[e[0]].angleTo(poiDirs[e[1]])]).sort((a, b) => b[1] - a[1]); let made = 0;
    for (const [ei] of order){ if (made >= (isTouch ? 4 : 6)) break;
      const [a, b] = EDGES[ei], m = poiDirs[a].clone().add(poiDirs[b]).normalize(); if (poiDist(m)[0] < 14) continue;
      const across = edgeN[ei], span = 4.6, fA = m.clone().addScaledVector(across, span/R).normalize(), fB = m.clone().addScaledVector(across, -span/R).normalize();
      if (!walkable(fA) || !walkable(fB) || obstacles.some(o => o.d.angleTo(fA)*R < o.r + 1.2 || o.d.angleTo(fB)*R < o.r + 1.2)) continue;
      const g = archTree(span, 6.4 + rnd()*1.2); placeAt(g, m, 0, -0.1); faceToward(g, m.clone().addScaledVector(V().crossVectors(across, m), 0.1).normalize().multiplyScalar(R));
      bake(g); addObstacle(fA, 0.9); addObstacle(fB, 0.9); made++; } }
  // palms on the beaches
  for (let i=0, p=0; i<4000 && p<Math.round(14*AREA); i++){ const d = randDir(), s = terrainInfo(d); if (s.n < 0.48 || s.n > 0.58 || s.h < SEA + 0.25 || s.pd < 9 || s.rd < 2.4) continue; if (!clearOf(d,9,2.4,2)) continue;
    const pl = palm(); placeAt(pl, d, rnd()*6); bake(pl); addObstacle(d, 0.35); p++; }
  // sandstone pillars crowned with moss on the high ground
  for (let i=0, p=0; i<6000 && p<Math.round(3*AREA); i++){ const d = randDir(), s = okLand(d, 14, 5); if (!s || s.h < 1.6 || !clearOf(d, 14, 5, 3)) continue;
    const pr = rockPillar(4 + rnd()*4); placeAt(pr, d, rnd()*6, -0.3); bake(pr); addObstacle(d, 1.3); p++; }
  // mossy boulders, glowing crystal clusters, bushes
  for (let i=0, p=0; i<5000 && p<Math.round(48*AREA); i++){ const d = randDir(), s = okLand(d, 8, 2); if (!s || !clearOf(d,8,2,1.5)) continue;
    const roll = rnd();
    if (roll < 0.38){ const sz = 0.35 + rnd()*0.75, r = rock(sz, rnd() < 0.75); placeAt(r, d, rnd()*6, -0.05); bake(r); addObstacle(d, sz * 0.92, sz * 0.98); }
    else if (roll < 0.46){ const c = crystals(); c.scale.setScalar(0.8 + rnd()*0.6); placeAt(c, d, rnd()*6); bake(c); addObstacle(d, 0.5); }
    else { const b = bush(p, 1 + rnd()*0.4); placeAt(b, d, rnd()*6); bake(b); } p++; }
  const fl = new THREE.IcosahedronGeometry(0.07,0); fl.translate(0,0.16,0);
  const NG = 0, NF = Math.round((isTouch ? 300 : 520) * AREA);
  const gl = [[],[],[],[],[],[]], fls = [[],[],[],[],[],[]];
  const o = new THREE.Object3D(), GC = [0x7DB65A, 0x8CC163, 0x6FA552, 0xA9C25E, 0xC9B65A], FC = [0xF7D96A,0xFFFFFF,0xF2A0A8,0xBBD3F2,0xF4B26B];
  for (let i=0, gi=0, fi=0; i<160000 && (gi<NG || fi<NF); i++){
    const d = randDir(), s = terrainInfo(d); if (s.h < SEA + 0.25 || s.n > 0.45 || s.h > 2.8 || s.rd < 1.6 || s.pd < 7) continue;
    placeAt(o, d, rnd()*6); o.scale.setScalar(0.8 + rnd()*0.9); o.updateMatrix(); const rg = regionOf(o.position);
    if (gi < NG){ gl[rg].push([o.matrix.clone(), GC[rnd() < 0.86 ? (rnd()*3|0) : 3 + (rnd()*2|0)]]); gi++; }
    else if (fi < NF){ fls[rg].push([o.matrix.clone(), FC[rnd()*FC.length|0]]); fi++; }
  }
  const col = new THREE.Color(), fmat = new THREE.MeshToonMaterial({ gradientMap: grad });
  const emit = (list, geo, mat, recv) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mx, c], k) => { im.setMatrixAt(k, mx); im.setColorAt(k, col.setHex(c)); }); im.receiveShadow = recv && SHADOWS;
    im.computeBoundingSphere ? im.computeBoundingSphere() : null; if (!im.boundingSphere){ const bs = new THREE.Sphere(); const pts = list.map(([mx]) => V().setFromMatrixPosition(mx)); bs.setFromPoints(pts); bs.radius += 1; im.geometry = geo.clone(); im.geometry.boundingSphere = bs; }
    planet.add(im); };
  for (let r = 0; r < 6; r++){ emit(fls[r], fl, fmat, false); }
}
let grassMat = null;

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
const _thrP = new THREE.Vector3(), _thrV = new THREE.Vector3(), _thrD = new THREE.Vector3(), _thrU = new THREE.Vector3(), _zeroV = new THREE.Vector3(), lastCarPos = new THREE.Vector3();
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
  for (let i=0;i<3;i++){ const v = makeVan(); planet.add(v); cullList.push(v); vehicles.push({ g: v, e: (i*7) % EDGES.length, s: RING + 1, dir: i%2 ? 1 : -1, speed: 0, max: 6 + rnd()*2, honk: 0 }); }
  /* one resident per client — every client walks the planet, none repeated, none left out */
  CLIENTS.forEach((c, i) => { const p = person(20 + i, { logo: logoTex(c) }); planet.add(p); cullList.push(p); walkers.push({ g: p, c, ped: true, e: (i*5+1) % EDGES.length, s: RING + 1 + rnd()*10, dir: i%2 ? 1 : -1, walkT: rnd()*6, line: residentLine(c, i), pause: 0 }); });
}
/* ---------- streets: every place sits inside a roundabout ----------
   Roads run between places but stop at a ring road around each one, so nothing drives through a building:
   traffic follows the road, swings round the roundabout to its next road, and pedestrians use the outer
   pavement ring. ringFrame gives each place a tangent basis to measure angles round it. */
const _ringF = new Map();
function ringFrame(node){ let f = _ringF.get(node); if (f) return f; const c = poiDirs[node], e1 = V(0, 1, 0).cross(c); if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0).cross(c); e1.normalize();
  f = { c, e1, e2: V().crossVectors(c, e1).normalize() }; _ringF.set(node, f); return f; }
function ringTheta(node, d){ const f = ringFrame(node); return Math.atan2(d.dot(f.e2), d.dot(f.e1)); }
function ringDir(node, th, rad, out = V()){ const f = ringFrame(node), a = rad / R;
  return out.copy(f.c).multiplyScalar(Math.cos(a)).addScaledVector(f.e1, Math.cos(th) * Math.sin(a)).addScaledVector(f.e2, Math.sin(th) * Math.sin(a)).normalize(); }
const edgeLen = ei => poiDirs[EDGES[ei][0]].angleTo(poiDirs[EDGES[ei][1]]) * R;
/* the arc round a place between where a mover arrives (point a) and where it leaves (point b) */
function ringArc(node, a, b, bulgeR, longWay){
  const th0 = ringTheta(node, a), rad0 = poiDirs[node].angleTo(a) * R, rad1 = poiDirs[node].angleTo(b) * R; let dth = ringTheta(node, b) - th0;
  dth = Math.atan2(Math.sin(dth), Math.cos(dth)); if (longWay) dth -= Math.sign(dth || 1) * Math.PI * 2;
  const bulge = bulgeR ? bulgeR - (rad0 + rad1) / 2 : 0;   // pedestrians swing out to the pavement ring
  const len = Math.abs(dth) * (rad0 + rad1 + bulge * 1.3) / 2 + Math.abs(rad1 - rad0) + Math.abs(bulge) * 1.4 + 0.01;
  return { node, th0, dth, rad0, rad1, bulge, len, t: 0 };
}
function ringPoint(a, k, out){ return ringDir(a.node, a.th0 + a.dth * k, a.rad0 + (a.rad1 - a.rad0) * k + a.bulge * Math.sin(Math.PI * k), out); }
function advanceOnGraph(o, step){
  if (o.arc){ o.arc.t += step; if (o.arc.t >= o.arc.len) o.arc = null; return; }
  const L = edgeLen(o.e), lo = E0(o.e) + 0.6, hi = L - E1(o.e) - 0.6, lane = (o.lane || 0) * o.dir;
  if (hi <= lo){ o.s = L / 2; }
  o.s += step * o.dir;
  if (o.s < lo - 0.01 && o.dir > 0) o.s = lo; if (o.s > hi + 0.01 && o.dir < 0) o.s = hi;
  if ((o.dir > 0 && o.s >= hi) || (o.dir < 0 && o.s <= lo)){
    const node = o.dir > 0 ? EDGES[o.e][1] : EDGES[o.e][0], opts = ADJ[node].filter(x => x !== o.e), ne = opts.length ? opts[(rnd()*opts.length)|0] : o.e;
    const nd = EDGES[ne][0] === node ? 1 : -1, Ln = edgeLen(ne), s1 = nd > 0 ? Math.min(E0(ne) + 0.6, Ln / 2) : Math.max(Ln - E1(ne) - 0.6, Ln / 2);
    const from = edgePoint(o.e, clamp(o.s, lo, hi), lane, V()), to = edgePoint(ne, s1, (o.lane || 0) * nd, V());
    o.arc = ringArc(node, from, to, o.ped ? RN(node) + 2.1 : o.ringR, ne === o.e); o.e = ne; o.dir = nd; o.s = s1;
  }
}
const _a = V(), _b = V(), _c = V(), _m = new THREE.Matrix4();
function poseOnGraph(o, lane, lift){
  o.lane = lane; let d, ahead;
  if (o.arc){ const k = clamp(o.arc.t / o.arc.len, 0, 1); d = ringPoint(o.arc, k, _a); ahead = ringPoint(o.arc, Math.min(1, k + 0.4 / o.arc.len), _b);
    if (ahead.distanceToSquared(d) < 1e-12) ahead = edgePoint(o.e, o.s + 0.5*o.dir, lane*o.dir, _b); }
  else { d = edgePoint(o.e, o.s, lane*o.dir, _a); ahead = edgePoint(o.e, o.s + 0.5*o.dir, lane*o.dir, _b); }
  const up = d, fwd = _c.copy(ahead).sub(d); fwd.addScaledVector(up, -fwd.dot(up)).normalize(); const right = V().crossVectors(up, fwd);
  _m.makeBasis(right, up, fwd); o.g.quaternion.setFromRotationMatrix(_m); o.g.position.copy(d).multiplyScalar(R + Math.max(0, heightAt(d)) + lift);
  if (o.kick && o.kick.lengthSq() > 1e-6){ o.g.position.add(o.kick); o.g.rotateY(o.spin || 0); }
  return d;
}

/* ---------- the messenger ---------- */
const player = new THREE.Group(); scene.add(player);
const rig = new THREE.Group(); player.add(rig);
let mixer = null, walkAction = null, idleTime = 0, clipDur = 1, charLoaded = false;
const proc = {};
/* the messenger: a hand-built chibi astronaut — big round helmet with a dark glossy visor, a soft white
   suit with orange bands, grey gloves and boots. Every joint is a pivot we animate ourselves, so the walk,
   run, jump and idle are tuned by hand instead of baked into a downloaded model. */
function buildProceduralPlayer(){
  const W = 0xEEF3FB, OR = 0xF2602F, GL = 0xC9D0DB, BOOT = 0x3A3F4C;
  const sph = (r, col, x, y, z, sx = 1, sy = 1, sz = 1, par = rig) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), toon(col)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = SHADOWS; par.add(m); return m; };
  const cyl = (r1, r2, h, col, y, par, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), toon(col)); m.position.y = y; m.castShadow = SHADOWS; par.add(m); return m; };
  const band = (r, y, par, col = OR, tube = 0.024) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), toon(col)); m.rotation.x = Math.PI/2; m.position.y = y; par.add(m); return m; };
  const body = new THREE.Group(); rig.add(body); proc.body = body;
  // torso: a soft rounded pod
  sph(0.34, W, 0, 0.74, 0, 1, 1.0, 0.86, body);
  band(0.31, 0.6, body, OR, 0.026);
  // chest panel with little lights
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.05), toon(0xDDE2EA)); panel.position.set(0.04, 0.82, 0.28); panel.rotation.x = -0.18; body.add(panel);
  [[-0.02, 0xF0663A], [0.04, 0xF0663A], [0.1, 0x6BC1E8]].forEach(([x, c]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), basic(c)); b.position.set(x, 0.84, 0.31); b.rotation.x = -0.18; body.add(b); });
  // air hose from the chest round to the backpack
  { const curve = new THREE.CatmullRomCurve3([V(-0.1, 0.78, 0.27), V(-0.3, 0.7, 0.2), V(-0.36, 0.62, -0.02), V(-0.26, 0.66, -0.26)]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 8), toon(0xAEB4BF)); body.add(hose); }
  // helmet on a neck pivot so it can bob and look around
  const head = new THREE.Group(); head.position.set(0, 1.04, 0); body.add(head); proc.head = head;
  band(0.25, 0.0, head, 0xC9CED8, 0.05);
  const helm = sph(0.43, W, 0, 0.34, 0, 1, 0.96, 1, head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshPhongMaterial({ color: 0x0E1730, specular: 0x9FB4E0, shininess: 90 }));
  visor.position.set(0, 0.33, 0.215); visor.scale.set(1, 0.8, 0.66); head.add(visor);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.75 }));
  shine.position.set(-0.13, 0.44, 0.44); shine.scale.set(1.5, 0.75, 0.3); head.add(shine);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 10, 36), toon(0xE4E7EE)); rim.position.set(0, 0.33, 0.33); rim.scale.set(1.13, 0.94, 1); rim.rotation.x = -0.05; head.add(rim);
  [-1, 1].forEach(sd => { const ear = cyl(0.07, 0.07, 0.05, 0xE4E7EE, 0, head); ear.rotation.z = Math.PI/2; ear.position.set(sd * 0.43, 0.32, 0); });
  // arms: shoulder pivot → elbow pivot → glove
  const arm = sd => { const sh = new THREE.Group(); sh.position.set(sd * 0.33, 0.9, 0); body.add(sh);
    sph(0.12, W, 0, 0, 0, 1, 1, 1, sh); cyl(0.105, 0.1, 0.2, W, -0.12, sh); band(0.104, -0.16, sh);
    const el = new THREE.Group(); el.position.y = -0.24; sh.add(el); cyl(0.098, 0.09, 0.18, W, -0.08, el);
    const glove = sph(0.1, GL, 0, -0.22, 0.01, 1, 1.05, 1, el); sph(0.045, GL, sd * -0.06, -0.19, 0.06, 1, 1, 1, el);
    sh.rotation.z = sd * 0.16; return { sh, el }; };
  const aL = arm(-1), aR = arm(1); proc.armL = aL.sh; proc.armR = aR.sh; proc.elL = aL.el; proc.elR = aR.el;
  // legs: hip pivot → knee pivot → boot
  const leg = sd => { const hp = new THREE.Group(); hp.position.set(sd * 0.14, 0.44, 0); body.add(hp);
    cyl(0.13, 0.12, 0.24, W, -0.1, hp); band(0.123, -0.17, hp);
    const kn = new THREE.Group(); kn.position.y = -0.24; hp.add(kn); sph(0.12, W, 0, 0, 0, 1, 1, 1, kn); cyl(0.12, 0.115, 0.12, W, -0.06, kn);
    const boot = sph(0.14, BOOT, 0, -0.11, 0.04, 0.95, 0.6, 1.3, kn); const sole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.34), toon(0x24272F)); sole.position.set(0, -0.18, 0.04); kn.add(sole);
    return { hp, kn }; };
  const lL = leg(-1), lR = leg(1); proc.legL = lL.hp; proc.legR = lR.hp; proc.knL = lL.kn; proc.knR = lR.kn;
  proc.ph = 0; proc.blend = 0;
}
/* one pose function for every place the messenger walks (planet, HQ, studios):
   speed is in m/s, air is true while jumping */
function astroPose(moving, speed, dt, now, air){
  if (!proc.legL || !proc.knL) return;
  const k = 1 - Math.exp(-12 * dt), run = clamp((speed - 4.6) / 3, 0, 1);
  proc.blend += ((moving ? 1 : 0) - proc.blend) * (1 - Math.exp(-9 * dt));
  if (moving) proc.ph += dt * (5.2 + speed * 0.9);
  const ph = proc.ph, b = proc.blend, sw = Math.sin(ph), A = 0.62 + run * 0.28;
  let hl = sw * A * b, hr = -sw * A * b;
  let kl = (0.08 + Math.max(0, -Math.cos(ph)) * (0.7 + run * 0.5)) * b, kr = (0.08 + Math.max(0, Math.cos(ph)) * (0.7 + run * 0.5)) * b;
  let al = -sw * (0.55 + run * 0.35) * b, ar = sw * (0.55 + run * 0.35) * b, el = -(0.25 + run * 0.7) * b - 0.12, er = el;
  let bob = Math.abs(Math.cos(ph)) * (0.05 + run * 0.04) * b, twist = sw * 0.12 * b;
  const t = now * 0.001;
  // idle: breathe, sway, and glance around every few seconds
  const idle = 1 - b; bob += Math.sin(t * 2.1) * 0.012 * idle;
  const glance = Math.sin(t * 0.45) > 0.6 ? Math.sin(t * 1.3) * 0.5 : 0;
  if (air){ // the reference pose: one fist up, knees tucked — mid-hop through space
    hl = -0.9; hr = 0.35; kl = 1.25; kr = 0.4; al = -2.6; ar = 0.5; el = -0.6; er = -0.3; bob = 0; twist = 0; }
  const L = (o, prop, v) => { o.rotation[prop] += (v - o.rotation[prop]) * k; };
  L(proc.legL, 'x', -hl); L(proc.legR, 'x', -hr); L(proc.knL, 'x', kl); L(proc.knR, 'x', kr);
  L(proc.armL, 'x', al); L(proc.armR, 'x', ar); L(proc.elL, 'x', el); L(proc.elR, 'x', er);
  L(proc.armL, 'z', -0.16 - idle * 0.05 - (air ? 0.2 : 0)); L(proc.armR, 'z', 0.16 + idle * 0.05 + (air ? 0.15 : 0));
  L(proc.body, 'y', twist); proc.body.position.y = bob;
  L(proc.head, 'y', glance * idle - twist * 0.6); L(proc.head, 'x', Math.sin(t * 2.1) * 0.03 * idle + run * 0.08 * b);
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
    o.castShadow = SHADOWS; o.receiveShadow = SHADOWS; });
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
  const parts = [0,0], upd = () => progress(parts.reduce((a,b)=>a+b,0)/2);
  const ch = null;   // the messenger is built in code now (buildProceduralPlayer) — no character download
  const [hq, van] = await Promise.all([
    loadGLB('models/hq.glb', p => { parts[0] = p; upd(); }),
    loadGLB('models/van.glb', p => { parts[1] = p; upd(); }),
  ]);
  if (ch){
    const root = ch.scene; const holder = new THREE.Group(); holder.add(root);
    { const cs = fitSkinned(root, 1.7); toonify(root, 0.016/cs); }
    root.rotation.y = CHAR_YAW; rig.add(holder); charLoaded = true;
    if (ch.animations.length){ mixer = new THREE.AnimationMixer(root); const clip = ch.animations[0]; clipDur = clip.duration; walkAction = mixer.clipAction(clip); walkAction.play();
      // find the frame where the feet are closest together → idle pose
      let lf = null, rf = null; root.traverse(o => { if (o.isBone){ const n = o.name.toLowerCase(); if (n.includes('left') && n.includes('foot')) lf = lf || o; if (n.includes('right') && n.includes('foot')) rf = rf || o; } });
      if (lf && rf){ let best = 1e9; for (let k=0;k<48;k++){ const tt = k/48*clipDur; walkAction.time = tt; mixer.update(0); root.updateMatrixWorld(true);
        const dd = lf.getWorldPosition(V()).distanceTo(rf.getWorldPosition(V())); if (dd < best){ best = dd; idleTime = tt; } } }
      walkAction.time = idleTime; walkAction.timeScale = 0; mixer.update(0); }
  }
  if (!charLoaded){ buildProceduralPlayer(); addMessengerPack(); }
  else addMessengerPack();
  if (hq){ const root = hq.scene; const holder = new THREE.Group(); holder.add(root); const s = fitHeight(root, 8.2); toonify(root, 0.03/s); root.position.y -= 0.5; root.rotation.y = HQ_YAW; hqModel = holder; hqModel.userData.dyn = true; }
  if (van){ const root = van.scene; const holder = new THREE.Group(); holder.add(root); const s = fitHeight(root, 1.55); toonify(root, 0.025/s); root.rotation.y = VAN_YAW; vanModel = holder; }
}
/* the messenger carries Planet's mark on their back */
function addMessengerPack(){
  { const pack = new THREE.Group(), par = proc.body || rig;
    if (proc.body){
      // a rounded life-support pack: soft white shell, two orange air tanks, and Planet's mark as a round patch
      const shell = new THREE.Mesh(RB(0.5, 0.56, 0.26), toon(0xE6ECF5)); shell.castShadow = SHADOWS; pack.add(shell);
      const lid = new THREE.Mesh(RB(0.42, 0.14, 0.3), toon(0xF27A3E)); lid.position.y = 0.24; pack.add(lid);
      [-0.15, 0.15].forEach(x => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 14), toon(0xF2602F)); t.position.set(x, -0.02, -0.16); pack.add(t); });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.11, 28), new THREE.MeshBasicMaterial({ color: 0xffffff })); disc.position.set(0, 0.04, -0.21); disc.rotation.y = Math.PI; pack.add(disc);
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.11), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); mk.position.set(0, 0.04, -0.212); mk.rotation.y = Math.PI; pack.add(mk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 8, 28), toon(0x2E6BA9)); ring.position.set(0, 0.04, -0.21); pack.add(ring);
      pack.position.set(0, 0.8, -0.38);
      // a small Planet badge on the chest too, so the brand reads from the front
      const cb = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); cb.position.set(-0.15, 0.86, 0.315); cb.rotation.set(-0.18, -0.35, 0); proc.body.add(cb);
    } else {
      const box = mesh(new THREE.BoxGeometry(0.42,0.5,0.2), 0x2E6BA9); pack.add(box);
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.31,0.2), new THREE.MeshBasicMaterial({ map: markTex, transparent: true })); mk.position.set(0,0.04,-0.108); mk.rotation.y = Math.PI; pack.add(mk);
      pack.position.set(0, BACKPACK_Y, BACKPACK_Z); pack.scale.set(1.15, 1.05, 1.2);
    }
    par.add(pack); }
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
  updateHud(); if (typeof Voice !== 'undefined') Voice.paint(); if (dlg.active) renderLine(true); if (state === 'journal') renderJournal(); if (state === 'exhibit' && xRender) xRender();
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
  if (!keepFull && typeof Voice !== 'undefined') Voice.say(full, t(dlg.speaker));
  if (keepFull || reduce){ dlg.shown = full.length; $('line').textContent = full; return; }
  dlg.shown = 0; $('line').textContent = '';
  dlg.timer = setInterval(() => { dlg.shown += 2; if (dlg.shown % 6 === 0) Sfx.blip(); $('line').textContent = full.slice(0, dlg.shown); if (dlg.shown >= full.length) clearInterval(dlg.timer); }, 16);
}
function renderCta(){
  const box = $('dlgcta'); if (!box) return;
  const last = dlg.cta && dlg.i === dlg.lines.length - 1; box.hidden = !last; if (!last) return box.innerHTML = '';
  box.innerHTML = dlg.cta.map((c, k) => `<button type="button" class="dcta ${c.cls || ''}" data-k="${k}">${t(c.label)}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); const c = dlg.cta[+b.dataset.k];
    clearInterval(dlg.timer); dlg.active = false; dlg.done = null; if (typeof Voice !== 'undefined') Voice.stop(); $('dialog').hidden = true; box.hidden = true; state = 'play'; Sfx.click(); c.act(); });
}
function advance(){
  if (!dlg.active) return;
  const full = t(dlg.lines[dlg.i]);
  if (dlg.shown < full.length){ clearInterval(dlg.timer); dlg.shown = full.length; $('line').textContent = full; return; }
  if (++dlg.i < dlg.lines.length) return renderLine();
  dlg.active = false; $('dialog').hidden = true; state = 'play'; Sfx.close(); if (typeof Voice !== 'undefined') Voice.stop(); const d = dlg.done; dlg.done = null; d && d();
}
$('dialog').addEventListener('click', advance);

let near = null, guide = null;
function act(){
  if (state === 'talk') return advance();
  if (state === 'play' && riding) return requestDismount();
  if (state === 'play' && near) return interact(near);
}
{ let lastAct = 0; const fire = e => { if (performance.now() - lastAct < 400) return; lastAct = performance.now(); e.preventDefault(); act(); };
  $('prompt').addEventListener('pointerup', fire); $('prompt').addEventListener('click', fire); }
function interact(tk){
  if (tk.kind === 'stone'){ const s = STONES[tk.ref][lang]; return talk(L(STONES[tk.ref].en[0], STONES[tk.ref].ar[0]), [L(STONES[tk.ref].en[1], STONES[tk.ref].ar[1])], true); }
  if (tk.kind === 'board') return openExhibit('client', tk.ref.logo || tk.ref.name.en);
  if (tk.kind === 'emp') return talkToCrew(tk.ref);
  if (tk.kind === 'car') return mountCar(tk.ref);
  if (tk.kind === 'bus') return boardBus();
  if (tk.kind === 'rocket') return talk(L('Planet Rocket','صاروخ Planet'), [L("Fuelled and ready. Seven worlds orbit Planet: the Moon where our crew lives, the Clients' Ring, the Academy, the Gallery of our work, the Services station, Voyage Planet with its runway and planes — and the Star Catcher, if you fancy a game.", "الوقود مليان. فيه سبع عوالم حوالين Planet: القمر اللي ساكن فيه طاقمنا، وحلقة العملاء، والأكاديمية، ومعرض شغلنا، ومحطة الخدمات، وكوكب الرحلات بمطاره وطياراته — وكوكب صيد النجوم لو عايز تلعب.")], true, () => startLaunch());
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
let turnRate = 0, pLandT = 0; const prevFwd = V(0,0,1);
let jumpBuf = 0, coyote = 0, moveSpeed = 0, floorY = 0;
let jumpReq = false, jy = 0, vy = 0, grounded = true, walkT = 0, animSpeed = 0, lastStepSign = 1, introT = 0;
function spawn(hq = pois[0]){
  const e = EDGES[ADJ[hq.i][0]], nb = e[0] === hq.i ? e[1] : e[0];
  const tow = poiDirs[nb].clone().sub(hq.dir); tow.addScaledVector(hq.dir, -tow.dot(hq.dir)).normalize();
  const side = V().crossVectors(hq.dir, tow).normalize();
  const dirv = tow.clone().multiplyScalar(0.55).add(side.multiplyScalar(0.84)).normalize();
  // stand on dry ground in front of HQ: step around the building until the spot is walkable and clear
  for (let k = 0; k < 36; k++){ const a = (k % 2 ? 1 : -1) * Math.ceil(k/2) * 0.3, r = hq.r + 4.5 - (k % 3) * 0.8;
    pDir.copy(hq.dir).addScaledVector(dirv.clone().applyAxisAngle(hq.dir, a), r/R).normalize(); resolve(pDir); if (walkable(pDir)) break; }
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
/* what's under the feet at d: the terrain (0) or the surface of a climbable rock — a dome that's
   highest in the middle and meets the ground at its rim, so its sides are steep and its top walkable */
function supportAt(d){ let h = 0;
  for (const o of obstacles){ if (o.top === undefined) continue; const dt0 = d.dot(o.d); if (dt0 < 0.995) continue;
    const x = Math.acos(Math.min(1, dt0)) * R - 0.18, k = 1 - (x / (o.r * 1.02)) ** 2; if (k > 0) h = Math.max(h, o.top * Math.sqrt(k)); }
  return h; }
function resolve(d, solidRocks = true){
  for (let pass=0; pass<2; pass++) for (const o of obstacles){ if (!solidRocks && o.top !== undefined) continue; const dt0 = d.dot(o.d); if (dt0 < 0.985) continue; const ang = Math.acos(Math.min(1, dt0))*R, rr = o.r + 0.32;
    if (ang < rr){ tmp2.copy(d).sub(o.d); tmp2.addScaledVector(o.d, -tmp2.dot(o.d)); if (tmp2.lengthSq() < 1e-10) tmp2.set(1,0,0); tmp2.normalize(); d.copy(o.d).multiplyScalar(Math.cos(rr/R)).addScaledVector(tmp2, Math.sin(rr/R)).normalize(); } }
  return d;
}
function updatePlayer(dt, now){
  up.copy(pDir);
  // keep the camera heading tangent
  camFwd.addScaledVector(up, -camFwd.dot(up)); if (camFwd.lengthSq() < 1e-6) camFwd.copy(pFwd); camFwd.normalize();
  if (camYawDelta){ camFwd.applyAxisAngle(up, -camYawDelta); camYawDelta = 0; }
  const camRight = right.crossVectors(camFwd, up).normalize();
  const passenger = (typeof passengerOf !== 'undefined' && passengerOf) || (typeof onBus !== 'undefined' && onBus);
  const [ix, iy, mag] = state === 'play' && !passenger ? inputVector() : [0,0,0];
  const run = keys.ShiftLeft || keys.ShiftRight || runToggle;
  let moved = 0;
  const flying = riding && car && car.userData.ship && flyY > 1.2;
  if (mag > 0.08){
    const wish = tmp.copy(camFwd).multiplyScalar(iy).addScaledVector(camRight, ix).normalize();
    if (pFwd.dot(wish) < -0.98) pFwd.addScaledVector(camRight, 0.2);
    pFwd.lerp(wish, 1 - Math.exp(-(riding ? 9 : 16)*dt)).addScaledVector(up, -pFwd.dot(up)).normalize();
  }
  // speed builds up and eases off instead of snapping: quick to start on foot, heavier in a car
  { const target = mag > 0.08 ? (flying ? (run ? 30 : 20) : riding ? (run ? 17 : 12) : run ? 7.8 : 4.6) * Math.min(1, mag) * (landing ? 0.25 : 1) : 0;
    const acc = riding ? (target > moveSpeed ? 3.2 : 2.6) : (target > moveSpeed ? 14 : 18); moveSpeed += (target - moveSpeed) * (1 - Math.exp(-acc * dt)); if (moveSpeed < 0.05) moveSpeed = 0; }
  if (moveSpeed > 0){
    const stepLen = moveSpeed * dt;
    const stuck = !walkable(pDir);   // e.g. dropped into water: let them walk out instead of freezing
    const onFoot = !riding && !passenger;
    const tryDir = dirv => { const nd = V().copy(pDir).addScaledVector(dirv, stepLen/R).normalize(); if (flying) return nd; resolve(nd, !onFoot); if (!(walkable(nd) || stuck)) return null;
      if (onFoot){ // rocks: a gentle rise you can walk up, a steep side needs a jump, and you can't walk into one mid-air below its top
        const f = supportAt(nd), rise = f - jy;
        if (rise > 0.03){ if (!grounded){ if (rise > 0.12) return null; } else if (rise > 0.34 || rise / Math.max(1e-3, stepLen) > 1.4) return null; } }
      return nd; };
    let nd = tryDir(pFwd);
    if (!nd){ for (const a of [0.6, -0.6, 1.2, -1.2]){ nd = tryDir(V().copy(pFwd).applyAxisAngle(up, a)); if (nd) break; } }
    if (nd){ moved = pDir.angleTo(nd)*R; pDir.copy(nd); } else moveSpeed *= 0.5;
  }
  const shipRide = riding && car && car.userData.ship;
  if (riding && !shipRide) carBump(dt);
  if (shipRide && knockT > 0){ knockT -= dt; pDir.addScaledVector(knock, dt / R).normalize(); knock.multiplyScalar(Math.exp(-6 * dt)); }
  if (shipRide){ // climb to cruising height (above every roof), higher while Space is held or after a jump-button tap
    // the pilot sets the height: Space/R/▲ climb, Q/C/▼ descend, a jump tap gives a quick boost
    if (jumpReq){ flyTarget = Math.min(FLY_MAX, flyTarget + 5); jumpReq = false; landing = false; }
    if (keys.Space || keys.KeyR || altBtn > 0){ flyTarget = Math.min(FLY_MAX, flyTarget + dt * 10); landing = false; }
    if (keys.KeyQ || keys.KeyC || altBtn < 0) flyTarget = Math.max(FLY_MIN, flyTarget - dt * 10);
    { const ar = $('altread'); if (ar) ar.textContent = Math.round(flyY) + 'm'; }
    const cruise = landing ? 0 : flyTarget;
    if (landing) flyY = Math.max(0, flyY - dt * Math.max(2.5, flyY * 1.4)); else flyY += (cruise - flyY) * (1 - Math.exp(-1.8 * dt));
    if (landing && flyY <= 0){ dismount(); }
    // two shuttles in the air bounce apart instead of passing through each other
    if (typeof peers !== 'undefined') for (const p of peers.values()){ if (p.rk !== 2 || !p.g.visible || p.id === (typeof passengerOf !== 'undefined' && passengerOf)) continue;
      const dd = p.g.position.distanceTo(player.position); if (dd > 3.4 || dd < 1e-4) continue;
      const away = player.position.clone().sub(p.g.position); const vert = away.dot(pDir); away.addScaledVector(pDir, -vert); if (away.lengthSq() < 1e-6) away.copy(pFwd).negate(); away.normalize();
      knock.copy(away).multiplyScalar(11); knockT = 0.45; flyY += (vert >= 0 ? 1 : -1) * (3.4 - dd) * 0.8; flyTarget = Math.max(FLY_MIN, Math.min(FLY_MAX, flyTarget + (vert >= 0 ? 1.2 : -1.2)));
      if (performance.now() - lastThump > 450){ lastThump = performance.now(); Sfx.land(); burst(p.g.position.clone().lerp(player.position, 0.5), 0xBFE3F2, 18, 3, 0.6); if (navigator.vibrate) navigator.vibrate(50); } }
    if (proc.legL){ proc.legL.rotation.x = proc.legR.rotation.x = -1.45; proc.knL.rotation.x = proc.knR.rotation.x = 1.4; proc.armL.rotation.x = proc.armR.rotation.x = -0.6; } }
  // the ground under us may have pushed us out of an obstacle while idle
  if (!moved && !shipRide && !passenger) resolve(pDir, riding);
  up.copy(pDir); pFwd.addScaledVector(up, -pFwd.dot(up)).normalize();
  { const tr = dt > 0 ? Math.atan2(tmp2.crossVectors(prevFwd, pFwd).dot(up), prevFwd.dot(pFwd)) / dt : 0; turnRate += (tr - turnRate) * (1 - Math.exp(-10*dt)); prevFwd.copy(pFwd); }
  animSpeed = THREE.MathUtils.lerp(animSpeed, moved/dt, 1 - Math.exp(-12*dt));
  // jump
  // jumping: a press a moment before landing still counts (buffer), and so does one just after walking off an edge (coyote time)
  if (jumpReq) jumpBuf = 0.14; jumpReq = false; jumpBuf = Math.max(0, jumpBuf - dt);
  const floor = (riding || passenger) ? 0 : supportAt(pDir); floorY = floor;
  if (grounded){ coyote = 0.11;
    if (jy > floor + 0.06){ grounded = false; vy = 0; }                       // walked off a rock: fall
    else jy += (floor - jy) * (1 - Math.exp(-22 * dt)); }                     // follow the rock's surface up and down
  else coyote = Math.max(0, coyote - dt);
  if (jumpBuf > 0 && (grounded || coyote > 0) && !riding && !passenger){ vy = 8.7; grounded = false; coyote = 0; jumpBuf = 0; Sfx.jump(); }
  if (!grounded){ jy += vy*dt; vy -= 25*dt; if (vy < 0 && jy <= floor){ const hard = vy < -9; jy = floor; vy = 0; grounded = true; pLandT = hard ? 0.24 : 0.16; Sfx.land(); } }
  // walk cycle / footsteps
  const moving = animSpeed > 0.4 && grounded && !riding;
  if (riding && car) car.traverse(o => { if (o.userData.wheel) o.rotation.x += moved * 3; });
  if (moving){ const before = Math.sin(walkT); walkT += dt * animSpeed * 2.1; if (Math.sign(Math.sin(walkT)) !== Math.sign(before)) Sfx.step(animSpeed > 6, terrainInfo(pDir).rd > 1.5); }
  // pose
  const h = Math.max(heightAt(pDir), SEA + 0.12);
  right.crossVectors(up, pFwd).normalize(); mtx.makeBasis(right, up, pFwd); player.quaternion.setFromRotationMatrix(mtx);
  player.position.copy(up).multiplyScalar(R + h + jy + flyY);
  if (mixer){
    if (moving){ walkAction.timeScale = THREE.MathUtils.lerp(walkAction.timeScale, clamp(animSpeed/4.0, 0.6, 1.9), 1 - Math.exp(-10*dt)); }
    else { walkAction.timeScale = 0; let d = idleTime - walkAction.time; d -= Math.round(d/clipDur)*clipDur; walkAction.time += d * (1 - Math.exp(-10*dt)); }
    mixer.update(dt); rig.position.y = moving ? 0 : Math.sin(now*0.0022)*0.012;   // now is in ms: a slow breath, not a shiver
    // body language: lean into turns, tip forward when running, squash a little on landing
    const lean = moving ? clamp(-turnRate * 0.09, -0.26, 0.26) : 0, fwdLean = moving ? clamp((animSpeed - 3) * 0.022, 0, 0.13) : 0;
    rig.rotation.z += (lean - rig.rotation.z) * (1 - Math.exp(-8*dt));
    if (!grounded) rig.rotation.x += (-0.14 - rig.rotation.x) * (1 - Math.exp(-10*dt)); else rig.rotation.x += (fwdLean - rig.rotation.x) * (1 - Math.exp(-8*dt));
    if (!riding){ pLandT = Math.max(0, pLandT - dt); const sq = Math.sin(pLandT / 0.2 * Math.PI) * 0.1; rig.scale.set(1 + sq*0.6, 1 - sq, 1 + sq*0.6); }
  } else if (proc.legL){
    if (!riding && !passenger) astroPose(moving, animSpeed, dt, now, !grounded);
    const lean = moving ? clamp(-turnRate * 0.09, -0.24, 0.24) : 0, fwdLean = moving ? clamp((animSpeed - 3) * 0.02, 0, 0.12) : 0;
    rig.rotation.z += (lean - rig.rotation.z) * (1 - Math.exp(-8*dt)); rig.rotation.x += (fwdLean - rig.rotation.x) * (1 - Math.exp(-8*dt));
    pLandT = Math.max(0, pLandT - dt); const sq = Math.sin(pLandT / 0.2 * Math.PI) * 0.1; rig.scale.set(1 + sq*0.6, 1 - sq, 1 + sq*0.6);
  }
  shadow.position.copy(up).multiplyScalar(R + h + floorY + 0.04); shadow.quaternion.setFromUnitVectors(V(0,0,1), up); shadow.scale.setScalar(shipRide ? 2.4 * (1 - Math.min(0.7, flyY / 30)) : 1 - Math.min(0.5, (jy - floorY)*0.15));
  // camera auto-follow while walking (not right after a manual drag)
  if (moved && now - lastDrag > 1600 && pFwd.dot(camFwd) > -0.35) camFwd.lerp(pFwd, 1 - Math.exp(-1.7*dt)).normalize();
  return moved;
}
/* keep the messenger in sight: if a tree or a building stands between them and the camera,
   swing in closer and a little higher until the view is clear again */
let camPull = 1;
const _h0 = V(), _seg = V(), _op = V(), _vcl = V();
function viewPull(base, want){
  _h0.copy(base).addScaledVector(pDir, 1.3); _seg.copy(want).sub(_h0); const L2 = _seg.lengthSq(); if (L2 < 1e-4) return 1;
  const reach = Math.cos((camDist + 4) / R); let pull = 1;
  for (const o of obstacles){ if (o.d.dot(pDir) < reach) continue;
    const rad = o.r < 1 ? 1.1 : o.r * 1.02, hgt = o.r < 1 ? 1.6 : 2.2;
    _op.copy(o.d).multiplyScalar(R + heightAt(o.d) + hgt);
    const t = _op.clone().sub(_h0).dot(_seg) / L2; if (t < 0.12 || t > 1.05) continue;
    _vcl.copy(_h0).addScaledVector(_seg, t); if (_vcl.distanceTo(_op) < rad) pull = Math.min(pull, Math.max(0.32, t - rad / Math.sqrt(L2))); }
  return pull;
}
let talkZoom = 0;
function updateCamera(dt, k){
  // during a conversation the camera eases in close and low, like a scene in a film
  talkZoom += ((state === 'talk' && flyY < 1 ? 1 : 0) - talkZoom) * (1 - Math.exp(-2.6 * dt));
  const cDist = camDist * (1 - 0.4 * talkZoom), cH = camH * (1 - 0.32 * talkZoom);
  const base = tmp.copy(pDir).multiplyScalar(R + Math.max(heightAt(pDir), SEA + 0.12) + flyY);
  const want = tmp2.copy(base).addScaledVector(pDir, cH + flyY * 0.45).addScaledVector(camFwd, -cDist - flyY * 0.35);
  { const target = state === 'play' && flyY < 1 ? viewPull(base, want) : 1; camPull += (target - camPull) * (1 - Math.exp(-(target < camPull ? 9 : 2.2) * dt));
    if (camPull < 0.999) want.copy(base).addScaledVector(pDir, cH + (1 - camPull) * 1.6).addScaledVector(camFwd, -cDist * camPull); }
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
/* the sun rides along with the view: it lights whatever you look at from the upper side, and its shadow map
   covers just the patch in front of the camera (re-rendered every other frame — shadows barely move) */
const _sf = V(), _sr = V(), _sc = V(); let shadowTick = 0;
function placeSun(){
  camera.getWorldDirection(_sf); _sr.crossVectors(_sf, camera.up).normalize();
  _sc.copy(camera.position).addScaledVector(_sf, 9);
  sunLight.target.position.copy(_sc); sunLight.position.copy(_sc).addScaledVector(camera.up, 46).addScaledVector(_sr, 26).addScaledVector(_sf, 14);
  sunLight.target.updateMatrixWorld();
  if (SHADOWS && (++shadowTick & 1)) renderer.shadowMap.needsUpdate = true;
}
/* frame budget: if frames keep running slow, render a bit softer; climb back slowly when there's room */
let perfN = 0, perfSum = 0, lastDrop = 0;
function frame(now){
  const raw = now - last;
  if (raw < 120 && document.visibilityState === 'visible' && state !== 'loading'){ perfSum += raw; if (++perfN >= 90){ const avg = perfSum / perfN; perfN = 0; perfSum = 0;
    if (avg > 30 && dprNow <= DPR_MIN + 0.01 && inkOn && now - lastDrop > 6000){ inkOn = false; lastDrop = now; }
    if (avg > 26 && dprNow > DPR_MIN + 0.01){ dprNow = Math.max(DPR_MIN, dprNow - 0.2); lastDrop = now; renderer.setPixelRatio(dprNow); resize(); }
    else if (avg < 15 && dprNow < DPR_MAX - 0.01 && now - lastDrop > 15000){ dprNow = Math.min(DPR_MAX, dprNow + 0.1); renderer.setPixelRatio(dprNow); resize(); } } }
  const dt = Math.min(0.05, (now - last)/1000); last = now; const ts = now/1000;
  if (oceanMat && oceanMat.userData.s) oceanMat.userData.s.uniforms.uT.value = ts;
  if (grassMat && grassMat.userData.s) grassMat.userData.s.uniforms.uT.value = ts;
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
    // traffic rules: stop for people in front, keep a safe gap to the vehicle ahead (vans and the tour bus)
    let blocked = state !== 'title' && !v.ghost && !riding && ahead(player.position, 3.6);
    if (!blocked && !v.ghost) for (const o of vehicles) if (o !== v && ahead(o.g.position, 4.6)){ blocked = true; break; }
    if (!blocked && typeof bus !== 'undefined' && bus && bus.visible && ahead(bus.position, 6)) blocked = true;
    if (!blocked && !v.ghost && riding && ahead(player.position, 5)) blocked = true;
    if (v.kick){ v.kick.multiplyScalar(Math.exp(-3 * dt)); v.spin = (v.spin || 0) * Math.exp(-3 * dt); }
    v.speed = THREE.MathUtils.lerp(v.speed, blocked ? 0 : v.max, 1 - Math.exp(-3*dt));
    if (blocked){ v.honk += dt; v.wait = (v.wait || 0) + dt;  if (v.wait > 4.5){ v.ghost = 2.5; v.wait = 0; } } else { v.honk = Math.min(v.honk, 0); v.wait = 0; }
    advanceOnGraph(v, v.speed*dt); poseOnGraph(v, -0.55, 0);
  }
  // anything on wheels coming at a pedestrian: my car, the vans, the tour bus
  const threats = [];
  if (riding && car && !(car.userData.ship && flyY > 1.2)){ car.getWorldPosition(_thrP); const v = _thrV.copy(_thrP).sub(lastCarPos); const sp = v.length() / Math.max(dt, 1e-3);
    if (sp > 1.2 && sp < 80) threats.push({ p: _thrP.clone(), f: v.normalize().clone(), sp }); lastCarPos.copy(_thrP); }
  for (const v of vehicles) if (v.speed > 1) threats.push({ p: v.g.position, f: v.g.getWorldDirection(V()), sp: v.speed });
  if (typeof bus !== 'undefined' && bus && bus.visible && bus.userData.sp > 1) threats.push({ p: bus.position, f: bus.getWorldDirection(V()), sp: bus.userData.sp });
  for (const w of walkers){
    // see it coming → jump out of the way, to the side the vehicle isn't heading
    w.dodge = w.dodge || V(); w.dodgeT = Math.max(0, (w.dodgeT || 0) - dt);
    for (const th of threats){ const to = _thrD.copy(w.g.position).sub(th.p), dist = to.length(); if (dist > 4 + th.sp * 0.7) continue;
      const along = to.dot(th.f); if (along < -0.6) continue; const lat = to.clone().addScaledVector(th.f, -along); if (lat.length() > 1.15) continue;
      if (w.dodgeT < 0.2){ const up = _thrU.copy(w.g.position).normalize(), side = lat.clone(); side.addScaledVector(up, -side.dot(up)); side.addScaledVector(th.f, -side.dot(th.f));
        if (side.lengthSq() < 0.0025) side.crossVectors(up, th.f); side.addScaledVector(up, -side.dot(up)).normalize(); w.dodgeGoal = side.multiplyScalar(3.0); w.hopT = 0; if (w.g.position.distanceTo(player.position) < 25) Sfx.blip(); }
      w.dodgeT = 1.6; }
    const goal = w.dodgeT > 0 && w.dodgeGoal ? w.dodgeGoal : _zeroV;
    w.dodge.lerp(goal, 1 - Math.exp(-(w.dodgeT > 0 ? 11 : 1.6) * dt));
    if (w.dodgeT > 0 || w.dodge.lengthSq() > 0.01){ w.hopT = (w.hopT || 0) + dt;
      const hop = w.hopT < 0.45 ? Math.sin(w.hopT / 0.45 * Math.PI) * 0.7 : 0; poseOnGraph(w, -1.9, 0); w.g.position.add(w.dodge).addScaledVector(_thrU.copy(w.g.position).normalize(), hop);
      animatePerson(w.g, w.dodgeT > 0 ? w.hopT * 14 : 0, w.dodgeT > 0, ts); if (w.dodgeT > 0){ w.g.userData.armL.rotation.z = 2.4; w.g.userData.armR.rotation.z = -2.4; } continue; }
    const close = state !== 'title' && w.g.position.distanceTo(player.position) < 3;
    if (close || w.pause > 0){ w.pause = Math.max(0, w.pause - dt); animatePerson(w.g, 0, close, ts); poseOnGraph(w, -1.9, 0); if (close) faceToward(w.g, player.position); continue; }
    advanceOnGraph(w, 1.3*dt); w.walkT += dt*6; poseOnGraph(w, -1.9, 0); animatePerson(w.g, w.walkT, false, ts);
  }
  // standing NPCs wave when you come close
  for (const n of npcs){ const d = n.getWorldPosition(tmp).distanceTo(player.position); animatePerson(n, 0, state !== 'title' && d < 10, ts); }
  if ((++cullTick & 3) === 0){ for (const o of cullList){ { const dc = o.position.distanceTo(camera.position); o.visible = !o.userData.hidden && dc < (o.isSprite ? 40 : 46) && dc > 1.9; } } }
  // signs fade with distance
  for (const s of signs){ const d = s.getWorldPosition(tmp).distanceTo(camera.position); s.material.opacity = clamp(1 - (d - 16)/7, 0, 1); s.visible = s.material.opacity > 0.01; }

  { const far = state === 'title' || state === 'loading' || (state === 'intro' && introT < 1.4), fn = far ? 90 : state === 'finale' ? 44 : 40, ff = far ? 220 : state === 'finale' ? 150 : 118, kf = 1 - Math.exp(-1.5*dt);
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
      else if (near){ const nm = near.kind === 'poi' ? t(near.ref.name) : near.kind === 'stone' ? t(L(STONES[near.ref].en[0], STONES[near.ref].ar[0])) : near.kind === 'board' ? t(near.ref.name) : near.kind === 'car' ? (near.ref.car.userData.ship ? (lang === 'ar' ? 'سفينة Planet' : 'the Planet shuttle') : (lang === 'ar' ? 'عربية Planet' : 'the Planet car')) : near.kind === 'rocket' ? (lang === 'ar' ? 'صاروخ Planet' : 'the Planet rocket') : near.kind === 'bus' ? (lang === 'ar' ? 'باص الجولة 🚌' : 'the tour bus 🚌') : (near.kind === 'walker' && near.ref.c ? (lang === 'ar' ? 'واحد من ' : 'someone from ') + t(near.ref.c.name) : t(L('Townsperson','واحد من السكان')));
        $('promptText').textContent = `${near.kind === 'stone' ? t(UI.visit) : near.kind === 'board' ? (lang === 'ar' ? 'شوف شغل' : 'See work for') : near.kind === 'car' || near.kind === 'rocket' || near.kind === 'bus' ? (lang === 'ar' ? 'اركب' : 'Ride') : near.kind === 'poi' && near.ref.id === 'hq' ? (lang === 'ar' ? 'ادخل' : 'Enter') : t(UI.talk)} ${nm}`; }
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
  placeSun();
  renderScene();
  requestAnimationFrame(frame);
}

function resize(){ const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.fov = w < h ? 66 : 55; camera.updateProjectionMatrix(); if (inkRT) setupInk(); }
addEventListener('resize', resize); if (window.visualViewport) visualViewport.addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 250));

/* ---------- ink: outlines drawn over the finished frame ----------
   The scene renders into an off-screen target with its depth; a full-screen pass then finds edges —
   silhouettes (big jumps in depth), creases (where the surface bends) and colour borders — and inks
   them in a dark blue-grey, thinning out with distance. One pass covers every object on the planet. */
let inkOn = true, inkRT = null, inkScene = null, inkCam = null, inkMat = null;
function inkSize(){ const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); return [Math.max(2, sz.x), Math.max(2, sz.y)]; }
function setupInk(){
  const [w, h] = inkSize();
  if (!inkRT){ const ms = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget;
    inkRT = ms ? new THREE.WebGLMultisampleRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }) : new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    if (ms) inkRT.samples = 4;
    inkRT.depthTexture = new THREE.DepthTexture(w, h); inkRT.depthTexture.type = THREE.UnsignedIntType;
    inkMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tCol: { value: inkRT.texture }, tDep: { value: inkRT.depthTexture }, px: { value: new THREE.Vector2(1 / w, 1 / h) }, near: { value: camera.near }, far: { value: camera.far }, ink: { value: new THREE.Color(0x232838) }, wid: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tCol; uniform sampler2D tDep; uniform vec2 px; uniform float near; uniform float far; uniform vec3 ink; uniform float wid; varying vec2 vUv;
        float lin(vec2 uv){ float z = texture2D(tDep, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
        float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        void main(){
          vec4 c = texture2D(tCol, vUv); vec2 o = px * wid;
          float d0 = lin(vUv), dl = lin(vUv - vec2(o.x, 0.0)), dr = lin(vUv + vec2(o.x, 0.0)), du = lin(vUv + vec2(0.0, o.y)), dd = lin(vUv - vec2(0.0, o.y));
          float sil = max(max(abs(dl - d0), abs(dr - d0)), max(abs(du - d0), abs(dd - d0))) / max(d0, 0.5);
          float crease = (abs(dl + dr - 2.0 * d0) + abs(du + dd - 2.0 * d0)) / max(d0, 0.5);
          vec3 cl = texture2D(tCol, vUv - vec2(o.x, 0.0)).rgb, cr = texture2D(tCol, vUv + vec2(o.x, 0.0)).rgb, cu = texture2D(tCol, vUv + vec2(0.0, o.y)).rgb, cd = texture2D(tCol, vUv - vec2(0.0, o.y)).rgb;
          float cdiff = max(max(abs(lum(cl) - lum(cr)), abs(lum(cu) - lum(cd))), 0.0);
          float e = max(smoothstep(0.035, 0.09, sil), smoothstep(0.012, 0.03, crease) * 0.85);
          e = max(e, smoothstep(0.3, 0.46, cdiff) * 0.45);
          e *= 1.0 - smoothstep(70.0, 150.0, d0);                 // far away the lines fade out
          gl_FragColor = vec4(mix(c.rgb, ink, e * 0.82), 1.0);
        }` });
    inkScene = new THREE.Scene(); inkCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); inkScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), inkMat)); }
  else { inkRT.setSize(w, h); inkRT.depthTexture.image.width = w; inkRT.depthTexture.image.height = h; inkRT.depthTexture.needsUpdate = true; inkMat.uniforms.px.value.set(1 / w, 1 / h); }
  inkMat.uniforms.wid.value = Math.max(1, dprNow * 0.75);
}
function renderScene(){
  if (!inkOn){ renderer.render(scene, camera); return; }
  if (!inkRT) setupInk();
  inkMat.uniforms.near.value = camera.near; inkMat.uniforms.far.value = camera.far;
  renderer.setRenderTarget(inkRT); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(inkScene, inkCam);
}

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
  buildPois(); buildDistrictGates(); buildRoadside(); buildRoadMarks(); buildBillboards(); setP(0.8); await nextFrame();
  buildNature(); placeVehicles(); buildStars(); buildSkyLife(); if (typeof buildWorlds === 'function') buildWorlds(); spawnTraffic(); setP(0.92); await nextFrame();
  flush(); planet.children.forEach(o => { if (o.isSprite && !signs.includes(o) && !markers.includes(o)) cullList.push(o); if (o.isSprite && o.material.map === glowTex) lampHalos.push(o); }); applyDayNight(); spawn(); updateHud(); setP(1);
  await nextFrame();
  $('loading').style.opacity = 0; setTimeout(() => $('loading').hidden = true, 600);
  $('title').hidden = false; state = 'title'; $('begin').focus();
})();

/* ---------- Everyone sees the same cars ----------
   Each visitor's planet has the same cars in the same order (placeVehicles is deterministic), but where a car
   was left only lived on the screen of whoever drove it — so a car you parked was invisible to everyone else,
   and the one you were driving still sat in its old spot for them while you drove a copy around.
   Now: while you drive, others hide that car (you bring it along); when you get out, where you left it goes
   to everyone, and the newest parking always wins. */
const CS = { mine: null, applied: new Map() };   // mine: my last parking {k, d, f, t}; applied: car index → newest time seen
const carIndexOf = c => cars.findIndex(r => r.car === c);
const r4 = v => v.toArray().map(x => +x.toFixed(4));

{ const plainDismount = dismount; dismount = function(){
    const was = car, r = plainDismount.apply(this, arguments), k = carIndexOf(was);
    if (k >= 0){ const rec = cars[k], f = new THREE.Vector3(0, 0, 1).applyQuaternion(rec.car.quaternion); CS.mine = { k, d: r4(rec.tk.d), f: r4(f), t: Date.now() }; CS.applied.set(k, CS.mine.t); }
    return r; }; }

/* what I tell the others: which car I'm driving now, and where I last left one */
{ const plainMy = myState; myState = function(){
    const s = plainMy(); if (!s) return s;
    if (s.w === 'p' && riding && car){ const k = carIndexOf(car); if (k >= 0) s.rc = k; }
    if (CS.mine && Date.now() - CS.mine.t < 30 * 60e3) s.lc = [CS.mine.k, CS.mine.d, CS.mine.f, CS.mine.t];
    return s; }; }
/* the network only resends what changed: let these two count as a change */
{ const plainTick = netTick; netTick = function(now){ const s = typeof myState === 'function' ? myState() : null;
    if (s){ const extra = JSON.stringify([s.rc, s.lc && s.lc[3]]); if (extra !== CS.lastExtra){ CS.lastExtra = extra; netLastKey = ''; } }
    return plainTick.apply(this, arguments); }; }

/* what they tell me */
{ const plainState = onPeerState; onPeerState = function(p){
    plainState(p); if (!p || p.i === netId) return; const peer = peers.get(p.i); if (!peer) return;
    peer.rc = p.w === 'p' && p.r && Number.isInteger(p.rc) ? p.rc : -1;
    // the car under them is the very car they took, not a stand-in in their colour
    if (peer.car && peer.rc >= 0 && cars[peer.rc] && peer.carK !== peer.rc){
      const src = cars[peer.rc].car, cp = src.clone(true); cp.position.set(0, 0, 0); cp.quaternion.identity(); cp.scale.copy(src.scale); cp.visible = true;
      cp.traverse(o => { if (o.isMesh) o.userData.shared = true; });
      peer.g.remove(peer.car); peer.g.add(cp); peer.car = cp; peer.carK = peer.rc; }
    if (!peer.car) peer.carK = -1;
    const lc = p.lc; if (!Array.isArray(lc) || lc.length < 4) return;
    const [k, d, f, t] = lc, rec = cars[k];
    if (!rec || !Array.isArray(d) || !Array.isArray(f) || !(t > (CS.applied.get(k) || 0))) return;
    if (riding && rec.car === car) return;              // I'm in it right now: my drive wins
    const dd = new THREE.Vector3().fromArray(d).normalize(), ff = new THREE.Vector3().fromArray(f); ff.addScaledVector(dd, -ff.dot(dd));
    if (ff.lengthSq() < 1e-6) return;
    CS.applied.set(k, t); parkCar(rec.car, dd, ff.normalize());
  }; }

/* a car someone else is driving isn't parked anywhere: hide it, and it can't be taken */
setInterval(() => {
  if (typeof cars === 'undefined' || !cars.length) return;
  const taken = new Set(); for (const pr of peers.values()) if (pr.rc >= 0 && pr.world === 'p') taken.add(pr.rc);
  cars.forEach((rec, k) => {
    if (riding && rec.car === car) return;
    const parked = rec.car.parent === planet, hide = taken.has(k) && parked;
    rec.car.visible = !hide;
    const i = talkables.indexOf(rec.tk);
    if (hide && i >= 0) talkables.splice(i, 1);
    else if (!hide && parked && i < 0) talkables.push(rec.tk);
  });
}, 400);

/* ---------- Interiors that stay smooth on a phone ----------
   A furnished room with its staff was ~900 separate draws (every person alone is ~48 little meshes), and the
   HQ ~1000 — enough to drop a phone to a few frames a second, so walking to the door felt like being stuck.
   Here every group of leaf meshes that share a material and never move on their own is welded into one mesh,
   in the space of the joint they hang from. A waving arm is still one joint, so poses and animation are
   untouched; anything something else moves or recolours (spinning globes, blinking lights, flames, markers,
   pictures still loading, anything named in userData) is left alone. */
function perfSkipSet(extra){
  const skip = new Set();
  const add = o => { if (!o) return; if (Array.isArray(o)) o.forEach(add); else if (o.isObject3D) skip.add(o); };
  extra.forEach(add);
  return skip;
}
function mergeLeaves(root, skip){
  root.updateMatrixWorld(true);
  // anything the code reaches through userData keeps its own identity
  root.traverse(o => { for (const v of Object.values(o.userData || {})){ if (v && v.isObject3D) skip.add(v); else if (Array.isArray(v)) v.forEach(x => x && x.isObject3D && skip.add(x)); } });
  let before = 0, after = 0;
  const visit = node => {
    const groups = new Map();
    for (const c of node.children){
      if (!c.isMesh || c.isSkinnedMesh || c.isInstancedMesh || c.children.length || skip.has(c) || !c.visible) continue;
      if (Array.isArray(c.material) || !c.geometry || !c.geometry.attributes.position || c.geometry.morphAttributes && Object.keys(c.geometry.morphAttributes).length) continue;
      const u = c.userData; if (u && (u.keep || u.dyn || u.wheel)) continue;
      const attrs = Object.keys(c.geometry.attributes).sort().join(','), key = c.material.uuid + '|' + attrs + '|' + c.castShadow + c.receiveShadow + c.renderOrder;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c);
    }
    for (const list of groups.values()){
      if (list.length < 2) continue;
      const geos = list.map(m => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(m.matrix); return g; });
      const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos); geos.forEach(g => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder;
      m.userData.merged = true; node.add(m);
      before += list.length; after++;
      for (const o of list) node.remove(o);
    }
    for (const c of [...node.children]) if (c.children.length) visit(c);
  };
  visit(root);
  return { before, after };
}

/* client rooms and Planet studios: weld once the room (and its staff, frames and photo spots) is built */
{ const plainBuild = buildRoom; buildRoom = function(p){
    const r = plainBuild.apply(this, arguments);
    try {
      const skip = perfSkipSet([iSpin, iBlink, IST.flames, IST.pan, typeof FUN !== 'undefined' ? FUN.markers : null]);
      const st = mergeLeaves(iG, skip); PERF.lastRoom = st;
    } catch (e) { console.warn('merge room', e); }
    return r; }; }

/* the HQ is built once and kept: weld it once */
const PERF = { lastRoom: null, office: null };
if (typeof buildOffice === 'function'){ const plainOffice = buildOffice; buildOffice = function(){
    const r = plainOffice.apply(this, arguments);
    try { PERF.office = mergeLeaves(oGroup, perfSkipSet([typeof oStudio !== 'undefined' ? oStudio : null])); } catch (e) { console.warn('merge office', e); }
    return r; }; }

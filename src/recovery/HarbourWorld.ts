import { Box3, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Vector3 } from 'three';
import { createArmouredBaymax, mountArmour, seatOn } from '../characters/ArmouredBaymax';
import { Euler, Quaternion, type Object3D } from 'three';
import { assets } from '../systems/AssetManager';
import { mountChestBay } from '../characters/ChestBay';
import { createDistrict } from './district';
import type { JourneyWorld } from './journey';

export async function createHarbourWorld(): Promise<JourneyWorld> {
  const model = await assets.cloneBaymax();
  const district = createDistrict();
  const meshes: Mesh[] = []; model.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; meshes.push(n); } });
  for (const side of [-1, 1]) {
    const hip = new Group(); hip.name = side < 0 ? 'hip-left' : 'hip-right';
    hip.position.set(side * .53, .55, .28); model.add(hip); model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const p = mesh.position, sx = side * p.x;
      const thigh = Math.abs(sx - .57) < .06 && Math.abs(p.y - .48) < .06;
      const foot = Math.abs(sx - .71) < .06 && (Math.abs(p.y - .26) < .06 || Math.abs(p.y - .04) < .06) && p.z > 1.2;
      if (thigh || foot) hip.attach(mesh);
    }
    hip.rotation.x = 1.45;
  }
  model.rotation.order = 'YXZ'; model.rotation.set(-Math.PI / 2, -.5, -.08); model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model), center = bounds.getCenter(new Vector3()), a = district.baymaxAnchor;
  model.position.set(a.x - center.x, -1.02 - bounds.min.y, a.z - center.z); model.updateMatrixWorld(true);
  // A little settling (tracker P5-02): the legs ease until his back rests on the apron instead of
  // being propped up on them, then the whole shell sinks in so everything touches the ground.
  const torso = meshes.reduce((big, m) => { const v = new Box3().setFromObject(m).getSize(new Vector3()); const bv = new Box3().setFromObject(big).getSize(new Vector3()); return v.x * v.y * v.z > bv.x * bv.y * bv.z ? m : big; });
  const hips = model.children.filter(c => c.name.startsWith('hip-'));
  const lift = () => { model.updateMatrixWorld(true); return new Box3().setFromObject(torso).min.y - new Box3().setFromObject(model).min.y; };
  for (let i = 0, gap = lift(); i < 40 && gap > .02; i++) {
    let best = 0, bestGap = gap;
    for (const d of [-.04, .04]) { hips.forEach(h => { h.rotation.x += d; }); const g = lift(); if (g < bestGap) { best = d; bestGap = g; } hips.forEach(h => { h.rotation.x -= d; }); }
    if (!best) break;
    hips.forEach(h => { h.rotation.x += best; }); gap = bestGap;
  }
  model.updateMatrixWorld(true);
  model.position.y += -1.02 - new Box3().setFromObject(model).min.y - .1; model.updateMatrixWorld(true);
  const bay = mountChestBay(model);
  // He's been on the combat chip since the opening: armoured (tracker PW-03). The suit is posed from
  // this rig's hips; the white body hides (the chest bay stays) and he's re-seated on the suit's shape.
  const armoured = await createArmouredBaymax({ hole: () => bay.holeOpen ? bay.root.getObjectByName('dock')?.getWorldPosition(new Vector3()) ?? null : null });
  mountArmour(armoured, model, { y: .55, z: .28 }, 2.42);
  const legQ = (h: Object3D | undefined) => h ? new Quaternion().setFromEuler(new Euler(h.rotation.x - 1.42, 0, h.rotation.z)) : undefined;
  armoured.set(1); armoured.drive({ legL: legQ(hips.find(h => h.name === 'hip-right')), legR: legQ(hips.find(h => h.name === 'hip-left')) });
  meshes.forEach(m => { let q: Object3D | null = m; while (q && q !== bay.root) q = q.parent; if (!q) m.visible = false; });
  // The chest bay sits in the suit's plating, not floating where the white chest was (tracker N-03).
  armoured.seatOnPlate(bay.root, .2, .2, .235, 1.2);
  model.updateMatrixWorld(true);
  model.position.y += -1.02 - new Box3().setFromObject(armoured.root, true).min.y - .06; model.updateMatrixWorld(true);
  const red = new PointLight('#ff3626', .35, 3.5, 2); red.position.set(.42, 2.2, .9); model.add(red);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!, gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,.6)'); gradient.addColorStop(.5, 'rgba(0,0,0,.28)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(c), material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const shadow = new Mesh(new PlaneGeometry(4.6, 5.6), material);
  shadow.rotation.set(-Math.PI / 2, 0, -.5); shadow.position.set(a.x, -1.008, a.z); district.group.add(shadow);
  const disposeDistrict = district.dispose;
  district.dispose = () => { armoured.dispose(); texture.dispose(); material.dispose(); shadow.geometry.dispose(); disposeDistrict(); };
  return { baymax: model, bay, district, armoured };
}

let prepared: Promise<JourneyWorld> | null = null;
export function preloadHarbour() {
  prepared ??= createHarbourWorld().catch(error => { prepared = null; throw error; });
  return prepared;
}
export function takeHarbour() { const world = prepared ?? createHarbourWorld(); prepared = null; return world; }

import * as T from 'three';
import { createDistrict } from '../recovery/district';
import { assets } from '../systems/AssetManager';
import { mountChestBay } from '../characters/ChestBay';
import { createLimiter } from '../phase4/limiter';

/**
 * Back at the harbour bay: the same district and the same Baymax pose as the landing and the
 * engineering board (on his apron, clear of the debris), plus the power regulator Hiro found in
 * Bay 6 (Phase 4's createLimiter), cabled into his open bay. Its gauge and lamp show the load.
 */
export async function createBay() {
  const district = createDistrict();
  const model = await assets.cloneBaymax();

  // The landing's pose, exactly: legs unfolded, lying on his back on the apron.
  const meshes: T.Mesh[] = []; model.traverse(n => { if (n instanceof T.Mesh) meshes.push(n); });
  for (const side of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(side * .53, .55, .28); model.add(hip); model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const p = mesh.position, sx = side * p.x;
      const thigh = Math.abs(sx - .57) < .06 && Math.abs(p.y - .48) < .06;
      const foot = Math.abs(sx - .71) < .06 && (Math.abs(p.y - .26) < .06 || Math.abs(p.y - .04) < .06) && p.z > 1.2;
      if (thigh || foot) hip.attach(mesh);
    }
    hip.rotation.x = 1.45;
  }
  model.rotation.order = 'YXZ'; model.rotation.set(-Math.PI / 2, -.5, -.08); model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3()), a = district.baymaxAnchor;
  model.position.set(a.x - center.x, -1 - bounds.min.y, a.z - center.z); model.updateMatrixWorld(true);
  const bay = mountChestBay(model);
  district.group.add(model);
  const body = new T.Box3().setFromObject(model).getCenter(new T.Vector3());

  // His eyes and head: the only things that change when he comes back up.
  const eyes: T.MeshBasicMaterial[] = []; let head: T.Object3D | null = null;
  model.traverse(o => {
    if (o.name === 'dormant-head') head = o;
    if (o instanceof T.Mesh && o.name.startsWith('dormant-eye')) { const m = (o.material as T.MeshBasicMaterial).clone(); m.toneMapped = false; o.material = m; eyes.push(m); }
  });
  const headBase = head ? (head as T.Object3D).rotation.clone() : new T.Euler();
  // His body axis (hips → head) and the side facing the lane: the camera and the limiter work from there.
  const headWorld = head ? (head as T.Object3D).getWorldPosition(new T.Vector3()) : body.clone().add(new T.Vector3(0, 0, -1));
  const axis = headWorld.clone().sub(body).setY(0).normalize();
  const side = new T.Vector3(-axis.z, 0, axis.x); if (side.x > 0) side.negate();
  const red = new T.PointLight('#ff2a1c', 0, 6, 1.8); red.position.copy(body).add(new T.Vector3(-.6, 1.2, .4)); district.group.add(red);

  const limiter = createLimiter();
  limiter.scale.setScalar(1.15);
  const ground = -1.02;
  const staged = body.clone().addScaledVector(side, 2.9).addScaledVector(axis, -.4).setY(ground);
  const fitted = body.clone().addScaledVector(side, 1.75).addScaledVector(axis, .2).setY(ground);
  limiter.position.copy(staged); limiter.rotation.y = .5; district.group.add(limiter);
  // Feed cable from the limiter into the chest bay, drawn once the unit is in place.
  const dock = bay.dockWorld().clone();
  const cableCurve = new T.CatmullRomCurve3([fitted.clone().add(new T.Vector3(0, .14, 0)), fitted.clone().addScaledVector(side, -.55).setY(ground + .05), dock.clone().addScaledVector(side, .5).setY(dock.y + .25), dock]);
  const cable = new T.Mesh(new T.TubeGeometry(cableCurve, 40, .028, 8), new T.MeshStandardMaterial({ color: '#1b1d1f', roughness: .7 }));
  cable.visible = false; district.group.add(cable);

  let shake = 0; const baseY = model.position.y;
  return {
    district, model, bay, body, side, axis,
    /** fitted: 0 staged → 1 on his flank. power: 0 dormant → 1 running against the limit. */
    update(t: number, dt: number, s: { fitted: number; power: number; held: boolean }) {
      district.update(t, dt, false);
      limiter.position.lerpVectors(staged, fitted, T.MathUtils.smootherstep(s.fitted, 0, 1));
      limiter.position.y = ground + Math.sin(Math.PI * s.fitted) * .35;
      limiter.rotation.y = Math.atan2(axis.x, axis.z) + T.MathUtils.lerp(.5, 0, s.fitted);
      cable.visible = s.fitted > .99;
      limiter.led.color.set(s.power > .05 ? '#ffb15a' : s.fitted > .99 ? '#7dffa6' : '#2a3a33');
      // The needle climbs with the load and stops short of the red: that's the limit holding.
      limiter.setGauge(s.fitted > .99 ? .1 + Math.min(s.power, 1) * .32 + Math.sin(t * 9) * .006 * s.power : .05);
      // Powered against the limit: eyes go red, the head turns toward Hiro, the body strains and settles.
      const p = s.power;
      eyes.forEach(m => m.color.set('#0b0f11').lerp(new T.Color('#ff2414'), p).multiplyScalar(1 + p * .6));
      red.intensity = p * (1.6 + .5 * Math.sin(t * 2.3));
      if (head) (head as T.Object3D).rotation.set(headBase.x - .18 * p, headBase.y + .42 * p, headBase.z * (1 - p));
      const strain = s.held ? 0 : Math.max(0, Math.sin(Math.min(1, p * 1.4) * Math.PI));
      shake = T.MathUtils.damp(shake, strain, 6, dt);
      model.position.y = baseY + Math.sin(t * 17) * .006 * shake + strain * .05;
      model.rotation.z = -.08 + Math.sin(t * 11) * .012 * shake;
      bay.update({ t, open: 4.6, seated: 1, red: .9, seamGlow: .15 + p * .35 });
    },
    dispose() { limiter.dispose(); bay.dispose(); district.dispose(); },
  };
}
export type Bay = Awaited<ReturnType<typeof createBay>>;

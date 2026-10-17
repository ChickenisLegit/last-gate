import * as T from 'three';
import { createHarbourWorld } from '../recovery/HarbourWorld';
import { createLimiter } from '../phase4/parts';

/**
 * Back at the harbour bay: the same district and the same Baymax pose as the landing and the
 * engineering board (on his apron, clear of the debris), plus the limiter recovered in Bay 6.
 * The recovered limiter is a single intact industrial unit, cabled into his open bay.
 */
export async function createBay() {
  const { district, baymax: model, bay } = await createHarbourWorld();
  district.group.add(model);
  district.group.traverse(object => {
    if (!('isPointLight' in object)) return;
    for (let parent = object.parent; parent; parent = parent.parent) if (parent === bay.root) return;
    object.visible = false;
  });
  const body = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
  const arm = new T.Group(); arm.name = 'baymax-output-test-arm'; arm.position.set(1.02, 2.26, .02); model.add(arm); model.updateMatrixWorld(true);
  const armMeshes: T.Mesh[] = []; model.traverse(o => { if (o instanceof T.Mesh) armMeshes.push(o); });
  for (const mesh of armMeshes) {
    const p = mesh.position;
    const upper = Math.abs(p.x - 1.12) < .06 && Math.abs(p.y - 1.7) < .06;
    const fore = Math.abs(p.x - 1.23) < .06 && Math.abs(p.y - .82) < .06;
    const hand = Math.abs(p.x - 1.25) < .06 && Math.abs(p.y - .35) < .06;
    const finger = p.x > 1 && p.x < 1.5 && Math.abs(p.y - .29) < .03 && p.z > .7;
    if (upper || fore || hand || finger) arm.attach(mesh);
  }

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
  limiter.scale.setScalar(.44);
  const statusMaterial = new T.MeshBasicMaterial({ color: '#2a3a33', toneMapped: false });
  const status = new T.Mesh(new T.BoxGeometry(.16, .05, .02), statusMaterial);
  status.position.set(.6, 2.52, .69); limiter.add(status);
  const ground = -1.02;
  const staged = body.clone().addScaledVector(side, 2.9).addScaledVector(axis, -.4).setY(ground);
  const fitted = body.clone().addScaledVector(side, 1.75).addScaledVector(axis, .2).setY(ground);
  limiter.position.copy(staged); limiter.rotation.y = .5; district.group.add(limiter);
  // Feed cable from the limiter into the chest bay, drawn once the unit is in place.
  const dock = bay.dockWorld().clone();
  const cableCurve = new T.CatmullRomCurve3([fitted.clone().add(new T.Vector3(0, .14, 0)), fitted.clone().addScaledVector(side, -.55).setY(ground + .05), dock.clone().addScaledVector(side, .5).setY(dock.y + .25), dock]);
  const cable = new T.Mesh(new T.TubeGeometry(cableCurve, 40, .028, 8), new T.MeshStandardMaterial({ color: '#1b1d1f', roughness: .7 }));
  cable.name = 'limiter-feed';
  cable.visible = false; district.group.add(cable);
  const plug = new T.Mesh(new T.CylinderGeometry(.055, .055, .16, 16), new T.MeshStandardMaterial({ color: '#9a9f94', metalness: .75, roughness: .3 }));
  plug.name = 'limiter-connector';
  district.group.add(plug); plug.visible = false;
  const tangent = new T.Vector3(), up = new T.Vector3(0, 1, 0), redEye = new T.Color('#ff2414');

  let shake = 0; const baseY = model.position.y;
  return {
    district, model, bay, body, side, axis,
    /** fitted: 0 staged → 1 on his flank. power: 0 dormant → 1 running against the limit. */
    update(t: number, dt: number, s: { fitted: number; power: number; held: boolean }) {
      district.update(t, dt, false);
      limiter.position.lerpVectors(staged, fitted, T.MathUtils.smootherstep(s.fitted, 0, 1));
      limiter.position.y = ground + Math.sin(Math.PI * s.fitted) * .12;
      limiter.rotation.y = Math.atan2(axis.x, axis.z) + T.MathUtils.lerp(.5, 0, s.fitted);
      const connected = T.MathUtils.smoothstep(s.fitted, .55, 1);
      cable.visible = connected > 0; plug.visible = connected > 0;
      cable.geometry.setDrawRange(0, Math.floor(cable.geometry.index!.count * connected / 3) * 3);
      cableCurve.getPoint(connected, plug.position); cableCurve.getTangent(connected, tangent); plug.quaternion.setFromUnitVectors(up, tangent);
      statusMaterial.color.set(s.power > .05 ? '#ffb15a' : s.fitted > .99 ? '#7dffa6' : '#2a3a33');
      // Powered against the limit: eyes go red, the head turns toward Hiro, the body strains and settles.
      const p = s.power;
      eyes.forEach(m => m.color.set('#0b0f11').lerp(redEye, p).multiplyScalar(1 + p * .6));
      red.intensity = p * (1.6 + .5 * Math.sin(t * 2.3));
      if (head) (head as T.Object3D).rotation.set(headBase.x - .18 * p, headBase.y + .42 * p, headBase.z * (1 - p));
      // The shoulder tries to reach Hiro, then settles against the limited physical feed.
      arm.rotation.z = T.MathUtils.damp(arm.rotation.z, .42 * p, 2.4, dt);
      arm.rotation.x = T.MathUtils.damp(arm.rotation.x, -.16 * p, 2.4, dt);
      const strain = s.held ? 0 : Math.max(0, Math.sin(Math.min(1, p * 1.4) * Math.PI));
      shake = T.MathUtils.damp(shake, strain, 6, dt);
      model.position.y = baseY + Math.sin(t * 17) * .006 * shake + strain * .05;
      model.rotation.z = -.08 + Math.sin(t * 11) * .012 * shake;
      bay.update({ t, open: 4.6, seated: 1, red: .9, seamGlow: .15 + p * .35 });
    },
    dispose() {
      for (const root of [limiter, cable, plug]) root.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
      // Recovered part materials are shared across the chapter boundary.
      for (const mesh of [status, cable, plug]) (mesh.material as T.Material).dispose();
      eyes.forEach(m => m.dispose()); bay.dispose(); district.dispose();
    },
  };
}
export type Bay = Awaited<ReturnType<typeof createBay>>;

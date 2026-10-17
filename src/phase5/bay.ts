import * as T from 'three';
import { createHarbourWorld } from '../recovery/HarbourWorld';
import { createLimiter } from '../phase4/limiter';

/**
 * Back at the harbour bay: the same district and the same Baymax pose as the landing and the
 * engineering board (on his apron, clear of the debris), plus the power regulator Hiro found in
 * Bay 6 (Phase 4's createLimiter), lifted off the apron and docked into a slot on his flank. Its gauge
 * and lamp show the load.
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
  limiter.scale.setScalar(.8);
  const ground = -1.02;
  const staged = body.clone().addScaledVector(side, 2.6).addScaledVector(axis, -.4).setY(ground);
  limiter.position.copy(staged); limiter.rotation.y = .5; district.group.add(limiter);
  // The slot: a recessed port on his flank, facing the lane, at the height of his side.
  // Found by casting in from the lane at mid-torso height, so it sits on his actual surface.
  const box = new T.Box3().setFromObject(model), midY = T.MathUtils.lerp(box.min.y, box.max.y, .45);
  const from = body.clone().addScaledVector(side, 4).addScaledVector(axis, .15).setY(midY);
  const hit = new T.Raycaster(from, side.clone().negate(), 0, 8).intersectObject(model, true)[0];
  const port = hit ? hit.point.clone().addScaledVector(side, -.04) : body.clone().addScaledVector(side, 1.2).setY(midY);
  const slot = new T.Group(); slot.position.copy(port); slot.lookAt(port.clone().add(side)); district.group.add(slot);
  const slotMat = new T.MeshStandardMaterial({ color: '#2a2f33', metalness: .6, roughness: .45 });
  const rimMat = new T.MeshStandardMaterial({ color: '#9a9f94', metalness: .8, roughness: .3 });
  const slotGeos = [new T.BoxGeometry(.42, .3, .06), new T.TorusGeometry(.26, .022, 8, 32)];
  slot.add(new T.Mesh(slotGeos[0], slotMat)); const rim = new T.Mesh(slotGeos[1], rimMat); rim.scale.set(1, .72, 1); rim.position.z = .03; slot.add(rim);
  const mouth = port.clone().addScaledVector(side, .7).setY(port.y + .1), seated = port.clone().addScaledVector(side, .16);
  const faceSlot = Math.atan2(-side.x, -side.z), tmpP = new T.Vector3(), redEye = new T.Color('#ff2414');
  let shake = 0, clunk = 0, contacted = false; const baseY = model.position.y, baseRotZ = model.rotation.z;
  const hipsP5 = model.children.filter(c => c.name.startsWith('hip-')), hipBase = hipsP5.map(h => h.rotation.x);
  const limiterBase = new T.Vector3();
  const ss = (x: number, a: number, b: number) => T.MathUtils.smoothstep(x, a, b), pulse = (x: number, a: number, b: number) => Math.sin(Math.PI * T.MathUtils.clamp((x - a) / (b - a), 0, 1));
  return {
    district, model, bay, body, side, axis,
    /** fitted: 0 staged → 1 on his flank. power: 0 dormant → 1 running against the limit. */
    update(t: number, dt: number, s: { fitted: number; power: number; held: boolean }) {
      district.update(t, dt, false);
      // Lift off the apron and carry to the slot mouth (0–.6), line up (.6–.8), push home with a
      // small settle (.8–1).
      const f = s.fitted, carry = T.MathUtils.smootherstep(f, 0, .6), push = T.MathUtils.smootherstep(f, .8, .97);
      tmpP.lerpVectors(staged, mouth, carry); tmpP.y = T.MathUtils.lerp(ground, mouth.y, carry) + Math.sin(Math.PI * carry) * .35;
      limiter.position.copy(tmpP).lerp(seated, push);
      limiter.position.addScaledVector(side, -Math.sin(Math.PI * T.MathUtils.clamp((f - .95) / .05, 0, 1)) * .02);
      limiter.rotation.set(T.MathUtils.lerp(0, -Math.PI / 2, T.MathUtils.smoothstep(f, .3, .75)), T.MathUtils.lerp(.5, faceSlot, T.MathUtils.smoothstep(f, .2, .8)), 0, 'YXZ');
      rimMat.emissive.set(f > .97 ? '#ffb15a' : '#000000'); rimMat.emissiveIntensity = f > .97 ? .6 + .4 * s.power : 0;
      limiter.led.color.set(s.power > .05 ? '#ffb15a' : s.fitted > .99 ? '#7dffa6' : '#2a3a33');
      // The needle climbs with the load and stops short of the red: that's the limit holding.
      limiter.setGauge(s.fitted > .99 ? .1 + Math.min(s.power, 1) * .32 + Math.sin(t * 9) * .006 * s.power : .05);
      // Powered against the limit: eyes go red, the head turns toward Hiro, the body strains and settles.
      const p = s.power;
      eyes.forEach(m => m.color.set('#0b0f11').lerp(redEye, p).multiplyScalar(1 + p * .6));
      red.intensity = p * (1.6 + .5 * Math.sin(t * 2.3));
      // The power-up against the limit (tracker PW-05). Power arrives as a twitch; he rolls toward
      // Hiro, lifts his head, kicks and reaches; the reach hits the limiter's ceiling with a clunk and
      // shudders there. Held, he sags back and keeps testing it, always stopping at the same height.
      const LIMIT = .55;
      const twitch = pulse(p, .04, .12) * Math.sin(t * 40) * .06;
      const wantReach = ss(p, .12, .62), reach = Math.min(wantReach, LIMIT);
      const press = Math.max(0, wantReach - LIMIT) / (1 - LIMIT);
      if (!s.held && press > .02 && !contacted) { contacted = true; clunk = 1; }
      if (p < .05) contacted = false;
      clunk = Math.max(0, clunk - dt * 2.2);
      const test = s.held ? Math.pow(Math.max(0, Math.sin(t * 2.4)), 8) : 0;
      const holdSag = s.held ? .72 + .28 * test : 1;
      const tremble = (press * .9 + clunk + test * .7) * Math.sin(t * 38) * .03;
      arm.rotation.z = T.MathUtils.damp(arm.rotation.z, .78 * reach * holdSag + twitch + tremble - clunk * .06, 6, dt);
      arm.rotation.x = T.MathUtils.damp(arm.rotation.x, -.3 * reach * holdSag + tremble * .5, 6, dt);
      // Body: rolls up onto his side toward Hiro as he tries to rise, held down at the limit.
      const rise = Math.min(ss(p, .15, .55), .6) * holdSag;
      model.rotation.z = baseRotZ + .07 * rise + Math.sin(t * 31) * .006 * (press + clunk) + Math.sin(t * 11) * .01 * shake;
      model.position.y = baseY + .045 * rise + clunk * .02 + Math.sin(t * 17) * .005 * shake;
      shake = T.MathUtils.damp(shake, s.held ? test : Math.min(1, press + clunk), 6, dt);
      // Head lifts off the apron toward Hiro, pushing forward at the limit.
      if (head) (head as T.Object3D).rotation.set(headBase.x - .24 * rise - .05 * press, headBase.y + .42 * ss(p, .1, .5), headBase.z * (1 - p) + tremble * .4);
      // One leg kicks as he first tries to get his feet under him.
      hipsP5.forEach((h, i) => { h.rotation.x = hipBase[i] + (i === 0 ? -.22 : -.1) * pulse(p, .25, .5) * (s.held ? 0 : 1); });
      // The limiter takes the load: it buzzes and its lamp flares on contact and each renewed push.
      if (!limiterBase.lengthSq() && s.fitted > .99) limiterBase.copy(limiter.position);
      if (limiterBase.lengthSq() && s.fitted > .99) limiter.position.copy(limiterBase).addScaledVector(side, Math.sin(t * 57) * .006 * (press + clunk + test));
      if (clunk > .5 || test > .6) limiter.led.color.set('#fff1c4');
      bay.update({ t, open: 4.6, seated: 1, red: .9, seamGlow: .15 + p * .35 });
    },
    dispose() {
      limiter.dispose();
      slotGeos.forEach(g => g.dispose()); slotMat.dispose(); rimMat.dispose(); slot.removeFromParent();
      eyes.forEach(m => m.dispose()); bay.dispose(); district.dispose();
    },
  };
}
export type Bay = Awaited<ReturnType<typeof createBay>>;

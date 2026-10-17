import * as T from 'three';
import { createHarbourWorld } from '../recovery/HarbourWorld';
import { createLimiter } from '../phase4/limiter';

/**
 * Back at the harbour bay: the same district and the same Baymax pose as the landing and the
 * engineering board (on his apron, clear of the debris), plus the power regulator Hiro found in
 * Bay 6 (Phase 4's createLimiter), lifted off the apron and fitted flat onto his right chest plate,
 * where it stays for the rest of the story. Its gauge and lamp show the load.
 */
export async function createBay() {
  const { district, baymax: model, bay, armoured } = await createHarbourWorld();
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
  limiter.scale.setScalar(.62);
  const ground = -1.02;
  const staged = body.clone().addScaledVector(side, 2.6).addScaledVector(axis, -.4).setY(ground);
  limiter.position.copy(staged); limiter.rotation.y = .5; district.group.add(limiter);
  // The limiter's mount (tracker N-04): flat on his right chest plate, face out, long side along his
  // body. Kept relative to the chest bone so it moves with him once fitted.
  const tmpP = new T.Vector3(), redEye = new T.Color('#ff2414'), tmpM = new T.Matrix4();
  const mountLocal = new T.Matrix4(), mountPos = new T.Vector3(), mountQ = new T.Quaternion(), mountS = new T.Vector3(), mountN = new T.Vector3();
  const stagedQ = new T.Quaternion().setFromEuler(new T.Euler(0, .5, 0));
  const spot = armoured?.chestFrame(-.3, .36) ?? null;
  if (spot) {
    const n = spot.n;
    const mw = new T.Matrix4().makeBasis(spot.x, n, spot.z).setPosition(spot.point.clone().addScaledVector(n, -.02)).scale(limiter.scale.clone());
    mountLocal.copy(spot.bone.matrixWorld).invert().multiply(mw);
  }
  let shake = 0, clunk = 0, contacted = false; const baseY = model.position.y, baseRotZ = model.rotation.z;
  const hipsP5 = model.children.filter(c => c.name.startsWith('hip-')), hipBase = hipsP5.map(h => h.rotation.x);
  const headQ = new T.Quaternion(), headRestInv = new T.Quaternion().setFromEuler(headBase).invert(), legE = new T.Euler();
  const legQ = (h: T.Object3D | undefined) => h ? new T.Quaternion().setFromEuler(legE.set(h.rotation.x - 1.42, 0, h.rotation.z)) : undefined;
  const ss = (x: number, a: number, b: number) => T.MathUtils.smoothstep(x, a, b), pulse = (x: number, a: number, b: number) => Math.sin(Math.PI * T.MathUtils.clamp((x - a) / (b - a), 0, 1));
  return {
    district, model, bay, body, side, axis,
    /** fitted: 0 staged → 1 on his flank. power: 0 dormant → 1 running against the limit. */
    update(t: number, dt: number, s: { fitted: number; power: number; held: boolean }) {
      district.update(t, dt, false);
      // Lift off the apron and carry to the slot mouth (0–.6), line up (.6–.8), push home with a
      // small settle (.8–1).
      const f = s.fitted, carry = T.MathUtils.smootherstep(f, 0, .6), push = T.MathUtils.smootherstep(f, .75, .97);
      if (spot) tmpM.copy(spot.bone.matrixWorld).multiply(mountLocal).decompose(mountPos, mountQ, mountS);
      mountN.set(0, 1, 0).applyQuaternion(mountQ);
      tmpP.lerpVectors(staged, mountPos.clone().addScaledVector(mountN, .5), carry); tmpP.y += Math.sin(Math.PI * carry) * .35;
      limiter.position.copy(tmpP).lerp(mountPos, push);
      limiter.position.addScaledVector(mountN, -Math.sin(Math.PI * T.MathUtils.clamp((f - .95) / .05, 0, 1)) * .02);
      limiter.quaternion.copy(stagedQ).slerp(mountQ, T.MathUtils.smoothstep(f, .25, .8));
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
      if (s.fitted > .99) limiter.position.addScaledVector(mountN, Math.sin(t * 57) * .005 * (press + clunk + test));
      if (clunk > .5 || test > .6) limiter.led.color.set('#fff1c4');
      // The suit follows this rig: his reaching arm (+x pivot = the suit's left), the leg kick, the head.
      if (armoured) armoured.drive({
        armL: arm.quaternion,
        legL: legQ(hipsP5.find(h => h.name === 'hip-right')), legR: legQ(hipsP5.find(h => h.name === 'hip-left')),
        head: head ? headQ.setFromEuler((head as T.Object3D).rotation).multiply(headRestInv) : undefined,
      });
      bay.update({ t, open: 4.6, seated: 1, red: .9, seamGlow: .15 + p * .35 });
    },
    dispose() {
      limiter.dispose();
      eyes.forEach(m => m.dispose()); bay.dispose(); district.dispose();
    },
  };
}
export type Bay = Awaited<ReturnType<typeof createBay>>;

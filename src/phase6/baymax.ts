import * as T from 'three';
import { createArmouredBaymax, mountArmour, seatOn } from '../characters/ArmouredBaymax';
import { createLimiter } from '../phase4/limiter';
import { assets } from '../systems/AssetManager';
import { mountChestBay } from '../characters/ChestBay';

/**
 * The same Baymax as Phase 5 (the shell GLB, the Phase 1 skin, armour and chest bay), hinged so he
 * can get up and move: hips and ankles for the legs, shoulders for the arms, the head as is. The
 * shell is authored sitting, legs forward; `sit` 1 is that pose, 0 is standing.
 *
 * Every frame the director writes a Pose and calls update(); nothing here keeps story state.
 */
export type Pose = {
  sit: number; lie: number; lean: number; guard: number; punch: number; hold: number;
  stride: number; gait: number; dangle: number; yaw: number;
  head: [number, number, number];
  eyes: T.Color; eyeGlow: number; thrust: number; sputter: number;
  open: number; chipGlow: number; chipInBay: boolean; careSeated: boolean;
  /** 0..1 how much of the combat armour he's wearing (the combat chip's; it comes off at the boot). */
  armour: number;
  /** The fitted limiter is switched on (Hiro's regulator remote). */
  limiterOn: number;
  /** 0..1 arms trailing up over his head (lying, dragged by the feet). */
  overhead: number;
  /**
   * 0..1 through the staged get-up from lying on his back: sit up (pushing on the ground behind),
   * settle, lean over his feet with his hands planted, push up, wobble to a stand. Overrides
   * lie/sit/lean while above 0. Like tension and sluggish, it is cleared after each update(), so
   * the director writes it every frame it wants it.
   */
  getUp: number;
  /** Force the combat tension or the limited sluggishness (otherwise read from guard, eyes and sputter). */
  tension: number; sluggish: number;
};
export const restPose = (): Pose => ({
  sit: 1, lie: 0, lean: 0, guard: 0, punch: 0, hold: 0, stride: 0, gait: 0, dangle: 0, yaw: 0,
  head: [0, 0, 0], eyes: new T.Color('#0b0f11'), eyeGlow: 0, thrust: 0, sputter: 0,
  open: 0, chipGlow: 0, chipInBay: true, careSeated: false, getUp: 0, tension: 0, sluggish: 0, armour: 1, overhead: 0, limiterOn: 0,
});

const FLAME_VS = 'varying vec2 vUv;varying float vFace;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vFace=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}';
// A soft additive jet: white core into orange, flickering along its length.
const FLAME_FS = `varying vec2 vUv;varying float vFace;uniform float uTime;uniform float uPower;
void main(){float along=vUv.y;float core=pow(vFace,1.6);
float flick=.75+.25*sin(uTime*53.+along*17.)*sin(uTime*31.+vUv.x*9.);
float a=core*pow(1.-along,1.4)*uPower*flick;
vec3 c=mix(vec3(1.,.36,.12),vec3(1.,.93,.78),pow(1.-along,3.));
gl_FragColor=vec4(c*a*1.6,a);}`;

export async function createBaymax() {
  const model = await assets.cloneBaymax();
  const meshes: T.Mesh[] = []; model.traverse(n => { if (n instanceof T.Mesh) meshes.push(n); });
  const near = (a: number, b: number, tol = .06) => Math.abs(a - b) < tol;

  // Hinges, built in the authored (sitting) pose so attach() keeps every mesh where it was.
  const hips: T.Group[] = [], ankles: T.Group[] = [], shoulders: T.Group[] = [];
  let palm: T.Mesh | null = null, fist: T.Mesh | null = null;
  for (const side of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(side * .53, .55, .28); model.add(hip);
    const ankle = new T.Group(); ankle.position.set(side * .18, -.27, .86); hip.add(ankle);
    const shoulder = new T.Group(); shoulder.position.set(side * .98, 2.42, 0); model.add(shoulder);
    model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const p = mesh.position, sx = side * p.x;
      if (near(sx, .57) && near(p.y, .48)) hip.attach(mesh);
      else if (near(sx, .71) && (near(p.y, .26) || near(p.y, .04)) && p.z > 1.2) ankle.attach(mesh);
      else if (sx > .8 && p.y < 2.45 && !(near(p.y, .48) || p.z > 1.2)) { if (near(sx, 1.25) && near(p.y, .35)) { if (side < 0) palm = mesh; else fist = mesh; } shoulder.attach(mesh); }
    }
    hips.push(hip); ankles.push(ankle); shoulders.push(shoulder);
  }
  const bay = mountChestBay(model);

  let head: T.Object3D | null = null;
  model.traverse(o => { if (o.name === 'dormant-head') head = o; });
  const headNode = head as T.Object3D | null;
  const headBase = headNode ? headNode.rotation.clone() : new T.Euler();
  // The eyes and the line between them share one material: dark, red, or soft white.
  const eyeMat = new T.MeshBasicMaterial({ color: '#0b0f11', toneMapped: false });
  headNode?.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshBasicMaterial) o.material = eyeMat; });
  // The combat armour (tracker PW-03): the armoured suit, mounted in this rig and posed from it.
  const holeAt = new T.Vector3();
  const armoured = await createArmouredBaymax({ eye: eyeMat, hole: () => bay.holeOpen ? bay.root.getObjectByName('dock')!.getWorldPosition(holeAt) : null });
  mountArmour(armoured, model, { y: .55, z: .28 }, 2.42);
  // The limiter Hiro fitted in Phase 5 stays on his chest plate (tracker N-04); Hiro's remote drives its lamp.
  // Smaller and centred on the plate, so it lies inside his outline from every angle, even lying on his back (tracker R-08).
  const limiter = createLimiter(); limiter.scale.setScalar(.46 / armoured.root.scale.x); armoured.root.add(limiter);
  armoured.drive({}); armoured.mountOnChest(limiter, -.3, .24);
  // Phase 6 opens armoured: start fully on, so the warm-up draw compiles the opaque plates it will really use (tracker R-05).
  armoured.set(1);
  // While armoured the chest bay sits in the suit's chest plating (tracker N-03); it goes back on the white chest at the boot.
  let unseatBay: (() => void) | null = null;
  const under = (o: T.Object3D, roots: T.Object3D[]) => { for (let q: T.Object3D | null = o; q; q = q.parent) if (roots.includes(q)) return true; return false; };

  // Jets: two from the back pack, one under each foot.
  const flameMat = new T.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms: { uTime: { value: 0 }, uPower: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  // Base at the nozzle (origin), tip 1.6 m down -Y.
  const flameGeo = new T.ConeGeometry(.2, 1.6, 14, 1, true); flameGeo.rotateX(Math.PI); flameGeo.translate(0, -.8, 0);
  const flames: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    const back = new T.Mesh(flameGeo, flameMat); back.position.set(side * .26, 1.75, -.78); back.rotation.x = .45; model.add(back); flames.push(back);
  }
  for (const ankle of ankles) {
    const foot = new T.Mesh(flameGeo, flameMat); foot.position.set(0, -.3, .42); foot.scale.setScalar(.8); ankle.add(foot); flames.push(foot);
  }
  flames.forEach(f => { f.renderOrder = 5; f.frustumCulled = false; });
  const jetLight = new T.PointLight('#ff8a46', 0, 9, 1.8); jetLight.position.set(0, -.6, 0); model.add(jetLight);

  // The combat chip in his dock; once the bay opens after the fall its glow pulses (the bay's own light follows it).
  const combatChip = bay.root.getObjectByName('combat-chip')!;
  const dock = bay.root.getObjectByName('dock')!;

  // His standing head height, measured once. (Each frame the shell itself is sat on the ground.)
  const root = new T.Group(); root.name = 'baymax-phase6';
  const body = new T.Group(); root.add(body); body.add(model);
  const setLegs = (sit: number) => {
    hips.forEach(h => { h.rotation.x = (1 - sit) * 1.42; });
    ankles.forEach(a => { a.rotation.x = -(1 - sit) * 1.42; });
  };
  const lowest = () => { model.updateMatrixWorld(true); return new T.Box3().setFromObject(model).min.y; };
  setLegs(0); const standDrop = -lowest();
  model.updateMatrixWorld(true);
  const headHeight = (headNode ? headNode.getWorldPosition(new T.Vector3()).y : 3) + standDrop;
  setLegs(1);

  const pose = restPose();
  // Smoothed copies of the pose (springs) and the rig's own memory.
  const cur: Record<string, number> = { guard: 0, punch: 0, lean: 0, hold: 0, dangle: 0, stride: 0, h0: 0, h1: 0, h2: 0, yaw: 0, squash: 0, pitch: 0, bank: 0, flail: 0, flop: 0, wob: 0 };
  const vel: Record<string, number> = Object.fromEntries(Object.keys(cur).map(k => [k, 0]));
  let last = -1, lastDt = 1 / 60, first = true, shuffle = 0, lastStep = 0, stoodUp = false, braced = false, prevVy = 0;
  // His own motion, measured from where the director put him: flight posture and falls read it.
  const prevPos = new T.Vector3(), rawV = new T.Vector3(), velS = new T.Vector3(), accS = new T.Vector3(), rawA = new T.Vector3(), wp = new T.Vector3();
  const spring = (key: string, target: number, k: number, zeta: number, snap: boolean) => {
    if (snap) { cur[key] = target; vel[key] = 0; return; }
    vel[key] += ((target - cur[key]) * k * k - 2 * zeta * k * vel[key]) * lastDt; cur[key] += vel[key] * lastDt;
  };
  const kick = (amount: number) => { vel.squash += amount * 6; };
  const mode = { tense: 0, slug: 0 };
  const shell = meshes.filter(m => { m.geometry.computeBoundingBox(); return !!m.geometry.boundingBox; });
  // While he's armoured: the white body hides (the chest bay stays), and his torso plus the suit's feet ground him.
  const whiteParts = meshes.filter(m => !under(m, [bay.root]));
  const whiteTorso = shell.filter(m => !under(m, [...hips, ...shoulders]));
  const qA = new T.Quaternion(), qB = new T.Quaternion(), qC = new T.Quaternion(), qD = new T.Quaternion(), qH = new T.Quaternion(), eul = new T.Euler(), headRest = new T.Quaternion();
  const box = new T.Box3();
  return {
    root, model, bay, pose, combatChip, dock, eyeMat,
    /** World position of the dock (the chip's seat). */
    dockWorld: (out = new T.Vector3()) => dock.getWorldPosition(out),
    headWorld: (out = new T.Vector3()) => (headNode ?? model).getWorldPosition(out),
    /** His right hand (the one Hiro takes). */
    handWorld: (out = new T.Vector3()) => (palm ?? model).getWorldPosition(out),
    /** His other hand, the one `punch` drives (and the fist bump). */
    fistWorld: (out = new T.Vector3()) => ((fist as T.Mesh | null) ?? model).getWorldPosition(out),
    headHeight,
    chestWorld: (out = new T.Vector3()) => bay.chestWorld(out),
    /** His current (smoothed) facing. */
    facing: () => cur.yaw,
    update(t: number) {
      armoured.set(pose.armour);
      limiter.visible = pose.armour > .5;
      limiter.led.color.set(pose.limiterOn > .5 ? '#ffb15a' : '#2a3a33'); limiter.setGauge(pose.limiterOn > .5 ? .35 + Math.sin(t * 9) * .006 : .05);
      const covered = armoured.covers(pose.armour); whiteParts.forEach(m => { m.visible = !covered; });
      const p = pose;
      const gap = last < 0 ? 1 : t - last; last = t;
      const dt = Math.min(.05, Math.max(0, gap)); lastDt = dt;
      // A long gap (a cut, a stage entered cold, the tab coming back) snaps instead of easing.
      const snap = dt === 0 || gap > .25 || first;
      first = false;

      // ── Mode: combat tension (red eyes, guard up, full power) vs limited sluggishness.
      const red = p.eyeGlow > .5 && p.eyes.r > .5 && p.eyes.g < .4 ? 1 : 0;
      const upright = (1 - p.lie) * (1 - p.sit);
      const tenseTarget = Math.max(p.tension, p.guard * red * (1 - Math.min(1, p.sputter)) * upright * (1 - p.dangle * .6));
      const slugTarget = Math.max(p.sluggish, Math.min(1, p.sputter) * upright);
      mode.tense += (tenseTarget - mode.tense) * (snap ? 1 : 1 - Math.exp(-dt * 4));
      mode.slug += (slugTarget - mode.slug) * (snap ? 1 : 1 - Math.exp(-dt * 2));
      const tense = mode.tense, slug = mode.slug;

      // ── Motion: velocity and acceleration of the root, smoothed, in his own frame.
      root.getWorldPosition(wp);
      if (snap) { prevPos.copy(wp); velS.set(0, 0, 0); accS.set(0, 0, 0); rawV.set(0, 0, 0); }
      else {
        rawV.copy(wp).sub(prevPos).divideScalar(Math.max(dt, 1e-3)); prevPos.copy(wp);
        rawA.copy(rawV).sub(velS).divideScalar(Math.max(dt, 1e-3));
        accS.lerp(rawA, 1 - Math.exp(-dt * 4)); velS.lerp(rawV, 1 - Math.exp(-dt * 8));
      }
      const fy = Math.sin(cur.yaw), fz = Math.cos(cur.yaw);
      const fwdSpeed = velS.x * fy + velS.z * fz, sideSpeed = velS.x * fz - velS.z * fy;
      const fwdAcc = accS.x * fy + accS.z * fz, sideAcc = accS.x * fz - accS.z * fy;
      const air = Math.min(1, p.dangle);
      // Flight: pitch into the speed and flare back when braking; bank into turns.
      spring('pitch', air * T.MathUtils.clamp(fwdSpeed * .045 - fwdAcc * .025, -.5, .55), 4, .72, snap);
      spring('bank', air * T.MathUtils.clamp(-sideAcc * .035 - sideSpeed * .02, -.55, .55), 3.4, .7, snap);
      const sweep = air * T.MathUtils.clamp(Math.abs(fwdSpeed) * .07, 0, .85);
      // Falling without thrust: arms and legs flail. Landing hard: a big squash, limbs flop, a wobble.
      const dropping = T.MathUtils.clamp((-rawV.y - 2) / 4, 0, 1) * (1 - Math.min(1, p.thrust * 2));
      spring('flail', dropping, 8, .6, snap);
      if (!snap && prevVy < -4 && rawV.y > -1.2) { kick(1.6); vel.flop += 7; vel.wob += 2.6 * (Math.sin(t * 13) > 0 ? 1 : -1); }
      prevVy = snap ? 0 : rawV.y;
      spring('flop', 0, 6, .3, false); spring('wob', 0, 4, .32, false);
      // How quickly he answers: snappy when fighting, syrupy when the limit is on.
      const rate = T.MathUtils.lerp(1, 1.8, tense) * T.MathUtils.lerp(1, .38, slug);

      // ── The staged get-up overrides the seat, lean and arms (lying → sat up → crouch → stand).
      let lie = p.lie, sit = p.sit, lean = p.lean, push = 0, brace = 0, tuck = 0;
      if (p.getUp > 0) {
        const g = p.getUp, k = (a: number, b: number) => T.MathUtils.smootherstep(g, a, b);
        const sitUp = k(0, .28), settle = k(.3, .42), crouch = k(.42, .64), rise = k(.62, .86);
        lie = 1 - sitUp;
        sit = sitUp * (1 - crouch * .62) * (1 - rise);
        lean = crouch * .52 * (1 - rise) + rise * .1 * (1 - k(.86, 1));
        push = sitUp * (1 - settle);       // hands pushing on the ground behind him as he sits up
        brace = crouch * (1 - rise * .8);   // hands planted at his sides as he leans over his feet
        tuck = Math.sin(Math.PI * sitUp) * .35 + crouch * .25 * (1 - rise);
        // Rocks forward twice to build up momentum, sinks into the push, rises, then settles.
        lean += Math.sin(Math.PI * 2 * k(.46, .62)) * .08;
        if (g > .6 && !braced) { braced = true; kick(.55); }
        if (g > .86 && !stoodUp) { stoodUp = true; kick(.9); vel.wob += 1.8; }
        if (g < .5) { stoodUp = false; braced = false; }
      }

      // ── Springs: what the director asks for, with weight. Arms overshoot a little.
      spring('guard', p.guard, 9 * rate, .75, snap);
      spring('punch', p.punch, (p.punch > cur.punch ? 11 : 6) * rate, .62, snap);
      spring('lean', lean + tense * .07 + slug * .06, 6 * rate, .8, snap);
      spring('hold', p.hold, 5 * rate, .85, snap);
      spring('dangle', p.dangle, 4.5, .7, snap);
      spring('stride', p.stride, 5 * rate, 1, snap);
      spring('h0', p.head[0], 7 * rate, .7, snap); spring('h1', p.head[1], 7 * rate, .7, snap); spring('h2', p.head[2], 7 * rate, .7, snap);
      // Facing: big jumps (a new shot) snap; anything else turns the body round with lag, the
      // head leading into the turn.
      let yawErr = Math.atan2(Math.sin(p.yaw - cur.yaw), Math.cos(p.yaw - cur.yaw));
      if (snap || Math.abs(yawErr) > 1.6) { cur.yaw = p.yaw; vel.yaw = 0; yawErr = 0; }
      else { const w = 5 * rate; vel.yaw += (yawErr * w * w - 2 * .9 * w * vel.yaw) * dt; cur.yaw += vel.yaw * dt; }
      // Turning on the spot shuffles the feet.
      const turning = Math.min(1, Math.abs(vel.yaw) * 1.4) * (1 - cur.stride) * upright * (1 - cur.dangle);
      if (turning > .05) shuffle += dt * 7 * Math.max(.4, turning);
      const shuffleAmp = turning * .35;

      // ── Steps: footfalls kick the shell's jiggle; the weight rolls over the stance foot.
      const stride = cur.stride, gait = p.gait;
      const step = Math.floor(gait / Math.PI);
      if (step !== lastStep) { if (stride > .2 && !snap) kick(.35 + slug * .35 + stride * .2); lastStep = step; }
      spring('squash', 0, 9, .28, false);
      const swing = Math.sin(gait) * stride + Math.sin(shuffle) * shuffleAmp;
      const heavy = 1 + slug * .7;

      // Suit knees: soft at rest, folding through the swing (the leg moving forward), hanging when airborne.
      const knee = (s: number) => (1 - sit) * (1 - lie) * (.1 + stride * .85 * Math.max(0, -s * Math.cos(gait)) + cur.dangle * .35);
      // Legs: sitting ↔ standing, the stride, the dangle when airborne; kept vertical under a lean.
      const legLean = cur.lean * (1 - sit) * (1 - lie) * .85;
      hips.forEach((h, i) => {
        const s = i === 0 ? 1 : -1;
        h.rotation.x = (1 - sit) * (1.42 + s * swing * .45 - cur.dangle * .18) - legLean - tuck * .6 * sit
          + sweep * .35 + cur.flail * Math.sin(t * 8 + i * Math.PI) * .32 + cur.flop * .12;
        // Heavy steps swing out round the hip a little (more under the limit).
        h.rotation.z = -s * cur.dangle * .06 - s * brace * .05 - s * Math.max(0, s * Math.cos(gait)) * stride * .05 * heavy;
      });
      ankles.forEach((a, i) => { const s = i === 0 ? 1 : -1; a.rotation.x = -(1 - sit) * 1.42 + cur.dangle * .55 + Math.max(0, -s * swing) * .3 + tuck * .4; });

      // Arms: hanging, guard, punch, hold; combat tremor; the sluggish droop; get-up push and brace.
      const tremor = tense * Math.sin(t * 29) * .012;
      const sag = slug * (.18 + .1 * Math.max(0, Math.sin(t * .9)));
      shoulders.forEach((sh, i) => {
        const right = i === 1, s = right ? 1 : -1;
        const guard = cur.guard * (1 - slug * .3);
        const fwd = guard * (.55 + tense * .1) + (right ? cur.punch * 1.05 : -cur.punch * .25) + (!right ? cur.hold * .5 : 0)
          + Math.sin(gait - .5 + (right ? 0 : Math.PI)) * stride * .24 * heavy - sag * (1 - guard) + tremor
          + cur.flail * (.9 + .4 * Math.sin(t * 9 + i * 2))
          - push * .9 + brace * .25 + p.overhead * 2.7;
        // Lying, the arms rest back along the ground.
        sh.rotation.x = -fwd + lie * (1 - cur.hold) * .35 + sweep * .6 + cur.flop * .28;
        sh.rotation.z = s * (sweep * .12 + cur.flail * (.35 + .3 * Math.sin(t * 7 + i)) + guard * .2 + cur.dangle * .32 + (!right ? cur.hold * .55 : 0) + push * .2 + brace * .32 - sag * .05 + tense * .04);
        sh.rotation.y = -s * guard * .2;
      });

      // Body: lean, the weight shift and roll over the stance foot, the jiggle.
      const shift = Math.sin(gait) * stride * .075 * heavy;
      body.rotation.set(cur.lean * (1 - lie) - lie * Math.PI / 2 + cur.pitch + Math.abs(Math.sin(gait)) * stride * .03 * heavy, 0,
        (Math.sin(gait) * stride * .07 * heavy + Math.sin(shuffle) * shuffleAmp * .04 + cur.wob * .09) * (1 - lie) + cur.bank);
      body.position.set(shift * (1 - lie), 0, lie * .9);
      // Combat: a coiled, ready bounce, sunk a little lower. Sluggish: a periodic hitch.
      const bounce = tense * (Math.sin(t * 5.2) * .012 - .05) * (1 - stride);
      const hitch = slug * Math.pow(Math.max(0, Math.sin(t * 2.7)), 18) * -.035;
      const sq = cur.squash;
      body.scale.set(1 + sq * .03, 1 - sq * .045, 1 + sq * .03);
      // Find the lowest point of the shell (not the jets or the bay) and sit it on the ground.
      root.rotation.y = cur.yaw;
      root.updateMatrixWorld(true);
      // Pose the suit from this rig: shoulder pivots (side +1 is his left), hips (relative to straight down), head.
      if (pose.armour > 0) {
        headRest.setFromEuler(headBase).invert();
        armoured.drive({
          armL: qA.setFromEuler(shoulders[1].rotation), armR: qB.setFromEuler(shoulders[0].rotation),
          // The suit's thighs are far bigger than the white legs: a shorter swing, and the knee folds
          // as each leg comes through, so the plates don't drive up into his belly (tracker R-04/R-05).
          legL: qC.setFromEuler(eul.set((hips[1].rotation.x - 1.42) * .7, 0, hips[1].rotation.z)), legR: qD.setFromEuler(eul.set((hips[0].rotation.x - 1.42) * .7, 0, hips[0].rotation.z)),
          kneeL: knee(-1), kneeR: knee(1),
          head: headNode ? qH.setFromEuler(headNode.rotation).multiply(headRest) : undefined,
          // Elbows: bent up in guard, straightening into a punch or reaching overhead.
          // Guard: forearms forward and a little up, a ready stance rather than hands in the air (tracker S-06).
          elbowL: .3 + cur.guard * .45 - cur.punch * .6 - p.overhead * .2 + cur.flail * .3,
          elbowR: .3 + cur.guard * .45 - cur.hold * .5 - p.overhead * .2 + cur.flail * .3,
        });
      }
      if (pose.armour > .5 && !unseatBay) unseatBay = armoured.seatOnPlate(bay.root, .2, .2, .235, 1.2);
      else if (pose.armour <= .5 && unseatBay) { unseatBay(); unseatBay = null; }
      let low = Infinity;
      if (pose.armour > .5) { for (const m of whiteTorso) { box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); low = Math.min(low, box.min.y); } low = Math.min(low, armoured.footLow()); }
      else for (const m of shell) { box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); low = Math.min(low, box.min.y); }
      const parentY = root.parent ? root.parent.matrixWorld.elements[13] : 0;
      body.position.y = root.position.y + parentY - low + bounce + hitch;
      if (headNode) {
        const lead = T.MathUtils.clamp(yawErr * .55, -.5, .5);
        headNode.rotation.set(headBase.x + cur.h0 + tense * .1 + slug * .1 + tuck * .3 - push * .1 + Math.sin(gait * 2 - .8) * stride * .035 - cur.flail * .25 - cur.pitch * .4, headBase.y + cur.h1 + lead, headBase.z * (1 - cur.guard) + cur.h2);
      }
      eyeMat.color.copy(p.eyes).multiplyScalar(1 + p.eyeGlow * (.8 + tense * .25 * (.5 + .5 * Math.sin(t * 6))));
      p.getUp = 0; p.tension = 0; p.sluggish = 0;
      // Jets: power, with a broken stutter when the limit starves them.
      const stutter = p.sputter > 0 ? (Math.sin(t * 41) * Math.sin(t * 13.7) > .1 ? 1 : .15) : 1;
      const power = p.thrust * T.MathUtils.lerp(1, stutter * (.35 + .25 * Math.sin(t * 9)), p.sputter);
      flameMat.uniforms.uTime.value = t; flameMat.uniforms.uPower.value = power;
      flames.forEach(f => { f.visible = power > .02; f.scale.y = (f.parent === model ? 1 : .8) * (.5 + power * .9); });
      jetLight.intensity = power * 9;
      // The bay: its own authored opening; the combat chip's glow grows into the missing piece.
      const pulse = p.chipGlow * (1 + .45 * Math.sin(t * 4));
      bay.update({ t, open: p.open, seated: p.chipInBay && !p.careSeated ? 1 : 0, red: p.careSeated ? 0 : .9 + pulse * 2.5, seamGlow: p.careSeated ? .05 : .12 + pulse * .6 });
      combatChip.visible = p.chipInBay && p.open > .4;
    },
    dispose() {
      limiter.dispose(); armoured.dispose(); bay.dispose(); flameGeo.dispose(); flameMat.dispose(); eyeMat.dispose();
      root.removeFromParent();
    },
  };
}
export type Baymax = Awaited<ReturnType<typeof createBaymax>>;

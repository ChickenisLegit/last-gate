import * as T from 'three';
import { SceneKit, seeded, type Pose } from '../phase2/SceneKit';
import { buildSanFransokyo } from './sanFransokyo';
import { chipOutline } from '../characters/RedChip.js';
import type { Pose as BaymaxPose } from './baymax';
import type { HiroPose } from '../characters/HiroModel';

/**
 * The other side: San Fransokyo as it should be, quiet at dusk. A small lawn on the waterfront,
 * a railing, the water, the bridge's red towers across the bay and the city lit beyond it.
 * Everything obeys gravity here. The same group is drawn through the open gate (into a render
 * target) and is then the set itself once they cross.
 *
 * HOME_GATE is where the gate opens on this side: the portal's centre maps onto it.
 */
export const HOME_GATE = new T.Vector3(0, 3.4, 7);
export const HOME_BAYMAX = new T.Vector3(-.6, 0, 2.4);
export const CARE_CHIP_AT = new T.Vector3(1.4, .05, 1.7);

const SKY_FS = `varying vec3 vDir;void main(){float h=normalize(vDir).y;
vec3 top=vec3(.2,.17,.36);vec3 mid=vec3(.357,.294,.541);vec3 low=vec3(.98,.62,.45);vec3 glow=vec3(1.,.8,.6);
vec3 c=mix(low,mid,smoothstep(.0,.22,h));c=mix(c,top,smoothstep(.22,.7,h));
float sun=pow(max(0.,dot(normalize(vDir),normalize(vec3(-.25,.06,-1.)))),40.);
c+=glow*sun*.8+low*smoothstep(.08,-.05,h)*.2;gl_FragColor=vec4(c,1.);}`;
const WATER_FS = `varying vec2 vUv;varying vec3 vWorld;uniform float uTime;void main(){
float d=clamp(-vWorld.z/220.,0.,1.);vec3 near=vec3(.16,.16,.3);vec3 far=vec3(.85,.56,.48);
vec3 c=mix(near,far,pow(d,.7));
float streak=pow(max(0.,sin(vWorld.x*.9+sin(vWorld.z*.35+uTime*.6)*1.5)),18.)*(1.-d*.6);
float sunPath=exp(-pow((vWorld.x+.25*-vWorld.z*.25)/(6.+d*30.),2.))*d;
c+=vec3(1.,.75,.55)*(streak*.18+sunPath*.35*(.6+.4*sin(vWorld.z*1.3+uTime*1.4)));
gl_FragColor=vec4(c,1.);}`;

export function createCareChip(k: SceneKit) {
  // The healthcare chip: the combat chip's outline, soft green, a white cross.
  const chip = new T.Group(); chip.name = 'care-chip';
  const body = k.ownMaterial(new T.MeshPhysicalMaterial({ color: '#2f8f5f', roughness: .3, metalness: .5, clearcoat: .7, emissive: '#0d3a22', emissiveIntensity: .5 }));
  const geo = k.ownGeometry(new T.ExtrudeGeometry(chipOutline(), { depth: .012, bevelEnabled: true, bevelThickness: .003, bevelSize: .0028, bevelSegments: 3, curveSegments: 6 }));
  geo.translate(0, 0, -.006);
  chip.add(new T.Mesh(geo, body));
  const glow = k.ownMaterial(new T.MeshBasicMaterial({ color: '#9dffc8', toneMapped: false }));
  const white = k.ownMaterial(new T.MeshBasicMaterial({ color: '#f7f4ef', toneMapped: false }));
  for (const [w, h] of [[.05, .014], [.014, .05]]) { const m = new T.Mesh(k.ownGeometry(new T.PlaneGeometry(w, h)), white); m.position.set(-.012, .03, .0095); chip.add(m); }
  const line = new T.Mesh(k.ownGeometry(new T.PlaneGeometry(.0042, .15)), glow); line.position.set(.054, .004, .0094); chip.add(line);
  const gold = k.ownMaterial(new T.MeshStandardMaterial({ color: '#d3a55c', roughness: .24, metalness: 1 }));
  for (let i = 0; i < 7; i++) { const m = new T.Mesh(k.boxGeo, gold); m.scale.set(.011, .026, .0016); m.position.set(-.054 + i * .018, -.088, .0088); chip.add(m); }
  return { chip, glow, body };
}

export function createHome() {
  const k = new SceneKit('phase6-home');
  const random = seeded(1123), rand = (a: number, b: number) => a + random() * (b - a);
  const warmStone = k.standard('#b8a690', .85, .02), lawn = k.standard('#4f6a4c', .95, 0), path = k.standard('#9b8f84', .9, .02);
  const rail = k.standard('#2f3640', .5, .6), vermilion = k.standard('#a8443a', .6, .2), city = k.standard('#5d6175', .9, .05);
  // Sky and water.
  const sky = k.mesh(k.ownGeometry(new T.SphereGeometry(400, 32, 16)), k.ownMaterial(new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: SKY_FS })), { p: [0, 0, 0] });
  sky.renderOrder = -1;
  const waterMat = k.ownMaterial(new T.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, fog: false, vertexShader: 'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}', fragmentShader: WATER_FS }));
  k.mesh(k.ownGeometry(new T.PlaneGeometry(600, 300)), waterMat, { p: [0, -1.2, -156], r: [-Math.PI / 2, 0, 0] });
  // Lawn and promenade, the sea wall and its railing.
  k.box({ p: [0, -.6, 6], s: [60, 1.2, 26] }, warmStone);
  k.box({ p: [0, .01, 4], s: [60, .03, 16] }, lawn);
  k.box({ p: [0, .02, -4.2], s: [60, .03, 3.6] }, path);
  k.box({ p: [0, -.7, -6.3], s: [60, 1.4, .6] }, warmStone);
  for (let x = -29; x <= 29; x += 2) k.box({ p: [x, .55, -6.1], s: [.06, 1.1, .06] }, rail);
  k.box({ p: [0, 1.1, -6.1], s: [60, .06, .08] }, rail);
  k.box({ p: [0, .6, -6.1], s: [60, .03, .04] }, rail);
  // Benches and lamps along the promenade, lit.
  const lamps: T.Vector3[] = [];
  for (const x of [-12, -4, 6, 14]) {
    k.box({ p: [x, 2, -4.9], s: [.1, 4, .1] }, rail);
    k.mesh(k.ownGeometry(new T.SphereGeometry(.2, 14, 10)), k.basic('#ffd29a', 1.6), { p: [x, 4.05, -4.9] });
    lamps.push(new T.Vector3(x, 3.8, -4.6));
  }
  for (const x of [-8, 10]) { k.box({ p: [x, .45, -3.4], s: [1.8, .08, .5] }, k.standard('#7a5a44', .8, 0)); k.box({ p: [x, .75, -3.62], s: [1.8, .45, .06] }, k.standard('#7a5a44', .8, 0)); for (const dx of [-.75, .75]) k.box({ p: [x + dx, .22, -3.4], s: [.06, .44, .45] }, rail); }
  // A cherry tree on the lawn, and petals in the air.
  k.box({ p: [-6.5, 1.4, 4], s: [.3, 2.8, .3], r: [0, 0, .08] }, k.standard('#4a3a32', .9, 0));
  const blossom: Pose[] = []; for (let i = 0; i < 26; i++) { const a = random() * Math.PI * 2, r = rand(.2, 1.8); blossom.push({ p: [-6.5 + Math.cos(a) * r, rand(2.6, 4.2), 4 + Math.sin(a) * r], s: [rand(.6, 1.1), rand(.5, .8), rand(.6, 1.1)] }); }
  k.instances(blossom, k.standard('#e8a8b8', .8, 0), k.sphereGeo);
  const PETALS = 70, petalPos = new Float32Array(PETALS * 3);
  for (let i = 0; i < PETALS; i++) petalPos.set([rand(-12, 6), rand(0, 5), rand(-4, 9)], i * 3);
  const petalGeo = k.ownGeometry(new T.BufferGeometry()); petalGeo.setAttribute('position', new T.BufferAttribute(petalPos, 3));
  const petals = new T.Points(petalGeo, k.ownMaterial(new T.PointsMaterial({ color: '#f3c2cd', size: .06, sizeAttenuation: true })));
  k.root.add(petals);
  // Across the water: San Fransokyo at sunset (sanFransokyo.ts).
  const sf = buildSanFransokyo(k, new T.Vector3(-.25, .06, -1));
  // A tram line pole and overhead wire running along the promenade.
  for (const x of [-20, 0, 20]) k.box({ p: [x, 3, 11], s: [.12, 6, .12] }, rail);
  k.line([new T.Vector3(-30, 5.8, 11), new T.Vector3(0, 5.5, 11), new T.Vector3(30, 5.8, 11)], '#2f3640', .9);

  // Light: low warm sun from across the water, dusk-purple sky fill, warm lamps.
  const hemi = new T.HemisphereLight('#b9a6d8', '#40353a', 1.15); k.root.add(hemi);
  const sun = new T.DirectionalLight('#ffb07a', 2.2); sun.position.set(-20, 12, -40); k.root.add(sun);
  const back = new T.DirectionalLight('#8f86c9', .7); back.position.set(10, 8, 20); k.root.add(back);
  for (const p of lamps) { const l = new T.PointLight('#ffcf8a', 3, 9, 1.8); l.position.copy(p); k.root.add(l); }
  // The gate on this side, closing behind them.
  const gateMat = k.ownMaterial(new T.MeshBasicMaterial({ color: '#b9a6ff', side: T.DoubleSide, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const gate = k.mesh(k.ownGeometry(new T.CircleGeometry(3.1, 64)), gateMat, { p: [HOME_GATE.x, HOME_GATE.y, HOME_GATE.z] });
  const gateLight = new T.PointLight('#9a86e0', 0, 18, 1.6); gateLight.position.copy(HOME_GATE).add(new T.Vector3(0, 0, -1.5)); k.root.add(gateLight);

  const care = createCareChip(k);
  care.chip.position.copy(CARE_CHIP_AT); care.chip.rotation.set(-Math.PI / 2, 0, .6); care.chip.scale.setScalar(1);
  k.root.add(care.chip);
  const careLight = new T.PointLight('#7dffb0', 0, 2.2, 2); careLight.position.copy(CARE_CHIP_AT).add(new T.Vector3(0, .25, 0)); k.root.add(careLight);

  return {
    root: k.root, care, careLight, kit: k,
    background: new T.Color('#2a2440'),
    update(t: number, dt: number, s: { gate: number; careBlink: number }) {
      waterMat.uniforms.uTime.value = t;
      sf.update(t, dt);
      for (let i = 0; i < PETALS; i++) {
        const o = i * 3; petalPos[o] += dt * (.35 + Math.sin(t + i) * .1); petalPos[o + 1] -= dt * (.18 + (i % 5) * .03); petalPos[o + 2] += Math.sin(t * .7 + i) * dt * .1;
        if (petalPos[o + 1] < 0) { petalPos[o + 1] = 5; petalPos[o] = rand(-12, 2); }
      }
      petalGeo.attributes.position.needsUpdate = true;
      gate.visible = s.gate > .001; gateMat.opacity = s.gate * .85; gate.scale.setScalar(Math.max(.001, s.gate)); gateLight.intensity = s.gate * 20;
      // The chip's last signal: a slow green pulse.
      const pulse = s.careBlink * (.5 + .5 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 6));
      care.glow.color.set('#9dffc8').multiplyScalar(.4 + pulse * 2.2);
      careLight.intensity = pulse * 2.4;
    },
    dispose() { sf.dispose(); k.dispose(); },
  };
}
export type Home = ReturnType<typeof createHome>;

// ─────────────────────────────────────────────────────────────── directing the home beat

const RED_OFF = new T.Color('#0b0f11'), CARE_WHITE = new T.Color('#f4f8ff');
const sm = (e: number, a: number, b: number) => T.MathUtils.smoothstep(e, a, b);
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
/** Where Hiro kneels at Baymax's side (clear of his arm), and where he steps back to as he gets up. */
export const HIRO_KNEEL = new T.Vector3(HOME_BAYMAX.x + 2.5, 0, HOME_BAYMAX.z + .35);
export const HIRO_STAND = new T.Vector3(HOME_BAYMAX.x + 2.75, 0, HOME_BAYMAX.z - 1.05);
/** Where Hiro steps in to for the fist bump. */
export const HIRO_BUMP = new T.Vector3(HOME_BAYMAX.x + 1.65, 0, HOME_BAYMAX.z - 1.55);

export type HomeCast = {
  baymax: { root: T.Object3D; pose: BaymaxPose; dock: T.Object3D; handWorld(out?: T.Vector3): T.Vector3; headWorld(out?: T.Vector3): T.Vector3 };
  hiro: { root: T.Object3D; pose: HiroPose };
};
export type HomeShot = { stage: string; e: number; t: number; dt: number; care: 'ground' | 'held' | 'seated'; dragPos: T.Vector3; returning: number; camera: T.Camera };

/**
 * Everything the home set does each frame: the gate closing, the healthcare chip on the grass (or
 * in the hand, or seated in his dock), Baymax and Hiro, and where the camera wants to be.
 *
 *   home    Baymax on his back, Hiro kneeling at his side; the chip waits on the grass.
 *   seated  the chip is in; Hiro waits with a hand on him.
 *   boot    the bay closes; his eyes come on with the chime; Hiro gets up and steps back; Baymax
 *           gets up in stages (sits up, settles, leans over his feet, pushes up, wobbles still);
 *           he looks down at Hiro; fist bump.
 *   end     the two of them at the rail, the city across the water at sunset.
 *
 * Returns the camera target and lens; `cue` fires the sounds the moment they happen.
 */
export function directHome(home: Home, cast: HomeCast, s: HomeShot, cue: { chime(): void; step(level: number): void; done(): void }, camPos: T.Vector3, look: T.Vector3) {
  const { baymax, hiro } = cast, P = baymax.pose, H = hiro.pose;
  const { stage, e, t, dt } = s;
  home.update(t, dt, { gate: 0, careBlink: s.care === 'seated' ? 0 : 1 });
  baymax.root.position.copy(HOME_BAYMAX);
  Object.assign(P, { yaw: Math.PI, lie: 1, sit: 0, guard: 0, open: 4.6, chipInBay: false, eyeGlow: 0, careSeated: s.care === 'seated' });
  P.eyes.copy(RED_OFF);
  hiro.root.position.copy(HIRO_KNEEL); Object.assign(H, { yaw: -Math.PI / 2, kneel: 1, look: -.15, lookUp: -.25, reach: 0, walk: 0, stride: 0, bump: 0 });
  camPos.set(6.4, 3.5, 5.2); look.set(-.7, .8, 2.9);
  let fov = 44, shot = stage;

  // The healthcare chip: on the grass, in the hand, sliding back, or seated in his dock.
  const care = home.care.chip;
  if (s.care !== 'seated') {
    if (s.care === 'held') { care.position.copy(s.dragPos); care.lookAt(s.camera.position); care.scale.setScalar(1.6); }
    else if (s.returning > 0) { care.position.copy(s.dragPos); }
    else { care.position.copy(CARE_CHIP_AT); care.rotation.set(-Math.PI / 2, 0, .6); care.scale.setScalar(1); }
    home.careLight.position.copy(care.position).add(v(0, .25, 0));
    if (stage === 'home') {
      // Coming through: the camera settles as Hiro drops to his knee beside him.
      camPos.set(3, 3.8, 11.5).lerp(v(6.4, 3.5, 5.2), sm(e, 0, 3.5)); look.set(-.5, .8, 1.5).lerp(v(-.7, .8, 2.9), sm(e, 0, 3.5));
      H.kneel = sm(e, .8, 2.4); H.reach = .35 * sm(e, 2, 3); H.lookUp = -.3;
    }
    return { fov, shot };
  }
  if (care.parent !== baymax.dock) { baymax.dock.add(care); care.position.set(0, 0, .004); care.rotation.set(0, 0, 0); care.scale.setScalar(1); }
  P.careSeated = true;
  if (stage === 'seated') { H.reach = .55; H.lookUp = -.2; return { fov, shot }; }

  // boot / end. `be` runs on past the end of boot so the end holds the final pose.
  const be = stage === 'end' ? 40 : e;
  // 0–1.6 the bay closes. 1.9 eyes on, chime.
  P.open = 4.6 * (1 - sm(be, .2, 1.6));
  const eyesOn = sm(be, 1.9, 2.9);
  P.eyes.copy(RED_OFF).lerp(CARE_WHITE, eyesOn); P.eyeGlow = eyesOn * .25;
  if (stage === 'boot' && be > 1.95 && be - dt <= 1.95) cue.chime();
  // 2.0–3.4 his head lifts a little off the grass: he looks for who's there.
  P.head[0] = -.12 * sm(be, 2.2, 3.2) * (1 - sm(be, 4.4, 5.4));
  P.head[1] = -.35 * sm(be, 2.4, 3.4) * (1 - sm(be, 4.2, 5));
  // 4.4–10.4 the get-up.
  const g = T.MathUtils.clamp((be - 4.4) / 6, 0, 1);
  if (g > 0) P.getUp = g;
  if (g >= 1) { P.lie = 0; P.sit = 0; P.getUp = 0; P.lean = 0; }
  // 10.6–12 he looks down at Hiro, head tilted. 12.4–14.2 the fist bump.
  const lookDown = sm(be, 10.6, 12);
  P.head[0] += .22 * lookDown; P.head[1] -= .38 * lookDown; P.head[2] = -.22 * lookDown * (1 - sm(be, 13.5, 14.5) * .5);
  const bump = sm(be, 12.6, 13.8) * (1 - sm(be, 15.2, 16.4) * .7);
  P.hold = bump * .8;

  // Hiro: kneeling with a hand on his shell; at the chime he sits back; 3.0–4.2 he gets up and
  // 3.6–5.2 walks back out of reach as Baymax starts to move; watches him rise; steps in for
  // the bump.
  const getUpH = sm(be, 3, 4.2), back = sm(be, 3.6, 5.2), stepIn = sm(be, 12, 13.2);
  H.kneel = 1 - getUpH; H.reach = .4 * (1 - sm(be, 1.2, 2.2));
  const at = HIRO_KNEEL.clone().lerp(HIRO_STAND, back).lerp(HIRO_BUMP, stepIn);
  hiro.root.position.copy(at);
  // Walking: legs move only while he is actually travelling.
  const moving = (back > 0 && back < 1) || (stepIn > 0 && stepIn < 1);
  H.stride = moving ? .55 : 0; H.walk = (be - 3.6) * 6.5;
  // Facing: toward Baymax's middle (or his fist for the bump).
  const target = stepIn > 0 ? baymax.handWorld() : baymax.root.position.clone().add(v(0, 0, -.4));
  H.yaw = Math.atan2(target.x - at.x, target.z - at.z) - (back > 0 && back < 1 ? .5 * Math.sin(Math.PI * back) : 0);
  H.lookUp = T.MathUtils.lerp(-.2, .15, sm(be, 1.9, 2.6)) + .7 * sm(be, 5, 8) - .2 * stepIn;
  H.bump = sm(be, 12.9, 13.7) * (1 - sm(be, 15.2, 16.4));
  if (stage === 'boot' && (Math.floor(H.walk / Math.PI) !== Math.floor((H.walk - dt * 6.5) / Math.PI)) && moving) cue.step(.15);

  // Camera: in front, low, his face and Hiro beside him as he comes up; then wider for the bump.
  camPos.set(3.4, 2.1, -7.6).lerp(v(2.3, 2.7, -9.4), sm(be, 4, 10)); look.set(-1.2, 1.4, 2).lerp(v(-1.3, 2, 2), sm(be, 4, 10));
  if (be > 11.8) { camPos.lerp(v(.9, 2, -6.9), sm(be, 11.8, 13.4)); look.lerp(v(-1.7, 1.8, 1.2), sm(be, 11.8, 13.4)); }
  fov = 40;
  if (stage === 'end') {
    // Behind the two of them, high and wide: side by side, looking out over the rail at the city.
    hiro.root.position.set(HOME_BAYMAX.x + 1.75, 0, HOME_BAYMAX.z - .5); Object.assign(H, { yaw: Math.PI, stride: 0, bump: 0, lookUp: .05, look: .25, kneel: 0, reach: 0 });
    P.hold = 0; P.head[0] = .08; P.head[1] = -.3; P.head[2] = -.12;
    camPos.set(5.2, 4.6, 15.5).lerp(v(4.4, 5.6, 17.5), sm(e, 0, 20)); look.set(-6, 7, -60); fov = 46; shot = 'end';
  }
  if (stage === 'boot' && be > 17) cue.done();
  return { fov, shot };
}

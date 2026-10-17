import * as T from 'three';
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
};
export const restPose = (): Pose => ({
  sit: 1, lie: 0, lean: 0, guard: 0, punch: 0, hold: 0, stride: 0, gait: 0, dangle: 0, yaw: 0,
  head: [0, 0, 0], eyes: new T.Color('#0b0f11'), eyeGlow: 0, thrust: 0, sputter: 0,
  open: 0, chipGlow: 0, chipInBay: true, careSeated: false,
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
  let palm: T.Mesh | null = null;
  for (const side of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(side * .53, .55, .28); model.add(hip);
    const ankle = new T.Group(); ankle.position.set(side * .18, -.27, .86); hip.add(ankle);
    const shoulder = new T.Group(); shoulder.position.set(side * .98, 2.42, 0); model.add(shoulder);
    model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const p = mesh.position, sx = side * p.x;
      if (near(sx, .57) && near(p.y, .48)) hip.attach(mesh);
      else if (near(sx, .71) && (near(p.y, .26) || near(p.y, .04)) && p.z > 1.2) ankle.attach(mesh);
      else if (sx > .8 && p.y < 2.45 && !(near(p.y, .48) || p.z > 1.2)) { if (side < 0 && near(sx, 1.25) && near(p.y, .35)) palm = mesh; shoulder.attach(mesh); }
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

  // Measure the two leg poses once so his feet (or seat) always meet the ground.
  const root = new T.Group(); root.name = 'baymax-phase6';
  const body = new T.Group(); root.add(body); body.add(model);
  const setLegs = (sit: number) => {
    hips.forEach(h => { h.rotation.x = (1 - sit) * 1.42; });
    ankles.forEach(a => { a.rotation.x = -(1 - sit) * 1.42; });
  };
  const lowest = () => { model.updateMatrixWorld(true); return new T.Box3().setFromObject(model).min.y; };
  setLegs(1); const sitDrop = -lowest();
  setLegs(0); const standDrop = -lowest();
  // Belly height above the ground when lying on his back (half his depth).
  const lieDrop = .72;
  model.updateMatrixWorld(true);
  const headHeight = (headNode ? headNode.getWorldPosition(new T.Vector3()).y : 3) + standDrop;
  setLegs(1);

  const pose = restPose();
  return {
    root, model, bay, pose, combatChip, dock, eyeMat,
    /** World position of the dock (the chip's seat). */
    dockWorld: (out = new T.Vector3()) => dock.getWorldPosition(out),
    headWorld: (out = new T.Vector3()) => (headNode ?? model).getWorldPosition(out),
    /** His right hand (the one Hiro takes). */
    handWorld: (out = new T.Vector3()) => (palm ?? model).getWorldPosition(out),
    headHeight,
    chestWorld: (out = new T.Vector3()) => bay.chestWorld(out),
    update(t: number) {
      const p = pose;
      // Legs: sitting ↔ standing, plus a heavy alternating stride and a hang when airborne.
      const swing = Math.sin(p.gait) * p.stride;
      hips.forEach((h, i) => {
        const s = i === 0 ? 1 : -1;
        h.rotation.x = (1 - p.sit) * (1.42 + s * swing * .45 - p.dangle * .18);
        h.rotation.z = -s * p.dangle * .06;
      });
      ankles.forEach((a, i) => { const s = i === 0 ? 1 : -1; a.rotation.x = -(1 - p.sit) * 1.42 + p.dangle * .55 + Math.max(0, -s * swing) * .3; });
      // Arms hang from the shoulder; the guard brings both up and forward, the punch drives the right.
      shoulders.forEach((sh, i) => {
        const right = i === 1, s = right ? 1 : -1;
        // hold: his right arm lifted off the ground and out to the side, where Hiro takes his hand.
        const fwd = p.guard * .75 + (right ? p.punch * 1.05 : -p.punch * .25) + (!right ? p.hold * .5 : 0) + Math.sin(p.gait + (right ? 0 : Math.PI)) * p.stride * .22;
        // Lying down the arms rest back along the ground instead of reaching up.
        sh.rotation.x = -fwd + p.lie * (1 - p.hold) * .35;
        sh.rotation.z = s * (p.guard * .28 + p.dangle * .32 + (!right ? p.hold * .55 : 0));
        sh.rotation.y = -s * p.guard * .2;
      });
      // Body: stand height, lean, a heavy dip on each step, lying back on the ground.
      const drop = T.MathUtils.lerp(standDrop, sitDrop, p.sit);
      const bob = Math.abs(Math.cos(p.gait)) * p.stride * .1;
      body.position.y = T.MathUtils.lerp(drop - bob, lieDrop, p.lie);
      body.rotation.set(p.lean * (1 - p.lie) - p.lie * Math.PI / 2, 0, Math.sin(p.gait) * p.stride * .05 * (1 - p.lie));
      // Lying on his back the shell pivots about its seat; shift him so he lies centred on the spot.
      body.position.z = p.lie * .9;
      root.rotation.y = p.yaw;
      if (headNode) headNode.rotation.set(headBase.x + p.head[0], headBase.y + p.head[1], headBase.z * (1 - p.guard) + p.head[2]);
      eyeMat.color.copy(p.eyes).multiplyScalar(1 + p.eyeGlow * .8);
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
      bay.dispose(); flameGeo.dispose(); flameMat.dispose(); eyeMat.dispose();
      root.removeFromParent();
    },
  };
}
export type Baymax = Awaited<ReturnType<typeof createBaymax>>;

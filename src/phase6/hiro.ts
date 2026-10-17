import * as T from 'three';

/**
 * Hiro, for the shots where we see him: a slight fourteen-year-old in a blue-grey hoodie, dark
 * shorts over leggings, trainers and the same dark gloves as the hand close-up. Simple rounded
 * forms in the same procedural language as the Baymax shell; hinged at the joints so the walk,
 * the turn and the long heavy drag read from the body.
 */
export type HiroPose = {
  walk: number; stride: number; lean: number; haul: number; kneel: number; reach: number; look: number; yaw: number;
};
export const hiroRest = (): HiroPose => ({ walk: 0, stride: 0, lean: 0, haul: 0, kneel: 0, reach: 0, look: 0, yaw: 0 });

export function createHiro() {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const mat = (color: string, roughness = .8, metalness = 0) => { const m = new T.MeshStandardMaterial({ color, roughness, metalness }); mats.push(m); return m; };
  const hoodie = mat('#3C4A5C', .92), hoodieDark = mat('#2c3747', .95), shorts = mat('#1d232b', .9), legging = mat('#14181d', .7);
  const skin = mat('#d9a888', .7), hair = mat('#14110f', .85), glove = mat('#22262b', .75), shoe = mat('#d8d2c6', .6), sole = mat('#3a3d42', .8);
  const capsule = (r: number, len: number, m: T.Material, parent: T.Object3D, y = -len / 2 - r) => {
    const g = new T.CapsuleGeometry(r, len, 6, 12); geos.push(g); const mesh = new T.Mesh(g, m); mesh.position.y = y; parent.add(mesh); return mesh;
  };
  const ball = (r: number, m: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0, s: [number, number, number] = [1, 1, 1]) => {
    const g = new T.SphereGeometry(r, 18, 12); geos.push(g); const mesh = new T.Mesh(g, m); mesh.position.set(x, y, z); mesh.scale.set(...s); parent.add(mesh); return mesh;
  };
  const joint = (parent: T.Object3D, x: number, y: number, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new T.Group(); root.name = 'hiro';
  const pelvis = joint(root, 0, .86);
  ball(.15, shorts, pelvis, 0, -.02, 0, [1.15, .7, .8]);
  const spine = joint(pelvis, 0, .04);
  // Hoodie torso: a soft tapered body, the kangaroo pocket and the hood folded on the back.
  const torso = capsule(.17, .3, hoodie, spine, .27); torso.scale.set(1.05, 1, .74);
  ball(.12, hoodieDark, spine, 0, .14, .1, [1.2, .55, .3]);
  ball(.15, hoodieDark, spine, 0, .5, -.11, [1.05, .6, .55]);
  const neck = joint(spine, 0, .58);
  const head = joint(neck, 0, .1);
  ball(.092, skin, head, 0, .015, .01, [1, 1.12, 1.02]);
  // Hair: a messy dark mop. A cap over the crown and back, then short spikes pushed out and back.
  ball(.097, hair, head, 0, .05, -.014, [1.04, .86, 1.04]);
  const spikeGeo = new T.ConeGeometry(.026, .075, 6); geos.push(spikeGeo);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, up = .55 + (i % 3) * .22;
    const dir = new T.Vector3(Math.sin(a) * Math.cos(up), Math.sin(up), Math.cos(a) * Math.cos(up) - .35).normalize();
    if (dir.z > .55 && dir.y < .7) continue; // keep the face clear
    const spike = new T.Mesh(spikeGeo, hair); spike.position.copy(dir).multiplyScalar(.085).add(new T.Vector3(0, .055, -.015));
    spike.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); head.add(spike);
  }
  // A fringe falling over the brow.
  for (const x of [-.045, 0, .045]) { const f = new T.Mesh(spikeGeo, hair); f.position.set(x, .075, .075); f.rotation.set(2.1, 0, x * 3); f.scale.setScalar(.8); head.add(f); }
  const arms: { shoulder: T.Group; elbow: T.Group }[] = [];
  for (const side of [-1, 1]) {
    const shoulder = joint(spine, side * .2, .5);
    capsule(.055, .2, hoodie, shoulder);
    const elbow = joint(shoulder, 0, -.29);
    capsule(.047, .19, hoodie, elbow);
    const hand = joint(elbow, 0, -.27);
    ball(.05, glove, hand, 0, -.03, .01, [1, 1.3, .8]);
    arms.push({ shoulder, elbow });
  }
  const legs: { hip: T.Group; knee: T.Group }[] = [];
  for (const side of [-1, 1]) {
    const hip = joint(pelvis, side * .09, -.04);
    capsule(.075, .2, shorts, hip);
    const knee = joint(hip, 0, -.38);
    capsule(.05, .28, legging, knee);
    const foot = joint(knee, 0, -.4);
    ball(.06, shoe, foot, 0, -.02, .05, [1, .7, 1.9]);
    ball(.062, sole, foot, 0, -.055, .05, [1.02, .25, 1.95]);
    legs.push({ hip, knee });
  }
  root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });

  const pose = hiroRest();
  return {
    root, pose,
    /** World position of the right hand: what Baymax's hand is held by during the drag. */
    handWorld: (out = new T.Vector3()) => arms[1].elbow.children[1].getWorldPosition(out),
    update() {
      const p = pose;
      const s = Math.sin(p.walk) * p.stride, lift = Math.max(0, Math.cos(p.walk)) * p.stride;
      root.rotation.y = p.yaw;
      // Lean: forward into a run, far back on the drag; kneel drops the pelvis onto one knee.
      pelvis.position.y = .86 - Math.abs(s) * .03 - p.kneel * .42 - p.haul * .1;
      pelvis.position.z = -p.haul * .12;
      spine.rotation.x = p.lean * .3 - p.haul * .42 + p.kneel * .25;
      neck.rotation.x = p.haul * .3 - p.kneel * .15;
      neck.rotation.y = p.look;
      legs.forEach(({ hip, knee }, i) => {
        const k = i === 0 ? 1 : -1;
        // On the drag the steps are short and braced: the knees stay bent, the hips sit back.
        hip.rotation.x = -s * k * .55 + p.haul * .35 - p.kneel * (i === 0 ? 1.55 : .2);
        knee.rotation.x = (k > 0 ? lift : Math.max(0, -Math.cos(p.walk)) * p.stride) * .8 + p.haul * .5 + p.kneel * (i === 0 ? 1.6 : 1.45);
      });
      arms.forEach(({ shoulder, elbow }, i) => {
        const k = i === 0 ? 1 : -1;
        const hold = p.haul * 1.25, reach = i === 1 ? p.reach * 1.2 : 0;
        shoulder.rotation.x = s * k * .45 * (1 - p.haul) - hold - reach - p.kneel * .2;
        shoulder.rotation.z = (i === 0 ? -1 : 1) * (.08 + p.haul * .05);
        elbow.rotation.x = -.25 - p.stride * .35 - p.haul * .2 + reach * .25;
      });
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); root.removeFromParent(); },
  };
}
export type Hiro = ReturnType<typeof createHiro>;

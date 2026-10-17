import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Armoured Baymax (tracker PW-03): "Armored Baymax (from Disney's Big Hero 6)" by DoodleNotes1,
 * CC BY 3.0, non-commercial fan art (public/models/baymax-armoured.CREDITS.txt).
 *
 * The model is a rigged suit. It is mounted inside the white Baymax rig of each chapter (a child of
 * the white model, scaled so hips and shoulders line up) and posed every frame from the same joints
 * that rig already drives: drive() takes the white rig's arm, leg and head rotations, so every walk,
 * flight, fall and get-up carries over. set(k) runs the swap: 0 = white Baymax, 1 = armoured; in
 * between the plates arrive one by one, core first, and the suit and face come in at the end.
 *
 * The source rig moves its hands by IK, with the hand bones hanging off the root, so drive() carries
 * each hand on the end of its forearm itself.
 */
export const ARMOUR_URL = '/models/baymax-armoured.glb';
let template: Promise<T.Object3D> | null = null;
export const loadArmouredTemplate = () => (template ??= new GLTFLoader().loadAsync(ARMOUR_URL).then(g => mergeRigid(g.scene)));

/**
 * glTF splits each multi-material mesh into one mesh per material, so the suit arrives as dozens of
 * small draws. The rigid pieces riding the same bone are merged into one mesh per material per bone
 * (tracker PW-08); the skinned pieces stay as they are.
 */
function mergeRigid(scene: T.Object3D) {
  scene.updateMatrixWorld(true);
  const groups = new Map<T.Object3D, Map<T.Material, T.BufferGeometry[]>>(), merged: T.Mesh[] = [];
  scene.traverse(o => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh || Array.isArray(o.material)) return;
    let b: T.Object3D | null = o.parent; while (b && !(b instanceof T.Bone)) b = b.parent;
    if (!b) return;
    const byMat = groups.get(b) ?? new Map(); groups.set(b, byMat);
    const g = o.geometry.clone().applyMatrix4(new T.Matrix4().copy(b.matrixWorld).invert().multiply(o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    const list = byMat.get(o.material) ?? []; list.push(g.index ? g.toNonIndexed() : g); byMat.set(o.material, list); merged.push(o);
  });
  merged.forEach(o => o.removeFromParent());
  for (const [bone, byMat] of groups) for (const [mat, list] of byMat) {
    const geo = mergeGeometries(list, false); if (!geo) continue;
    const mesh = new T.Mesh(geo, mat); mesh.name = `armour-${bone.name}-${mat.name}`; bone.add(mesh);
  }
  return scene;
}

const name = (n: string) => T.PropertyBinding.sanitizeNodeName(n);
const RED = '#b0121c', PURPLE = '#5b2b8c';
function material(original: string, eye?: T.Material): T.Material {
  const phys = (color: string, metalness: number, roughness: number, extra: T.MeshPhysicalMaterialParameters = {}) =>
    new T.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: .35, clearcoatRoughness: .3, ...extra });
  if (original === 'Black' && eye) return eye;
  if (original.startsWith('RED')) return phys(RED, .45, .3);
  if (original.startsWith('purple')) return phys(PURPLE, .4, .35);
  if (original === 'Silver' || original === 'Metal') return phys('#a3abb2', .85, .28, { clearcoat: 0 });
  if (original === 'BLACK_Skin') return phys('#17191d', .2, .65, { clearcoat: .1 });
  if (original === 'TRANSPARENT') return new T.MeshPhysicalMaterial({ color: '#9fc4d8', metalness: 0, roughness: .05, transmission: 0, transparent: true, opacity: .18, depthWrite: false });
  if (original === 'Black') return new T.MeshBasicMaterial({ color: '#0b0f11' });
  return phys('#eee8dc', 0, .78, { clearcoat: .02, sheen: .3 });
}

export type ArmourJoints = {
  /** Arm rotations in the white model's frame, relative to hanging at his side (as the white rig's shoulder pivots). */
  armL?: T.Quaternion; armR?: T.Quaternion;
  /** Leg rotations relative to hanging straight down. */
  legL?: T.Quaternion; legR?: T.Quaternion;
  /** Head rotation relative to its rest. */
  head?: T.Quaternion;
};

type Piece = { mesh: T.Mesh; mats: T.Material[]; orig: { transparent: boolean; opacity: number; depthWrite: boolean }[]; base: T.Vector3; delay: number; late: boolean };

export async function createArmouredBaymax(opts: { eye?: T.Material; hole?: () => T.Vector3 | null } = {}) {
  const src = await loadArmouredTemplate();
  const root = new T.Group(); root.name = 'armoured-baymax';
  const suit = cloneSkinned(src); root.add(suit);
  root.updateMatrixWorld(true);
  const bone = (n: string) => suit.getObjectByName(name(n)) as T.Bone;
  const hips = bone('Armor_Hips'), chest = bone('Armor_Chest'), head = bone('Armor_Head');
  const uArm = { L: bone('Armor_U_Arm.L'), R: bone('Armor_U_Arm.R') }, lArm = { L: bone('Armor_L_Arm.L'), R: bone('Armor_L_Arm.R') };
  const hand = { L: bone('Armor_Hand.L'), R: bone('Armor_Hand.R') }, pad = { L: bone('Armor_Shoulder.L'), R: bone('Armor_Shoulder.R') };
  const uLeg = { L: bone('Armor_U_Leg.L'), R: bone('Armor_U_Leg.R') }, lLeg = { L: bone('Armor_L_Leg.L'), R: bone('Armor_L_Leg.R') };

  // Rest pose in the root's frame (root is at the identity here).
  const relQ = (o: T.Object3D) => o.getWorldQuaternion(new T.Quaternion());
  const relM = (o: T.Object3D) => o.matrixWorld.clone();
  const restQ = new Map<T.Object3D, T.Quaternion>([hips, chest, head, uArm.L, uArm.R, uLeg.L, uLeg.R, pad.L, pad.R].map(b => [b, relQ(b)]));
  const parentQ = (b: T.Object3D) => restQ.get(b.parent!) ?? relQ(b.parent!);
  const parentRest = new Map([uArm.L, uArm.R, uLeg.L, uLeg.R, head, pad.L, pad.R].map(b => [b, parentQ(b)]));
  // Arms rest in a T: the swing that hangs each one at his side, a little out from the body.
  const hang = (side: 'L' | 'R') => {
    const from = lArm[side].getWorldPosition(new T.Vector3()).sub(uArm[side].getWorldPosition(new T.Vector3())).normalize();
    return new T.Quaternion().setFromUnitVectors(from, new T.Vector3(side === 'L' ? .14 : -.14, -1, 0).normalize());
  };
  const hangQ = { L: hang('L'), R: hang('R') };
  const legDown = (side: 'L' | 'R') => {
    const from = lLeg[side].getWorldPosition(new T.Vector3()).sub(uLeg[side].getWorldPosition(new T.Vector3())).normalize();
    return new T.Quaternion().setFromUnitVectors(from, new T.Vector3(0, -1, 0));
  };
  const legQ = { L: legDown('L'), R: legDown('R') };
  // Each hand rides on the end of its forearm, as it sat at rest.
  const handOffset = { L: relM(lArm.L).invert().multiply(relM(hand.L)), R: relM(lArm.R).invert().multiply(relM(hand.R)) };
  // Feet: points at the bottom of each lower leg (and a little under it, the sole), for grounding.
  const feet = (['L', 'R'] as const).map(s => {
    const f = new T.Object3D(); lLeg[s].add(f);
    const tip = lLeg[s].getWorldPosition(new T.Vector3()), knee = uLeg[s].getWorldPosition(new T.Vector3());
    f.position.copy(lLeg[s].worldToLocal(tip.clone().addScaledVector(tip.clone().sub(knee).normalize(), .52)));
    return f;
  });

  // Materials: restyled to match the project (red, purple, black suit, white face); the chest plate
  // and suit get a hole over the chest bay so the chips stay reachable.
  const hole = { c: new T.Vector3(), r: .42 };
  const pieces: Piece[] = [], centre = new T.Box3().setFromObject(suit).getCenter(new T.Vector3());
  suit.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const originals = Array.isArray(o.material) ? o.material : [o.material];
    const mats = originals.map(m => {
      const mat = material(m.name, opts.eye);
      if (mat !== opts.eye && mat instanceof T.MeshPhysicalMaterial && opts.hole) {
        mat.onBeforeCompile = shader => {
          shader.uniforms.uHole = { value: hole.c }; shader.uniforms.uHoleR = { value: hole.r };
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vArmourWorld;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvArmourWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHole;uniform float uHoleR;varying vec3 vArmourWorld;')
            .replace('void main() {', 'void main() {\nif (uHoleR > 0. && distance(vArmourWorld, uHole) < uHoleR) discard;');
        };
      }
      return mat;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    // The inner suit and chest plates carry his whole silhouette; the small pieces skip the shadow pass (tracker PW-08).
    o.castShadow = /INSIDE|Chest/.test(o.name); o.receiveShadow = true; o.frustumCulled = false;
    const late = /INSIDE|Baymax\.00/.test(o.name) || o instanceof T.SkinnedMesh && /INSIDE/.test(o.name);
    pieces.push({ mesh: o, mats, orig: mats.map(m => ({ transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite })), base: o.scale.clone(), delay: o.getWorldPosition(new T.Vector3()).distanceTo(centre), late });
  });
  const order = pieces.filter(p => !p.late).sort((a, b) => a.delay - b.delay);
  order.forEach((p, i) => { p.delay = i / Math.max(1, order.length - 1); });
  const tmpQ = new T.Quaternion(), tmpM = new T.Matrix4(), inv = new T.Matrix4(), id = new T.Quaternion();

  let shown = -1;
  const api = {
    root, feet,
    /** Bone rest heights in the model's own units (for mounting it inside a white rig). */
    joints: { hipY: uLeg.L.getWorldPosition(new T.Vector3()).y, hipZ: uLeg.L.getWorldPosition(new T.Vector3()).z, shoulderY: uArm.L.getWorldPosition(new T.Vector3()).y },
    /** Pose the suit from the white rig's joint rotations. */
    drive(j: ArmourJoints) {
      const set = (b: T.Bone, q: T.Quaternion) => { b.quaternion.copy(parentRest.get(b)!).invert().multiply(q); };
      for (const s of ['L', 'R'] as const) {
        const arm = s === 'L' ? j.armL : j.armR, leg = s === 'L' ? j.legL : j.legR;
        tmpQ.copy(arm ?? id).multiply(hangQ[s]).multiply(restQ.get(uArm[s])!); set(uArm[s], tmpQ);
        // The pad rides up with the arm a little.
        tmpQ.copy(id).slerp(arm ?? id, .3).multiply(restQ.get(pad[s])!); set(pad[s], tmpQ);
        tmpQ.copy(leg ?? id).multiply(legQ[s]).multiply(restQ.get(uLeg[s])!); set(uLeg[s], tmpQ);
      }
      tmpQ.copy(j.head ?? id).multiply(restQ.get(head)!); set(head, tmpQ);
      // Hands onto the forearms.
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      for (const s of ['L', 'R'] as const) {
        tmpM.copy(inv).multiply(lArm[s].matrixWorld).multiply(handOffset[s]);
        const parentRel = new T.Matrix4().copy(inv).multiply(hand[s].parent!.matrixWorld);
        tmpM.premultiply(parentRel.invert());
        tmpM.decompose(hand[s].position, hand[s].quaternion, hand[s].scale);
      }
      root.updateMatrixWorld(true);
      const h = opts.hole?.(); if (h) { hole.c.copy(h); hole.r = .58 * root.getWorldScale(new T.Vector3()).x / 1.5; } else hole.r = 0;
    },
    /** Lowest point of his feet in world space (for sitting him on the ground). */
    footLow() { let low = Infinity; const v = new T.Vector3(); for (const f of feet) low = Math.min(low, f.getWorldPosition(v).y); return low; },
    /** 0 = no armour … 1 = fully armoured. Plates arrive core first; the suit and face come in last. */
    set(k: number) {
      if (k === shown) return; shown = k;
      root.visible = k > 0;
      for (const p of pieces) {
        const local = p.late ? T.MathUtils.smoothstep(k, .8, 1) : T.MathUtils.clamp((k - p.delay * .55) / .45, 0, 1);
        const e = local * local * (3 - 2 * local);
        p.mesh.visible = local > 0;
        if (!p.late) p.mesh.scale.copy(p.base).multiplyScalar(1 + (1 - e) * .2);
        p.mats.forEach((m, i) => {
          if (m === opts.eye) return;
          const o = p.orig[i];
          if (e < 1) { m.transparent = true; m.opacity = o.opacity * e; m.depthWrite = o.depthWrite && e > .5; }
          else { m.transparent = o.transparent; m.opacity = o.opacity; m.depthWrite = o.depthWrite; }
        });
      }
    },
    /** True once the white body underneath is fully covered (callers hide it then). */
    covers: (k: number) => k >= .98,
    dispose() { root.removeFromParent(); pieces.forEach(p => p.mats.forEach(m => { if (m !== opts.eye) m.dispose(); })); },
  };
  api.drive({}); api.set(0);
  return api;
}
export type ArmouredBaymax = Awaited<ReturnType<typeof createArmouredBaymax>>;

/** Mount the suit inside a white rig: scale and place it so its hips and shoulders meet the white rig's. */
export function mountArmour(a: ArmouredBaymax, white: T.Object3D, hip: { y: number; z: number }, shoulderY: number) {
  const s = (shoulderY - hip.y) / (a.joints.shoulderY - a.joints.hipY);
  a.root.scale.setScalar(s);
  a.root.position.set(0, hip.y - a.joints.hipY * s, hip.z - a.joints.hipZ * s);
  white.add(a.root);
  return s;
}

import * as T from 'three';

/**
 * Baymax's armour (tracker PW-03): what the combat chip puts him in. Every soft white part of the
 * shell gets a fitted red plate (a slightly larger copy of that part, parented to it, so it follows
 * every limb the controllers move); the head gets a helmet open at the face so his eyes still read;
 * the crimson pads on his shoulders and feet go purple. A hole is cut in the plating over the chest
 * bay so the chips stay reachable.
 *
 * set(k) runs the transition: 0 = no armour, 1 = fully plated. In between, plates arrive (or leave)
 * one after another from the core outward, each settling in from a little off his body.
 */
type Plate = { mesh: T.Mesh; mat: T.MeshStandardMaterial; base: T.Vector3; delay: number };

const RED = new T.Color('#b0121c'), PURPLE = new T.Color('#5b2b8c');

export function fitArmour(model: T.Object3D) {
  model.updateMatrixWorld(true);
  const plates: Plate[] = [], owned: (T.BufferGeometry | T.Material)[] = [];
  const hole = { centre: new T.Vector3(), radius: .34, node: null as T.Object3D | null };
  model.traverse(o => { if (o.name === 'access-ring' || o.name === 'baymax-access') hole.node ??= o; });
  const centre = new T.Box3().setFromObject(model).getCenter(new T.Vector3());

  const plateMaterial = () => {
    const mat = new T.MeshStandardMaterial({ color: RED, metalness: .55, roughness: .3, transparent: true, opacity: 0 });
    mat.onBeforeCompile = shader => {
      shader.uniforms.uHole = { value: hole.centre }; shader.uniforms.uHoleR = { value: hole.radius };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vArmourWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvArmourWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHole;uniform float uHoleR;varying vec3 vArmourWorld;')
        .replace('void main() {', 'void main() {\nif (distance(vArmourWorld, uHole) < uHoleR) discard;');
    };
    owned.push(mat); return mat;
  };

  // Fitted plates over the white parts (not the head: that gets the helmet).
  const head = (() => { let h: T.Object3D | null = null; model.traverse(o => { if (o.name === 'dormant-head') h = o; }); return h as T.Object3D | null; })();
  const underHead = (o: T.Object3D) => { for (let p: T.Object3D | null = o; p; p = p.parent) if (p === head) return true; return false; };
  const pads: T.MeshStandardMaterial[] = [];
  const meshes: T.Mesh[] = []; model.traverse(o => { if (o instanceof T.Mesh) meshes.push(o); });
  for (const mesh of meshes) {
    const mat = mesh.material as T.MeshStandardMaterial;
    if (mat?.name === 'armor' && !pads.includes(mat)) pads.push(mat);
    if (mat?.name !== 'inflatable' || underHead(mesh)) continue;
    const plate = new T.Mesh(mesh.geometry, plateMaterial()); plate.name = 'armour-plate';
    const size = new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).length();
    plate.scale.setScalar(1 + Math.min(.08, .05 / Math.max(.4, size)) + .02);
    plate.castShadow = true; plate.visible = false;
    mesh.add(plate);
    const dist = mesh.getWorldPosition(new T.Vector3()).distanceTo(centre);
    plates.push({ mesh: plate, mat: plate.material as T.MeshStandardMaterial, base: plate.scale.clone(), delay: dist });
  }
  // The helmet: a shell round the head, open over the face (where the eyes are).
  if (head) {
    const box = new T.Box3().setFromObject(head), r = box.getSize(new T.Vector3()).length() * .36;
    const eyes: T.Vector3[] = []; head.traverse(o => { if (o.name.startsWith('dormant-eye')) eyes.push(head.worldToLocal(o.getWorldPosition(new T.Vector3()))); });
    const face = eyes.length ? eyes.reduce((a, b) => a.add(b), new T.Vector3()).normalize() : new T.Vector3(0, 0, 1);
    const geo = new T.SphereGeometry(r, 32, 18, 0, Math.PI * 2 - 1.7); owned.push(geo);
    const helmet = new T.Mesh(geo, plateMaterial()); helmet.name = 'armour-helmet'; helmet.visible = false;
    helmet.position.copy(head.worldToLocal(box.getCenter(new T.Vector3())));
    // The sphere's gap is centred at phi = -0.85 (x = -cos φ, z = sin φ); turn it to face the eyes.
    helmet.quaternion.setFromUnitVectors(new T.Vector3(-Math.cos(-.85), 0, Math.sin(-.85)).normalize(), face.clone().normalize());
    head.add(helmet);
    plates.push({ mesh: helmet, mat: helmet.material as T.MeshStandardMaterial, base: helmet.scale.clone(), delay: 99 });
  }
  // Order the arrival: core first, head last.
  const order = [...plates].sort((a, b) => a.delay - b.delay); order.forEach((p, i) => { p.delay = i / Math.max(1, order.length - 1); });
  const padBase = pads.map(m => m.color.clone());

  let shown = -1;
  return {
    /** 0 = no armour … 1 = fully plated. Call each frame (cheap when unchanged). */
    set(k: number) {
      if (hole.node) hole.node.getWorldPosition(hole.centre);
      if (k === shown) return; shown = k;
      for (const p of plates) {
        const local = T.MathUtils.clamp((k - p.delay * .55) / .45, 0, 1), e = local * local * (3 - 2 * local);
        p.mesh.visible = local > 0;
        p.mesh.scale.copy(p.base).multiplyScalar(1 + (1 - e) * .18);
        p.mat.opacity = e; p.mat.transparent = e < 1; p.mat.depthWrite = e > .5;
      }
      pads.forEach((m, i) => m.color.copy(padBase[i]).lerp(PURPLE, T.MathUtils.smoothstep(k, .5, 1)));
    },
    dispose() { plates.forEach(p => p.mesh.removeFromParent()); owned.forEach(o => o.dispose()); pads.forEach((m, i) => m.color.copy(padBase[i])); },
  };
}
export type Armour = ReturnType<typeof fitArmour>;

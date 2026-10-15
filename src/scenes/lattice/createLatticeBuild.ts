import * as T from 'three';
import { SceneKit, seeded, type ChapterWorld, type Pose } from '../../phase2/SceneKit';
import type { PhaseTwoDirector } from '../../phase2/model';

export type LatticeBuildWorld = ChapterWorld & { pickables: T.Object3D[]; components: T.Group[] };

/** Sheltered wreckage pocket used for the tactile assembly and first swarm reveal. */
export function createLatticeBuild(director: PhaseTwoDirector): LatticeBuildWorld {
  const k = new SceneKit('13 / LAST GATE');
  const random = seeded(1307);
  k.box({ p: [0, -1.55, -1.5], s: [17, .55, 12], r: [0, -.08, -.025] }, k.edge);
  k.box({ p: [-4.7, .2, -4.7], s: [4.5, 5.2, .5], r: [.14, .2, -.08] }, k.concrete);
  k.box({ p: [5.2, 1.3, -4.8], s: [3.1, 2.8, .45], r: [.1, -.25, .22] }, k.metal);
  const wreckage: Pose[] = [];
  for (let i = 0; i < 32; i++) wreckage.push({
    p: [(random() - .5) * 13, -1 + random() * 4.4, -5.2 + random() * 8],
    s: [.05 + random() * .16, .04 + random() * .2, .04 + random() * .14],
    r: [random() * 2, random() * 2, random() * 2],
  });
  k.instances(wreckage, k.metal);
  k.label('SHELTER POCKET // 02', { p: [-6.6, 3.1, -4.7], r: [0, .42, .02] }, 4.8);
  k.label('LAST GATE', { p: [-2.4, 3.35, -2.2], r: [0, 0, 0] }, 4.4, '#c8f3ff');

  const target = new T.Vector3(0, .35, -1.7);
  const components: T.Group[] = [];
  const pickables: T.Object3D[] = [];
  const makeComponent = (index: number, name: string, position: T.Vector3, color: T.Material, shape: 'micro' | 'armour' | 'core') => {
    const group = new T.Group();
    group.name = name;
    group.position.copy(position);
    group.userData.componentIndex = index;
    const child = shape === 'micro'
      ? new T.Mesh(k.ownGeometry(new T.IcosahedronGeometry(.44, 1)), color)
      : shape === 'armour'
        ? new T.Mesh(k.ownGeometry(new T.SphereGeometry(.6, 12, 8, 0, Math.PI * 2, 0, Math.PI * .62)), color)
        : new T.Mesh(k.ownGeometry(new T.CylinderGeometry(.3, .48, 1.05, 8)), color);
    child.userData.componentIndex = index;
    child.castShadow = true;
    group.add(child);
    const ring = new T.Mesh(k.ownGeometry(new T.TorusGeometry(.72, .025, 5, 20)), k.cyan);
    ring.rotation.x = Math.PI / 2;
    ring.userData.componentIndex = index;
    group.add(ring);
    k.root.add(group);
    components.push(group);
    pickables.push(group);
  };
  makeComponent(0, 'MICROBOT REMNANTS', new T.Vector3(-3.4, .4, -2.1), k.ivory, 'micro');
  makeComponent(1, 'PORTAL-SCORED ARMOUR', new T.Vector3(3.2, 1.15, -2.2), k.metal, 'armour');
  makeComponent(2, 'MAGNETIC PREDICTOR CORE', new T.Vector3(.2, 2.65, -3.1), k.cyan, 'core');
  const connection = k.line([new T.Vector3(-1.1, .35, -1.7), target, new T.Vector3(1.2, .35, -1.7)], '#78d8ee', .22);
  connection.visible = false;
  const glow = k.haze({ p: [0, .3, -1.7], s: [5, 3.4, 1] }, '#286f8d', .14);

  const update = (time: number, dt: number) => {
    const s = director.getSnapshot();
    const assembled = s.assembled;
    const lattice = s.stage === 'lattice' || s.stage === 'hunt' || s.stage === 'descent' || s.stage === 'null' || s.stage === 'ready';
    connection.visible = lattice || s.scanning;
    glow.visible = !lattice;
    components.forEach((component, index) => {
      const connected = !!(assembled & (1 << index));
      const phase = time * .65 + index * 2.1;
      const destination = connected ? target.clone().add(new T.Vector3((index - 1) * .38, index * .18, index * .08)) : component.position.clone();
      // Drag positions belong to the input system; magnetic interpolation starts on connection.
      component.position.lerp(destination, connected ? Math.min(1, dt * 4.8) : dt * 2.2);
      component.rotation.x += dt * (.08 + index * .02);
      component.rotation.y += dt * (.12 + index * .04);
      component.visible = !lattice || !connected || s.stage === 'lattice' && director.stageTime < 2.2;
      const ring = component.children[1] as T.Mesh;
      ring.scale.setScalar(1 + Math.sin(phase) * .08);
    });
  };
  return { root: k.root, update, pickables, components, dispose: () => k.dispose() };
}

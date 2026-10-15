import * as T from 'three';
import { SceneKit, seeded, type ChapterWorld, type Pose } from '../../phase2/SceneKit';
import type { PhaseTwoDirector } from '../../phase2/model';
import { ANCHORS } from '../../systems/vector/paths';

export type NullChamberWorld = ChapterWorld & { anchors: T.Group[]; decoy: T.Group };

export function createNullChamber(director: PhaseTwoDirector): NullChamberWorld {
  const k = new SceneKit('15 / NULL CHAMBER');
  const random = seeded(1509);
  const boundary: Pose[] = [];
  for (let i = 0; i < 18; i++) boundary.push({ p: [(random() - .5) * 90, (random() - .5) * 42, -45 - random() * 130], s: [.03, .03, 6 + random() * 14], r: [random() * 2, random() * 2, random() * 2] });
  k.instances(boundary, k.dim);
  const dust: Pose[] = []; for (let i = 0; i < 54; i++) dust.push({ p: [(random() - .5) * 34, (random() - .5) * 19, -8 - random() * 108], s: [.025, .025, .025] });
  k.instances(dust, k.metal);
  k.haze({ p: [0, 3, -70], s: [80, 48, 1] }, '#273d62', .12);
  k.haze({ p: [0, -3, -125], s: [120, 65, 1] }, '#263658', .1);
  k.label('NULL CHAMBER', { p: [-6.5, 5.2, -24], r: [0, .15, 0] }, 5.4, '#7da9be');
  const anchors: T.Group[] = [];
  const points = ANCHORS;
  points.forEach((position, index) => {
    const g = new T.Group();
    g.position.set(...position);
    const ring = new T.Mesh(k.ownGeometry(new T.TorusGeometry(.62, .035, 6, 24)), k.cyan);
    ring.rotation.x = Math.PI / 2;
    const core = new T.Mesh(k.ownGeometry(new T.OctahedronGeometry(.16)), k.ivory);
    g.add(ring, core); g.visible = false; k.root.add(g); anchors.push(g);
  });
  const decoy = new T.Group();
  const decoyMaterial = k.ownMaterial(new T.MeshBasicMaterial({ color: '#94d9ee', transparent: true, opacity: .23, wireframe: true, depthWrite: false }));
  const torso = new T.Mesh(k.ownGeometry(new T.CapsuleGeometry(.58, 1.2, 5, 9)), decoyMaterial); torso.position.y = .35;
  const head = new T.Mesh(k.ownGeometry(new T.SphereGeometry(.43, 10, 7)), decoyMaterial); head.position.y = 1.6;
  decoy.add(torso, head); decoy.position.set(0, -1.4, -11); decoy.visible = false; k.root.add(decoy);
  return { root: k.root, anchors, decoy, update(time: number, dt: number) {
    const s = director.getSnapshot();
    anchors.forEach((anchor, index) => {
      anchor.visible = s.anchors > index;
      anchor.rotation.y += dt * (.35 + index * .1);
      anchor.children[0].scale.setScalar(1 + Math.sin(time * 1.8 + index) * .1);
    });
    // The incomplete silhouette is built by the instanced microbots, not a hologram.
    decoy.visible = false;
    decoy.rotation.y = Math.sin(time * .4) * .08;
    decoy.children.forEach(child => { if (child instanceof T.Mesh && child.material instanceof T.MeshBasicMaterial) child.material.opacity = .16 + Math.sin(time * 2.5) * .05; });
  }, dispose: () => k.dispose() };
}

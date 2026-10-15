import * as T from 'three';
import { SceneKit, seeded, type ChapterWorld, type Pose } from '../../phase2/SceneKit';
import type { PhaseTwoDirector } from '../../phase2/model';
import { ATTACK_START, ATTACK_END } from '../../systems/vector/paths';

export type FallingCityWorld = ChapterWorld & { attackScar: T.Group; captureLine: T.Line };

/** Low-detail, authored transforms sell the impossible upward city without physics. */
export function createFallingCity(director: PhaseTwoDirector): FallingCityWorld {
  const k = new SceneKit('14 / FALLING CITY');
  const random = seeded(1402);
  const blocks: Pose[] = [], windows: Pose[] = [], road: Pose[] = [], vehicles: Pose[] = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (7 + random() * 17), z = -12 - random() * 92;
    const y = -10 + random() * 18, w = 3 + random() * 7, h = 8 + random() * 25;
    blocks.push({ p: [x, y, z], s: [w, h, 4 + random() * 4], r: [0, random() * .3, (random() - .5) * .4] });
    for (let row = 0; row < Math.floor(h / 3); row++) for (let col = 0; col < 2; col++) windows.push({ p: [x + (col - .5) * w * .35, y - h / 2 + row * 3 + 1.1, z - 2.06], s: [.5, 1.1, .025] });
  }
  for (let i = 0; i < 12; i++) road.push({ p: [(random() - .5) * 32, -1 + random() * 12, -8 - random() * 85], s: [8 + random() * 8, .18, 1.2], r: [0, random() * .7, (random() - .5) * 1.25] });
  for (let i = 0; i < 14; i++) vehicles.push({ p: [(random() - .5) * 28, 1 + random() * 10, -10 - random() * 72], s: [1.8, .45, .8], r: [0, random() * 2, 0] });
  const buildingMesh = k.instances(blocks, k.concrete);
  const windowMesh = k.instances(windows, k.dim);
  const roadMesh = k.instances(road, k.edge);
  const vehicleMesh = k.instances(vehicles, k.metal);
  k.label('FALLING CITY / VECTOR ZONE 01', { p: [-7.8, 5.2, -13], r: [0, .35, 0] }, 6.3, '#a7d8e4');
  k.label('UPDRAFT // 0.7 M/S', { p: [6.2, 2.8, -21], r: [0, -.2, .1] }, 3.7, '#668ea0');
  const attackScar = new T.Group();
  const attackMaterial = k.ownMaterial(new T.LineBasicMaterial({ color: '#f19da5', transparent: true, opacity: 0, depthWrite: false }));
  const points = [new T.Vector3(...ATTACK_START), new T.Vector3(...ATTACK_END)];
  attackScar.add(new T.Line(k.ownGeometry(new T.BufferGeometry().setFromPoints(points)), attackMaterial));
  const captureLine = attackScar.children[0] as T.Line;
  k.root.add(attackScar);
  const bolt = k.mesh(k.sphereGeo, k.basic('#ff6e68', 4), {p: ATTACK_START, s:[.12,.12,.55]});
  const impactGlow = k.haze({p:[-3,1.5,1],s:[12,9,1]}, '#b5dfff', .35);
  const localDebris: Pose[] = []; for (let i = 0; i < 28; i++) localDebris.push({ p: [(random() - .5) * 12, random() * 7, -8 - random() * 30], s: [.05, .05, .05] });
  const debris = k.instances(localDebris, k.metal);
  return { root: k.root, attackScar, captureLine, update(time: number, dt: number) {
    const s = director.getSnapshot();
    const speed = s.stage === 'hunt' || s.stage === 'descent' ? .42 : .08;
    const drift = time * speed;
    buildingMesh.position.y = drift;
    windowMesh.position.y = drift;
    roadMesh.position.y = drift * 1.15;
    vehicleMesh.position.y = drift * 1.25;
    buildingMesh.rotation.z = Math.sin(time * .08) * .008;
    roadMesh.rotation.z = Math.sin(time * .13) * .015;
    debris.position.y = Math.sin(time * .6) * .25;
    const active = s.stage === 'hunt' && director.huntTime >= 16 && director.huntTime < 21;
    const flight = T.MathUtils.clamp((director.huntTime-16)*2.5,0,1);
    bolt.visible = director.huntTime >=16 && director.huntTime <16.45;
    bolt.position.copy(points[0]).lerp(points[1],flight);
    const impact = Math.max(0,1-Math.abs(director.huntTime-16.35)*3);
    impactGlow.visible=impact>0;impactGlow.scale.set(12*impact,9*impact,1);
    debris.position.x=impact*1.8;debris.rotation.z=impact*.2;
    roadMesh.position.x=impact*.45;
    attackScar.visible = director.huntTime >= 16 || s.captured;
    attackMaterial.color.set(active ? '#f19da5' : '#b8efff');
    attackMaterial.opacity = active ? .52 + Math.sin(time * 8) * .15 : .82;
    if (active) { attackScar.rotation.z = Math.sin(time * 2.2) * .014; attackScar.scale.setScalar(1 + Math.sin(time * 6) * .025); }
  }, dispose: () => k.dispose() };
}

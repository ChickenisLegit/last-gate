import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const housing = new T.MeshStandardMaterial({ color: '#171a1b', metalness: .58, roughness: .42 });
const edge = new T.MeshStandardMaterial({ color: '#5d6462', metalness: .82, roughness: .3 });
const red = new T.MeshStandardMaterial({ color: '#c52e24', metalness: .38, roughness: .38 });
const deepRed = new T.MeshStandardMaterial({ color: '#701b17', metalness: .38, roughness: .43 });
const brass = new T.MeshStandardMaterial({ color: '#bd9454', metalness: .84, roughness: .3 });
const ivory = new T.MeshStandardMaterial({ color: '#e0d7bf', roughness: .55 });
const wireRed = new T.MeshStandardMaterial({ color: '#c7382c', metalness: .3, roughness: .48 });
const wireBlue = new T.MeshStandardMaterial({ color: '#397d8a', metalness: .3, roughness: .46 });
function addBox(g: T.Group, size: [number, number, number], material: T.Material, position: [number, number, number], radius = .025) {
  const mesh = new T.Mesh(new RoundedBoxGeometry(...size, 3, radius), material);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function addCylinder(g: T.Group, radius: number, depth: number, material: T.Material, position: [number, number, number]) {
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, depth, 32), material);
  mesh.rotation.x = Math.PI / 2; mesh.position.set(...position); mesh.castShadow = true; g.add(mesh); return mesh;
}
export function createLimiter() {
  const g = new T.Group();
  addBox(g, [3.25, 2.02, 1.12], housing, [0, 1.04, 0], .075);
  addBox(g, [3.12, 1.9, .16], edge, [0, 1.04, .55], .045);
  addBox(g, [3, 1.78, .055], housing, [0, 1.04, .65], .025);
  for (const x of [-1.43, 1.43]) for (const y of [.23, 1.85]) addCylinder(g, .045, .035, brass, [x, y, .7]);
  addBox(g, [1.12, 1.14, .24], deepRed, [-.58, 1.12, .82], .06);
  addBox(g, [.98, 1.02, .12], red, [-.58, 1.12, .99], .04);
  addBox(g, [.7, .12, .035], deepRed, [-.58, 1.49, 1.07], .012);
  addBox(g, [.48, .055, .025], ivory, [-.58, 1.49, 1.095], .01);
  addCylinder(g, .34, .12, brass, [-.58, .98, 1.09]);
  addCylinder(g, .27, .13, housing, [-.58, .98, 1.17]);
  addCylinder(g, .13, .16, edge, [-.58, .98, 1.28]);
  addCylinder(g, .055, .17, housing, [-.58, .98, 1.39]);
  for (let i = 0; i < 7; i++) addBox(g, [.035, .17, .025], deepRed, [-.16 + i * .11, .94, 1.08], .008);
  addBox(g, [2.55, .26, .48], housing, [0, 2.18, -.04], .025);
  addBox(g, [2.43, .14, .4], edge, [0, 2.32, -.04], .02);
  for (let i = 0; i < 8; i++) {
    const x = -.98 + i * .28;
    addBox(g, [.18, .15, .27], i % 2 ? ivory : brass, [x, 2.47, .04], .012);
    addCylinder(g, .055, .09, brass, [x, 2.58, .04]);
  }
  for (const side of [-1, 1]) {
    addBox(g, [.22, .5, .3], housing, [side * 1.63, .47, -.04], .025);
    for (let i = 0; i < 3; i++) {
      const wire = new T.Mesh(new T.TorusGeometry(.2, .025, 8, 24, Math.PI), i === 1 ? wireBlue : wireRed);
      wire.position.set(side * 1.68, .18, -.12 + i * .12); wire.rotation.x = Math.PI / 2; wire.castShadow = true; g.add(wire);
    }
  }
  return g;
}

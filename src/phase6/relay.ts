import * as T from 'three';
import { SceneKit, seeded } from '../phase2/SceneKit';
import { createFacility } from '../phase5/facility';

/**
 * Back at the telemetry relay, the moment Phase 5 left it: lights on, the trace still drawn into
 * the sky. Outside the blown-out back wall is the yard where Baymax followed Hiro and sat down
 * under the limit; the service road runs off it into the city.
 */
export const BAYMAX_YARD = new T.Vector3(-.8, 0, -11.5);
export const RELAY_STATE = { powered: true, leads: 3, snr: 12, az: 212, el: 38, strength: 100, traced: true, breakers: [true, true, false, false] };

export function createRelay() {
  const facility = createFacility();
  const k = new SceneKit('phase6-yard');
  const random = seeded(7117), rand = (a: number, b: number) => a + random() * (b - a);
  // Yard: hard standing outside the back wall, a fence line, crates and a road out.
  k.box({ p: [0, -.2, -24], s: [30, .4, 34] }, k.concrete);
  k.box({ p: [0, .005, -24], s: [6, .02, 34] }, k.edge);
  for (const side of [-1, 1]) for (let z = -9; z > -40; z -= 3) {
    k.box({ p: [side * 12, 1.1, z], s: [.08, 2.2, .08] }, k.metal);
    if (random() > .3) k.box({ p: [side * 12, 1.6, z - 1.5], s: [.03, 1.2, 3], r: [0, 0, side * rand(-.08, .08)] }, k.dim);
  }
  for (const [x, z, r] of [[-5.2, -9.6, .2], [-6.4, -10.8, -.3], [5.8, -11, .5], [4.4, -18, 0]]) k.box({ p: [x, .45, z], s: [1.1, .9, 1.1], r: [0, r, 0] }, random() > .5 ? k.ivory : k.metal);
  // He sat down against an old cable drum.
  k.mesh(k.ownGeometry(new T.CylinderGeometry(1.1, 1.1, 1.3, 24)), k.dark, { p: [BAYMAX_YARD.x - .2, 1.1, BAYMAX_YARD.z - 1.9], r: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 6; i++) k.box({ p: [rand(-8, 8), .08, rand(-30, -9)], s: [rand(.4, 1.4), .16, rand(.4, 1)], r: [0, rand(0, 3), 0] }, k.concrete);
  // A yard lamp (lit by the relay's own lights; no extra light of its own).
  k.mesh(k.ownGeometry(new T.SphereGeometry(.14, 12, 10)), k.basic('#ffc062', 1.6), { p: [5.4, 4.2, -8.9] });
  k.box({ p: [5.4, 2.1, -8.9], s: [.12, 4.2, .12] }, k.metal);
  const root = new T.Group(); root.add(facility.root, k.root);
  return {
    root,
    update(t: number, dt: number) { facility.update(t, dt, RELAY_STATE); },
    dispose() { facility.dispose(); k.dispose(); root.removeFromParent(); },
  };
}
export type Relay = ReturnType<typeof createRelay>;

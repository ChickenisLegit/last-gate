import * as T from 'three';
import { SceneKit, seeded, type Pose } from '../phase2/SceneKit';
import { createPortalDimension } from '../environment/PortalDimension.js';

/** A camera beat along the service lane: where the eye rests and what it looks toward. */
export type Stop = { name: string; pos: T.Vector3; look: T.Vector3 };

/**
 * A compact, highly directed slice of the same corrupted San Fransokyo — a damaged harbour
 * service district. Three depth layers (foreground framing, the service lane and its shops,
 * the broken skyline and dimensional fracture beyond) create discovery: Baymax lies to the
 * right, screened by a collapsed maintenance gantry until the camera rounds toward the bay.
 *
 * Art direction continues Phase 1: neutral/slate architecture, cyan atmospheric depth, warm
 * practical lights, and a single red presence on Baymax. The location changes, not the look.
 */
export function createDistrict() {
  const group = new T.Group(); group.name = 'harbour-service-district';
  const random = seeded(4821);

  // --- Background: the displaced portal city, pushed far back and down for a skyline.
  const city = createPortalDimension();
  const cityGroup = city.group as T.Group;
  cityGroup.position.set(2, -1.5, -34);
  cityGroup.scale.setScalar(1.15);
  group.add(cityGroup);

  const k = new SceneKit('district-props');
  group.add(k.root);

  // Warmer practical materials layered onto the Phase 1 slate palette.
  const warm = k.basic('#ffb25e', 1.3);
  const warmDim = k.basic('#c9772f', 1);
  const sign = k.basic('#7fe6ff', 1.4);
  const signWarm = k.basic('#ff8a53', 1.2);
  const amber = k.basic('#ffc15a', 1.5);
  const rust = k.standard('#5a4336', .85, .25);
  const shutter = k.standard('#39474f', .5, .7);

  // === GROUND: the service lane, with slabs shifted by dimensional distortion. ===
  k.box({ p: [1, -1.4, -6], s: [13, .6, 30], r: [0, .04, 0] }, k.edge);
  k.box({ p: [1, -1.06, -6], s: [12.6, .05, 29.6], r: [0, .04, 0] }, k.concrete);
  // Lifted / rotated road pieces near the fracture.
  k.box({ p: [-3.6, -.7, -14], s: [4.5, .2, 5], r: [.22, .1, .16] }, k.concrete);
  k.box({ p: [5.2, -.55, -16], s: [3.4, .18, 4], r: [-.18, -.2, -.12] }, k.concrete);
  const marks: Pose[] = []; for (let i = 0; i < 9; i++) marks.push({ p: [.4, -1.02, 7 - i * 2.6], s: [.12, .02, 1.3], r: [0, .04, 0] });
  k.instances(marks, k.metal);

  // === LEFT: broken shopfronts, a service shop with shutter, signage, vending. ===
  for (let i = 0; i < 4; i++) {
    const z = 2 - i * 5.5, h = 7 + random() * 4;
    k.box({ p: [-6.6, h / 2 - 1.1, z], s: [3.2, h, 4.4], r: [0, .12, .02 * (i % 2 ? 1 : -1)] }, k.ivory);
    // Window rows.
    const win: Pose[] = [];
    for (let r = 0; r < Math.floor(h / 1.8); r++) for (let c = 0; c < 2; c++) win.push({ p: [-5.02, -.2 + r * 1.8, z - .9 + c * 1.8], s: [.02, 1, .9], r: [0, .12, 0] });
    k.instances(win, k.dim);
  }
  // The service shop: open bay with a half-dropped robotics-maintenance shutter.
  k.box({ p: [-4.5, .5, 1.2], s: [.25, 3.6, 3.6], r: [0, .12, 0] }, rust);
  k.box({ p: [-4.4, 1.9, 1.2], s: [.12, 1.6, 3.4], r: [0, .12, 0] }, shutter);
  for (let i = 0; i < 7; i++) k.box({ p: [-4.38, 1.2 + i * .2, 1.2], s: [.06, .04, 3.3], r: [0, .12, 0] }, k.dark);
  // Bilingual signage (San Fransokyo), one surviving cyan, one dead warm.
  k.label('ロボ整備 / ROBOTICS SVC', { p: [-4.2, 3.1, 2], r: [0, .12 + Math.PI / 2, 0] }, 3.4, '#8fe9ff');
  k.label('港湾 24 / BAY 24', { p: [-4.9, 1.4, -4.4], r: [0, .12 + Math.PI / 2, 0] }, 2.6, '#ff9a63');
  k.mesh(new T.PlaneGeometry(2.1, .5), sign, { p: [-4.18, 3.1, 2], r: [0, .12 + Math.PI / 2, 0] });
  // Vending / service units with their own glow.
  for (const [z, mat] of [[-1.3, sign], [-2.6, signWarm]] as const) {
    k.box({ p: [-3.9, -.35, z], s: [.9, 1.5, .8], r: [0, .1, 0] }, rust);
    k.mesh(new T.PlaneGeometry(.55, 1), mat, { p: [-3.42, -.3, z], r: [0, .1 + Math.PI / 2, 0] });
  }

  // === RIGHT: the robotics bay where Baymax lies, screened by a collapsed gantry. ===
  k.box({ p: [7, 1.3, -5], s: [3, 9, 6], r: [0, -.16, -.03] }, k.ivory);
  k.box({ p: [5.1, .6, -3], s: [.22, 3.4, 4], r: [0, -.1, .05] }, rust);
  // Collapsed maintenance gantry: the occluder. Baymax sits just beyond it.
  k.box({ p: [3.4, .2, -1.2], s: [3.2, .4, .4], r: [.1, .3, -.5] }, k.metal);
  k.box({ p: [2.6, -.2, -1.6], s: [.35, 2.2, .35], r: [.3, 0, .7] }, k.metal);
  k.box({ p: [4.2, .5, -2.2], s: [2.6, .35, .35], r: [-.1, -.2, .35] }, k.metal);
  k.box({ p: [3.1, -.5, -.4], s: [1.8, .9, 1.4], r: [0, .2, .12] }, k.concrete);
  // A charging point beside the bay (its light steadies later, in engineering).
  k.box({ p: [5.4, -.55, -5.4], s: [.5, 1.1, .5], r: [0, -.1, 0] }, rust);
  k.mesh(new T.PlaneGeometry(.3, .5), warmDim, { p: [5.4, -.3, -5.12], r: [0, 0, 0] });
  // A maintenance cart with a tool bench.
  k.box({ p: [1.8, -.7, -2.2], s: [1.4, .7, .9], r: [0, .3, 0] }, rust);
  k.box({ p: [1.8, -.32, -2.2], s: [1.5, .08, 1], r: [0, .3, 0] }, k.metal);

  // === FOREGROUND: utility poles, hanging cables, a broken street light framing the shot. ===
  k.box({ p: [-2.2, 1.5, 6.5], s: [.18, 6, .18], r: [0, 0, .04] }, k.metal);
  k.box({ p: [-2.2, 4.2, 6.2], s: [2.2, .14, .14], r: [0, 0, -.12] }, k.metal);
  k.box({ p: [6.2, 2, 5.5], s: [.2, 7, .2], r: [0, 0, -.05] }, k.metal);
  // A broken, amber street lamp — one of the only warm sources near the lane.
  k.mesh(new T.SphereGeometry(.16, 12, 10), amber, { p: [6.2, 5.3, 5.5] });
  // Drooping cables between the poles.
  for (let i = 0; i < 4; i++) {
    const sag = .5 + i * .18, pts = [new T.Vector3(-2.2, 4.1 - i * .25, 6.2), new T.Vector3(2, 3.2 - sag, 4), new T.Vector3(6.2, 4 - i * .25, 5.4)];
    k.line(new T.CatmullRomCurve3(pts).getPoints(28), '#0c1620', .85);
  }

  // === DISTANCE: monorail remains, a collapsed pedestrian bridge, the dimensional fracture. ===
  k.box({ p: [-8, 6, -24], s: [1, .9, 26], r: [0, .14, .05] }, k.edge);
  for (let i = 0; i < 6; i++) k.box({ p: [-8 + i * .4, 2.6 + i * .4, -16 - i * 3], s: [.5, 7, .5], r: [0, 0, .08] }, k.dark);
  // Collapsed pedestrian bridge, sheared mid-span.
  k.box({ p: [3, 5.5, -22], s: [10, .5, 2], r: [-.12, .1, -.22] }, k.concrete);
  k.box({ p: [8.5, 3, -22], s: [.5, 5, 2], r: [0, 0, .1] }, k.edge);
  // The dimensional fracture: cyan/violet light bleeding between displaced blocks.
  const fractureMat = k.ownMaterial(new T.MeshBasicMaterial({ color: new T.Color('#7fd6ff').multiplyScalar(1.6), transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false }));
  const fracture = k.mesh(new T.PlaneGeometry(1.4, 18), fractureMat, { p: [-2, 6, -30], r: [0, .1, .3] });
  k.haze({ p: [-2, 6, -29], s: [10, 16, 1] }, '#4aa6d8', .2);
  k.haze({ p: [2, 0, -12], s: [14, 8, 1] }, '#2d5f82', .16);
  k.haze({ p: [0, 1, 2], s: [16, 10, 1] }, '#24506f', .1);

  // === LIGHTING: one cool key, selective warm practicals, Baymax's red is added by the scene. ===
  const hemi = new T.HemisphereLight('#9ec6e4', '#0a1420', 1.5); group.add(hemi);
  const key = new T.DirectionalLight('#bcd9ec', 2.1); key.position.set(-8, 16, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  key.shadow.bias = -.0005; group.add(key);
  const fill = new T.DirectionalLight('#35628c', .8); fill.position.set(12, 3, -20); group.add(fill);
  // Warm practicals: workshop interior, the amber lamp, a vending unit.
  const shopLight = new T.PointLight('#ffae55', 6, 10, 1.8); shopLight.position.set(-3.8, 1.4, 1); group.add(shopLight);
  const lampLight = new T.PointLight('#ffc062', 4, 9, 2); lampLight.position.set(6.2, 5.1, 5.2); group.add(lampLight);
  const ventLight = new T.PointLight('#ff8a46', 2.4, 6, 2); ventLight.position.set(-3.5, -.2, -1.8); group.add(ventLight);
  // Cool bleed from the fracture.
  const fractureLight = new T.PointLight('#73c8ff', 5, 40, 1.4); fractureLight.position.set(-2, 6, -26); group.add(fractureLight);

  group.position.set(0, 0, 0);

  // Authored camera beats. Baymax (anchor below) is hidden until DISCOVER.
  const stops: Stop[] = [
    { name: 'arrive', pos: new T.Vector3(.4, 1.75, 9), look: new T.Vector3(.2, 1.4, -3) },
    { name: 'lane', pos: new T.Vector3(1.4, 1.6, 4.6), look: new T.Vector3(1, 1.3, -6) },
    { name: 'corner', pos: new T.Vector3(3.3, 1.6, 2), look: new T.Vector3(4.6, .4, -3.6) },
  ];
  const baymaxAnchor = new T.Vector3(4.7, 0, -4);

  let flicker = 0;
  return {
    group, stops, baymaxAnchor,
    update(time: number, dt: number, reduced: boolean) {
      city.update(time, dt, reduced, 0, 'approaching');
      flicker = reduced ? 1 : .82 + .18 * Math.sin(time * 23 + Math.sin(time * 7)) * (Math.random() > .04 ? 1 : .3);
      shopLight.intensity = 6 * flicker;
      ventLight.intensity = 2.4 * (.7 + .3 * Math.sin(time * 1.6));
      fractureMat.opacity = reduced ? .9 : .7 + .3 * Math.abs(Math.sin(time * .9));
      fractureLight.intensity = 5 * (.8 + .2 * Math.sin(time * .9));
      fracture.rotation.z = .3 + Math.sin(time * .3) * .02;
    },
    dispose() { city.dispose(); k.dispose(); group.removeFromParent(); },
  };
}
export type District = ReturnType<typeof createDistrict>;

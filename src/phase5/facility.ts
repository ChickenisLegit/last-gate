import * as T from 'three';
import { SceneKit, seeded } from '../phase2/SceneKit';
import { createPortalDimension } from '../environment/PortalDimension.js';

/**
 * The communications / robotics telemetry facility, deeper in the same city. A relay room with a
 * broken back wall: consoles, server racks, a breaker cabinet and a patch panel inside; the
 * receiver dish on its lattice tower outside; the fracture skyline beyond. It starts dark and
 * answers each repair: lights and screens on power, patch leads lit, the dish turning, and at
 * the end the traced signal drawn up into the sky toward the boundary.
 */
export function createFacility() {
  const k = new SceneKit('telemetry-facility');
  const random = seeded(5150), rand = (a: number, b: number) => a + random() * (b - a);
  const city = createPortalDimension();
  // Keep the skyline close behind the receiver on the same sightline, without intersecting the dish.
  city.group.position.set(-6, -.6, -52); city.group.scale.setScalar(1.25);
  city.group.traverse(o => { o.castShadow = false; });
  k.root.add(city.group);

  // A grounded service apron connects the broken wall to the receiver tower.
  k.box({ p: [1.6, -.42, -10.5], s: [13, .22, 12] }, k.concrete);
  k.box({ p: [1.6, -.28, -16.5], s: [9.5, .08, 13] }, k.edge);
  for (const x of [-5.4, 8.6]) k.box({ p: [x, .65, -17], s: [1.2, 2.1, 7] }, k.dark);
  for (const [x, z, w, h] of [[-3.8, -24, 4.5, 6], [7.2, -27, 5.5, 8], [-8.5, -31, 6, 10]] as const) {
    k.box({ p: [x, h / 2 - .35, z], s: [w, h, 5] }, k.standard('#465563', .82, .12));
    k.box({ p: [x, h + .02, z], s: [w + .18, .16, 5.18] }, k.edge);
    for (let y = 1.4; y < h - .4; y += 1.55) {
      k.box({ p: [x, y, z - 2.53], s: [w - .35, .055, .06] }, k.dark);
    }
  }

  // Small service details give the apron scale and tie the relay room to the dish.
  const apronLight = k.ownMaterial(new T.MeshBasicMaterial({ color: '#d9b56c', toneMapped: false }));
  for (const x of [-4.8, 8]) {
    k.box({ p: [x, 1.9, -9.3], s: [.12, 3.8, .12] }, k.metal);
    k.mesh(new T.SphereGeometry(.16, 12, 8), apronLight, { p: [x, 3.85, -9.3] });
    k.box({ p: [x, .08, -9.3], s: [.55, .16, .55] }, k.dark);
  }
  for (const x of [-3.9, -2.7, 6.1, 7.3]) {
    k.box({ p: [x, .12, -15.7], s: [.22, .24, .22] }, k.metal);
    k.box({ p: [x, .34, -15.7], s: [.3, .08, .3] }, k.edge);
  }
  for (const x of [-3.7, -2.8, 6.2, 7.1]) {
    k.box({ p: [x, .2, -18.2], s: [.8, .4, .7] }, k.ivory);
    k.box({ p: [x, .43, -18.2], s: [.65, .04, .55] }, k.edge);
  }
  const apronCable = new T.CatmullRomCurve3([
    new T.Vector3(-7.6, .08, -6.5), new T.Vector3(-6.2, .08, -9.5), new T.Vector3(-3.4, .08, -11.6),
    new T.Vector3(-1.2, .08, -13.1), new T.Vector3(1.5, .08, -14.2), new T.Vector3(1.6, .08, -15.3),
  ]);
  k.mesh(k.ownGeometry(new T.TubeGeometry(apronCable, 30, .035, 6)), k.dark, { p: [0, 0, 0] });
  for (const z of [-8.2, -11.2, -14.1]) k.box({ p: [1.6, .04, z], s: [2.2, .08, .035] }, k.edge);
  for (const z of [-8.2, -11.2, -14.1]) k.line(new T.CatmullRomCurve3([
    new T.Vector3(-7.6, .09, z), new T.Vector3(-4.5, .06, z + .25), new T.Vector3(-1.6, .09, z),
  ]).getPoints(12), '#27343b', .75);
  k.box({ p: [5.4, .32, -12.8], s: [1.4, .64, 1.1] }, k.dark);
  k.box({ p: [5.4, .68, -12.8], s: [1.15, .05, .85] }, k.edge);
  k.box({ p: [5.4, .98, -12.8], s: [.07, .62, .72] }, k.metal);

  const screenOff = new T.Color('#0b1a22'), screenOn = new T.Color('#5fd2ff');
  const screenMat = new T.MeshBasicMaterial({ color: screenOff.clone(), toneMapped: false });
  const ledMat = new T.MeshBasicMaterial({ color: '#1a2a24', toneMapped: false });
  const panelMat = new T.MeshBasicMaterial({ color: '#141c20', toneMapped: false });
  for (const m of [screenMat, ledMat, panelMat]) k.ownMaterial(m);

  // Shell: floor, side walls, a back wall blown open toward the dish, a broken ceiling.
  k.box({ p: [0, -.2, 0], s: [17, .4, 15] }, k.concrete);
  const wall = k.standard('#3a4a58', .9, .1);
  for (const x of [-8.3, 8.3]) k.box({ p: [x, 2.4, 0], s: [.4, 5.2, 15] }, wall);
  for (const x of [-8.08, 8.08]) for (let y = .9; y < 4.6; y += 1.2) k.box({ p: [x, y, 0], s: [.04, .04, 14.6] }, k.edge);
  k.box({ p: [-5.6, 2.4, -6.8], s: [5.8, 5.2, .4] }, wall);
  k.box({ p: [5.6, 2.4, -6.8], s: [5.8, 5.2, .4] }, wall);
  // The blast took the wall above the gap too: the dish and the sky read straight through it.
  k.box({ p: [-2.1, 4.9, -6.8], s: [1.2, .6, .4], r: [0, 0, .3] }, wall);
  for (let i = 0; i < 5; i++) k.box({ p: [rand(-2.4, 2.4), rand(-.05, .25), rand(-7.6, -6.2)], s: [rand(.4, 1.2), rand(.2, .5), rand(.4, 1)], r: [rand(0, 1), rand(0, 1), rand(0, 1)] }, k.ivory);
  k.box({ p: [-4, 5.1, 1], s: [9, .3, 15], r: [0, 0, .03] }, k.edge);
  k.box({ p: [5.4, 5.6, -2], s: [5, .3, 8], r: [.12, 0, -.1] }, k.edge);
  // Ceiling light panels: dark until power returns.
  const lights: T.Mesh[] = [];
  for (const [x, z] of [[-3, -2], [0, -2], [3, -2], [-3, 2], [0, 2]]) lights.push(k.mesh(new T.PlaneGeometry(1.6, .35), panelMat, { p: [x, 4.9, z], r: [Math.PI / 2, 0, 0] }));

  // Console row: three desks, each with a monitor whose screen lights with power.
  for (const x of [-3.2, 0, 3.2]) {
    k.box({ p: [x, .86, -1.6], s: [2.4, .08, .95] }, k.metal);
    for (const dx of [-1.05, 1.05]) k.box({ p: [x + dx, .42, -1.6], s: [.08, .84, .85] }, k.dark);
    k.box({ p: [x, 1.42, -1.95], s: [1.25, .72, .06], r: [-.12, 0, 0] }, k.dark);
    k.mesh(new T.PlaneGeometry(1.12, .6), screenMat, { p: [x, 1.42, -1.915], r: [-.12, 0, 0] });
    k.box({ p: [x, .92, -1.35], s: [.8, .03, .26], r: [.08, 0, 0] }, k.edge);
  }
  // Server racks on the left wall, LED strips waking with power.
  for (let i = 0; i < 4; i++) {
    const z = -4.6 + i * 1.3;
    k.box({ p: [-7.5, 1.15, z], s: [1, 2.3, 1.05] }, k.dark);
    for (let r = 0; r < 6; r++) k.mesh(new T.PlaneGeometry(.55, .03), ledMat, { p: [-6.99, .45 + r * .3, z], r: [0, Math.PI / 2, 0] });
  }
  // Breaker cabinet and patch panel on the right wall.
  k.box({ p: [7.75, 1.5, .4], s: [.5, 1.6, 1.2] }, k.metal);
  const breakers: T.Mesh[] = [];
  for (let i = 0; i < 4; i++) breakers.push(k.box({ p: [7.48, 1.75 - i * .3, .4], s: [.08, .12, .36] }, k.edge));
  k.box({ p: [7.8, 1.6, 2.6], s: [.3, 1.1, 1.6] }, k.dark);
  const leads: T.Mesh[] = [];
  const leadColors = ['#f0b46e', '#8fe0ff', '#9be6b4'];
  for (let i = 0; i < 3; i++) {
    const y = 1.95 - i * .32, curve = new T.CatmullRomCurve3([new T.Vector3(7.62, y, 2.05), new T.Vector3(7.2, y - .35, 2.6), new T.Vector3(7.62, y - .1, 3.15)]);
    const lead = k.mesh(k.ownGeometry(new T.TubeGeometry(curve, 16, .025, 8)), k.ownMaterial(new T.MeshBasicMaterial({ color: leadColors[i], toneMapped: false })), { p: [0, 0, 0] });
    lead.visible = false; leads.push(lead);
  }
  // Cable trays overhead with sagging runs.
  k.box({ p: [0, 4.1, 0], s: [14, .08, .5] }, k.metal);
  for (let i = 0; i < 6; i++) k.line(new T.CatmullRomCurve3([new T.Vector3(-7 + i * 2.4, 4.05, 0), new T.Vector3(-6 + i * 2.4, 3.4 - random() * .5, .2), new T.Vector3(-5 + i * 2.4, 4.05, 0)]).getPoints(16), '#0d151c', .9);

  // The receiver dish outside, on a lattice tower, framed by the broken back wall.
  const tower = new T.Group(); tower.position.set(1.6, -.2, -14); k.root.add(tower);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box({ p: [x * .9, 3.2, z * .9], s: [.14, 6.6, .14], r: [z * -.06, 0, x * .06] }, k.metal, tower);
  for (let y = .8; y < 6.4; y += 1.1) for (const r of [0, Math.PI / 2]) k.box({ p: [0, y, 0], s: [1.9, .07, .07], r: [0, r, .5] }, k.metal, tower);
  const dish = new T.Group(); dish.position.set(0, 6.9, 0); tower.add(dish);
  const profile: T.Vector2[] = []; for (let i = 0; i <= 16; i++) { const r = i / 16 * 1.9; profile.push(new T.Vector2(r, r * r * .18)); }
  const bowl = k.mesh(k.ownGeometry(new T.LatheGeometry(profile, 40)), k.ownMaterial(new T.MeshStandardMaterial({ color: '#b9c4c9', metalness: .5, roughness: .45, side: T.DoubleSide })), { p: [0, 0, 0], r: [Math.PI / 2, 0, 0] }, dish);
  void bowl;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box({ p: [Math.cos(a) * .7, Math.sin(a) * .7, .75], s: [.04, .04, 1.6], r: [Math.sin(a) * .45, -Math.cos(a) * .45, 0] }, k.metal, dish); }
  k.mesh(new T.CylinderGeometry(.09, .12, .3, 12), k.dark, { p: [0, 0, 1.5], r: [Math.PI / 2, 0, 0] }, dish);
  k.box({ p: [0, -.5, 0], s: [.5, .7, .5] }, k.dark, dish);

  // The traced signal: from the dish up through the sky toward the boundary. Drawn at the end.
  const traceMat = k.ownMaterial(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float uTime;uniform float uReveal;void main(){if(vUv.x>uReveal)discard;float pulse=.5+.5*sin((vUv.x*30.-uTime*3.));gl_FragColor=vec4(vec3(1.,.42,.36)*(.6+pulse*.8),.85);}',
  }));
  const tracePath = new T.CatmullRomCurve3([new T.Vector3(1.6, 6.9, -14), new T.Vector3(-2, 14, -40), new T.Vector3(-8, 26, -80), new T.Vector3(-12, 34, -118)]);
  const trace = k.mesh(k.ownGeometry(new T.TubeGeometry(tracePath, 80, .09, 8)), traceMat, { p: [0, 0, 0] });
  trace.visible = false;
  const boundary = k.haze({ p: [-12, 34, -119], s: [26, 26, 1] }, '#ff6a52', 0);

  // Light: cold spill from the fracture and one red emergency lamp until power is back.
  const hemi = new T.HemisphereLight('#7ea6c4', '#0a1420', .7); k.root.add(hemi);
  const sky = new T.DirectionalLight('#b6d6ee', 1.2); sky.position.set(-4, 12, -10); k.root.add(sky);
  const emergency = new T.PointLight('#ff4a3a', 3.5, 12, 1.8); emergency.position.set(-6.5, 3.6, 2); k.root.add(emergency);
  const roomLights = [-3, 0, 3].map(x => { const l = new T.PointLight('#d8ecff', 0, 9, 1.6); l.position.set(x, 4.4, -1); k.root.add(l); return l; });
  const consoleGlow = new T.PointLight('#5fd2ff', 0, 6, 2); consoleGlow.position.set(0, 1.6, -.6); k.root.add(consoleGlow);

  let reveal = 0;
  return {
    root: k.root,
    update(t: number, dt: number, s: { powered: boolean; leads: number; snr: number; az: number; el: number; strength: number; traced: boolean; breakers: boolean[] }) {
      city.update(t, dt, false, 0, 'approaching');
      const on = s.powered ? 1 : 0;
      panelMat.color.set(on ? '#dbeeff' : '#141c20');
      roomLights.forEach(l => { l.intensity = T.MathUtils.damp(l.intensity, on * 6, 3, dt); });
      emergency.intensity = on ? 0 : 3.5 * (.6 + .4 * Math.sin(t * 3));
      screenMat.color.copy(screenOff).lerp(screenOn, on * (.45 + .55 * Math.min(1, s.strength / 100)));
      consoleGlow.intensity = on * 2.4;
      ledMat.color.set(on ? (Math.sin(t * 9) > 0 ? '#7dffa6' : '#3fd27a') : '#1a2a24');
      breakers.forEach((b, i) => { b.rotation.z = s.breakers[i] ? .5 : -.5; });
      leads.forEach((l, i) => { l.visible = i < s.leads; });
      dish.rotation.set(-T.MathUtils.degToRad(s.el), T.MathUtils.degToRad(s.az - 212) + Math.PI, 0, 'YXZ');
      reveal = T.MathUtils.damp(reveal, s.traced ? 1 : 0, 1.2, dt);
      trace.visible = reveal > .01; (traceMat as T.ShaderMaterial).uniforms.uReveal.value = reveal; (traceMat as T.ShaderMaterial).uniforms.uTime.value = t;
      ((boundary.material as T.ShaderMaterial).uniforms.opacity.value) = reveal * .5;
    },
    dispose() { city.dispose(); k.dispose(); },
  };
}
export type Facility = ReturnType<typeof createFacility>;

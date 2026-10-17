import * as T from 'three';
import { SceneKit, seeded, type Pose } from '../phase2/SceneKit';
import { chipOutline } from '../characters/RedChip.js';

/**
 * The other side: San Fransokyo as it should be, quiet at dusk. A small lawn on the waterfront,
 * a railing, the water, the bridge's red towers across the bay and the city lit beyond it.
 * Everything obeys gravity here. The same group is drawn through the open gate (into a render
 * target) and is then the set itself once they cross.
 *
 * HOME_GATE is where the gate opens on this side: the portal's centre maps onto it.
 */
export const HOME_GATE = new T.Vector3(0, 3.4, 7);
export const HOME_BAYMAX = new T.Vector3(-.6, 0, 2.4);
export const CARE_CHIP_AT = new T.Vector3(1.4, .05, 1.7);

const SKY_FS = `varying vec3 vDir;void main(){float h=normalize(vDir).y;
vec3 top=vec3(.2,.17,.36);vec3 mid=vec3(.357,.294,.541);vec3 low=vec3(.98,.62,.45);vec3 glow=vec3(1.,.8,.6);
vec3 c=mix(low,mid,smoothstep(.0,.22,h));c=mix(c,top,smoothstep(.22,.7,h));
float sun=pow(max(0.,dot(normalize(vDir),normalize(vec3(-.25,.06,-1.)))),40.);
c+=glow*sun*.8+low*smoothstep(.08,-.05,h)*.2;gl_FragColor=vec4(c,1.);}`;
const WATER_FS = `varying vec2 vUv;varying vec3 vWorld;uniform float uTime;void main(){
float d=clamp(-vWorld.z/220.,0.,1.);vec3 near=vec3(.16,.16,.3);vec3 far=vec3(.85,.56,.48);
vec3 c=mix(near,far,pow(d,.7));
float streak=pow(max(0.,sin(vWorld.x*.9+sin(vWorld.z*.35+uTime*.6)*1.5)),18.)*(1.-d*.6);
float sunPath=exp(-pow((vWorld.x+.25*-vWorld.z*.25)/(6.+d*30.),2.))*d;
c+=vec3(1.,.75,.55)*(streak*.18+sunPath*.35*(.6+.4*sin(vWorld.z*1.3+uTime*1.4)));
gl_FragColor=vec4(c,1.);}`;

export function createCareChip(k: SceneKit) {
  // The healthcare chip: the combat chip's outline, soft green, a white cross.
  const chip = new T.Group(); chip.name = 'care-chip';
  const body = k.ownMaterial(new T.MeshPhysicalMaterial({ color: '#2f8f5f', roughness: .3, metalness: .5, clearcoat: .7, emissive: '#0d3a22', emissiveIntensity: .5 }));
  const geo = k.ownGeometry(new T.ExtrudeGeometry(chipOutline(), { depth: .012, bevelEnabled: true, bevelThickness: .003, bevelSize: .0028, bevelSegments: 3, curveSegments: 6 }));
  geo.translate(0, 0, -.006);
  chip.add(new T.Mesh(geo, body));
  const glow = k.ownMaterial(new T.MeshBasicMaterial({ color: '#9dffc8', toneMapped: false }));
  const white = k.ownMaterial(new T.MeshBasicMaterial({ color: '#f7f4ef', toneMapped: false }));
  for (const [w, h] of [[.05, .014], [.014, .05]]) { const m = new T.Mesh(k.ownGeometry(new T.PlaneGeometry(w, h)), white); m.position.set(-.012, .03, .0095); chip.add(m); }
  const line = new T.Mesh(k.ownGeometry(new T.PlaneGeometry(.0042, .15)), glow); line.position.set(.054, .004, .0094); chip.add(line);
  const gold = k.ownMaterial(new T.MeshStandardMaterial({ color: '#d3a55c', roughness: .24, metalness: 1 }));
  for (let i = 0; i < 7; i++) { const m = new T.Mesh(k.boxGeo, gold); m.scale.set(.011, .026, .0016); m.position.set(-.054 + i * .018, -.088, .0088); chip.add(m); }
  return { chip, glow, body };
}

export function createHome() {
  const k = new SceneKit('phase6-home');
  const random = seeded(1123), rand = (a: number, b: number) => a + random() * (b - a);
  const warmStone = k.standard('#b8a690', .85, .02), lawn = k.standard('#4f6a4c', .95, 0), path = k.standard('#9b8f84', .9, .02);
  const rail = k.standard('#2f3640', .5, .6), vermilion = k.standard('#a8443a', .6, .2), city = k.standard('#5d6175', .9, .05);
  // Sky and water.
  const sky = k.mesh(k.ownGeometry(new T.SphereGeometry(400, 32, 16)), k.ownMaterial(new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: SKY_FS })), { p: [0, 0, 0] });
  sky.renderOrder = -1;
  const waterMat = k.ownMaterial(new T.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, fog: false, vertexShader: 'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}', fragmentShader: WATER_FS }));
  k.mesh(k.ownGeometry(new T.PlaneGeometry(600, 300)), waterMat, { p: [0, -1.2, -156], r: [-Math.PI / 2, 0, 0] });
  // Lawn and promenade, the sea wall and its railing.
  k.box({ p: [0, -.6, 6], s: [60, 1.2, 26] }, warmStone);
  k.box({ p: [0, .01, 4], s: [60, .03, 16] }, lawn);
  k.box({ p: [0, .02, -4.2], s: [60, .03, 3.6] }, path);
  k.box({ p: [0, -.7, -6.3], s: [60, 1.4, .6] }, warmStone);
  for (let x = -29; x <= 29; x += 2) k.box({ p: [x, .55, -6.1], s: [.06, 1.1, .06] }, rail);
  k.box({ p: [0, 1.1, -6.1], s: [60, .06, .08] }, rail);
  k.box({ p: [0, .6, -6.1], s: [60, .03, .04] }, rail);
  // Benches and lamps along the promenade, lit.
  const lamps: T.Vector3[] = [];
  for (const x of [-12, -4, 6, 14]) {
    k.box({ p: [x, 2, -4.9], s: [.1, 4, .1] }, rail);
    k.mesh(k.ownGeometry(new T.SphereGeometry(.2, 14, 10)), k.basic('#ffd29a', 1.6), { p: [x, 4.05, -4.9] });
    lamps.push(new T.Vector3(x, 3.8, -4.6));
  }
  for (const x of [-8, 10]) { k.box({ p: [x, .45, -3.4], s: [1.8, .08, .5] }, k.standard('#7a5a44', .8, 0)); k.box({ p: [x, .75, -3.62], s: [1.8, .45, .06] }, k.standard('#7a5a44', .8, 0)); for (const dx of [-.75, .75]) k.box({ p: [x + dx, .22, -3.4], s: [.06, .44, .45] }, rail); }
  // A cherry tree on the lawn, and petals in the air.
  k.box({ p: [-6.5, 1.4, 4], s: [.3, 2.8, .3], r: [0, 0, .08] }, k.standard('#4a3a32', .9, 0));
  const blossom: Pose[] = []; for (let i = 0; i < 26; i++) { const a = random() * Math.PI * 2, r = rand(.2, 1.8); blossom.push({ p: [-6.5 + Math.cos(a) * r, rand(2.6, 4.2), 4 + Math.sin(a) * r], s: [rand(.6, 1.1), rand(.5, .8), rand(.6, 1.1)] }); }
  k.instances(blossom, k.standard('#e8a8b8', .8, 0), k.sphereGeo);
  const PETALS = 70, petalPos = new Float32Array(PETALS * 3);
  for (let i = 0; i < PETALS; i++) petalPos.set([rand(-12, 6), rand(0, 5), rand(-4, 9)], i * 3);
  const petalGeo = k.ownGeometry(new T.BufferGeometry()); petalGeo.setAttribute('position', new T.BufferAttribute(petalPos, 3));
  const petals = new T.Points(petalGeo, k.ownMaterial(new T.PointsMaterial({ color: '#f3c2cd', size: .06, sizeAttenuation: true })));
  k.root.add(petals);
  // Across the water: the bridge's two red towers and its cables, the hills, the lit city.
  const bridge = new T.Group(); bridge.position.set(-20, -1.2, -110); bridge.rotation.y = .12; k.root.add(bridge);
  k.box({ p: [0, 9, 0], s: [170, .8, 4] }, k.standard('#7b6e6a', .8, .1), bridge);
  for (const x of [-38, 38]) {
    for (const side of [-1, 1]) k.box({ p: [x, 20, side * 2.2], s: [1.4, 40, 1.2] }, vermilion, bridge);
    for (const y of [24, 38]) k.box({ p: [x, y, 0], s: [1.6, 1.2, 6] }, vermilion, bridge);
    k.box({ p: [x, 40.5, 0], s: [10, .9, 7] }, vermilion, bridge);
  }
  for (const side of [-1, 1]) {
    const pts: T.Vector3[] = []; for (let i = 0; i <= 60; i++) { const x = -84 + i * 2.8; pts.push(new T.Vector3(x, 9.5 + 29 * Math.pow(Math.min(1, Math.abs(x) / 38), 2), side * 2.1)); }
    k.line(pts, '#8a4a40', .9, bridge);
  }
  for (let i = 0; i < 8; i++) { const m = k.mesh(k.sphereGeo, k.standard('#4e5466', .95, 0), { p: [-150 + i * 42, -12, -230], s: [40, 26 + random() * 14, 18] }); void m; }
  const windows: Pose[] = [];
  for (let i = 0; i < 26; i++) {
    const x = -90 + i * 7 + rand(-1, 1), h = rand(10, 34), z = -185 + rand(-8, 8), w = rand(4, 6.5);
    k.box({ p: [x, h / 2 - 1.2, z], s: [w, h, 5] }, city);
    for (let y = 2; y < h - 2; y += 2.4) for (let c = -1; c <= 1; c++) if (random() > .45) windows.push({ p: [x + c * w * .28, y - 1.2, z + 2.55], s: [.8, .9, .05] });
  }
  k.instances(windows, k.basic('#ffcf8a', 1.25));
  // A tram line pole and overhead wire running along the promenade.
  for (const x of [-20, 0, 20]) k.box({ p: [x, 3, 11], s: [.12, 6, .12] }, rail);
  k.line([new T.Vector3(-30, 5.8, 11), new T.Vector3(0, 5.5, 11), new T.Vector3(30, 5.8, 11)], '#2f3640', .9);

  // Light: low warm sun from across the water, dusk-purple sky fill, warm lamps.
  const hemi = new T.HemisphereLight('#b9a6d8', '#40353a', 1.15); k.root.add(hemi);
  const sun = new T.DirectionalLight('#ffb07a', 2.2); sun.position.set(-20, 12, -40); k.root.add(sun);
  const back = new T.DirectionalLight('#8f86c9', .7); back.position.set(10, 8, 20); k.root.add(back);
  for (const p of lamps) { const l = new T.PointLight('#ffcf8a', 3, 9, 1.8); l.position.copy(p); k.root.add(l); }
  // The gate on this side, closing behind them.
  const gateMat = k.ownMaterial(new T.MeshBasicMaterial({ color: '#b9a6ff', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const gate = k.mesh(k.ownGeometry(new T.CircleGeometry(3.1, 64)), gateMat, { p: [HOME_GATE.x, HOME_GATE.y, HOME_GATE.z] });
  const gateLight = new T.PointLight('#9a86e0', 0, 18, 1.6); gateLight.position.copy(HOME_GATE).add(new T.Vector3(0, 0, -1.5)); k.root.add(gateLight);

  const care = createCareChip(k);
  care.chip.position.copy(CARE_CHIP_AT); care.chip.rotation.set(-Math.PI / 2, 0, .6); care.chip.scale.setScalar(1);
  k.root.add(care.chip);
  const careLight = new T.PointLight('#7dffb0', 0, 2.2, 2); careLight.position.copy(CARE_CHIP_AT).add(new T.Vector3(0, .25, 0)); k.root.add(careLight);

  return {
    root: k.root, care, careLight, kit: k,
    background: new T.Color('#2a2440'),
    update(t: number, dt: number, s: { gate: number; careBlink: number }) {
      waterMat.uniforms.uTime.value = t;
      for (let i = 0; i < PETALS; i++) {
        const o = i * 3; petalPos[o] += dt * (.35 + Math.sin(t + i) * .1); petalPos[o + 1] -= dt * (.18 + (i % 5) * .03); petalPos[o + 2] += Math.sin(t * .7 + i) * dt * .1;
        if (petalPos[o + 1] < 0) { petalPos[o + 1] = 5; petalPos[o] = rand(-12, 2); }
      }
      petalGeo.attributes.position.needsUpdate = true;
      gate.visible = s.gate > .001; gateMat.opacity = s.gate * .85; gate.scale.setScalar(Math.max(.001, s.gate)); gateLight.intensity = s.gate * 20;
      // The chip's last signal: a slow green pulse.
      const pulse = s.careBlink * (.5 + .5 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 6));
      care.glow.color.set('#9dffc8').multiplyScalar(.4 + pulse * 2.2);
      careLight.intensity = pulse * 2.4;
    },
    dispose() { k.dispose(); },
  };
}
export type Home = ReturnType<typeof createHome>;

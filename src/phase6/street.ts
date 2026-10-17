import * as T from 'three';
import { SceneKit, seeded, type Pose } from '../phase2/SceneKit';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { chipOutline, CHIP_W, CHIP_H, CHIP_KEY } from '../characters/RedChip.js';

/**
 * Deeper into the same city: a service street running from the relay's yard to the old portal
 * site, a plaza where the first gate was built. The frame is dead, ringed in scaffolding, with a
 * work deck on its left; three ring segments on its face carry power from the feed at the top
 * round to the frame, and a keyed socket sits empty at its centre.
 *
 * Same look as Phases 4 and 5: slate blocks, cyan haze, warm practicals, the displaced skyline.
 */
export const EYE = 1.62;
export const FRAME = new T.Vector3(0, 3.4, -92);
export const FRAME_R = 3.3;
export const DECK = { x: -2.7, y: 2.6, z: -90.2 };
export const LANDING = new T.Vector3(-2.2, 0, -85.2);
export const ROUTE = new T.CatmullRomCurve3([
  [0, EYE, 6], [.9, EYE, -6], [-.8, EYE, -18], [-.4, EYE, -30], [1, EYE, -42], [.2, EYE, -54], [-.6, EYE, -66], [-1.2, EYE, -76],
].map(([x, y, z]) => new T.Vector3(x, y, z)), false, 'centripetal');
export const ROUTE_LENGTH = ROUTE.getLength();

/** Ring segments, outermost first: radius and where each one's two contacts sit (deg, clockwise from the top). */
export const RINGS = [
  { r: 2.95, in: 0, out: 140 },
  { r: 2.6, in: 0, out: 100 },
  { r: 2.25, in: 0, out: 80 },
];
/** The frame's own contacts: the feed at the top and the return the last segment must reach. */
export const FEED_AT = 0, RETURN_AT = 320;

/** How much of the feed reaches each junction: [feed→outer, outer→middle, middle→inner, inner→frame]. */
export function ringLive(angles: number[]) {
  const gap = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  // Made within 1.5°; otherwise the reading falls off over 60°, so it can be followed by eye.
  const couple = (d: number) => d < 1.5 ? 1 : Math.max(0, 1 - d / 60) * .8;
  const live = [0, 0, 0, 0];
  let at = FEED_AT, upstream = 1;
  RINGS.forEach((ring, i) => {
    live[i] = upstream * couple(gap(angles[i] + ring.in, at));
    upstream = live[i] >= 1 ? 1 : 0;
    at = angles[i] + ring.out;
  });
  live[3] = upstream * couple(gap(at, RETURN_AT));
  return live;
}

const PORTAL_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
// The open gate: the far side seen through it (rendered each frame into uView), held in a slow
// dusk-purple swirl that blooms out from the socket.
const PORTAL_FS = `varying vec2 vUv;uniform sampler2D uView;uniform vec2 uRes;uniform float uOpen;uniform float uTime;uniform float uFlash;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);
float edge=uOpen;if(r>edge)discard;
float swirl=sin(a*5.+r*9.-uTime*1.6)*.5+.5;float ripple=sin(r*22.-uTime*4.)*.004*(1.-r);
vec2 suv=gl_FragCoord.xy/uRes+vec2(cos(a),sin(a))*ripple;
vec3 view=texture2D(uView,suv).rgb;
vec3 dusk=vec3(.357,.294,.541);vec3 glow=vec3(.85,.78,1.);
float rim=smoothstep(edge-.32,edge,r);
float clear=smoothstep(.95,.2,r/max(edge,.001))*smoothstep(.15,.8,uOpen);
vec3 col=mix(dusk*(.7+swirl*.6),view,clear*.92);
col+=glow*rim*(.8+swirl*.5)+dusk*(1.-clear)*.4;
col=mix(col,vec3(1.,.97,1.),uFlash);
gl_FragColor=vec4(col,1.);}`;

function crackTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d')!;
  const rnd = seeded(808);
  x.strokeStyle = 'rgba(8,14,20,.95)'; x.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    let px = 256, py = 256, a = i / 14 * Math.PI * 2 + rnd() * .3, w = 7;
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 9; s++) { a += (rnd() - .5) * .7; const len = 14 + rnd() * 22; px += Math.cos(a) * len; py += Math.sin(a) * len; x.lineWidth = w; x.lineTo(px, py); w *= .78; }
    x.stroke();
  }
  // A crushed centre and a ring of broken edges.
  const grd = x.createRadialGradient(256, 256, 0, 256, 256, 90); grd.addColorStop(0, 'rgba(5,9,12,.85)'); grd.addColorStop(1, 'rgba(5,9,12,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 512, 512);
  x.lineWidth = 2.5; for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = 60 + rnd() * 40; x.beginPath(); x.arc(256, 256, r, a, a + .25 + rnd() * .3); x.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}

export function createStreet() {
  const k = new SceneKit('phase6-street');
  const random = seeded(6606), rand = (a: number, b: number) => a + random() * (b - a);
  const skyline = createPortalDimension();
  skyline.group.position.set(4, -6, -200); skyline.group.scale.setScalar(1.35);
  skyline.group.traverse(o => { o.castShadow = false; });
  k.root.add(skyline.group);

  // --- The street: lane, heaved slabs, kerbs, the same slate blocks with window rows.
  k.box({ p: [0, -.3, -34], s: [13, .6, 92] }, k.edge);
  k.box({ p: [0, .01, -34], s: [12.4, .04, 91.4] }, k.concrete);
  const marks: Pose[] = []; for (let i = 0; i < 24; i++) marks.push({ p: [.1, .04, 6 - i * 3.3], s: [.1, .02, 1.4] });
  k.instances(marks, k.metal);
  for (const [x, z, rx, rz] of [[-3.9, -10, .12, .1], [4, -24, -.12, -.15], [-4.3, -39, .1, -.08], [3.7, -52, -.15, .12], [-3.6, -63, .08, .1]]) k.box({ p: [x, .1, z], s: [3.2, .22, 3.6], r: [rx, rand(-.3, .3), rz] }, k.concrete);
  for (const side of [-1, 1]) for (let z = 4; z > -72; z -= 5.5) if (random() > .25) k.box({ p: [side * 5.9, .32, z], s: [.45, .65, rand(2.2, 4)], r: [0, 0, side * rand(0, .05)] }, k.ivory);
  const block = (x: number, z: number, w: number, h: number, d: number, side: number) => {
    const tilt = side * rand(-.05, .07);
    k.box({ p: [x, h / 2 - .05, z], s: [w, h, d], r: [0, side * rand(-.06, .06), tilt] }, random() > .5 ? k.ivory : k.concrete);
    const win: Pose[] = [];
    for (let r = 1; r < h / 1.7 - 1; r++) for (let c = 0; c < 3; c++) win.push({ p: [x - side * (w / 2 + .02), r * 1.7, z - d / 3 + c * d / 3], s: [.03, .9, 1], r: [0, 0, tilt] });
    k.instances(win, k.dim);
    if (random() > .62) k.box({ p: [x, h + rand(1.2, 3), z + rand(-1, 1)], s: [w * .9, rand(2, 4), d * .9], r: [rand(-.2, .2), rand(-.6, .6), rand(-.25, .25)] }, k.ivory);
  };
  for (const side of [-1, 1]) for (let z = 8; z > -74; z -= rand(6.5, 8.5)) { const w = rand(4, 6.5); block(side * (7.4 + w / 2 + rand(0, 1.2)), z, w, rand(8, 19), rand(5, 7), side); }
  for (let i = 0; i < 10; i++) k.box({ p: [rand(-9, 9), rand(9, 18), rand(-70, 4)], s: [rand(.6, 2.4), rand(.3, 1), rand(.6, 2)], r: [rand(0, 3), rand(0, 3), rand(0, 3)] }, k.concrete);
  // Signs toward the old gate.
  const signs: [string, number, number, string][] = [['旧ゲート跡 GATE SITE  →  400 m', -3.6, -12, '#8fe9ff'], ['立入禁止 / NO ENTRY', 3.9, -33, '#ff9a63'], ['GATE SITE  ゲート  →  90 m', -3.7, -56, '#8fe9ff']];
  for (const [text, x, z, color] of signs) {
    k.box({ p: [x, 1.6, z], s: [.12, 3.2, .12] }, k.metal);
    k.box({ p: [x - Math.sign(x) * 1.5, 3.25, z], s: [3.6, .55, .08] }, k.dark);
    k.label(text, { p: [x - Math.sign(x) * 1.5 + .25, 3.22, z + .05] }, 3.8, color);
  }
  const lamps: T.Vector3[] = [];
  for (const [x, z, live] of [[5.3, -4, true], [-5.3, -20, false], [5.3, -38, true], [-5.3, -58, true], [5.3, -70, false]] as [number, number, boolean][]) {
    k.box({ p: [x, 2.6, z], s: [.14, 5.2, .14], r: [0, 0, Math.sign(x) * .04] }, k.metal);
    k.box({ p: [x - Math.sign(x) * .6, 5.15, z], s: [1.3, .1, .1] }, k.metal);
    k.mesh(new T.SphereGeometry(.13, 12, 10), live ? k.basic('#ffc062', 1.6) : k.dark, { p: [x - Math.sign(x) * 1.2, 5.05, z] });
    if (live) lamps.push(new T.Vector3(x - Math.sign(x) * 1.2, 4.9, z));
  }

  // --- The plaza: wider paving, broken blocks around its edge, barriers across the old perimeter.
  k.box({ p: [0, -.3, -94], s: [36, .6, 34] }, k.edge);
  k.box({ p: [0, .015, -94], s: [35.4, .04, 33.4] }, k.concrete);
  const tiles: Pose[] = []; for (let x = -16; x <= 16; x += 2.2) for (let z = -79; z > -110; z -= 2.2) if (random() > .2) tiles.push({ p: [x + rand(-.05, .05), .045, z], s: [2.1, .02, 2.1], r: [0, rand(-.02, .02), 0] });
  k.instances(tiles, k.edge);
  for (const side of [-1, 1]) for (let z = -80; z > -108; z -= rand(7, 9)) { const w = rand(5, 7); block(side * (18 + w / 2), z, w, rand(10, 22), rand(6, 8), side); }
  for (let x = -14; x <= 14; x += 7) block(x + rand(-1, 1), -114 - rand(0, 3), rand(5, 7), rand(12, 24), 6, 1);
  for (const [x, z, r] of [[-9, -80, .3], [9.5, -81, -.2], [-12, -98, .1], [12, -100, -.4]]) { k.box({ p: [x, .55, z], s: [2.6, 1.1, .5], r: [0, r, 0] }, k.ivory); k.box({ p: [x, 1.15, z], s: [2.6, .1, .55], r: [0, r, 0] }, k.basic('#b18b5d', .9)); }
  k.label('PORTAL RESEARCH SITE · 旧ゲート', { p: [-9, 1.6, -79.7] }, 4, '#e8cf9c');

  // --- The frame: a heavy ring standing in a cradle, the feed cable climbing to its crown.
  const frame = new T.Group(); frame.position.copy(FRAME); k.root.add(frame);
  const frameMat = k.standard('#40525e', .55, .6);
  const frameGlow = k.ownMaterial(new T.MeshStandardMaterial({ color: '#3a4a56', roughness: .4, metalness: .6, emissive: '#5B4B8A', emissiveIntensity: 0 }));
  k.mesh(k.ownGeometry(new T.TorusGeometry(FRAME_R, .32, 20, 96)), frameGlow, { p: [0, 0, 0] }, frame);
  k.mesh(k.ownGeometry(new T.TorusGeometry(FRAME_R + .38, .09, 10, 96)), frameMat, { p: [0, 0, -.18] }, frame);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; k.box({ p: [Math.sin(a) * (FRAME_R + .05), Math.cos(a) * (FRAME_R + .05), .18], s: [.34, .5, .2], r: [0, 0, -a] }, k.dark, frame); }
  for (const side of [-1, 1]) {
    k.box({ p: [side * 2.3, -FRAME_R + .3, -.1], s: [1.6, 1, 1.6], r: [0, 0, side * .5] }, k.concrete, frame);
    k.box({ p: [side * 3.4, -FRAME_R + .6, 0], s: [.9, 1.6, 1.3] }, k.metal, frame);
  }
  // Feed: a cable from the plaza edge up the back of the ring into the top contact.
  const feedCurve = new T.CatmullRomCurve3([new T.Vector3(10, .06, -100), new T.Vector3(4, .08, -94), new T.Vector3(2.2, 2.2, -92.6), new T.Vector3(.4, FRAME.y + FRAME_R + .3, -92.5), new T.Vector3(0, FRAME.y + FRAME_R + .1, -92.1)]);
  k.mesh(k.ownGeometry(new T.TubeGeometry(feedCurve, 60, .07, 8)), k.dark, { p: [0, 0, 0] });
  const feedLamp = k.ownMaterial(new T.MeshBasicMaterial({ color: '#ffb066', toneMapped: false }));
  k.mesh(k.ownGeometry(new T.BoxGeometry(.32, .22, .16)), feedLamp, { p: [0, FRAME_R - .12, .34] }, frame);
  // Spokes from the ring to the hub, set back so the segments turn in front of them.
  const spokes: T.Mesh[] = [];
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const m = k.box({ p: [Math.sin(a) * FRAME_R / 2, Math.cos(a) * FRAME_R / 2, -.12], s: [.12, FRAME_R - .2, .1], r: [0, 0, -a] }, k.metal, frame); spokes.push(m); }
  // The socket: a hub whose keyed slot repeats the chip's outline. It stays dark until filled.
  const hub = new T.Group(); hub.position.z = .05; frame.add(hub);
  k.mesh(k.ownGeometry(new T.CylinderGeometry(.42, .46, .3, 32)), k.dark, { p: [0, 0, 0], r: [Math.PI / 2, 0, 0] }, hub);
  const slotShape = chipOutline(CHIP_W * 1.9 + .04, CHIP_H * 1.9 + .04, CHIP_KEY * 1.9 + .02, .03);
  k.mesh(k.ownGeometry(new T.ShapeGeometry(slotShape)), k.ownMaterial(new T.MeshBasicMaterial({ color: '#05080b' })), { p: [0, 0, .152] }, hub);
  const socketRim = k.ownMaterial(new T.MeshBasicMaterial({ color: '#1a2026', toneMapped: false }));
  const rimGeo = k.ownGeometry(new T.TorusGeometry(.4, .02, 8, 48));
  k.mesh(rimGeo, socketRim, { p: [0, 0, .155] }, hub);

  // Ring segments: each a near-full ring with a break, carrying an in and an out contact.
  const segments = RINGS.map((ring, i) => {
    const g = new T.Group(); g.position.z = .34 + i * .05; frame.add(g);
    // The break sits on the unused side, between the out contact and the in contact.
    const gap = ring.out + (360 - ring.out) / 2;
    k.mesh(k.ownGeometry(new T.TorusGeometry(ring.r, .07, 10, 96, Math.PI * 2 - .35)), frameMat, { p: [0, 0, 0], r: [0, 0, (100 - gap) * Math.PI / 180] }, g);
    const contactMats = [0, 1].map(() => k.ownMaterial(new T.MeshBasicMaterial({ color: '#7a4a24', toneMapped: false })));
    [ring.in, ring.out].forEach((deg, j) => {
      const a = deg * Math.PI / 180;
      k.box({ p: [Math.sin(a) * ring.r, Math.cos(a) * ring.r, .03], s: [.2, .16, .14], r: [0, 0, -a] }, contactMats[j], g);
    });
    return { g, contactMats };
  });
  const feedLight = new T.PointLight('#ffb066', 0, 5, 2); feedLight.position.set(0, FRAME_R, .8); frame.add(feedLight);

  // Scaffolding: a full tower behind the ring, and in front only the bay that carries the work
  // deck on the left, so the opening itself stays clear. A ladder runs up the deck's inner end.
  const scaff = k.standard('#7d8b92', .5, .55), plank = k.standard('#6a5848', .85, .05);
  const BACK = -94.6, FRONT = -89.4, DL = -5.2, DR = -1.1;
  for (const x of [-5.4, -3.6, -1.6, 1.6, 3.6, 5.4]) k.box({ p: [x, 4.3, BACK], s: [.07, 8.6, .07] }, scaff);
  for (const y of [1.2, 2.6, 4.6, 6.6, 8.2]) k.box({ p: [0, y, BACK], s: [11, .06, .06] }, scaff);
  for (const [x, y] of [[-4.5, 3.6], [-2.6, 5.6], [2.6, 3.6], [4.5, 5.6]]) k.box({ p: [x, y, BACK], s: [2.2, .05, .05], r: [0, 0, x < 0 ? .78 : -.78] }, scaff);
  for (const x of [-5.4, 5.4]) { k.box({ p: [x, 4.3, -92], s: [.07, 8.6, .07] }, scaff); for (const y of [2.6, 6.6]) k.box({ p: [x, y, -92], s: [.06, .06, 5.2] }, scaff); }
  for (const x of [DL, DR]) k.box({ p: [x, (DECK.y + 1) / 2, FRONT], s: [.07, DECK.y + 1, .07] }, scaff);
  for (const y of [1.2, DECK.y - .05]) k.box({ p: [(DL + DR) / 2, y, FRONT], s: [DR - DL, .06, .06] }, scaff);
  k.box({ p: [(DL + DR) / 2, DECK.y + .95, FRONT], s: [DR - DL, .05, .05] }, scaff);
  for (const x of [DL, DR]) k.box({ p: [x, DECK.y / 2, -91.3], s: [.07, DECK.y, .07] }, scaff);
  k.box({ p: [DECK.x, DECK.y - .05, -90.3], s: [3.9, .1, 1.9] }, plank);
  k.box({ p: [3.6, 6.55, -93.4], s: [3.4, .1, 1.6] }, plank);
  for (let y = .3; y < DECK.y; y += .35) k.box({ p: [DR + .25, y, FRONT + .05], s: [.5, .04, .04] }, scaff);
  for (const x of [DR, DR + .5]) k.box({ p: [x, DECK.y / 2, FRONT + .05], s: [.05, DECK.y + .9, .05] }, scaff);
  // Work lights clamped to the scaffold.
  const worklight = k.basic('#ffd9a1', 1.4);
  for (const [x, y, z] of [[-5.3, 4.8, -91.9], [5.3, 6.9, -91.9]]) k.mesh(k.ownGeometry(new T.BoxGeometry(.3, .2, .16)), worklight, { p: [x, y, z] });

  // --- The fall: cracked paving and lifted tiles, dust thrown out from the impact.
  const crackMat = k.ownMaterial(new T.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  k.mesh(k.ownGeometry(new T.PlaneGeometry(5.2, 5.2)), crackMat, { p: [LANDING.x, .07, LANDING.z], r: [-Math.PI / 2, 0, .4] });
  const heaved: T.Mesh[] = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3, r = 1.9 + random() * .5; const m = k.box({ p: [LANDING.x + Math.cos(a) * r, .04, LANDING.z + Math.sin(a) * r], s: [.9, .1, .7], r: [0, a, 0] }, k.concrete); m.visible = false; heaved.push(m); }
  const DUST = 220;
  const dustPos = new Float32Array(DUST * 3), dustVel = new Float32Array(DUST * 3);
  const dustGeo = k.ownGeometry(new T.BufferGeometry()); dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
  const dotTex = dotTexture();
  const dustMat = k.ownMaterial(new T.PointsMaterial({ color: '#9fb6c4', size: .55, map: dotTex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
  const dust = new T.Points(dustGeo, dustMat); dust.frustumCulled = false; k.root.add(dust);
  let dustAge = 99, dustLift = 0;
  const kickDust = (at: T.Vector3, strength: number, lift = 0) => {
    dustAge = 0; dustLift = lift;
    for (let i = 0; i < DUST; i++) {
      const a = random() * Math.PI * 2, s = (.6 + random() * 1.6) * strength;
      dustPos.set([at.x + Math.cos(a) * .4, .1 + random() * .3, at.z + Math.sin(a) * .4], i * 3);
      dustVel.set([Math.cos(a) * s * 2.2, (.4 + random() * 1.2) * strength, Math.sin(a) * s * 2.2], i * 3);
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  // --- The open gate.
  const portalMat = k.ownMaterial(new T.ShaderMaterial({ vertexShader: PORTAL_VS, fragmentShader: PORTAL_FS, uniforms: { uView: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uOpen: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } }, side: T.DoubleSide }));
  const portal = k.mesh(k.ownGeometry(new T.CircleGeometry(FRAME_R - .2, 96)), portalMat, { p: [0, 0, .02] }, frame);
  portal.visible = false;
  const portalLight = new T.PointLight('#9a86e0', 0, 26, 1.6); portalLight.position.set(0, 0, 2.5); frame.add(portalLight);

  const purple = new T.Color('#5B4B8A'), copper = new T.Color('#7a4a24'), hot = new T.Color('#ffc58a');
  return {
    root: k.root, lamps, portalMat, frame, hub,
    /** Socket centre in world space. */
    socketWorld: (out = new T.Vector3()) => hub.getWorldPosition(out).add(new T.Vector3(0, 0, .16)),
    kickDust,
    update(t: number, dt: number, s: { angles: number[]; live: number[]; powered: number; open: number; flash: number; cracked: number; socket: number }) {
      skyline.update(t, dt, false, 0, 'approaching');
      // Segments turn with their angle; contacts go from cold copper to live as current reaches them.
      segments.forEach((seg, i) => {
        seg.g.rotation.z = -s.angles[i] * Math.PI / 180;
        seg.contactMats.forEach((m, j) => {
          const k2 = s.live[i] >= 1 ? (j === 0 || s.live[i + 1] >= 1 ? 1 : .55 + .45 * Math.sin(t * 5)) : j === 0 ? s.live[i] : 0;
          m.color.copy(copper).lerp(hot, Math.min(1, k2)).multiplyScalar(1 + k2 * (1.2 + .3 * Math.sin(t * 30 + i)));
        });
      });
      feedLamp.color.set('#ffb066').multiplyScalar(1.2 + .3 * Math.sin(t * 2));
      feedLight.intensity = 1.5 + s.live[0] * 2;
      // Powered: the ring hums dusk purple. The socket only lights once the chip is in it.
      frameGlow.emissiveIntensity = s.powered * (.55 + .2 * Math.sin(t * 3.1)) + s.open * .8;
      socketRim.color.copy(purple).multiplyScalar(s.socket * (1.6 + .5 * Math.sin(t * 5))).addScalar(s.socket ? 0 : .1);
      if (!s.socket) socketRim.color.set('#1a2026');
      spokes.forEach((m, i) => { m.scale.y = 1 - s.open * .98; m.position.setLength((FRAME_R / 2) * (1 + s.open * .9)); m.visible = s.open < .97; void i; });
      portal.visible = s.open > .001;
      portalMat.uniforms.uOpen.value = s.open; portalMat.uniforms.uTime.value = t; portalMat.uniforms.uFlash.value = s.flash;
      portalLight.intensity = s.open * 26 + s.flash * 30;
      crackMat.opacity = s.cracked;
      heaved.forEach((m, i) => { m.visible = s.cracked > .05; m.rotation.x = s.cracked * (.18 + (i % 3) * .07); m.position.y = .04 + s.cracked * .06; });
      // Dust: drifts out, slows, settles and fades.
      if (dustAge < 9) {
        dustAge += dt;
        for (let i = 0; i < DUST; i++) {
          const o = i * 3, drag = Math.exp(-dt * 1.6);
          dustVel[o] *= drag; dustVel[o + 2] *= drag; dustVel[o + 1] = dustVel[o + 1] * drag - dt * (.3 - dustLift * .5);
          dustPos[o] += dustVel[o] * dt; dustPos[o + 1] = Math.max(.05, dustPos[o + 1] + dustVel[o + 1] * dt); dustPos[o + 2] += dustVel[o + 2] * dt;
        }
        dustGeo.attributes.position.needsUpdate = true;
        dustMat.opacity = Math.min(1, dustAge * 6) * Math.max(0, 1 - dustAge / 9) * .55;
        dustMat.size = .5 + dustAge * .35;
      } else dustMat.opacity = 0;
    },
    dispose() { skyline.dispose(); dotTex.dispose(); (crackMat.map as T.Texture).dispose(); k.dispose(); },
  };
}
export type Street = ReturnType<typeof createStreet>;

import * as T from 'three';
import gsap from 'gsap';
import { edgeWear, grain, grime, paint, scratches, seeded, wornPaint } from '../phase4/canvasTex';

/**
 * Hiro's own controller for the PR-6: a handheld remote he built to pair with the regulator in
 * Baymax's back. Same family as the PR-6 itself (worn grey paint chipped to bare metal, gunmetal
 * end caps with bolts, a small analogue OUTPUT gauge, a red/black chevron panel) with one guarded
 * toggle: flip the red cover up, push the bat forward and the limit is on.
 *
 * Built in metres, about 15 cm long: long axis on Z (the tip, with its stub aerial, toward -Z),
 * face up (+Y), origin at the middle of the grip.
 *
 * createFirstPersonHands() is the pair of hands that hold it, for a camera at Hiro's eye.
 */
export type LimiterController = {
  root: T.Object3D;
  /** Snap to on (limit on: guard up, bat forward, needle at 35 %, lamp lit) or off. */
  setOn(on: boolean): void;
  isOn(): boolean;
  /** The animated parts, 0..1. press() drives these; set them directly for a custom move. */
  state: { guard: number; toggle: number; lamp: number; gauge: number };
  /** Lamp pulse and needle jitter. Optional: setOn/press already pose everything. */
  update(t: number): void;
  /** World position of the guard's lip and of the toggle bat (where a thumb or finger goes). */
  guardWorld(out?: T.Vector3): T.Vector3;
  toggleWorld(out?: T.Vector3): T.Vector3;
  dispose(): void;
};

/** Output when limited, as the dial reads it. */
const LIMIT = .35;

function gaugeFace() {
  return paint(256, 256, (x, w) => {
    const c = w / 2, r = seeded(14);
    x.fillStyle = '#e6dfcb'; x.fillRect(0, 0, w, w);
    grain(x, w, w, r, 1800, .08); grime(x, w, w, r, 3, '60,48,30', .16);
    x.translate(c, c);
    x.strokeStyle = '#b3201c'; x.lineWidth = 14; x.beginPath(); x.arc(0, 0, 96, -Math.PI / 2 + .62, -Math.PI / 2 + 2.36); x.stroke();
    x.strokeStyle = '#1b1a18'; x.fillStyle = '#1b1a18'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i <= 20; i++) {
      const a = (-135 + i * 13.5) * Math.PI / 180, major = i % 5 === 0, r1 = major ? 80 : 90;
      x.lineWidth = major ? 4.5 : 2; x.beginPath(); x.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1); x.lineTo(Math.sin(a) * 104, -Math.cos(a) * 104); x.stroke();
    }
    x.font = '700 22px "IBM Plex Mono", monospace'; x.fillText('OUT', 0, 44);
    x.font = '600 26px "Space Grotesk", Arial, sans-serif'; x.fillText('0', -62, 58); x.fillText('10', 64, 58);
    x.beginPath(); x.arc(0, 0, 120, 0, Math.PI * 2); x.lineWidth = 12; x.strokeStyle = '#2a2826'; x.stroke();
  });
}
function chevrons() {
  return paint(256, 128, (x, w, h) => {
    const r = seeded(31);
    x.fillStyle = '#141414'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c4231c';
    for (let i = 0; i < 4; i++) { const x0 = 18 + i * 60; x.beginPath(); x.moveTo(x0, 16); x.lineTo(x0 + 36, 64); x.lineTo(x0, 112); x.lineTo(x0 + 22, 112); x.lineTo(x0 + 58, 64); x.lineTo(x0 + 22, 16); x.closePath(); x.fill(); }
    grain(x, w, h, r, 2000, .22); scratches(x, w, h, r, 14, '220,210,200', .5); edgeWear(x, w, h, r, '#8d8a84', 8, .8);
  });
}
function label() {
  return paint(256, 64, (x, w, h) => {
    const r = seeded(9);
    x.fillStyle = '#d9d2bf'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#26241f'; x.fillRect(0, 0, 70, h);
    x.fillStyle = '#d9d2bf'; x.font = '700 30px "Space Grotesk", Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('PR-6', 6, 33);
    x.fillStyle = '#26241f'; x.font = '600 21px "IBM Plex Mono", monospace'; x.fillText('LINK · LIMIT', 82, 22); x.fillText('HH-01  ·  H.H.', 82, 46);
    grain(x, w, h, r, 1500, .12); scratches(x, w, h, r, 10, '120,110,90', .5);
  });
}

export function createLimiterController(): LimiterController {
  const geos = new Set<T.BufferGeometry>(), mats = new Set<T.Material>(), texes = new Set<T.Texture>();
  const g = <G extends T.BufferGeometry>(x: G) => (geos.add(x), x);
  const tex = (t: T.Texture) => (texes.add(t), t);
  const std = (o: T.MeshStandardMaterialParameters) => { const m = new T.MeshStandardMaterial(o); mats.add(m); return m; };
  const root = new T.Group(); root.name = 'limiter-controller';
  const add = (geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, parent: T.Object3D = root, rx = 0, ry = 0, rz = 0) => {
    const mesh = new T.Mesh(g(geo), m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); parent.add(mesh); return mesh;
  };

  const paintTex = tex(wornPaint('#a59f92', 61, { rustSpots: 6, scratchCount: 70, size: 256 }));
  const darkTex = tex(wornPaint('#3b3a38', 62, { metal: '#a9a8a2', rustSpots: 2, scratchCount: 50, size: 256 }));
  const plateTex = tex(paint(128, 128, (x, w, h) => { const r = seeded(63); x.fillStyle = '#202224'; x.fillRect(0, 0, w, h); grain(x, w, h, r, 1500, .14); scratches(x, w, h, r, 20, '180,180,175', .35); edgeWear(x, w, h, r, '#7d7f80', 6, .7); }));
  const housing = std({ map: paintTex, bumpMap: paintTex, bumpScale: .4, roughness: .6, metalness: .35 });
  const gunmetal = std({ map: darkTex, bumpMap: darkTex, bumpScale: .4, roughness: .5, metalness: .6 });
  const plate = std({ map: plateTex, roughness: .48, metalness: .45 });
  const steel = std({ color: '#b3b6b6', roughness: .3, metalness: .92 });
  const darkSteel = std({ color: '#3d4144', roughness: .42, metalness: .85 });
  const rubber = std({ color: '#161718', roughness: .85, metalness: 0 });
  const red = std({ color: '#b51d18', roughness: .38, metalness: .25 });
  const face = std({ map: tex(gaugeFace()), roughness: .55 });
  const chev = std({ map: tex(chevrons()), roughness: .5, metalness: .2 });
  const sticker = std({ map: tex(label()), roughness: .6, metalness: .05 });
  const glass = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .05, metalness: .1, transparent: true, opacity: .16, depthWrite: false }); mats.add(glass);
  const lampMat = new T.MeshBasicMaterial({ color: '#2a2f2a', toneMapped: false }); mats.add(lampMat);
  const lensMat = new T.MeshBasicMaterial({ color: '#4a1210', toneMapped: false }); mats.add(lensMat);

  // Body: a rounded slab, chamfered paint worn through on the long top edges.
  const W = .062, L = .15, H = .026;
  const slab = (w: number, l: number, r: number, h: number) => {
    const s = new T.Shape(), x = -w / 2, y = -l / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r); s.quadraticCurveTo(x + w, y + l, x + w - r, y + l);
    s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const geo = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 2, curveSegments: 5 });
    geo.rotateX(Math.PI / 2); geo.translate(0, h / 2, 0); return geo;
  };
  add(slab(W, L, .01, H), housing, 0, 0, 0);
  for (const s of [-1, 1]) add(new T.BoxGeometry(.003, .004, L - .03), steel, s * (W / 2 - .001), H / 2 + .0005, 0, root, 0, 0, s * .8);
  // Rubber grips down both sides.
  for (const s of [-1, 1]) add(new T.BoxGeometry(.005, H * .5, .08), rubber, s * (W / 2 + .0012), -.004, .022);
  // End caps, bolted. The tip carries a stub aerial and the link lens; the tail a lanyard loop.
  add(new T.BoxGeometry(W + .004, H + .004, .016), gunmetal, 0, 0, -L / 2 - .004);
  add(new T.BoxGeometry(W + .004, H + .004, .014), gunmetal, 0, 0, L / 2 + .003);
  for (const z of [-L / 2 - .004, L / 2 + .003]) for (const x of [-.022, .022]) add(new T.CylinderGeometry(.0028, .0028, .002, 6), steel, x, H / 2 + .003, z);
  add(new T.CylinderGeometry(.0042, .005, .028, 10), rubber, .021, H / 2 + .012, -L / 2 - .002);
  add(new T.SphereGeometry(.0052, 10, 8), rubber, .021, H / 2 + .027, -L / 2 - .002);
  add(new T.SphereGeometry(.0065, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lensMat, -.012, 0, -L / 2 - .012, root, -Math.PI / 2);
  add(new T.TorusGeometry(.007, .0018, 6, 16), steel, 0, 0, L / 2 + .014, root, Math.PI / 2);

  // Face plate.
  const top = H / 2 + .001;
  add(slab(.04, .084, .006, .0016), plate, 0, top, -.016);
  // Gauge: steel bezel, face, needle, glass.
  const gauge = new T.Group(); gauge.position.set(.003, top + .001, -.042); root.add(gauge);
  add(new T.CylinderGeometry(.0195, .0205, .005, 28), darkSteel, 0, .002, 0, gauge);
  add(new T.TorusGeometry(.0178, .0022, 8, 28), steel, 0, .0048, 0, gauge, Math.PI / 2);
  add(new T.CircleGeometry(.0172, 28), face, 0, .0047, 0, gauge, -Math.PI / 2);
  add(new T.CircleGeometry(.0172, 28), glass, 0, .0058, 0, gauge, -Math.PI / 2);
  const needle = new T.Group(); needle.position.y = .0052; gauge.add(needle);
  add(new T.BoxGeometry(.0013, .0006, .0145), red, 0, 0, -.006, needle);
  add(new T.CylinderGeometry(.0018, .0018, .0012, 10), darkSteel, 0, .0004, 0, needle);
  // Chevron panel near the tail, the sticker beside it.
  add(new T.PlaneGeometry(.026, .02), chev, .0, top + .0014, .042, root, -Math.PI / 2, 0, Math.PI / 2);
  add(new T.PlaneGeometry(.048, .012), sticker, 0, top + .0014, .0635, root, -Math.PI / 2);

  // The guarded toggle, toward the tip: a steel collar and bat on a pivot, the red cover hinged
  // on its tip-side edge so a thumb from the grip can get under its lip and flick it up.
  const sw = new T.Group(); sw.position.set(.002, top, .008); root.add(sw);
  add(new T.BoxGeometry(.026, .004, .03), darkSteel, 0, .002, 0, sw);
  add(new T.CylinderGeometry(.0055, .0055, .005, 16), steel, 0, .0055, 0, sw);
  const bat = new T.Group(); bat.position.y = .007; sw.add(bat);
  add(new T.CylinderGeometry(.0022, .0032, .017, 10), steel, 0, .0085, 0, bat);
  add(new T.SphereGeometry(.0034, 10, 8), steel, 0, .017, 0, bat);
  const guard = new T.Group(); guard.position.set(0, .004, -.016); sw.add(guard);
  add(new T.CylinderGeometry(.0024, .0024, .03, 10), steel, 0, 0, 0, guard, 0, 0, Math.PI / 2);
  // The cover: an open-bottomed box (top and two sides) so it reads as a hollow cap over the bat.
  add(new T.BoxGeometry(.026, .0022, .031), red, 0, .022, .0155, guard);
  for (const s of [-1, 1]) add(new T.BoxGeometry(.0022, .021, .031), red, s * .012, .0115, .0155, guard);
  add(new T.BoxGeometry(.026, .021, .0022), red, 0, .0115, .03, guard);
  const lip = add(new T.BoxGeometry(.014, .003, .005), red, 0, .007, .033, guard);
  // Two white stripes on the cover.
  const stripe = std({ color: '#ece7dc', roughness: .5 });
  for (const x of [-.006, .006]) add(new T.BoxGeometry(.0025, .0005, .028), stripe, x, .0233, .0155, guard);
  // Status lamp beside the switch.
  add(new T.CylinderGeometry(.0042, .0042, .003, 14), darkSteel, .021, top + .0015, -.012);
  add(new T.SphereGeometry(.0032, 12, 8), lampMat, .021, top + .003, -.012);
  root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });

  const state = { guard: 0, toggle: 0, lamp: 0, gauge: 1 };
  let jitter = 0;
  const apply = () => {
    guard.rotation.x = -state.guard * 1.95;
    bat.rotation.x = T.MathUtils.lerp(.5, -.5, state.toggle);
    needle.rotation.y = -(-135 + T.MathUtils.clamp(state.gauge + jitter, 0, 1) * 270) * Math.PI / 180;
  };
  const ctl: LimiterController = {
    root, state,
    setOn(on) { gsap.killTweensOf(state); Object.assign(state, on ? { guard: 1, toggle: 1, lamp: 1, gauge: LIMIT } : { guard: 0, toggle: 0, lamp: 0, gauge: 1 }); apply(); },
    isOn: () => state.toggle > .5,
    update(t) {
      jitter = Math.sin(t * 23) * Math.sin(t * 7.1) * .012 * (state.toggle > .5 ? .5 : 1);
      apply();
      lampMat.color.set(state.lamp > .5 ? '#ffb347' : '#2a2f2a').multiplyScalar(state.lamp > .5 ? 1.5 + .35 * Math.sin(t * 5) : 1);
    },
    guardWorld: (out = new T.Vector3()) => lip.getWorldPosition(out),
    toggleWorld: (out = new T.Vector3()) => bat.localToWorld(out.set(0, .017, 0)),
    dispose() { gsap.killTweensOf(state); root.removeFromParent(); geos.forEach(x => x.dispose()); mats.forEach(m => m.dispose()); texes.forEach(t => t.dispose()); },
  };
  ctl.setOn(false);
  return ctl;
}

// ─────────────────────────────────────────────────────────────── first-person hands

export type FirstPersonHands = {
  /** Parent it to the camera (the camera must be in the scene). Camera at Hiro's eye, -Z forward. */
  root: T.Object3D;
  /** Held in the left hand. */
  controller: LimiterController;
  /**
   * Every frame. walk 0..1 = speed (0 stand, 1 sprint); gait = step phase in radians (one footfall
   * per PI); raise 0..1 = controller lifted into view; reach 0..1 = right hand forward (pull a chip,
   * slot a cartridge, grip Baymax's hand).
   */
  update(t: number, dt: number, s: { walk: number; gait: number; raise: number; reach: number }): void;
  /**
   * The thumb works the guarded switch and toggles the controller: if it is off, flick the cover up
   * and push the bat forward; if it is on, pull the bat back and knock the cover shut. onClick fires
   * the moment the bat lands, onDone once the hand has settled. rate scales the speed. Returns the
   * timeline (pause or seek it for a still).
   */
  press(onClick: () => void, onDone: () => void, rate?: number): gsap.core.Timeline;
  dispose(): void;
};

/**
 * Left-thumb poses (base pitch, base yaw, bend), solved against the controller as it sits in the
 * hand: resting along the edge, tucked under the guard's lip, the flick, on the bat (off / on).
 */
const THUMB = {
  rest: { tx: -.4, ty: 1.6, tb: 1.05 }, under: { tx: -.5, ty: 1.7, tb: .3 }, lip: { tx: -1.8, ty: 1.3, tb: 0 },
  flick: { tx: -1.7, ty: 1.1, tb: 0 }, tog: { tx: -1.3, ty: 1.2, tb: 0 }, togOn: { tx: -.9, ty: 1.1, tb: 0 },
};

type Hand = { root: T.Group; fingers: T.Group[][]; thumb: T.Group[]; palm: T.Group };

/**
 * One hand in its own frame: wrist at the origin, fingers along -Z, palm facing -Y, back of the
 * hand +Y; the thumb on +X for a left hand, -X for a right. The hoodie sleeve runs back along +Z.
 */
function buildHand(side: -1 | 1, own: { g: <G extends T.BufferGeometry>(x: G) => G; skin: T.Material; skinDark: T.Material; nail: T.Material; sleeve: T.Material; cuff: T.Material }): Hand {
  const { g, skin, skinDark, nail, sleeve, cuff } = own;
  const root = new T.Group();
  const sphere = g(new T.SphereGeometry(1, 20, 14));
  const seg = (len: number, r0: number, r1: number) => {
    const pts: T.Vector2[] = [];
    for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; pts.push(new T.Vector2(Math.cos(a) * r1, -len + Math.sin(a) * r1)); }
    for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI / 2; pts.push(new T.Vector2(Math.max(.0001, Math.cos(a) * r0), Math.sin(a) * r0)); }
    const geo = g(new T.LatheGeometry(pts, 12)); geo.rotateX(-Math.PI / 2); return geo; // along -Z
  };
  // Sleeve and ribbed cuff behind the wrist.
  const sl = new T.Mesh(g(new T.CylinderGeometry(.046, .052, .32, 18)), sleeve); sl.rotation.x = Math.PI / 2; sl.position.z = .2; root.add(sl);
  const cf = new T.Mesh(g(new T.CylinderGeometry(.042, .045, .05, 18)), cuff); cf.rotation.x = Math.PI / 2; cf.position.z = .035; root.add(cf);
  // Wrist and palm.
  const palm = new T.Group(); root.add(palm);
  const wrist = new T.Mesh(g(new T.CylinderGeometry(.026, .03, .05, 16)), skin); wrist.rotation.x = Math.PI / 2; wrist.position.z = .01; palm.add(wrist);
  const p = new T.Mesh(sphere, skin); p.scale.set(.041, .016, .047); p.position.set(0, 0, -.042); palm.add(p);
  // Thenar pad at the thumb's root, a little knuckle ridge.
  const pad = new T.Mesh(sphere, skin); pad.scale.set(.018, .014, .026); pad.position.set(side * .026, -.004, -.026); palm.add(pad);
  // Fingers: index, middle, ring, little; three segments each with a nail on the last.
  const fingers: T.Group[][] = [];
  const specs: [number, number, number[]][] = [[.026, .0088, [.03, .021, .018]], [.009, .0092, [.033, .024, .019]], [-.009, .0087, [.031, .022, .018]], [-.026, .0076, [.024, .017, .015]]];
  for (const [x0, r, lens] of specs) {
    const joints: T.Group[] = [];
    let parent: T.Object3D = palm, z = -.078 + Math.abs(x0) * .5;
    lens.forEach((len, i) => {
      const j = new T.Group(); j.position.set(i === 0 ? side * x0 : 0, i === 0 ? .002 : 0, z); parent.add(j);
      const rr = r * (1 - i * .09);
      j.add(new T.Mesh(seg(len, rr, rr * .93), skin));
      if (i === 0) { const k = new T.Mesh(sphere, skinDark); k.scale.setScalar(r * 1.02); k.position.y = r * .35; j.add(k); }
      if (i === 2) { const n = new T.Mesh(sphere, nail); n.scale.set(rr * .75, rr * .3, rr * .9); n.position.set(0, rr * .72, -len * .62); j.add(n); }
      joints.push(j); parent = j; z = -len;
    });
    fingers.push(joints);
  }
  // Thumb: from the heel of the palm, angled out and forward.
  const thumbBase = new T.Group(); thumbBase.position.set(side * .034, -.006, -.016); thumbBase.rotation.set(0, side * -.7, side * .5); palm.add(thumbBase);
  const thumb: T.Group[] = [];
  { let parent: T.Object3D = thumbBase, z = 0; [.031, .025, .021].forEach((len, i) => { const j = new T.Group(); j.position.z = z; parent.add(j); j.add(new T.Mesh(seg(len, .0115 - i * .0008, .0105 - i * .0008), skin)); if (i === 2) { const n = new T.Mesh(sphere, nail); n.scale.set(.0072, .003, .009); n.position.set(0, .0075, -len * .6); j.add(n); } thumb.push(j); parent = j; z = -len; }); }
  return { root, fingers, thumb, palm };
}

export function createFirstPersonHands(controller: LimiterController = createLimiterController()): FirstPersonHands {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const g = <G extends T.BufferGeometry>(x: G) => { geos.push(x); return x; };
  const std = (o: T.MeshStandardMaterialParameters) => { const m = new T.MeshStandardMaterial(o); mats.push(m); return m; };
  const own = {
    g, skin: std({ color: '#e3b28e', roughness: .6 }), skinDark: std({ color: '#d6a07c', roughness: .65 }), nail: std({ color: '#efcdb6', roughness: .35 }),
    sleeve: std({ color: '#56677d', roughness: .93 }), cuff: std({ color: '#4b5b70', roughness: .97 }),
  };
  const root = new T.Group(); root.name = 'first-person-hands';
  // A soft key so the hands read whatever the set's lighting (it only reaches a metre).
  const key = new T.PointLight('#fff1e2', .9, 1.2, 2); key.position.set(.15, .25, .1); root.add(key);

  const left = buildHand(1, own), right = buildHand(-1, own);
  // Each hand hangs from a mount that does the big moves (raise, reach, sway).
  const leftMount = new T.Group(), rightMount = new T.Group(); root.add(leftMount, rightMount);
  // Left: the controller sits in the mount, face tilted up toward the eye; the hand is placed
  // round it (palm under, fingers wrapping the right edge, thumb along the left of the face).
  const held = new T.Group(); leftMount.add(held);
  held.add(controller.root); controller.root.position.set(0, 0, 0); controller.root.rotation.set(0, 0, 0);
  held.add(left.root);
  left.root.position.set(-.05, -.03, .045); left.root.rotation.set(0, -.72, Math.PI - .25, 'YXZ');
  rightMount.add(right.root);
  // Right: palm down, a little turned in; it opens as it reaches.
  right.root.rotation.set(-.2, -.25, -.15);
  root.traverse(o => { o.frustumCulled = false; if (o instanceof T.Mesh) o.renderOrder = 2; });

  // Animated values; press() tweens these.
  const s = { ...THUMB.rest, tilt: 0, nudge: 0 };
  const sm = { walk: 0, raise: 0, reach: 0 };
  const hold = { curl: [.85, .9, .95, 1] };
  let timeline: gsap.core.Timeline | null = null;

  const curl = (h: Hand, amount: number[], spread = 0) => h.fingers.forEach((f, i) => {
    const c = amount[i] ?? amount[0];
    f[0].rotation.set(-c * 1.15, (i - 1.5) * spread * .08, 0); f[1].rotation.x = -c * 1.4; f[2].rotation.x = -c * 1.0;
  });

  const hands: FirstPersonHands = {
    root, controller,
    update(t, dt, inp) {
      const k = 1 - Math.exp(-dt * 10);
      sm.walk += (inp.walk - sm.walk) * k; sm.raise += (inp.raise - sm.raise) * (1 - Math.exp(-dt * 6)); sm.reach += (inp.reach - sm.reach) * (1 - Math.exp(-dt * 7));
      const w = sm.walk, ph = inp.gait;
      const breathe = Math.sin(t * 1.6) * .004 * (1 - w);
      // Walk: a dip on each footfall, a sway side to side, and a pump with the run.
      const bob = -Math.abs(Math.cos(ph)) * .016 * w, sway = Math.sin(ph) * .014 * w, pump = Math.sin(ph) * .05 * w * w;
      // Left hand + controller: lowered out of shot ↔ raised in front, a little left of centre.
      const r = sm.raise;
      leftMount.position.set(T.MathUtils.lerp(-.2, -.085, r) + sway, T.MathUtils.lerp(-.5, -.105, r) + bob + breathe, T.MathUtils.lerp(-.25, -.36, r) + pump);
      leftMount.rotation.set(T.MathUtils.lerp(-.9, .8, r) + s.tilt + Math.sin(ph) * .05 * w, T.MathUtils.lerp(.4, .15, r), .12 + Math.sin(ph) * .06 * w + s.nudge);
      // Right hand: out of shot ↔ forward and down, open.
      const q = sm.reach;
      rightMount.position.set(T.MathUtils.lerp(.24, .085, q) - sway * .8, T.MathUtils.lerp(-.5, -.12, q) + bob + breathe, T.MathUtils.lerp(-.22, -.5, q) - pump);
      rightMount.rotation.set(T.MathUtils.lerp(-.8, .05, q) - Math.sin(ph) * .05 * w, T.MathUtils.lerp(-.3, -.05, q), -Math.sin(ph) * .06 * w);
      rightMount.visible = q > .01 || w > .3; leftMount.visible = r > .01 || w > .3;
      // Fingers: left wrapped round the controller; right relaxed, opening as it reaches.
      curl(left, hold.curl);
      curl(right, [.55 - q * .4, .62 - q * .42, .7 - q * .44, .78 - q * .45], q);
      right.thumb[0].rotation.set(-.2 + q * .1, -.2 - q * .2, 0); right.thumb[1].rotation.x = -.3; right.thumb[2].rotation.x = -.25;
      // Left thumb: resting along the controller's edge, or working the switch.
      left.thumb[0].rotation.set(s.tx, s.ty, 0);
      left.thumb[1].rotation.x = -s.tb * .8; left.thumb[2].rotation.x = -s.tb * .7;
      controller.update(t);
    },
    press(onClick, onDone, rate = 1) {
      timeline?.kill();
      const c = controller.state, on = controller.isOn();
      const tl = gsap.timeline({ onComplete: onDone, defaults: { lazy: false } }); timeline = tl;
      const to = (k: keyof typeof THUMB, duration: number, ease = 'power2.inOut', extra: Record<string, number> = {}) => ({ ...THUMB[k], ...extra, duration, ease });
      if (!on) {
        // Thumb slides up under the lip, flicks the cover open past its stop, then pushes the bat.
        tl.to(s, to('under', .3, 'power2.out', { tilt: .05 }))
          .to(s, to('lip', .12, 'power2.in'))
          .to(s, to('flick', .12, 'power2.out'))
          .to(c, { guard: 1, duration: .26, ease: 'back.out(2.6)' }, '<')
          .to(s, to('tog', .16, 'power2.inOut', { nudge: .02 }))
          .to(s, to('togOn', .08, 'power3.in', { tilt: .09 }))
          .to(c, { toggle: 1, duration: .07, ease: 'back.out(3)' }, '<.02')
          .call(() => { c.lamp = 1; onClick(); })
          .to(c, { gauge: LIMIT, duration: 1.1, ease: 'power3.inOut' })
          .to(s, to('rest', .4, 'power2.inOut', { tilt: 0, nudge: 0 }), '<.12');
      } else {
        // Thumb hooks the bat back, then sweeps the cover down; it falls the last bit on its spring.
        tl.to(s, to('togOn', .28, 'power2.out', { tilt: .05 }))
          .to(s, to('tog', .09, 'power3.in', { tilt: .08 }))
          .to(c, { toggle: 0, duration: .07, ease: 'back.out(3)' }, '<.02')
          .call(() => { c.lamp = 0; onClick(); })
          .to(c, { gauge: 1, duration: .8, ease: 'power2.out' })
          .to(s, to('flick', .14, 'power2.out'), '<')
          .to(s, to('under', .12, 'power2.in'))
          .to(c, { guard: 0, duration: .2, ease: 'bounce.out' }, '<.04')
          .to(s, to('rest', .32, 'power2.inOut', { tilt: 0, nudge: 0 }));
      }
      tl.timeScale(rate);
      return tl;
    },
    dispose() { timeline?.kill(); controller.dispose(); geos.forEach(x => x.dispose()); mats.forEach(m => m.dispose()); root.removeFromParent(); },
  };
  (hands as unknown as { debug: unknown }).debug = { left, right, held, leftMount, rightMount, s, hold };
  return hands;
}

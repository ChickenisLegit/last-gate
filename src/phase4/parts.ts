import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PartId } from './DistrictWorld';

/**
 * The three components Hiro recovers, built to read as the hardware they are:
 *  - HIGH-CURRENT RELAY: a sealed service contactor. Ceramic body, two threaded copper load
 *    studs with nuts and ring lugs, arc-chute fins, a coil connector and a rating plate.
 *  - MOTOR GOVERNOR: an actuator power regulator. Finned aluminium body, graduated dial with a
 *    knurled regulator spindle, a cracked clear isolation cover over screw terminals.
 *  - FIELD CLAMP: a split laminated core with copper windings that closes around the thruster
 *    feed. Contact jaws, a T-handle clamp screw and a mounting bracket.
 * Each is normalised to fit a 0.9-unit box with its base at y = -0.3. Geometry and materials are
 * shared module-wide; every call returns a fresh group so a part can appear in two places.
 */

const BASE_Y = -.3, SIZE = .9;

function label(lines: string[], w = 512, h = 160, bg = '#d9d4c4', fg = '#1b2226') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.font = `600 ${Math.round(h * .26)}px monospace`; x.fillText(lines[0], 26, h * .42);
  x.font = `${Math.round(h * .16)}px monospace`; lines.slice(1).forEach((line, i) => x.fillText(line, 26, h * .66 + i * h * .2));
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function speckle(base: string, spots: string, count: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < count; i++) { x.fillStyle = spots; x.globalAlpha = .25 + Math.random() * .5; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, .6 + Math.random() * 2.2, 0, Math.PI * 2); x.fill(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function dialFace() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = '#121a1e'; x.fillRect(0, 0, 256, 256); x.translate(128, 128);
  x.strokeStyle = '#d8d2bf'; x.fillStyle = '#d8d2bf'; x.font = '18px monospace'; x.textAlign = 'center';
  for (let i = 0; i <= 20; i++) {
    const a = (-135 + i * 13.5) * Math.PI / 180, r1 = i % 5 ? 92 : 84;
    x.lineWidth = i % 5 ? 2 : 4; x.beginPath(); x.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1); x.lineTo(Math.sin(a) * 104, -Math.cos(a) * 104); x.stroke();
    if (i % 5 === 0) x.fillText(String(i * 5), Math.sin(a) * 66, -Math.cos(a) * 66 + 6);
  }
  x.fillStyle = '#e09a4e'; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
  x.font = '13px monospace'; x.fillStyle = '#9fb1ad'; x.fillText('% OUTPUT', 0, 52);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

let shared: ReturnType<typeof buildShared> | null = null;
function buildShared() {
  const std = (o: T.MeshStandardMaterialParameters) => new T.MeshStandardMaterial(o);
  return {
    copper: std({ color: '#c47a45', metalness: 1, roughness: .32 }),
    brass: std({ color: '#b8964f', metalness: 1, roughness: .38 }),
    steel: std({ color: '#8d979c', metalness: .9, roughness: .38 }),
    darkSteel: std({ color: '#2b3236', metalness: .8, roughness: .5 }),
    zinc: std({ color: '#b9c0c2', metalness: .85, roughness: .45 }),
    ceramic: std({ color: '#e7e0cc', roughness: .48, metalness: 0, map: speckle('#e7e0cc', '#a89c86', 55) }),
    phenolic: std({ color: '#1c1d1e', roughness: .62, metalness: 0 }),
    rubberRed: std({ color: '#9a2323', roughness: .7 }),
    rubberBlack: std({ color: '#141516', roughness: .75 }),
    rubberOrange: std({ color: '#c8642a', roughness: .6 }),
    aluminium: std({ color: '#a9b2b7', metalness: .85, roughness: .42 }),
    iron: std({ color: '#454c4f', metalness: .7, roughness: .62, map: speckle('#454c4f', '#20262a', 900) }),
    cover: new T.MeshPhysicalMaterial({ color: '#cfe7ee', roughness: .15, metalness: 0, transparent: true, opacity: .32, depthWrite: false }),
    crack: new T.MeshBasicMaterial({ color: '#f2f7f8', transparent: true, opacity: .7 }),
    led: new T.MeshBasicMaterial({ color: '#7dffa6' }),
    relayPlate: new T.MeshStandardMaterial({ map: label(['HC-400  CONTACTOR', '400 A · 48 V DC · COIL 12 V', 'SERVICE ISOLATION · BAY 6']), roughness: .6 }),
    governorPlate: new T.MeshStandardMaterial({ map: label(['SVC GOVERNOR', 'ACTUATOR FEED REGULATOR', 'IN 48 V  ·  OUT ADJ'], 512, 150, '#c9cfc8'), roughness: .6 }),
    clampPlate: new T.MeshStandardMaterial({ map: label(['FIELD CLAMP · FC-2', 'THRUSTER BRANCH', 'TORQUE 6 N·m'], 512, 150, '#cbc6b4'), roughness: .6 }),
    dial: new T.MeshStandardMaterial({ map: dialFace(), roughness: .4, metalness: .1 }),
  };
}
const M = () => (shared ??= buildShared());

const mesh = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent?: T.Object3D) => {
  const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent?.add(o); return o;
};
const hexNut = (r: number, h: number) => new T.CylinderGeometry(r, r, h, 6);
const cyl = (r: number, h: number, seg = 20) => new T.CylinderGeometry(r, r, h, seg);
function threadedStud(parent: T.Object3D, x: number, y: number, z: number, m: ReturnType<typeof M>) {
  const stud = mesh(cyl(.034, .2, 16), m.copper, x, y + .1, z, parent);
  for (let i = 0; i < 6; i++) mesh(new T.TorusGeometry(.034, .006, 4, 16).rotateX(Math.PI / 2), m.copper, x, y + .12 + i * .016, z, parent);
  mesh(cyl(.07, .012, 24), m.zinc, x, y + .02, z, parent);              // washer
  mesh(hexNut(.062, .045), m.brass, x, y + .055, z, parent);           // lower nut
  return stud;
}

function relay() {
  const m = M(), g = new T.Group();
  // Mounting flange with four slotted holes.
  mesh(new RoundedBoxGeometry(.84, .05, .5, 2, .015), m.darkSteel, 0, .025, 0, g);
  for (const [x, z] of [[-.36, -.19], [.36, -.19], [-.36, .19], [.36, .19]]) mesh(cyl(.028, .055, 16), m.phenolic, x, .03, z, g);
  // Sealed ceramic body.
  mesh(new RoundedBoxGeometry(.6, .4, .4, 4, .06), m.ceramic, 0, .25, 0, g);
  // Arc-chute fins across the top, between the load studs.
  for (let i = 0; i < 5; i++) mesh(new T.BoxGeometry(.012, .05, .3), m.phenolic, -.06 + i * .03, .475, 0, g);
  // Two threaded load studs, nuts and ring lugs carrying short cable tails.
  for (const side of [-1, 1]) {
    const x = side * .2;
    threadedStud(g, x, .45, 0, m);
    mesh(new T.BoxGeometry(.16, .014, .07), m.copper, x + side * .07, .518, 0, g);                       // ring lug tongue
    mesh(new T.TorusGeometry(.04, .012, 8, 20).rotateX(Math.PI / 2), m.copper, x, .518, 0, g);        // lug eye
    mesh(hexNut(.062, .045), m.brass, x, .545, 0, g);                                                  // top nut
    const tail = new T.CatmullRomCurve3([new T.Vector3(x + side * .15, .52, 0), new T.Vector3(x + side * .25, .5, 0), new T.Vector3(x + side * .31, .38, 0)]);
    mesh(new T.TubeGeometry(tail, 16, .03, 12), side < 0 ? m.rubberRed : m.rubberBlack, 0, 0, 0, g);
    mesh(cyl(.034, .05, 16), m.copper, x + side * .31, .35, 0, g);                                       // crimp barrel
  }
  // Coil connector on the front face, with its two thin leads.
  mesh(new RoundedBoxGeometry(.11, .07, .06, 2, .01), m.phenolic, .19, .14, .225, g);
  for (const dx of [-.025, .025]) mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.19 + dx, .14, .26), new T.Vector3(.22 + dx, .1, .32), new T.Vector3(.3 + dx, .07, .34)]), 10, .007, 6), dx < 0 ? m.rubberRed : m.rubberBlack, 0, 0, 0, g);
  // Rating plate, and a chip knocked out of the ceramic corner.
  mesh(new T.PlaneGeometry(.34, .1), m.relayPlate, -.08, .26, .201, g);
  mesh(new T.SphereGeometry(.03, 8, 6), m.phenolic, .28, .43, .19, g).scale.set(1, .5, .6);
  return g;
}

function governor() {
  const m = M(), g = new T.Group();
  // Finned aluminium body: base block plus a heatsink comb.
  mesh(new RoundedBoxGeometry(.64, .26, .44, 3, .03), m.aluminium, 0, .13, 0, g);
  for (let i = 0; i < 11; i++) mesh(new T.BoxGeometry(.014, .14, .4), m.aluminium, -.28 + i * .056, .33, 0, g);
  // Front control panel: graduated dial and the knurled regulator spindle.
  const panel = mesh(new T.BoxGeometry(.4, .22, .02), m.phenolic, -.07, .14, .23, g);
  panel.castShadow = false;
  mesh(new T.CircleGeometry(.085, 40), m.dial, -.12, .14, .2415, g);
  const spindle = new T.Group(); spindle.position.set(-.12, .14, .245); g.add(spindle);
  mesh(cyl(.028, .06, 24).rotateX(Math.PI / 2), m.steel, 0, 0, .03, spindle);
  mesh(cyl(.05, .045, 32).rotateX(Math.PI / 2), m.brass, 0, 0, .075, spindle);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mesh(new T.BoxGeometry(.006, .006, .045), m.darkSteel, Math.cos(a) * .05, Math.sin(a) * .05, .075, spindle); }
  mesh(new T.BoxGeometry(.008, .05, .004), m.zinc, 0, .02, .099, spindle); // pointer line on the knob
  mesh(new T.PlaneGeometry(.17, .05), m.governorPlate, .06, .2, .2412, g);
  mesh(new T.SphereGeometry(.012, 12, 8), m.led, .11, .09, .243, g);
  // Terminal block on the right, under a cracked clear isolation cover.
  mesh(new T.BoxGeometry(.16, .06, .3), m.phenolic, .23, .29, 0, g);
  for (let i = 0; i < 4; i++) {
    const z = -.105 + i * .07;
    mesh(cyl(.018, .02, 16), m.zinc, .23, .33, z, g);
    mesh(new T.BoxGeometry(.03, .004, .005), m.darkSteel, .23, .341, z, g);
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.27, .32, z), new T.Vector3(.33, .3, z), new T.Vector3(.37, .2, z)]), 10, .012, 8), i < 2 ? m.rubberRed : m.rubberBlack, 0, 0, 0, g);
  }
  mesh(new RoundedBoxGeometry(.2, .1, .34, 2, .02), m.cover, .23, .35, 0, g).castShadow = false;
  const crack = mesh(new T.PlaneGeometry(.004, .16), m.crack, .23, .401, .02, g); crack.rotation.set(-Math.PI / 2, 0, .6); crack.castShadow = false;
  const crack2 = mesh(new T.PlaneGeometry(.003, .07), m.crack, .26, .401, -.04, g); crack2.rotation.set(-Math.PI / 2, 0, -.4); crack2.castShadow = false;
  return g;
}

function clamp() {
  const m = M(), g = new T.Group();
  const R = .27, gap = .55; // core radius and the opening angle at the bottom where the jaws meet
  const arc = Math.PI * 2 - gap, start = -Math.PI / 2 + gap / 2;
  // Laminated split core: stacked plates with hairline gaps.
  const core = new T.Group(); core.position.y = .42; g.add(core);
  for (let i = 0; i < 6; i++) {
    const plate = mesh(new T.TorusGeometry(R, .062, 4, 48, arc), m.iron, 0, 0, -.075 + i * .03, core);
    plate.rotation.z = start; plate.scale.z = .42;
  }
  // Copper windings around the upper core.
  for (let i = 0; i < 14; i++) {
    const a = start + gap * .4 + (arc - gap * .8) * (.18 + i / 13 * .64);
    const turn = mesh(new T.TorusGeometry(.085, .013, 8, 20), m.copper, Math.cos(a) * R, Math.sin(a) * R, 0, core);
    // A turn's ring lies across the core, so its axis follows the core's tangent (a + 90°).
    turn.rotation.set(0, Math.PI / 2, 0); turn.rotateOnWorldAxis(new T.Vector3(0, 0, 1), a + Math.PI / 2);
  }
  // Contact jaws at the split, faced in bright plating.
  for (const side of [-1, 1]) {
    const a = -Math.PI / 2 + side * gap / 2;
    const jaw = mesh(new T.BoxGeometry(.1, .085, .2), m.darkSteel, Math.cos(a) * R + side * .02, Math.sin(a) * R - .02, 0, core);
    jaw.rotation.z = a + Math.PI / 2;
    mesh(new T.BoxGeometry(.012, .07, .17), m.zinc, Math.cos(a) * R - side * .03, Math.sin(a) * R - .02, 0, core);
  }
  // T-handle clamp screw across the jaws.
  mesh(cyl(.016, .38, 16).rotateZ(Math.PI / 2), m.steel, 0, -R - .07, 0, core);
  mesh(cyl(.014, .2, 12).rotateX(Math.PI / 2), m.steel, .21, -R - .07, 0, core);
  mesh(cyl(.026, .05, 20).rotateZ(Math.PI / 2), m.brass, .18, -R - .07, 0, core);
  // The thruster feed it closes around.
  mesh(cyl(.055, .62, 24).rotateX(Math.PI / 2), m.rubberOrange, 0, 0, 0, core);
  for (const z of [-.31, .31]) mesh(cyl(.062, .03, 24).rotateX(Math.PI / 2), m.darkSteel, 0, 0, z, core);
  // Mounting bracket and its bolts, behind the core.
  mesh(new T.BoxGeometry(.5, .04, .26), m.darkSteel, 0, .02, -.06, g);
  mesh(new T.BoxGeometry(.5, .3, .03), m.darkSteel, 0, .17, -.17, g);
  for (const x of [-.18, .18]) { mesh(hexNut(.03, .03).rotateX(Math.PI / 2), m.zinc, x, .25, -.15, g); mesh(cyl(.02, .02, 16), m.zinc, x, .05, .03, g); }
  mesh(new T.PlaneGeometry(.2, .06), m.clampPlate, 0, .26, -.154, g);
  return g;
}

/** Fits a built part into the shared 0.9-unit box, centred, base on BASE_Y. */
function normalise(group: T.Group) {
  const box = new T.Box3().setFromObject(group), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
  const k = SIZE / Math.max(size.x, size.y, size.z);
  const holder = new T.Group(); group.position.set(-center.x, -box.min.y, -center.z); holder.add(group);
  holder.scale.setScalar(k); holder.position.y = BASE_Y;
  const outer = new T.Group(); outer.add(holder); return outer;
}

const BUILDERS: Record<PartId, () => T.Group> = { relay, governor, clamp };
export function createPart(part: PartId) { return normalise(BUILDERS[part]()); }

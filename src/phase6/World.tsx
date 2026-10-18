import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { createRedChip } from '../characters/RedChip.js';
import { reducedMotion } from '../config/experience';
import { createBaymax, type Baymax } from './baymax';
import { createHiro } from './hiro';
import { createFirstPersonHands, createLimiterController } from '../characters/RegulatorController';
import { FirstPerson } from './fp';
import { createRelay, BAYMAX_YARD, BAYMAX_REACH_Z } from './relay';
import { RECORDER } from './relay';
import { createStreet, createCartridge, ringLive, rampY, ROUTE, ROUTE_LENGTH, FRAME, DECK, LANDING, PEDESTAL, LADDER_X, WALK_Y, type Street } from './street';
import { createHome, directHome, HOME_GATE, HOME_BAYMAX, CARE_CHIP_AT, type Home } from './home';
import { useP6, go, now, setOf, isInsert, atLeast, type Stage, type SetName } from './store';
import type { PhaseSixAudio } from './audio';

/**
 * The 3D side of Phase 6: one Canvas, three sets (relay, street + gate site, home). Everything up to
 * the crossing is seen through Hiro's eyes: a first-person rig walks, runs, climbs and kneels where
 * each moment needs him, his hands hold his own regulator remote, and the switch moments are his
 * thumb on it. Every frame reads the stage and how long it has run, poses Baymax and moves Hiro.
 * Home, after the crossing, goes back to a camera that can see the two of them.
 */

export type Hints = { grab: RefObject<HTMLDivElement | null>; drop: RefObject<HTMLDivElement | null> };
/** Effects the World drives directly on the page: the crossing warp and the near-miss flash. */
export type Fx = { warp: RefObject<SVGFEDisplacementMapElement | null>; world: RefObject<HTMLDivElement | null>; hurt: RefObject<HTMLDivElement | null> };
/** Live numbers shared with the page: the run's input, and what the readouts show. */
export type RunState = {
  p: number; speed: number; forward: boolean; pointer: T.Vector2; impulse: number;
  /** Metres between Baymax and Hiro, how close that feels (0…1), and both on the plan (x, z). */
  gap: number; dread: number; hiro: [number, number]; bay: [number, number];
  /** Times a swing came close or debris came down, for the readout. */
  misses: number;
};

const ease = (x: number) => T.MathUtils.smoothstep(x, 0, 1);
const span = (e: number, a: number, b: number) => ease((e - a) / (b - a));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const backOut = (x: number) => { x = clamp01(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const RED = new T.Color('#ff2414'), DARK = new T.Color('#0b0f11'), CARE = new T.Color('#f4f8ff');
const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const HOVER_Y = 1.15;
const CHASE_SKY = new T.Color('#05090e'), CITY_SKY = new T.Color('#0a1622');

/** Where Hiro stands for each piece of the gate site. */
const GATE_SPOT = v3(-.6, 0, -83.8);
const DECK_SPOT = v3(DECK.x + .7, DECK.y, DECK.z + .45);
const READER_SPOT = v3(PEDESTAL.x - .1, 0, PEDESTAL.z + 1.02);
const RELAY_SPOT = v3(1.5, 0, -3.3);
/** Lying on his back (yaw π) his feet are 1.81 m toward the gate from his root, his head 2.76 m back. */
const FEET = 1.81, LIE_CENTRE = .47, LIE_LENGTH = 4.57;
/** Hauling: how far ahead of his feet Hiro walks, and the root position at which Hiro's eye crosses the surface. */
const LEAD = .95, CROSS_ROOT_Z = FRAME.z + FEET + LEAD;
/** Home: seconds of first person after the crossing (Baymax comes through, the gate closes) before the wide shot. */
export const EMERGE = 5.2;
/** Carry: up on Baymax, Hiro looks back at the gate beating with the chip, then the chip can come out. */
export const CLUE_AT = 4.3, CLUE_END = 6;
const HOME_CROSS_ROOT_Z = CROSS_ROOT_Z - FRAME.z + HOME_GATE.z;
/** The home gate sits a little off the ground; things come out at walkway height and settle. */
const homeFloor = (z: number) => z > HOME_GATE.z ? WALK_Y : Math.max(0, WALK_Y - (HOME_GATE.z - z) * .7);

/** A point along a polyline by arc length, 0…1. */
function along(points: T.Vector3[], k: number, out = new T.Vector3()) {
  const lens = points.slice(1).map((p, i) => p.distanceTo(points[i])), total = lens.reduce((a, b) => a + b, 0);
  let d = clamp01(k) * total;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) return out.copy(points[i]).lerp(points[i + 1], lens[i] ? Math.min(1, d / lens[i]) : 1); d -= lens[i]; }
  return out.copy(points[points.length - 1]);
}
/** Haul rhythm: braced short pulls, k 0…1 over `tugs` pulls. */
const tugged = (k: number, tugs: number) => { const x = clamp01(k) * tugs, f = x - Math.floor(x); return Math.min(1, (Math.floor(x) + Math.min(1, f / .42) ** .7) / tugs); };

export function World({ audio, hints, fx, run, onReady }: { audio: PhaseSixAudio; hints: Hints; fx: Fx; run: RefObject<RunState>; onReady: () => void }) {
  const { scene, camera, gl, size } = useThree();
  const cam = camera as T.PerspectiveCamera;
  const stage = useP6(s => s.stage);
  const set: SetName = setOf(stage);
  const [baymax, setBaymax] = useState<Baymax | null>(null);
  const hiro = useMemo(createHiro, []);
  const hands = useMemo(() => createFirstPersonHands(createLimiterController()), []);
  const fp = useMemo(() => new FirstPerson(), []);
  const cart = useMemo(createCartridge, []);
  useEffect(() => { if (import.meta.env.DEV) (window as Window & { __lastGateWorld?: unknown }).__lastGateWorld = { baymax, hiro, hands, fp, camera, T, gl, scene }; }, [baymax, hiro, hands, fp, camera, gl, scene]);
  const home = useMemo<Home>(createHome, []);
  const chipProxy = useMemo(() => { const c = createRedChip(); c.chip.visible = false; return c; }, []);
  const env = useRef<{ name: SetName; relay?: ReturnType<typeof createRelay>; street?: Street } | null>(null);
  const homeScene = useMemo(() => { const s = new T.Scene(); s.background = home.background; return s; }, [home]);
  const target = useMemo(() => new T.WebGLRenderTarget(4, 4, { colorSpace: T.SRGBColorSpace }), []);
  const homeCam = useMemo(() => new T.PerspectiveCamera(), []);
  // His eyes light what he looks at: a red spot from the head, and a soft glow on the head itself.
  const eyeLight = useMemo(() => { const l = new T.SpotLight('#ff2a18', 0, 34, .42, .55, 1.4); l.target.position.set(0, 0, 1); return l; }, []);
  const eyeGlow = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,60,40,1)'); g.addColorStop(.35, 'rgba(255,30,20,.35)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), color: '#ff3a24', transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
    s.scale.setScalar(1.6); s.renderOrder = 6; return s;
  }, []);
  // Coming through the far side: only the part of him already through is drawn.
  const crossing = useMemo(() => new T.Plane(new T.Vector3(0, 0, -1), 1e4), []);

  // Tracker R-05: before the cover lifts, start compiling the prebuilt street's programs (with everything
  // in it shown, his suit fully on, the street's lights counted). compileAsync links them in the background
  // while the relay plays, so nothing is built or linked as the chase starts.
  const warmStreet = (him: T.Object3D) => {
    const st = preStreet.current, relayRoot = env.current?.relay?.root;
    if (!st || !relayRoot) return;
    relayRoot.visible = false; scene.add(st.root); homeScene.add(home.root);
    // Everything hidden for now (debris, dust, sparks) is counted for the compile too.
    const hidden: T.Object3D[] = [];
    for (const sc of [st.root, homeScene, ...scene.children.filter(c => c !== relayRoot && c !== st.root)]) sc.traverse(o => { if (!o.visible) { o.visible = true; hidden.push(o); } });
    const prev = gl.getRenderTarget();
    try {
      gl.setRenderTarget(null); void gl.compileAsync(scene, camera).catch(() => {});
      gl.setRenderTarget(target); void gl.compileAsync(homeScene, homeCam).catch(() => {});
      // His materials clip at the gate, which compileAsync can't key: draw him alone, one pixel, for real.
      const others: T.Object3D[] = [], culled: T.Object3D[] = [];
      scene.traverse(o => { if ((o as T.Mesh).isMesh && o.visible) { let mine = false; for (let x: T.Object3D | null = o; x; x = x.parent) if (x === him) { mine = true; break; } if (!mine) { o.visible = false; others.push(o); } else if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } } });
      const scissor = gl.getScissorTest();
      gl.setRenderTarget(null); gl.setScissorTest(true); gl.setScissor(0, 0, 1, 1); gl.render(scene, camera); gl.setScissorTest(scissor);
      others.forEach(o => { o.visible = true; }); culled.forEach(o => { o.frustumCulled = true; });
    } finally {
      gl.setRenderTarget(prev); hidden.forEach(o => { o.visible = false; });
      st.root.removeFromParent(); home.root.removeFromParent(); relayRoot.visible = true;
    }
  };

  // Shared actors, made once for the phase. The camera joins the scene so the hands can ride on it.
  useEffect(() => {
    let alive = true, made: Baymax | null = null;
    createBaymax().then(b => {
      if (!alive) { b.dispose(); return; }
      made = b; mem.current.headH = b.headHeight;
      b.root.traverse(o => { if (o instanceof T.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.clippingPlanes = [crossing]; }); });
      scene.add(b.root); warmStreet(b.root); setBaymax(b); onReady();
    });
    gl.localClippingEnabled = true;
    scene.add(camera, hiro.root, chipProxy.chip, eyeLight, eyeLight.target, eyeGlow);
    camera.add(hands.root, cart.root);
    return () => {
      alive = false; if (made) made.dispose();
      hiro.dispose(); hands.dispose(); cart.dispose(); home.dispose(); target.dispose();
      scene.remove(camera, eyeLight, eyeLight.target, eyeGlow); eyeGlow.material.map?.dispose(); eyeGlow.material.dispose();
      chipProxy.chip.removeFromParent();
      chipProxy.chip.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    };
  }, [scene, camera, gl, hiro, hands, cart, home, chipProxy, target, eyeLight, eyeGlow, crossing, onReady]);

  // Sets: build the one in use, drop the last one. The home group lives in its own scene (seen
  // through the gate) until the crossing, then joins the main scene.
  // Tracker R-05: the street is built and its programs compiled while the relay loads (its lights
  // change the light count, which would otherwise recompile every material as the chase starts).
  const preStreet = useRef<Street | null>(null);
  useEffect(() => () => { preStreet.current?.dispose(); preStreet.current = null; }, []);
  useEffect(() => {
    const e: NonNullable<typeof env.current> = { name: set };
    if (set === 'relay') {
      e.relay = createRelay(); scene.add(e.relay.root); scene.background = new T.Color('#081320'); scene.fog = new T.Fog('#14293b', 14, 150);
      if (!preStreet.current) preStreet.current = createStreet();
    }
    if (set === 'street') { e.street = preStreet.current ?? createStreet(); preStreet.current = null; scene.add(e.street.root); homeScene.add(home.root); scene.background = new T.Color('#0a1622'); scene.fog = new T.Fog('#1a3146', 18, 190); }
    if (set === 'home') { scene.add(home.root); scene.background = home.background; scene.fog = null; }
    env.current = e;
    return () => { e.relay?.dispose(); e.street?.dispose(); home.root.removeFromParent(); env.current = null; };
  }, [set, scene, home, homeScene]);

  // Lights the sets share: a cool key and fill for the city; the home set brings its own.
  const lights = useMemo(() => {
    const g = new T.Group();
    g.add(new T.HemisphereLight('#9ec6e4', '#0a1420', 1.3));
    const key = new T.DirectionalLight('#bcd9ec', 1.7); key.position.set(-8, 16, 6); g.add(key);
    return g;
  }, []);
  useEffect(() => { scene.add(lights); return () => { scene.remove(lights); }; }, [scene, lights]);
  useEffect(() => { lights.visible = set !== 'home'; }, [set, lights]);

  // Drags: the combat chip out of his chest, the capture cartridge into the reader, the healthcare chip into his chest.
  const drag = useRef({ active: false, pos: new T.Vector3(), plane: new T.Plane(), returning: 0, from: new T.Vector3() });
  useEffect(() => {
    const el = gl.domElement, ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3();
    const screen = (p: T.Vector3) => { const q = p.clone().project(cam); return new T.Vector2((q.x + 1) / 2 * el.clientWidth, (1 - q.y) / 2 * el.clientHeight); };
    type What = 'take' | 'chip' | 'cart';
    const what = (): What | null => {
      const s = useP6.getState(), e = now() - s.since;
      if (s.stage === 'limited' && !s.took && e > 9.6) return 'take';
      if (s.stage === 'carry' && s.chip === 'bay' && e > CLUE_END) return 'chip';
      if (s.stage === 'carry' && s.chip === 'out' && s.cart === 'hand' && now() - s.pulledAt > 4.2) return 'cart';
      return null;
    };
    const source = (w: What) => w === 'take' ? cart.root.getWorldPosition(new T.Vector3()) : w === 'chip' ? baymax?.dockWorld() : cart.root.getWorldPosition(new T.Vector3());
    const dest = (w: What) => w === 'cart' ? env.current?.street?.readerWorld() : null;
    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return new T.Vector2(e.clientX - r.left, e.clientY - r.top); };
    let holding: What | null = null;
    const down = (e: PointerEvent) => {
      const w = what(); if (!w || e.button !== 0) return;
      const from = source(w); if (!from) return;
      if (screen(from).distanceTo(local(e)) > 80) return;
      // The capture: a click lifts it out of the recorder and into his pocket.
      if (w === 'take') { audio.unlock(); audio.snap(); useP6.setState({ took: true }); return; }
      audio.unlock(); holding = w;
      drag.current.active = true; drag.current.returning = 0; drag.current.pos.copy(from); drag.current.from.copy(from);
      // Carry on a plane facing the camera, through the midpoint of the piece and where it goes
      // (the chip comes up toward Hiro, so its plane sits just above the bay).
      const to = dest(w) ?? from.clone().lerp(camera.position, .35), mid = from.clone().lerp(to, .5), n = new T.Vector3(); cam.getWorldDirection(n);
      drag.current.plane.setFromNormalAndCoplanarPoint(n.negate(), mid);
      useP6.setState(w === 'chip' ? { chip: 'held' } : { cart: 'held' });
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) { const w = what(), from = w && source(w); el.style.cursor = from && screen(from).distanceTo(local(e)) < 80 ? 'grab' : ''; return; }
      el.style.cursor = 'grabbing';
      const l = local(e); ndc.set(l.x / el.clientWidth * 2 - 1, -(l.y / el.clientHeight * 2 - 1)); ray.setFromCamera(ndc, cam);
      if (ray.ray.intersectPlane(drag.current.plane, hit)) drag.current.pos.copy(hit);
    };
    const up = (e: PointerEvent) => {
      if (!drag.current.active || !holding) return;
      drag.current.active = false; el.style.cursor = '';
      const w = holding; holding = null;
      if (w === 'chip') {
        // Pulled clear of the dock: it's out, and dark.
        if (screen(drag.current.from).distanceTo(local(e)) > 110) { useP6.setState({ chip: 'out', pulledAt: now() }); audio.snap(); }
        else { drag.current.returning = 1; useP6.setState({ chip: 'bay' }); }
        return;
      }
      const to = dest(w);
      if (to && screen(to).distanceTo(local(e)) < 90) {
        useP6.setState({ cart: 'slot' }); audio.seat(); go('bloom');
      } else { drag.current.returning = 1; useP6.setState({ cart: 'hand' }); }
    };
    const cancel = () => {
      if (!drag.current.active || !holding) return;
      const w = holding; holding = null;
      drag.current.active = false; drag.current.returning = 1; el.style.cursor = '';
      useP6.setState(w === 'chip' ? { chip: 'bay' } : { cart: 'hand' });
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); };
  }, [gl, cam, camera, baymax, audio, cart]);

  // Tracker R-07: the healthcare chip goes in the way the combat chip did in Phase 1. Hold on the chip
  // to take it, hold on his chest to open the bay, then guide the chip into the socket (or hold E).
  const care = useRef({ target: null as 'chip' | 'chest' | null, at: 0, key: false, keyAt: 0, aim: null as T.Vector2 | null, guide: new T.Vector3(), open: 0, progress: 0 });
  useEffect(() => {
    const el = gl.domElement, c = care.current;
    const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return new T.Vector2(e.clientX - r.left, e.clientY - r.top); };
    const screen = (p: T.Vector3) => { const q = p.clone().project(cam); return new T.Vector2((q.x + 1) / 2 * el.clientWidth, (1 - q.y) / 2 * el.clientHeight); };
    const live = () => { const s = useP6.getState(); return s.stage === 'home' && now() - s.since > EMERGE + 2.4 ? s : null; };
    const down = (e: PointerEvent) => {
      const s = live(); if (!s || e.button !== 0 || !baymax) return; const p = at(e);
      if (s.care === 'ground' && screen(home.care.chip.getWorldPosition(new T.Vector3())).distanceTo(p) < 90) { audio.unlock(); c.target = 'chip'; c.at = now(); }
      else if (s.care === 'hand' && screen(baymax.dockWorld()).distanceTo(p) < 120) { audio.unlock(); c.target = 'chest'; c.at = now(); }
    };
    const up = () => { c.target = null; };
    const move = (e: PointerEvent) => { c.aim = at(e); };
    const kd = (e: KeyboardEvent) => { if (e.code === 'KeyE' && live() && !c.key) { audio.unlock(); c.key = true; c.keyAt = now(); } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'KeyE') c.key = false; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [gl, cam, baymax, home, audio]);

  // Memory that outlives a stage: where Baymax has got to on the street, step timing, shake, chase events.
  const mem = useRef({ trail: .28, stepAt: 0, shake: 0, landed: false, lastStage: '' as Stage | '', bayAt: new T.Vector3(), lift: 0, glance: 0, headH: 3.1, swingAt: -9, swung: false, wakeFx: 0, wakeSince: -1, falls: 0, warped: false, thirdShot: '', pressed: '' as Stage | '', idle: 0, escSince: -1 });
  const look = useMemo(() => new T.Vector3(), []);
  const feet = useMemo(() => new T.Vector3(), []);
  const camPos = useMemo(() => new T.Vector3(), []);
  const tmp = useMemo(() => new T.Vector3(), []);

  useFrame(({ clock }, delta) => {
    if (!baymax || !env.current || env.current.name !== set) return;
    const dt = Math.min(delta, .05), t = clock.elapsedTime, s = useP6.getState(), e = now() - s.since, m = mem.current, r = run.current!;
    const P = baymax.pose, H = hiro.pose;
    const enter = m.lastStage !== s.stage;
    // Each start of the run (and each retry after he catches Hiro) begins it from the top.
    if (s.stage === 'wake' && m.wakeSince !== s.since) { m.wakeSince = s.since; m.wakeFx = 0; }
    if (s.stage === 'escape' && m.escSince !== s.since) { m.escSince = s.since; r.p = 0; r.speed = 0; m.trail = -.05; m.falls = 0; m.swingAt = -9; r.misses = 0; m.idle = 0; }
    if (enter) {
      hands.controller.setOn(s.regulator);
      if (s.stage === 'drop') m.landed = false;
      if (s.stage === 'gate') m.trail = Math.max(m.trail, .4);
      if (s.stage === 'bloom') m.warped = false;
      if (s.stage === 'wake') m.wakeFx = 0;
      // The switch moments: his thumb on his own remote, the scene still in front of him.
      if (isInsert(s.stage) && m.pressed !== s.stage) {
        m.pressed = s.stage;
        const mode = s.stage === 'switchOff' ? 'off' : s.stage === 'switchOn2' ? 'onFast' : 'on';
        const next: Stage = s.stage === 'switchOn1' ? 'limited' : s.stage === 'switchOff' ? 'flyin' : 'drop';
        hands.press(() => { audio.click(); useP6.setState({ regulator: mode !== 'off' }); }, () => { if (useP6.getState().stage === s.stage) go(next); }, mode === 'onFast' ? 1.6 : 1.1);
      }
      if (!isInsert(s.stage)) m.pressed = '';
    }
    // Defaults each frame; the stage below sets what it needs.
    Object.assign(P, { armour: 1, overhead: 0, limiterOn: s.regulator ? 1 : 0, getUp: 0, sit: 0, lie: 0, lean: .08, guard: 1, punch: 0, hold: 0, stride: 0, dangle: 0, thrust: 0, sputter: 0, open: 0, chipGlow: 0, chipInBay: s.chip === 'bay', careSeated: s.care === 'seated', eyeGlow: 1 });
    P.tension = set === 'home' ? 0 : s.regulator ? .4 : 1;
    P.sluggish = s.regulator && set !== 'home' ? 1 : 0;
    P.eyes.copy(RED); P.head[0] = P.head[1] = P.head[2] = 0;
    baymax.root.rotation.x = 0; crossing.constant = 1e4;
    Object.assign(H, { walk: 0, stride: 0, lean: 0, haul: 0, kneel: 0, reach: 0, look: 0 });
    hiro.root.visible = false;
    let first = true, eye = 1.56, fov = 62, raise = .3, reach = 0, freeLook = .12, lookRate = 5, place = false;
    let jet = 0, hum = 0, dread = 0, near = 0, warp = 0, cartShown = false;
    const head = () => baymax.headWorld(tmp).clone();

    if (set === 'relay') {
      env.current.relay!.update(t, dt);
      baymax.root.position.copy(BAYMAX_YARD); P.yaw = 0;
      feet.copy(RELAY_SPOT); look.copy(head());
      if (s.stage === 'wake') {
        // Tracker R-03/S-05: he comes in hunting (the clock restarts as the cover lifts, so this is seen). A red glow over the dish, then he drops out of the sky,
        // jets roaring and eyes burning, slams down in the yard, and rises into the stance. Hiro steps back.
        const fly = span(e, 1, 3.3), land = e >= 3.3;
        const arc = ease(fly), from = v3(BAYMAX_YARD.x - 9, 17, BAYMAX_YARD.z - 26);
        if (!land) {
          baymax.root.position.lerpVectors(from, BAYMAX_YARD, arc).setY(T.MathUtils.lerp(17, 0, Math.pow(arc, 1.6)) + Math.sin(Math.PI * arc) * 2.2);
          P.yaw = Math.atan2(BAYMAX_YARD.x - from.x, BAYMAX_YARD.z - from.z) * (1 - arc);
          P.thrust = 1; jet = .9; P.dangle = .55 * (1 - span(e, 2.8, 3.25)); P.lean = .55 - span(e, 2.6, 3.25) * .4; P.guard = .25;
          if (e > 2.3 && m.wakeFx < 1) { m.wakeFx = 1; audio.whoosh(); }
        } else {
          // The landing: a hard crouch that he pushes up out of; the stance locks at 4.4 as before.
          const rise = span(e, 3.4, 5.1);
          P.sit = .55 * (1 - rise) * span(e, 3.3, 3.42); P.lean = .3 * (1 - rise) + .08 * P.guard;
          P.guard = Math.max(.25 * (1 - span(e, 3.4, 3.8)), backOut((e - 5.2) / .55));
          if (m.wakeFx < 2) { m.wakeFx = 2; m.shake = Math.max(m.shake, reducedMotion ? 0 : .7); audio.impact(); }
        }
        P.eyes.copy(RED); P.eyeGlow = .6 + .4 * fly;
        P.head[0] = (1 - P.guard) * .2; P.head[1] = span(e, 3.6, 4.4) * .15;
        feet.z = RELAY_SPOT.z + span(e, 5.25, 6) * .7;
        // Eyes up to the sky and the glow, then down with him to the yard.
        look.copy(head()).lerp(v3(BAYMAX_YARD.x, 1.6, BAYMAX_YARD.z), span(e, 3.4, 4.2)); lookRate = 4;
        if (e > 5.22 && e < 5.3) { m.shake = Math.max(m.shake, .35); audio.step(.7); }
        dread = .3 + span(e, 1, 3.4) * .35;
      } else if (s.stage === 'limited') {
        feet.z = RELAY_SPOT.z + .7;
        // Each full move falls short. Thrusters starve, the walk is heavy, the punch stops early.
        const fly = span(e, .8, 2.2) * (1 - span(e, 2.6, 3.2));
        P.thrust = e > .8 && e < 3.2 ? .75 : 0; P.sputter = 1; jet = P.thrust * .7;
        P.dangle = fly; baymax.root.position.y = fly * 1 + Math.sin(t * 9) * .05 * fly;
        if (e > 3.2 && e < 3.26) { m.shake = .35; audio.step(1); }
        // A few heavy steps toward the relay, stopping in the yard, short of the back wall.
        const walk = clamp01((e - 3.6) / 3.4);
        baymax.root.position.z = BAYMAX_YARD.z + ease(walk) * (BAYMAX_REACH_Z - BAYMAX_YARD.z);
        if (e > 3.6 && e < 7) { P.stride = .9; P.lean = .16; const ph = (e - 3.6) / .85 * Math.PI; P.gait = ph; if (Math.floor(ph / Math.PI) !== Math.floor(m.stepAt)) { audio.step(.85); m.shake = Math.max(m.shake, .16); } m.stepAt = ph / Math.PI; }
        // Wind up, a slow drive, stop short with the arm shaking, then pull back.
        P.punch = e < 7 ? 0 : e < 7.6 ? -.3 * span(e, 7, 7.6) : e < 8.7 ? -.3 + 1.05 * Math.sin(Math.PI / 2 * clamp01((e - 7.6) / 1.1)) : .75 * (1 - span(e, 8.9, 9.7));
        if (e > 8.4 && e < 8.9) P.punch += Math.sin(t * 60) * .02;
        if (e > 7.6 && e < 7.66) audio.servo();
        P.lean = e > 7.4 && e < 9.2 ? .2 : P.lean;
        dread = .45 + span(e, 3.6, 8.4) * .3; near = .3;
        // Before he goes: the capture, still in the recorder beside him.
        if (e > 9.6 && !s.took) { look.set(RECORDER.x, 1.05, RECORDER.z); lookRate = 3; reach = .45; }
      } else { feet.z = RELAY_SPOT.z + .7; P.guard = 1; dread = .4; }
      P.head[1] += .12;
      raise = s.stage === 'wake' ? .2 + span(e, 3.4, 5) * .2 : .4;
    }

    if (set === 'street') {
      const st = env.current.street!;
      const powered = atLeast(s.stage, 'powered') ? 1 : 0;
      const live = ringLive(s.angles);
      let open = 0, flash = 0;
      const socket = s.cart === 'slot' ? 1 : 0;
      hum = powered ? 1 : live.reduce((a, b) => a + b, 0) * .15;

      // Baymax down the street: coming on, slowly, the whole time the frame is being worked.
      const onTrail = (p: number) => { const q = ROUTE.getPointAt(clamp01(p)); const ahead = ROUTE.getPointAt(clamp01(p + .01)); baymax.root.position.set(q.x, 0, q.z); P.yaw = Math.atan2(ahead.x - q.x, ahead.z - q.z); };
      const trudge = (speed: number) => {
        P.stride = .85; P.gait += dt * speed * 3.6; const step = Math.floor(P.gait / Math.PI);
        if (step !== m.stepAt) { m.stepAt = step; const d = baymax.root.position.distanceTo(camera.position); audio.step(Math.min(1, 9 / d)); if (d < 16) m.shake = Math.max(m.shake, .28 * (1 - d / 16) + .05); }
      };

      if (s.stage === 'escape') {
        if (s.caught) { r.forward = false; r.impulse = 0; r.speed = 0; }
        const goal = r.forward ? 4.2 : 0;
        r.speed = T.MathUtils.damp(r.speed, goal + r.impulse * 3.5, 3, dt); r.impulse = Math.max(0, r.impulse - dt * 2.2);
        r.p = clamp01(r.p + r.speed * dt / ROUTE_LENGTH);
        // He gains when Hiro stops and only just loses ground while Hiro runs. Never quite reaching him.
        const gap = (r.p - m.trail) * ROUTE_LENGTH;
        const bSpeed = gap > 11 ? 4.7 : gap > 4.4 ? 3.8 : 0;
        m.trail = Math.min(r.p - 4.4 / ROUTE_LENGTH, m.trail + bSpeed * dt / ROUTE_LENGTH);
        onTrail(Math.max(0, m.trail)); if (m.trail < 0) baymax.root.position.z = ROUTE.getPointAt(0).z - m.trail * ROUTE_LENGTH;
        if (bSpeed > 0) trudge(bSpeed / 2.2); else P.stride = .25;
        P.lean = .22; P.guard = .8;
        // Close enough, he swings. It always just misses: Hiro is already moving or the arm stops short.
        if (gap < 6.2 && t - m.swingAt > 2.6) { m.swingAt = t; m.swung = false; audio.servo(); }
        const sw = t - m.swingAt;
        if (sw < 1.1) {
          P.punch = sw < .35 ? -.35 * span(sw, 0, .35) : sw < .6 ? -.35 + 1.4 * span(sw, .35, .6) : 1.05 * (1 - span(sw, .6, 1.1));
          P.lean = .3;
          if (!m.swung && sw > .5) { m.swung = true; audio.whoosh(); m.shake = Math.max(m.shake, .55); r.misses++; if (fx.hurt.current && !reducedMotion) { fx.hurt.current.classList.remove('on'); void fx.hurt.current.offsetWidth; fx.hurt.current.classList.add('on'); } }
        }
        // Debris: chunks come off the blocks ahead and land just off Hiro's line as he gets there.
        const FALLS = [.16, .33, .5, .66, .82];
        if (m.falls < FALLS.length && r.p > FALLS[m.falls]) {
          const side = m.falls % 2 ? 1 : -1, lead = 5.6 + r.speed * .4;
          const land = ROUTE.getPointAt(Math.min(1, r.p + lead / ROUTE_LENGTH)).setY(0).add(v3(side * (1.5 + (m.falls % 3) * .45), 0, 0));
          const from = v3(side * 7.6, 13.5, land.z + 1.5), fall = Math.sqrt(2 * 13 / 15);
          const push = v3((land.x - from.x) / fall, 0, (land.z - from.z) / fall);
          st.debris(from, push, .55 + (m.falls % 2) * .25, at => { const d = at.distanceTo(camera.position); audio.crash(Math.min(1, 6 / d)); m.shake = Math.max(m.shake, Math.min(.9, 5 / d)); r.misses++; });
          st.debris(from.clone().add(v3(0, 1.2, -.6)), push.clone().multiplyScalar(1.08), .22);
          st.debris(from.clone().add(v3(0, .6, .7)), push.clone().multiplyScalar(.94), .18);
          m.falls++;
        }
        const pos = ROUTE.getPointAt(r.p); feet.set(pos.x, 0, pos.z);
        const ahead = ROUTE.getPointAt(Math.min(1, r.p + .05));
        look.copy(ahead).lerp(FRAME, T.MathUtils.smoothstep(r.p, .75, 1));
        // Glances back over the shoulder at fixed points on the run, and whenever he swings.
        const g = Math.max([.24, .48, .72].reduce((acc, at) => Math.max(acc, Math.sin(Math.PI * clamp01((r.p - at) / .06))), 0), sw < 1.2 ? Math.sin(Math.PI * clamp01(sw / 1.2)) * .8 : 0);
        m.glance = T.MathUtils.damp(m.glance, g, 5, dt);
        if (m.glance > .01) look.copy(FirstPerson.blend(fp.eyeAt(), look.clone(), baymax.headWorld(tmp).clone().setY(2.5), m.glance));
        freeLook = .9 * (1 - m.glance); lookRate = 7; fov = 66; raise = 0;
        dread = clamp01(1 - (gap - 4.4) / 12); near = dread;
        r.gap = gap;
        // Stand still with him on your back and he gets you: the run stops and offers a retry.
        if (!s.caught) {
          m.idle = gap < 4.8 && r.speed < .8 ? m.idle + dt : Math.max(0, m.idle - dt * 2);
          if (m.idle > 1.8) {
            useP6.setState({ caught: true }); m.shake = reducedMotion ? 0 : 1; audio.crash(1);
            if (fx.hurt.current && !reducedMotion) { fx.hurt.current.classList.remove('on'); void fx.hurt.current.offsetWidth; fx.hurt.current.classList.add('on'); }
          }
        }
        // Caught: he turns to see him, fist drawn back.
        if (s.caught) { dread = 1; P.punch = .9; look.copy(head()); freeLook = 0; lookRate = 6; }
        else if (r.p > .985) go('gate');
      } else if (s.stage === 'gate' || s.stage === 'powered') {
        m.trail = Math.min(.62, m.trail + dt * .0035); onTrail(m.trail); trudge(.6);
        feet.copy(GATE_SPOT); look.set(0, FRAME.y + .1, FRAME.z); freeLook = .1; raise = .15;
        if (s.stage === 'powered') {
          // It tries: a seam opens in the middle of the ring, flickers, and folds shut. The reader
          // has locked onto something from this side, so there's nowhere for it to open onto.
          // The rings and spokes strain part-way out and snap back.
          const seam = Math.sin(Math.PI * span(e, .25, 1.8)) ** 1.5;
          open = seam * .3 * (.85 + .15 * Math.sin(t * 40)); flash = seam * (.5 + .5 * Math.sin(t * 31)) * .35;
          if (e > .25 && e - dt <= .25) audio.falter();
          if (e > .9 && e < 1.6) m.shake = Math.max(m.shake, .18);
          // A last look at it humming, then across to the ladder, up, and out onto the deck.
          const path = [GATE_SPOT, v3(LADDER_X + .3, 0, -88.5), v3(LADDER_X, 0, -88.85), v3(LADDER_X, DECK.y, -88.85), v3(LADDER_X + .4, DECK.y, -89.7), DECK_SPOT];
          const k = e < 1.2 ? 0 : e < 3.6 ? span(e, 1.2, 3.6) * .52 : e < 5.4 ? .52 + span(e, 3.6, 5.4) * .2 : .72 + span(e, 5.4, 6.4) * .28;
          along(path, k, feet);
          if (e > 1.2 && e < 3.6) look.set(LADDER_X, 1.6, -89.2);
          else if (e >= 3.6 && e < 5.4) look.set(LADDER_X, DECK.y + 1.4, -89.6);
          else if (e >= 5.4) look.copy(head()).lerp(v3(0, FRAME.y, FRAME.z), 1 - span(e, 5.4, 6.4));
          lookRate = 3; if (e > 6.6) go('choice');
        }
        dread = .2;
      } else if (s.stage === 'choice' || s.stage === 'switchOff') {
        m.trail = Math.min(.62, m.trail + dt * .0035); onTrail(m.trail); trudge(.6);
        feet.copy(DECK_SPOT); look.copy(head()).setY(2.4);
        raise = s.stage === 'switchOff' ? 1 : .35 + span(e, 2.4, 3) * .3; dread = .3;
      } else if (s.stage === 'flyin' || s.stage === 'faceoff' || s.stage === 'switchOn2') {
        // Full power: up above the roofs, down the street, and stop face to face with Hiro.
        const hover = v3(LANDING.x, HOVER_Y, LANDING.z);
        feet.copy(DECK_SPOT);
        const start = ROUTE.getPointAt(clamp01(m.trail)).setY(0);
        if (s.stage === 'flyin') {
          if (e < .05) m.bayAt.copy(start);
          const rise = span(e, .7, 2.3), travel = span(e, 2.2, 5.2);
          const up = m.bayAt.clone().setY(rise * 9);
          const c1 = up.clone().add(v3(0, 3, -12)), c2 = hover.clone().add(v3(0, 4, 9));
          const q = travel > 0 ? new T.CubicBezierCurve3(up, c1, c2, hover).getPoint(travel) : up;
          baymax.root.position.copy(q);
          P.yaw = Math.PI; P.dangle = 1; P.lean = .35 * Math.sin(Math.PI * travel) + .05; P.guard = 1 - .6 * Math.sin(Math.PI * travel);
          P.thrust = span(e, .1, .7); jet = P.thrust;
          if (e > .1 && e < .16) { audio.ignite(); m.shake = .25; }
          look.copy(head()); lookRate = 4;
          // He pulls up hard in front of the deck: Hiro flinches back a step.
          feet.z = DECK_SPOT.z - span(e, 4.6, 5.3) * .35;
          if (travel > .97 && m.lift === 0) { m.lift = 1; st.kickDust(hover.clone().setY(0), .7, 1); m.shake = .5; }
          dread = .5 + travel * .5; near = travel;
          if (e > 6.2) go('faceoff');
        } else {
          baymax.root.position.copy(hover).add(v3(Math.sin(t * .9) * .12, Math.sin(t * 2.2) * .06, 0));
          // Hovering on full thrust: fists up, a slow drift and sway, never quite still.
          P.yaw = Math.PI + Math.sin(t * .7) * .07; P.dangle = .3; P.lean = .05 + Math.sin(t * 1.3) * .04; P.guard = .45; P.thrust = 1; jet = 1; m.lift = 1;
          feet.z = DECK_SPOT.z - .35;
          look.copy(head()); raise = s.stage === 'switchOn2' ? 1 : .55; dread = .9; near = 1;
        }
        fov = 68;
      } else if (s.stage === 'drop') {
        // Thrusters out. He hangs, falls back, and hits the paving.
        const hoverY = HOVER_Y, g = 11.5, hang = .14;
        const tLand = hang + Math.sqrt(2 * Math.max(.3, hoverY) / g);
        const fall = e < hang ? 0 : Math.min(1, ((e - hang) / (tLand - hang)) ** 2);
        const y = e < tLand ? hoverY * (1 - fall) : Math.max(0, Math.sin(Math.min(1, (e - tLand) / .3) * Math.PI) * .07);
        baymax.root.position.set(LANDING.x, y, LANDING.z);
        P.yaw = Math.PI; P.dangle = 1 - fall; P.lie = e < tLand ? fall * .92 : 1; P.guard = .4 * (1 - fall);
        P.thrust = e < .1 ? .6 : 0; P.sputter = 1;
        P.eyes.copy(RED).lerp(DARK, span(e, 1.2, 3)); P.eyeGlow = 1 - span(e, 1.2, 3);
        P.open = clamp01((e - 4) / 2.5) * 4.6; P.chipGlow = span(e, 5.8, 7.4);
        // The landing shakes the gate's field: a flare and a flicker across the ring.
        if (m.landed) { const k = Math.exp(-(e - tLand) * 2.2); flash = k * .45; open = k * .16 * (.8 + .2 * Math.sin(t * 40)); }
        if (!m.landed && e >= tLand) { m.landed = true; m.shake = reducedMotion ? 0 : 1; audio.impact(); st.kickDust(LANDING, 1.4); }
        feet.copy(DECK_SPOT); feet.z -= .35;
        // Leaning over the deck rail to see him, then down to his chest as it opens.
        feet.z += span(e, 2, 3.5) * .35;
        look.copy(baymax.root.position).setY(e < tLand ? y + 2.6 : 1.1).lerp(baymax.chestWorld(tmp), span(e, 3.2, 5.2));
        lookRate = 3; raise = .2;
        if (e > 7.4) go('carry');
      } else if (s.stage === 'carry') {
        baymax.root.position.copy(LANDING); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0;
        P.open = 4.6; P.chipGlow = s.chip === 'bay' ? 1 : 0;
        const R0 = LANDING, onHim = v3(R0.x + .1, 1.0, R0.z - 1.45);
        raise = 0; freeLook = 0;
        if (s.chip !== 'out') {
          // Down the ladder, across to him, and up onto him to get at the bay.
          const path = [DECK_SPOT, v3(LADDER_X + .4, DECK.y, -89.7), v3(LADDER_X, DECK.y, -88.85), v3(LADDER_X, 0, -88.85), v3(R0.x, 0, R0.z - 2.6), v3(R0.x + .1, .85, R0.z - 1.75), onHim];
          const k = e < .8 ? span(e, 0, .8) * .14 : e < 2.3 ? .14 + span(e, .8, 2.3) * .2 : e < 4.3 ? .34 + span(e, 2.3, 4.3) * .52 : .86 + span(e, 4.3, 5.2) * .14;
          along(path, k, feet);
          look.copy(e < .8 ? v3(LADDER_X, DECK.y, -88) : e < 2.3 ? v3(LADDER_X, .4, -87.6) : baymax.dockWorld(tmp));
          eye = e > 4.6 ? 1.42 : 1.56; lookRate = 3.5; reach = s.chip === 'held' ? 1 : e > CLUE_END ? .4 : 0;
          if (e > 5.2) look.copy(baymax.dockWorld(tmp)).add(v3(0, .15, 0));
          // The clue: up on him, a look back at the gate, its hub and reader beating red in the
          // chip's rhythm, then back down to the chip.
          const clue = Math.sin(Math.PI * clamp01((e - CLUE_AT) / (CLUE_END - CLUE_AT)));
          if (clue > 0) look.copy(FirstPerson.blend(fp.eyeAt(), look.clone(), v3(0, FRAME.y - .9, FRAME.z), clue * .95));
        } else {
          // Off him, over to the reader, the cartridge out of his pocket.
          const k2 = now() - s.pulledAt;
          const path = [onHim, v3(R0.x + .1, .85, R0.z - 1.75), v3(R0.x + .3, 0, R0.z - 2.6), READER_SPOT];
          along(path, k2 < .7 ? 0 : k2 < 1.5 ? span(k2, .7, 1.5) * .3 : .3 + span(k2, 1.5, 4.2) * .7, feet);
          eye = k2 < .9 ? 1.42 : 1.56; lookRate = 3;
          look.copy(k2 < 1.5 ? baymax.dockWorld(tmp) : st.readerWorld()).lerp(st.readerWorld().add(v3(0, .05, 0)), span(k2, 1.6, 4));
          if (k2 > 4.2) look.set(PEDESTAL.x - .25, .95, PEDESTAL.z - 1.6);
          reach = s.cart === 'held' ? 1 : k2 > 2.4 ? .55 : 0;
          cartShown = s.cart === 'hand' && k2 > 2.4;
        }
      } else if (s.stage === 'bloom') {
        baymax.root.position.copy(LANDING); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0; P.open = 4.6; P.chipInBay = false; P.overhead = span(e, 7.4, 8.4);
        open = 1 - Math.pow(1 - span(e, .9, 3.6), 3);
        if (e > .9 && e < .96) audio.bloom();
        feet.copy(READER_SPOT);
        if (e < 5) { look.set(0, FRAME.y - .1, FRAME.z); lookRate = 2.5; reach = .3 * (1 - span(e, .6, 1.4)); }
        else if (e < 7.6) {
          // Turn round to him and walk to his feet.
          along([READER_SPOT, v3(1.4, 0, -87.4), v3(LANDING.x * .85, 0, LANDING.z - FEET - LEAD)], span(e, 5.3, 7.6), feet);
          look.copy(baymax.root.position).setY(.9).lerp(v3(LANDING.x, .4, LANDING.z - FEET), span(e, 6.6, 7.6)); lookRate = 3;
        } else {
          // He takes him by the feet and hauls him back: across onto the walkway's line, then
          // straight up it, through the middle of the ring, a braced pull at a time.
          const k = tugged((e - 8.3) / 10, 12);
          const A = v3(LANDING.x, 0, LANDING.z), B = v3(0, 0, LANDING.z - 1.1), C = v3(0, 0, CROSS_ROOT_Z - .5);
          const root = along([A, B, C], k);
          const cz = root.z + LIE_CENTRE, fz = root.z - FEET, hz = root.z + LIE_LENGTH - FEET;
          baymax.root.position.set(root.x, rampY(cz), root.z);
          baymax.root.rotation.x = Math.atan2(rampY(fz) - rampY(hz), LIE_LENGTH);
          feet.set(root.x * .85, 0, fz - LEAD); feet.y = rampY(feet.z);
          eye = e < 8.3 ? 1.56 - span(e, 7.6, 8.3) * .1 : 1.46; reach = span(e, 7.6, 8.2) * .5;
          look.set(root.x, baymax.root.position.y + .6, root.z + 1.3); lookRate = 4;
          // One look over his shoulder at the open gate, then back to Baymax.
          const glance = Math.sin(Math.PI * clamp01((e - 12.8) / 1.8));
          if (glance > 0) look.copy(FirstPerson.blend(fp.eyeAt(), look.clone(), v3(0, FRAME.y, FRAME.z - 3), glance * .9));
          const pull = Math.floor(clamp01((e - 8.3) / 10) * 12);
          if (pull !== m.stepAt && e > 8.3) { m.stepAt = pull; audio.step(.4); m.shake = Math.max(m.shake, reducedMotion ? 0 : .38); }
          // Each tug: a dip and a jolt through his arms, then the brace for the next one.
          const tug = Math.sin(Math.PI * ((clamp01((e - 8.3) / 10) * 12) % 1));
          // Hands low on his ankles, not reaching across the middle of the view.
          if (e > 8.3) { eye -= .07 * tug; reach = .48 + .1 * tug; }
          // The surface: the warp grows as his eye reaches it.
          warp = span(-(feet.z), -(FRAME.z + 1.25), -FRAME.z);
          if (warp > .3 && !m.warped) { m.warped = true; audio.warp(); }
          if (fp.feet.z <= FRAME.z + .02 && e > 9) go('home');
        }
        if (e > 19.5) go('home');
        flash = span(warp, .6, 1);
        renderGate(st, open);
      }
      // The combat chip: held up out of the dock, then into Hiro's pocket.
      if (s.stage === 'carry') {
        const k2 = s.chip === 'out' ? now() - s.pulledAt : 0;
        chipProxy.chip.visible = s.chip === 'held' || (s.chip === 'bay' && drag.current.returning > 0) || (s.chip === 'out' && k2 < .9);
        if (drag.current.returning > 0) {
          drag.current.returning = Math.max(0, drag.current.returning - dt * 3);
          const returnTo = s.cart === 'hand' && s.chip === 'out'
            ? camera.localToWorld(tmp.set(.16, -.2, -.42)) : baymax.dockWorld();
          drag.current.pos.lerp(returnTo, 1 - Math.exp(-dt * 10));
        }
        if (s.chip === 'out' && k2 < .9) drag.current.pos.lerp(camera.position.clone().add(v3(.3, -.6, 0)), 1 - Math.exp(-dt * 6));
        if (chipProxy.chip.visible) { chipProxy.chip.position.copy(drag.current.pos); chipProxy.chip.lookAt(camera.position); chipProxy.chip.scale.setScalar(1.6); chipProxy.glow.color.set('#ff3a2c').multiplyScalar(s.chip === 'out' ? .4 : 2); }
        P.chipInBay = s.chip === 'bay' && drag.current.returning === 0;
      } else chipProxy.chip.visible = false;
      // The cartridge: in Hiro's right hand, carried to the slot, seated and playing.
      const cartHeld = s.stage === 'carry' && s.cart === 'held', cartSeated = s.cart === 'slot' && (s.stage === 'carry' || s.stage === 'bloom');
      if (cartShown || cartHeld || cartSeated || (s.stage === 'carry' && drag.current.returning > 0 && s.chip === 'out')) {
        cart.root.visible = true; cart.root.scale.setScalar(1);
        if (cartShown && !drag.current.returning) { if (cart.root.parent !== camera) camera.add(cart.root); cart.root.position.set(.16, -.2, -.42); cart.root.rotation.set(.5, -.3, .1); }
        else {
          if (cart.root.parent !== scene) scene.add(cart.root);
          if (cartSeated) { cart.root.position.copy(st.readerWorld()); cart.root.quaternion.copy(st.readerQuat()); cart.root.rotateX(Math.PI / 2 - .2); cart.root.translateZ(.012); }
          else { cart.root.position.copy(drag.current.pos); cart.root.lookAt(st.readerWorld()); }
        }
        cart.glow.color.set(cartSeated ? '#c9dca8' : '#2a332c');
      } else cart.root.visible = false;
      // What the reader is locked onto: Baymax's combat chip. Faint while he's down the street,
      // stronger as he closes, and beating with the chip once his bay is open. Pulled, it lets go.
      const lock = !powered || socket ? 0
        : s.stage === 'drop' ? Math.max(.45, P.chipGlow)
        : s.stage === 'carry' ? (s.chip === 'bay' ? 1 : s.chip === 'held' ? .5 : 0)
        : s.stage === 'flyin' || s.stage === 'faceoff' || s.stage === 'switchOn2' ? .45
        : s.stage === 'powered' ? span(e, 1.2, 2.2) * .3 : .3;
      st.update(t, dt, { angles: s.angles, live, powered, open, flash, cracked: atLeast(s.stage, 'carry') || (s.stage === 'drop' && m.landed) ? 1 : 0, socket, lock, eye: camera.position, dread });
      if (s.stage !== 'flyin') m.lift = s.stage === 'faceoff' || s.stage === 'switchOn2' ? 1 : 0;
      if (s.stage !== 'escape') r.gap = baymax.root.position.distanceTo(fp.feet);
    } else cart.root.visible = false;

    if (set === 'home') {
      chipProxy.chip.visible = false;
      const he = e - EMERGE - .4;
      const gate = s.stage === 'home' ? 1 - span(e, EMERGE - 1.4, EMERGE + .6) : 0;
      home.update(t, dt, { gate, careBlink: s.care === 'seated' ? 0 : 1 });
      baymax.root.position.copy(HOME_BAYMAX); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0; P.open = 4.6; P.chipInBay = false; P.overhead = 1 - span(e, EMERGE - 1, EMERGE + .5);
      if (s.stage === 'home' && he < 0) {
        // Through. The rest of him comes out of the gate after Hiro, slides off its lip onto the
        // ground, and the gate closes behind him.
        const k = tugged(e / (EMERGE - 1.2), 6);
        const root = v3(0, 0, HOME_CROSS_ROOT_Z).lerp(HOME_BAYMAX, k);
        const fz = root.z - FEET, hz = root.z + LIE_LENGTH - FEET;
        baymax.root.position.set(root.x, homeFloor(root.z + LIE_CENTRE), root.z);
        baymax.root.rotation.x = Math.atan2(homeFloor(fz) - homeFloor(hz), LIE_LENGTH);
        crossing.normal.set(0, 0, -1); crossing.constant = HOME_GATE.z;
        feet.set(root.x * .85, 0, Math.min(HOME_GATE.z - .05, fz - LEAD)); feet.y = homeFloor(feet.z);
        eye = 1.46; reach = 1 - span(e, EMERGE - 1.6, EMERGE - .8);
        look.set(root.x, baymax.root.position.y + .6, root.z + 1.3).lerp(v3(HOME_GATE.x, HOME_GATE.y - 1, HOME_GATE.z), span(e, EMERGE - 2, EMERGE - .6) * .6);
        lookRate = 3.5; raise = 0;
        warp = 1 - span(e, .1, 1.1);
        if (e > .1 && e < 1.3) P.chipGlow = 0;
      } else {
        first = false;
        hiro.root.visible = true;
        // The healthcare chip (tracker R-07). Holds: on the chip, then on his chest (E works for both).
        const c = care.current, HOLD = .8;
        const holding = c.target ?? (c.key && (s.care === 'ground' || s.care === 'hand') ? (s.care === 'ground' ? 'chip' : 'chest') : null);
        c.progress = holding && s.stage === 'home' ? clamp01((now() - (c.target ? c.at : c.keyAt)) / HOLD) : 0;
        if (holding && c.progress >= 1) {
          c.target = null; c.key = false; c.progress = 0;
          if (holding === 'chip' && s.care === 'ground') { useP6.setState({ care: 'hand' }); audio.snap(); }
          else if (holding === 'chest' && s.care === 'hand') { useP6.setState({ care: 'open' }); audio.servo(); hiro.handWorld(c.guide); }
        }
        // The bay opens as it did in Phase 1, and stays open until the boot closes it.
        c.open = T.MathUtils.clamp(c.open + (s.care === 'open' || s.care === 'seated' ? dt * 2.6 : -dt * 4), 0, 4.6);
        // Guiding: the chip follows the pointer on a plane through the socket; near it, it's drawn in and seats.
        if (s.stage === 'home' && s.care === 'open' && c.open > 4) {
          const dock = baymax.dockWorld(new T.Vector3()), want = c.guide.clone();
          if (c.key) want.copy(dock);
          else if (c.aim) {
            const n = new T.Vector3(); cam.getWorldDirection(n); const plane = new T.Plane().setFromNormalAndCoplanarPoint(n.negate(), dock);
            const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(c.aim.x / size.width * 2 - 1, -(c.aim.y / size.height * 2 - 1)), cam);
            ray.ray.intersectPlane(plane, want);
          }
          c.guide.lerp(want, 1 - Math.exp(-dt * (c.key ? 2.5 : 12)));
          const d = c.guide.distanceTo(dock);
          if (d < .35) c.guide.lerp(dock, 1 - Math.exp(-dt * 8));
          if (d < .05) { useP6.setState({ care: 'seated' }); audio.seat(); go('seated'); }
        }
        drag.current.pos.copy(c.guide);
        const homeShot = directHome(home, { baymax, hiro }, {
          stage: s.stage, e: s.stage === 'home' ? Math.max(0, he) : e, t, dt,
          care: s.care, dragPos: drag.current.pos, returning: drag.current.returning, camera, bayOpen: care.current.open,
        }, { chime: () => audio.chime(), step: level => audio.step(level), done: () => go('end') }, camPos, look);
        fov = homeShot.fov;
      }
    }

    // ---------- everything after this is shared
    function renderGate(st: Street, open: number) {
      if (open <= 0) return;
      // The far side, seen from where the camera stands relative to this gate.
      const w = Math.max(2, Math.floor(size.width * gl.getPixelRatio() * .6)), h = Math.max(2, Math.floor(size.height * gl.getPixelRatio() * .6));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      homeCam.copy(cam); homeCam.position.copy(camera.position).sub(FRAME).add(HOME_GATE);
      home.update(t, dt, { gate: 0, careBlink: 1 });
      const prev = gl.getRenderTarget(); gl.setRenderTarget(target); gl.render(homeScene, homeCam); gl.setRenderTarget(prev);
      st.portalMat.uniforms.uView.value = target.texture;
      st.portalMat.uniforms.uRes.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
    }

    if (set === 'relay') {
      const inRec = s.stage === 'limited' && !s.took;
      cart.root.visible = inRec; cart.root.scale.setScalar(inRec ? 1.9 : 1);
      if (inRec) {
        if (cart.root.parent !== scene) scene.add(cart.root);
        cart.root.position.set(RECORDER.x, 1.06, RECORDER.z); cart.root.rotation.set(-Math.PI / 2 + .3, 0, .4);
        cart.glow.color.set('#ffb066').multiplyScalar(1 + .6 * Math.sin(t * 4));
      }
    }
    baymax.update(t); hiro.update();
    // His eyes: a red spot thrown where he faces, and a glow on the head, while they burn red.
    const red = P.eyeGlow * (P.eyes.r > .5 && P.eyes.g < .4 ? 1 : 0) * (set === 'home' ? 0 : 1);
    baymax.headWorld(tmp); eyeGlow.position.copy(tmp).add(v3(Math.sin(P.yaw) * .55, 0, Math.cos(P.yaw) * .55)); eyeGlow.visible = red > .02;
    (eyeGlow.material as T.SpriteMaterial).opacity = red * (.55 + .2 * Math.sin(t * 9)) * (.6 + dread * .6);
    eyeLight.position.copy(eyeGlow.position); eyeLight.target.position.copy(set === 'street' || set === 'relay' ? camera.position : tmp);
    eyeLight.intensity = red * (set === 'street' && s.stage === 'escape' ? 70 : 28);
    audio.set({ jet: jet || P.thrust, sputter: P.sputter > 0 && P.thrust > 0 ? 1 : 0, hum: set === 'street' ? hum : 0, air: set === 'home' ? 0 : 1, calm: set === 'home' ? 1 : 0, dread, near });
    // The chase is darker: the city light drops and the fog closes in.
    const chase = s.stage === 'escape' ? 1 : 0;
    (lights.children[0] as T.HemisphereLight).intensity = T.MathUtils.damp((lights.children[0] as T.HemisphereLight).intensity, 1.3 - chase * .95, 2, dt);
    (lights.children[1] as T.DirectionalLight).intensity = T.MathUtils.damp((lights.children[1] as T.DirectionalLight).intensity, 1.7 - chase * 1.4, 2, dt);
    if (set === 'street' && scene.fog instanceof T.Fog) { scene.fog.far = T.MathUtils.damp(scene.fog.far, chase ? 85 : 190, 2, dt); scene.fog.near = chase ? 6 : 18; scene.fog.color.set(chase ? '#08111a' : '#1a3146'); scene.background = chase ? CHASE_SKY : CITY_SKY; }

    // Camera: Hiro's eyes, or (home, after the crossing) a camera that drifts within each shot.
    hands.root.visible = first;
    if (first) {
      // A jump of more than a stride is a cut (a new set, a dev skip): place him, don't walk him.
      if (fp.feet.distanceTo(feet) > 1.2 || m.thirdShot) place = true;
      if (place) fp.place(feet); else fp.feet.copy(feet);
      fp.update(cam, dt, t, { look, eye, lookRate, pointer: r.pointer, freeLook: reducedMotion ? 0 : freeLook, onStep: (side, speed) => { audio.footstep(side, speed); } });
      hands.update(t, dt, { walk: clamp01(fp.speed / 4.2), gait: fp.gait, raise, reach });
      m.thirdShot = '';
    } else {
      const shot = s.stage === 'boot' || s.stage === 'end' ? s.stage : 'home';
      const cut = shot !== m.thirdShot; m.thirdShot = shot;
      camera.position.lerp(camPos, cut || reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4));
      if (cut) cam.userData.look = look.clone();
      const l = (cam.userData.look as T.Vector3 | undefined) ?? look.clone(); l.lerp(look, cut ? 1 : 1 - Math.exp(-dt * 3)); cam.userData.look = l;
      camera.lookAt(l);
    }
    if (Math.abs(cam.fov - fov) > .01) { cam.fov = place ? fov : T.MathUtils.damp(cam.fov, fov, 3, dt); cam.updateProjectionMatrix(); }
    // Shake: hard on the fall, on near misses and debris, small on each of his footfalls near Hiro.
    m.shake = Math.max(0, m.shake - dt * 1.6);
    if (m.shake > 0 && !reducedMotion) { const a = m.shake * m.shake * .1; camera.position.add(v3(Math.sin(t * 61) * a, Math.sin(t * 73 + 1) * a, Math.sin(t * 57 + 2) * a * .5)); camera.rotateZ(Math.sin(t * 47) * a * .3); }
    // The crossing: the page warps around the surface.
    if (fx.warp.current) fx.warp.current.setAttribute('scale', String(reducedMotion ? 0 : warp * 38));
    if (fx.world.current) fx.world.current.classList.toggle('p6-warping', warp > .01 && !reducedMotion);
    r.dread = dread; r.hiro = [fp.feet.x, fp.feet.z]; r.bay = [baymax.root.position.x, baymax.root.position.z];
    if (set === 'relay') r.gap = baymax.root.position.distanceTo(fp.feet);
    // Hints for the drags, placed over the piece and where it goes.
    const hint = (el: HTMLDivElement | null, p: T.Vector3 | null | undefined, on: boolean) => {
      if (!el) return;
      if (!p) { el.style.opacity = '0'; return; }
      const q = p.clone().project(camera); el.style.opacity = on && q.z < 1 ? '1' : '0';
      el.style.transform = `translate(${(q.x + 1) / 2 * size.width}px, ${(1 - q.y) / 2 * size.height}px)`;
    };
    const st = env.current.street;
    const taking = s.stage === 'limited' && !s.took && e > 9.6;
    const pulling = s.stage === 'carry' && s.chip !== 'out', slotting = s.stage === 'carry' && s.chip === 'out' && now() - s.pulledAt > 4.2, homing = s.stage === 'home' && e > EMERGE + 2.2;
    hint(hints.grab.current, taking ? cart.root.getWorldPosition(new T.Vector3()) : pulling ? baymax.dockWorld() : slotting ? cart.root.getWorldPosition(new T.Vector3()) : homing ? home.care.chip.getWorldPosition(new T.Vector3()) : null, taking || (pulling && s.chip === 'bay' && e > CLUE_END) || (slotting && s.cart === 'hand') || (homing && s.care === 'ground'));
    hint(hints.drop.current, slotting ? st?.readerWorld() : homing ? baymax.dockWorld() : null, (slotting && s.cart === 'held') || (homing && (s.care === 'hand' || s.care === 'open')));
    // The hold steps show their progress in the ring and say what to do (as in Phase 1).
    for (const el of [hints.grab.current, hints.drop.current]) el?.style.setProperty('--hold', homing ? care.current.progress.toFixed(3) : '0');
    if (hints.grab.current) hints.grab.current.dataset.label = homing && s.care === 'ground' ? 'CLICK + HOLD' : '';
    if (hints.drop.current) hints.drop.current.dataset.label = homing ? s.care === 'hand' ? 'CLICK + HOLD' : s.care === 'open' ? 'GUIDE IT IN · OR HOLD E' : '' : '';
    m.lastStage = s.stage;
  });

  return null;
}

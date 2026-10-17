import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { createRedChip } from '../characters/RedChip.js';
import { reducedMotion } from '../config/experience';
import { createBaymax, type Baymax } from './baymax';
import { createHiro } from './hiro';
import { createHandInsert, INSERT, INSERT_CAMERA } from './hand';
import { createRelay, BAYMAX_YARD } from './relay';
import { createStreet, ringLive, ROUTE, ROUTE_LENGTH, FRAME, DECK, LANDING, type Street } from './street';
import { createHome, HOME_GATE, HOME_BAYMAX, CARE_CHIP_AT, type Home } from './home';
import { useP6, go, now, setOf, isInsert, atLeast, type Stage, type SetName } from './store';
import type { PhaseSixAudio } from './audio';

/**
 * The 3D side of Phase 6: one Canvas, three sets (relay, street + gate site, home) and the same
 * Baymax, Hiro and hand close-up moved between them. Every frame reads the stage and how long it
 * has run, poses the actors, and places the camera for that moment.
 */

export type Hints = { grab: RefObject<HTMLDivElement | null>; drop: RefObject<HTMLDivElement | null> };
export type RunState = { p: number; speed: number; forward: boolean; pointer: T.Vector2; impulse: number };

const ease = (x: number) => T.MathUtils.smoothstep(x, 0, 1);
const span = (e: number, a: number, b: number) => ease((e - a) / (b - a));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const backOut = (x: number) => { x = clamp01(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const RED = new T.Color('#ff2414'), DARK = new T.Color('#0b0f11'), CARE = new T.Color('#f4f8ff');
const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const HOVER_Y = 1.15;

export function World({ audio, hints, run, onReady }: { audio: PhaseSixAudio; hints: Hints; run: RefObject<RunState>; onReady: () => void }) {
  const { scene, camera, gl, size } = useThree();
  const cam = camera as T.PerspectiveCamera;
  const stage = useP6(s => s.stage);
  const set: SetName = setOf(stage);
  const [baymax, setBaymax] = useState<Baymax | null>(null);
  const hiro = useMemo(createHiro, []);
  const hand = useMemo(createHandInsert, []);
  // Development only: freeze the close-up at a moment (window.__lastGateHand.play('on', f, f, 1, .5)).
  useEffect(() => { if (import.meta.env.DEV) (window as Window & { __lastGateHand?: typeof hand }).__lastGateHand = hand; }, [hand]);
  useEffect(() => { if (import.meta.env.DEV) (window as Window & { __lastGateWorld?: unknown }).__lastGateWorld = { baymax, hiro, camera, T, gl, scene }; }, [baymax, hiro, camera, gl, scene]);
  const home = useMemo<Home>(createHome, []);
  const chipProxy = useMemo(() => { const c = createRedChip(); c.chip.visible = false; return c; }, []);
  const env = useRef<{ name: SetName; relay?: ReturnType<typeof createRelay>; street?: Street } | null>(null);
  const homeScene = useMemo(() => { const s = new T.Scene(); s.background = home.background; return s; }, [home]);
  const target = useMemo(() => new T.WebGLRenderTarget(4, 4, { colorSpace: T.SRGBColorSpace }), []);
  const homeCam = useMemo(() => new T.PerspectiveCamera(), []);

  // Shared actors, made once for the phase.
  useEffect(() => {
    let alive = true, made: Baymax | null = null;
    createBaymax().then(b => { if (!alive) { b.dispose(); return; } made = b; mem.current.headH = b.headHeight; scene.add(b.root); setBaymax(b); onReady(); });
    scene.add(hiro.root, hand.root, chipProxy.chip);
    return () => {
      alive = false; if (made) made.dispose();
      hiro.dispose(); hand.dispose(); home.dispose(); target.dispose();
      chipProxy.chip.removeFromParent();
      chipProxy.chip.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    };
  }, [scene, hiro, hand, home, chipProxy, target, onReady]);

  // Sets: build the one in use, drop the last one. The home group lives in its own scene (seen
  // through the gate) until the crossing, then joins the main scene.
  useEffect(() => {
    const e: NonNullable<typeof env.current> = { name: set };
    if (set === 'relay') { e.relay = createRelay(); scene.add(e.relay.root); scene.background = new T.Color('#081320'); scene.fog = new T.Fog('#14293b', 14, 150); }
    if (set === 'street') { e.street = createStreet(); scene.add(e.street.root); homeScene.add(home.root); scene.background = new T.Color('#0a1622'); scene.fog = new T.Fog('#1a3146', 18, 190); }
    if (set === 'home') { scene.add(home.root); scene.background = home.background; scene.fog = null; }
    env.current = e;
    return () => { e.relay?.dispose(); e.street?.dispose(); home.root.removeFromParent(); env.current = null; };
  }, [set, scene, home, homeScene]);

  // Lights the sets share: a cool key and fill for the city; the home set brings its own.
  const lights = useMemo(() => {
    const g = new T.Group();
    g.add(new T.HemisphereLight('#9ec6e4', '#0a1420', 1.3));
    const key = new T.DirectionalLight('#bcd9ec', 1.7); key.position.set(-8, 16, 6); g.add(key);
    // The close-up's own key. Every light counts in every lit pixel, so the sets keep to the ones
    // they came with plus this, his jets and his bay.
    const insert = new T.PointLight('#ffe7cf', 1.6, 1.4, 2); insert.position.copy(INSERT).add(v3(.25, .35, .3)); g.add(insert);
    return g;
  }, []);
  useEffect(() => { scene.add(lights); return () => { scene.remove(lights); }; }, [scene, lights]);
  // The home set brings its own key and fill; the relay (whose room is now lit for its consoles) and the street use these.
  useEffect(() => { lights.children.forEach((l, i) => { if (i < 2) l.visible = set !== 'home'; }); }, [set, lights]);

  // Drags: the combat chip from his chest to the socket, the healthcare chip into his chest.
  const drag = useRef({ active: false, pos: new T.Vector3(), plane: new T.Plane(), returning: 0, from: new T.Vector3() });
  useEffect(() => {
    const el = gl.domElement, ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3();
    const screen = (p: T.Vector3) => { const q = p.clone().project(cam); return new T.Vector2((q.x + 1) / 2 * el.clientWidth, (1 - q.y) / 2 * el.clientHeight); };
    const grabbable = () => { const s = useP6.getState(); return (s.stage === 'carry' && s.chip === 'bay') || (s.stage === 'home' && s.care === 'ground' && now() - s.since > 2); };
    const source = () => useP6.getState().stage === 'carry' ? baymax?.dockWorld() : CARE_CHIP_AT.clone();
    const dest = () => { const s = useP6.getState(); return s.stage === 'carry' ? env.current?.street?.socketWorld() : baymax?.dockWorld(); };
    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return new T.Vector2(e.clientX - r.left, e.clientY - r.top); };
    const down = (e: PointerEvent) => {
      if (!grabbable() || e.button !== 0) return;
      const from = source(); if (!from) return;
      if (screen(from).distanceTo(local(e)) > 70) return;
      audio.unlock();
      drag.current.active = true; drag.current.pos.copy(from); drag.current.from.copy(from);
      // Carry on a plane facing the camera, through the midpoint of the chip and where it goes.
      const to = dest() ?? from, mid = from.clone().lerp(to, .5), n = new T.Vector3(); cam.getWorldDirection(n);
      drag.current.plane.setFromNormalAndCoplanarPoint(n.negate(), mid);
      useP6.setState(useP6.getState().stage === 'carry' ? { chip: 'held' } : { care: 'held' });
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) { el.style.cursor = grabbable() && source() && screen(source()!).distanceTo(local(e)) < 70 ? 'grab' : ''; return; }
      el.style.cursor = 'grabbing';
      const l = local(e); ndc.set(l.x / el.clientWidth * 2 - 1, -(l.y / el.clientHeight * 2 - 1)); ray.setFromCamera(ndc, cam);
      if (ray.ray.intersectPlane(drag.current.plane, hit)) drag.current.pos.copy(hit);
    };
    const up = (e: PointerEvent) => {
      if (!drag.current.active) return;
      drag.current.active = false; el.style.cursor = '';
      const to = dest(), s = useP6.getState();
      if (to && screen(to).distanceTo(local(e)) < 90) {
        if (s.stage === 'carry') { useP6.setState({ chip: 'socket' }); audio.seat(); go('bloom'); }
        else { useP6.setState({ care: 'seated' }); audio.seat(); go('seated'); }
      } else { drag.current.returning = 1; useP6.setState(s.stage === 'carry' ? { chip: 'bay' } : { care: 'ground' }); }
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [gl, cam, baymax, audio]);

  // Per-set memory that outlives a stage: where Baymax has got to on the street, step timing, shake.
  const mem = useRef({ trail: .28, stepAt: 0, shake: 0, landed: false, lastStage: '' as Stage | '', shot: '', bayAt: new T.Vector3(), lift: 0, glance: 0, headH: 3.1, careOpenAt: 0 });
  const look = useMemo(() => new T.Vector3(), []);
  const camPos = useMemo(() => new T.Vector3(), []);

  useFrame(({ clock }, delta) => {
    if (!baymax || !env.current || env.current.name !== set) return;
    const dt = Math.min(delta, .05), t = clock.elapsedTime, s = useP6.getState(), e = now() - s.since, m = mem.current;
    const P = baymax.pose, H = hiro.pose;
    if (m.lastStage !== s.stage) {
      if (s.stage === 'drop') m.landed = false;
      if (s.stage === 'escape') { run.current!.p = 0; run.current!.speed = 0; m.trail = -.07; }
      if (s.stage === 'gate') m.trail = .4;
      if (s.stage === 'switchOn1' || s.stage === 'switchOff' || s.stage === 'switchOn2') {
        const mode = s.stage === 'switchOff' ? 'off' : s.stage === 'switchOn2' ? 'onFast' : 'on';
        hand.play(mode, () => { audio.click(); useP6.setState({ regulator: mode !== 'off' }); }, () => go(s.stage === 'switchOn1' ? 'limited' : s.stage === 'switchOff' ? 'flyin' : 'drop'), mode === 'onFast' ? 1.25 : 1);
      } else if (m.lastStage === '' || !isInsert(s.stage)) hand.set(s.regulator);
      m.lastStage = s.stage;
    }
    // Defaults each frame; the stage below sets what it needs.
    Object.assign(P, { sit: 0, lie: 0, lean: .08, guard: 1, punch: 0, hold: 0, stride: 0, dangle: 0, thrust: 0, sputter: 0, open: 0, chipGlow: 0, chipInBay: s.chip === 'bay', careSeated: s.care === 'seated', eyeGlow: 1 });
    P.eyes.copy(RED); P.head[0] = P.head[1] = P.head[2] = 0;
    Object.assign(H, { walk: 0, stride: 0, lean: 0, haul: 0, kneel: 0, reach: 0, look: 0 });
    hiro.root.visible = true;
    let shot = s.stage as string, fov = 46;
    let jet = 0, hum = 0;

    if (set === 'relay') {
      env.current.relay!.update(t, dt);
      baymax.root.position.copy(BAYMAX_YARD); P.yaw = 0;
      hiro.root.position.set(2.55, 0, -.2); H.yaw = Math.PI + .3; H.look = -.25;
      camPos.set(3.5, 1.95, 2.6); look.set(-1.6, 1.7, -11.5);
      if (s.stage === 'wake') {
        // Dark, then a red flicker; he gets up and the stance locks in.
        const flick = e < 1.2 ? 0 : e < 2.6 ? (Math.sin(e * 37) * Math.sin(e * 11.3) > .2 ? 1 : .15) * span(e, 1.2, 1.6) : 1;
        P.eyes.copy(DARK).lerp(RED, flick); P.eyeGlow = flick;
        P.sit = 1 - span(e, 2.6, 4.5); P.guard = backOut((e - 4.4) / .55); P.lean = .08 * P.guard;
        P.head[0] = (1 - P.guard) * .25; P.head[1] = span(e, 1.6, 2.6) * .15;
        camPos.set(3.5 - span(e, 0, 6) * .3, 1.95, 2.6 - span(e, 0, 6) * .6);
        if (e > 4.42 && e < 4.5) { m.shake = Math.max(m.shake, .25); audio.step(.7); }
      } else if (s.stage === 'limited') {
        // Each full move falls short. Thrusters starve, the walk is heavy, the punch stops early.
        const fly = span(e, .8, 2.2) * (1 - span(e, 2.6, 3.2));
        P.thrust = e > .8 && e < 3.2 ? .75 : 0; P.sputter = 1; jet = P.thrust * .7;
        P.dangle = fly; baymax.root.position.y = fly * 1 + Math.sin(t * 9) * .05 * fly;
        if (e > 3.2 && e < 3.26) { m.shake = .3; audio.step(1); }
        const walk = clamp01((e - 3.6) / 3.4);
        baymax.root.position.z = BAYMAX_YARD.z + ease(walk) * 3.3;
        if (e > 3.6 && e < 7) { P.stride = .9; P.lean = .16; const ph = (e - 3.6) / .85 * Math.PI; P.gait = ph; if (Math.floor(ph / Math.PI) !== Math.floor(m.stepAt)) { audio.step(.85); m.shake = Math.max(m.shake, .12); } m.stepAt = ph / Math.PI; }
        // Wind up, a slow drive, stop short with the arm shaking, then pull back.
        P.punch = e < 7 ? 0 : e < 7.6 ? -.3 * span(e, 7, 7.6) : e < 8.7 ? -.3 + 1.05 * Math.sin(Math.PI / 2 * clamp01((e - 7.6) / 1.1)) : .75 * (1 - span(e, 8.9, 9.7));
        if (e > 8.4 && e < 8.9) P.punch += Math.sin(t * 60) * .02;
        P.lean = e > 7.4 && e < 9.2 ? .2 : P.lean;
        camPos.set(3.3, 1.9, 2.2 - span(e, 6.5, 8.4) * .5); look.set(-1.5, 1.6 + span(e, .8, 2) * .4 * (1 - span(e, 3, 4)), -10);
      } else { // switchOn1 shows the close-up; keep his stance behind it.
        P.guard = 1;
      }
      P.head[1] += .12;
    }

    if (set === 'street') {
      const st = env.current.street!;
      const powered = atLeast(s.stage, 'powered') ? 1 : 0;
      const live = ringLive(s.angles);
      let open = 0, flash = 0, socket = s.chip === 'socket' ? 1 : 0;
      hum = powered ? 1 : live.reduce((a, b) => a + b, 0) * .15;
      hiro.root.position.set(DECK.x + .2, DECK.y, DECK.z + .1); H.yaw = Math.PI;

      // Baymax down the street: coming on, slowly, the whole time the frame is being worked.
      const onTrail = (p: number) => { const q = ROUTE.getPointAt(clamp01(p)); const ahead = ROUTE.getPointAt(clamp01(p + .01)); baymax.root.position.set(q.x, 0, q.z); P.yaw = Math.atan2(ahead.x - q.x, ahead.z - q.z); };
      const trudge = (speed: number) => { P.stride = .85; P.gait += dt * speed * 3.6; const step = Math.floor(P.gait / Math.PI); if (step !== m.stepAt) { m.stepAt = step; const d = baymax.root.position.distanceTo(camera.position); audio.step(Math.min(1, 9 / d)); if (d < 14) m.shake = Math.max(m.shake, .08); } };

      if (s.stage === 'escape') {
        const r = run.current!;
        const goal = r.forward ? 4.2 : 0;
        r.speed = T.MathUtils.damp(r.speed, goal + r.impulse * 3.5, 3, dt); r.impulse = Math.max(0, r.impulse - dt * 2.2);
        r.p = clamp01(r.p + r.speed * dt / ROUTE_LENGTH);
        // He closes when Hiro stops and drops back while Hiro runs, never quite reaching him.
        const gap = (r.p - m.trail) * ROUTE_LENGTH;
        const bSpeed = gap > 16 ? 3.6 : gap > 7 ? 2.2 : 0;
        m.trail = Math.min(r.p - 7 / ROUTE_LENGTH, m.trail + bSpeed * dt / ROUTE_LENGTH);
        onTrail(Math.max(0, m.trail)); if (m.trail < 0) baymax.root.position.z = ROUTE.getPointAt(0).z - m.trail * ROUTE_LENGTH;
        if (bSpeed > 0) trudge(bSpeed / 2.2); else P.stride = 0;
        hiro.root.visible = false;
        const pos = ROUTE.getPointAt(r.p); fov = 56;
        const steps = t * r.speed * 2.1, bob = reducedMotion ? 0 : Math.sin(steps * 2) * .04 * Math.min(1, r.speed / 3);
        camPos.set(pos.x, pos.y + bob, pos.z);
        const ahead = ROUTE.getPointAt(Math.min(1, r.p + .05));
        look.copy(ahead).lerp(FRAME, T.MathUtils.smoothstep(r.p, .75, 1));
        // Two glances back over the shoulder, at fixed points on the run.
        const g = [.3, .64].reduce((acc, at) => Math.max(acc, Math.sin(Math.PI * clamp01((r.p - at) / .07))), 0);
        m.glance = T.MathUtils.damp(m.glance, g, 5, dt);
        if (m.glance > .01) { const back = baymax.root.position.clone().setY(2.2); look.lerp(back, m.glance); }
        shot = 'run';
        if (r.p > .985) go('gate');
      } else if (s.stage === 'gate' || s.stage === 'powered') {
        m.trail = Math.min(.62, m.trail + dt * .0035); onTrail(m.trail); trudge(.6);
        H.reach = s.stage === 'gate' ? .55 + Math.sin(t * 1.3) * .05 : .2;
        camPos.set(3.4, 4.3, FRAME.z + 9.6); look.set(-.9, FRAME.y + .1, FRAME.z);
        if (s.stage === 'powered') { camPos.lerp(v3(-.4, FRAME.y + .3, FRAME.z + 4.2), span(e, .6, 3.5)); look.set(0, FRAME.y, FRAME.z); if (e > 4.4) go('choice'); }
        fov = 44;
      } else if (s.stage === 'choice' || s.stage === 'switchOff') {
        m.trail = Math.min(.62, m.trail + dt * .0035); onTrail(m.trail); trudge(.6);
        H.yaw = Math.PI - span(e, 0, 1.4) * Math.PI; H.look = -.1; hiro.root.position.set(DECK.x - .5, DECK.y, DECK.z + .3);
        camPos.set(DECK.x + .9, DECK.y + 1.9, DECK.z - .9); look.set(baymax.root.position.x * .5 - 1.2, 2.4, baymax.root.position.z);
        fov = 40;
      } else if (s.stage === 'flyin' || s.stage === 'faceoff' || s.stage === 'switchOn2') {
        H.yaw = 0;
        // Full power: up above the roofs, down the street, and stop face to face with Hiro.
        // Feet well clear of the paving, his eyes level with Hiro's on the deck.
        const hover = v3(LANDING.x, HOVER_Y, LANDING.z);
        hiro.root.position.z = DECK.z + .3;
        const start = ROUTE.getPointAt(m.trail).setY(0);
        if (s.stage === 'flyin') {
          if (e < .05) m.bayAt.copy(start);
          const rise = span(e, .7, 2.3), travel = span(e, 2.2, 5.2);
          const up = m.bayAt.clone().setY(rise * 9);
          const c1 = up.clone().add(v3(0, 3, -12)), c2 = hover.clone().add(v3(0, 4, 9));
          const q = travel > 0 ? new T.CubicBezierCurve3(up, c1, c2, hover).getPoint(travel) : up;
          baymax.root.position.copy(q);
          P.yaw = Math.PI; P.dangle = 1; P.lean = .35 * Math.sin(Math.PI * travel) + .05; P.guard = 1 - .6 * Math.sin(Math.PI * travel);
          P.thrust = span(e, .1, .7); jet = P.thrust;
          if (e > .1 && e < .16) { audio.ignite(); m.shake = .2; }
          const follow = baymax.root.position.clone().setY(baymax.root.position.y + 2);
          camPos.set(DECK.x + .9, DECK.y + 1.9, DECK.z - .9).lerp(v3(-13, 4.6, -88.4), travel);
          look.copy(follow).lerp(v3(-2.35, 4, -87.4), span(e, 4.4, 6));
          if (e > 6.2) go('faceoff');
          if (travel > .97 && m.lift === 0) { m.lift = 1; st.kickDust(hover.clone().setY(0), .7, 1); }
        } else {
          baymax.root.position.copy(hover).add(v3(0, Math.sin(t * 2.2) * .06, 0));
          P.yaw = Math.PI; P.dangle = 1; P.lean = .05; P.thrust = 1; jet = 1; m.lift = 1;
          // Face to face at eye level: Hiro on the deck, Baymax holding in the air in front of him.
          look.set(-2.35, 4, -87.4);
          camPos.set(-13, 4.6, -88.4);
          if (s.stage === 'faceoff') camPos.lerp(v3(-12, 4.45, -88.2), span(e, 0, 4));
        }
        shot = 'hover';
        fov = 42;
      } else if (s.stage === 'drop') {
        // Thrusters out. He hangs, falls back, and hits the paving.
        const hoverY = HOVER_Y, g = 11.5, hang = .14;
        const tLand = hang + Math.sqrt(2 * Math.max(.3, hoverY) / g);
        const fall = e < hang ? 0 : Math.min(1, ((e - hang) / (tLand - hang)) ** 2);
        const y = e < tLand ? hoverY * (1 - fall) : Math.max(0, Math.sin(Math.min(1, (e - tLand) / .3) * Math.PI) * .07);
        baymax.root.position.set(LANDING.x, y, LANDING.z);
        hiro.root.position.z = DECK.z + .3; H.yaw = 0;
        P.yaw = Math.PI; P.dangle = 1 - fall; P.lie = e < tLand ? fall * .92 : 1; P.guard = .4 * (1 - fall);
        P.thrust = e < .1 ? .6 : 0; P.sputter = 1;
        P.eyes.copy(RED).lerp(DARK, span(e, 1.2, 3)); P.eyeGlow = 1 - span(e, 1.2, 3);
        P.open = clamp01((e - 4) / 2.5) * 4.6; P.chipGlow = span(e, 5.8, 7.4);
        if (!m.landed && e >= tLand) { m.landed = true; m.shake = reducedMotion ? 0 : 1; audio.impact(); st.kickDust(LANDING, 1.4); }
        const cracked = m.landed ? 1 : 0;
        camPos.set(-13, 4.6, -88.4).lerp(v3(-9.5, 3.8, LANDING.z + 4.2), span(e, 1.2, 4.2));
        look.copy(baymax.root.position).setY(e < tLand ? y + 2 : 1.1).lerp(baymax.chestWorld(), span(e, 3.6, 5.5));
        if (e > 7.4) go('carry');
        st.update(t, dt, { angles: s.angles, live, powered, open, flash, cracked, socket });
        return finishFrame();
      } else if (s.stage === 'carry') {
        baymax.root.position.copy(LANDING); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0;
        P.open = 4.6; P.chipGlow = 1;
        hiro.root.position.set(DECK.x + .3, DECK.y, DECK.z + .2); H.yaw = Math.PI * .25;
        camPos.set(5.6, 4.4, -78.2); look.set(-1.6, 1.9, -88);
        fov = 44;
      } else if (s.stage === 'bloom') {
        baymax.root.position.copy(LANDING); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0; P.open = 4.6; P.chipInBay = false;
        open = 1 - Math.pow(1 - span(e, .9, 3.6), 3);
        if (e > .9 && e < .96) { audio.bloom(); }
        const socketAt = st.socketWorld();
        hiro.root.position.set(.15, 0, FRAME.z + 3.6); H.yaw = Math.PI; H.look = 0;
        if (e < 5) {
          // One look at it, the whole thing.
          camPos.set(.9, 1.45, FRAME.z + 7.4).lerp(v3(.75, 1.5, FRAME.z + 6.6), span(e, 0, 5)); look.set(0, FRAME.y - .2, FRAME.z); shot = 'reveal';
        } else if (e < 7.6) {
          // Behind him, Baymax on the ground. Hiro turns round.
          H.yaw = Math.PI - span(e, 5.6, 7.2) * Math.PI;
          camPos.set(LANDING.x - .5, .85, LANDING.z + 4.8); look.set(-.4, 1.2, FRAME.z + 3.6); shot = 'behind';
        } else {
          // He takes his arm and hauls him back, braced, a short step at a time.
          const k = clamp01((e - 7.6) / 10.5), tugs = 11, x = k * tugs, f = x - Math.floor(x);
          const pulled = (Math.floor(x) + Math.min(1, f / .4) ** .7) / tugs;
          const dist = pulled * 9.5;
          baymax.root.position.set(LANDING.x + pulled * 2.3, 0, LANDING.z - dist);
          P.hold = 1;
          const grip = baymax.handWorld();
          hiro.root.position.set(grip.x + .1, 0, grip.z - .62); H.yaw = 0; H.haul = 1;
          H.walk = Math.floor(x) * Math.PI + Math.min(1, f / .4) * Math.PI; H.stride = .3;
          if (f < .05 && e > 7.7) audio.step(.25);
          if (e < 15.6) { camPos.set(7.2, 1.9, LANDING.z + 1.2 - dist * .55); look.set(grip.x - .6, .9, grip.z - .2); shot = 'haul'; }
          else { camPos.set(LANDING.x + 1.6, 1.9, LANDING.z + 4.4 - dist * .5); look.set(0, FRAME.y - .6, FRAME.z); shot = 'cross'; }
          flash = span(e, 16.6, 18);
          hiro.root.visible = hiro.root.position.z > FRAME.z - .1;
        }
        if (e > 18.4) go('home');
        // The chip, seated in the socket, lit.
        chipProxy.chip.visible = true; chipProxy.chip.position.copy(socketAt); chipProxy.chip.quaternion.identity(); chipProxy.chip.scale.setScalar(1.9);
        chipProxy.glow.color.set('#c9a6ff').multiplyScalar(1.6); socket = 1;
        fov = 44;
        renderGate(st, open);
      }
      // The combat chip on its way to the socket.
      if (s.stage === 'carry') {
        chipProxy.chip.visible = s.chip === 'held' || drag.current.returning > 0;
        if (drag.current.returning > 0) { drag.current.returning = Math.max(0, drag.current.returning - dt * 3); drag.current.pos.lerp(baymax.dockWorld(), 1 - Math.exp(-dt * 10)); }
        if (chipProxy.chip.visible) { chipProxy.chip.position.copy(drag.current.pos); chipProxy.chip.lookAt(camera.position); chipProxy.chip.scale.setScalar(1.6); chipProxy.glow.color.set('#ff3a2c').multiplyScalar(2); }
        P.chipInBay = s.chip === 'bay' && drag.current.returning === 0;
      } else if (s.stage !== 'bloom') chipProxy.chip.visible = false;
      st.update(t, dt, { angles: s.angles, live, powered, open, flash, cracked: atLeast(s.stage, 'carry') ? 1 : 0, socket });
      if (s.stage !== 'flyin') m.lift = s.stage === 'faceoff' || s.stage === 'switchOn2' ? 1 : 0;
    }

    if (set === 'home') {
      chipProxy.chip.visible = false;
      home.update(t, dt, { gate: s.stage === 'home' ? 1 - span(e, .6, 3.2) : 0, careBlink: s.care === 'seated' ? 0 : 1 });
      baymax.root.position.copy(HOME_BAYMAX); P.yaw = Math.PI; P.lie = 1; P.guard = 0; P.eyes.copy(DARK); P.eyeGlow = 0; P.open = 4.6; P.chipInBay = false;
      hiro.root.position.set(HOME_BAYMAX.x - 2.6, 0, HOME_BAYMAX.z + 1.6); H.yaw = Math.PI / 2; H.kneel = 1; H.look = -.2;
      camPos.set(6.4, 3.5, 5.2); look.set(-.7, .8, 2.9); fov = 44;
      const care = home.care.chip;
      if (s.care !== 'seated') {
        if (s.care === 'held') { care.position.copy(drag.current.pos); care.lookAt(camera.position); care.scale.setScalar(1.6); }
        else if (drag.current.returning > 0) { drag.current.returning = Math.max(0, drag.current.returning - dt * 3); drag.current.pos.lerp(CARE_CHIP_AT, 1 - Math.exp(-dt * 10)); care.position.copy(drag.current.pos); }
        else { care.position.copy(CARE_CHIP_AT); care.rotation.set(-Math.PI / 2, 0, .6); care.scale.setScalar(1); }
        home.careLight.position.copy(care.position).add(v3(0, .25, 0));
        if (s.stage === 'home') { camPos.set(3, 3.8, 11.5).lerp(v3(6.4, 3.5, 5.2), span(e, 0, 3.5)); look.set(-.5, .8, 1.5).lerp(v3(-.7, .8, 2.9), span(e, 0, 3.5)); H.kneel = span(e, .8, 2.4); H.reach = .3 * span(e, 2, 3); }
      } else {
        if (care.parent !== baymax.dock) { baymax.dock.add(care); care.position.set(0, 0, .004); care.rotation.set(0, 0, 0); care.scale.setScalar(1); }
        P.careSeated = true;
        if (s.stage === 'boot' || s.stage === 'end') {
          const be = s.stage === 'end' ? 20 : e;
          // The bay closes; he sits up, slowly; his eyes come on soft white with the chime;
          // then the head tilt toward Hiro.
          P.open = 4.6 * (1 - span(be, 0, 1.6));
          P.lie = 1 - span(be, 1.9, 4.4); P.sit = span(be, 1.9, 4.4);
          P.eyes.copy(DARK).lerp(CARE, span(be, 4.8, 5.8)); P.eyeGlow = span(be, 4.8, 5.8) * .25;
          if (s.stage === 'boot' && be > 4.9 && be < 4.97) audio.chime();
          P.head[2] = span(be, 6.4, 8.2) * .3; P.head[1] = span(be, 6.4, 8.2) * .4; P.head[0] = -span(be, 6.4, 8.2) * .08;
          // Hiro moves round beside him as he sits up.
          hiro.root.position.set(HOME_BAYMAX.x - 2.5, 0, HOME_BAYMAX.z - .6); H.yaw = Math.PI / 2 - .3; H.kneel = 1; H.look = .15;
          // In front of him: his face, and Hiro beside him.
          camPos.set(1.2, 2.9, -5.4).lerp(v3(.4, 2.8, -4.6), span(be, 2, 9)); look.set(-1.5, 2.2, 2.4);
          // The end: pulled back in front of the two of them, the bay behind.
          if (s.stage === 'end') { camPos.set(3.4, 2.4, -9.5); look.set(-1.4, 2.4, 2.4); }
          shot = s.stage;
          if (s.stage === 'boot' && be > 10) go('end');
          H.reach = 0;
        }
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
    finishFrame();

    function finishFrame() {
      baymax!.update(t); hiro.update();
      // The close-up only exists while it is on screen.
      hand.root.visible = isInsert(s.stage); if (hand.root.visible) hand.update(t);
      audio.set({ jet: jet || P.thrust, sputter: P.sputter > 0 && P.thrust > 0 ? 1 : 0, hum: set === 'street' ? hum : 0, air: set === 'home' ? 0 : 1, calm: set === 'home' ? 1 : 0 });
      // Camera: the close-up cuts in; shots cut on change and drift within themselves.
      if (isInsert(s.stage)) { camPos.copy(INSERT).add(INSERT_CAMERA.pos); look.copy(INSERT).add(INSERT_CAMERA.look); fov = 30; shot = 'insert'; }
      const cut = shot !== m.shot; m.shot = shot;
      const k = cut || reducedMotion ? 1 : 1 - Math.exp(-dt * (shot === 'run' ? 12 : 2.4));
      camera.position.lerp(camPos, k);
      if (cut) cam.userData.look = look.clone();
      const l = (cam.userData.look as T.Vector3 | undefined) ?? look.clone(); l.lerp(look, cut ? 1 : 1 - Math.exp(-dt * (shot === 'run' ? 8 : 3))); cam.userData.look = l;
      camera.lookAt(l);
      if (shot === 'run') { const r = run.current!; camera.rotateY(-r.pointer.x * .45 * (1 - m.glance)); camera.rotateX(-r.pointer.y * .2 * (1 - m.glance)); }
      if (Math.abs(cam.fov - fov) > .01) { cam.fov = cut ? fov : T.MathUtils.damp(cam.fov, fov, 3, dt); cam.updateProjectionMatrix(); }
      // Shake: hard on the fall, small on each footfall near him.
      m.shake = Math.max(0, m.shake - dt * 1.6);
      if (m.shake > 0 && !reducedMotion && !isInsert(s.stage)) { const a = m.shake * m.shake * .12; camera.position.add(v3(Math.sin(t * 61) * a, Math.sin(t * 73 + 1) * a, Math.sin(t * 57 + 2) * a * .5)); camera.rotateZ(Math.sin(t * 47) * a * .3); }
      // Hints for the drags, placed over the chip and its destination.
      const hint = (el: HTMLDivElement | null, p: T.Vector3 | null | undefined, on: boolean) => {
        if (!el) return;
        if (!p) { el.style.opacity = '0'; return; }
        const q = p.clone().project(camera); el.style.opacity = on && q.z < 1 ? '1' : '0';
        el.style.transform = `translate(${(q.x + 1) / 2 * size.width}px, ${(1 - q.y) / 2 * size.height}px)`;
      };
      const carrying = s.stage === 'carry', homing = s.stage === 'home' && e > 2.2;
      hint(hints.grab.current, carrying ? baymax!.dockWorld() : homing ? home.care.chip.getWorldPosition(new T.Vector3()) : null, (carrying && s.chip === 'bay') || (homing && s.care === 'ground'));
      hint(hints.drop.current, carrying ? env.current!.street?.socketWorld() : homing ? baymax!.dockWorld() : null, (carrying && s.chip === 'held') || (homing && s.care === 'held'));
    }
  });

  return null;
}


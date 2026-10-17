import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { SceneKit, seeded, type Pose } from '../phase2/SceneKit';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { reducedMotion } from '../config/experience';
import { enterServiceBay } from './entry';
import './walk.css';

/**
 * Between the board and Bay 6: Hiro leaves Baymax and walks the corrupted city, following the
 * one thing still alive in it, a service cable whose current runs toward Bay 6. Same world as
 * every earlier phase (slate architecture, cyan haze, displaced blocks, the fracture skyline);
 * the route ends at the maintenance yard's gate, where the bay itself (ServiceBay) picks up.
 */

const EYE = 1.62, GATE_Z = -64;
const PATH = new T.CatmullRomCurve3([
  [0, EYE, 8], [.8, EYE, -4], [-1, EYE, -16], [-.6, EYE, -28], [.9, EYE, -40], [0, EYE, -50], [0, EYE, -56],
].map(([x, y, z]) => new T.Vector3(x, y, z)), false, 'centripetal');
const LENGTH = PATH.getLength();
const PIPE_Z = -29;
const LINES: [number, string][] = [
  [0, 'I need something that slows him down.'],
  [.1, 'That cable’s still live.'],
  [.52, 'It’s feeding something up ahead.'],
  [.93, 'Bay 6. Robotics maintenance.'],
];

type WalkState = { p: number; speed: number; forward: boolean; back: boolean; pointer: T.Vector2; impulse: number };

function buildStreet() {
  const k = new SceneKit('walk-street');
  const random = seeded(6061);
  const rand = (a: number, b: number) => a + random() * (b - a);

  // Ground: the service lane, with slabs heaved by the displacement.
  k.box({ p: [0, -.3, -30], s: [13, .6, 84] }, k.edge);
  k.box({ p: [0, .01, -30], s: [12.4, .04, 83.4] }, k.concrete);
  const marks: Pose[] = []; for (let i = 0; i < 22; i++) marks.push({ p: [-.15, .04, 8 - i * 3.4], s: [.1, .02, 1.5] });
  k.instances(marks, k.metal);
  for (const [x, z, rx, rz] of [[-3.8, -12, .14, .1], [4.1, -23, -.12, -.16], [-4.4, -37, .1, -.08], [3.6, -47, -.16, .12]]) k.box({ p: [x, .1, z], s: [3.2, .22, 3.6], r: [rx, rand(-.3, .3), rz] }, k.concrete);
  // Kerbs and broken barriers.
  for (const side of [-1, 1]) for (let z = 6; z > -60; z -= 5.5) if (random() > .25) k.box({ p: [side * 5.9, .32, z], s: [.45, .65, rand(2.2, 4)], r: [0, 0, side * rand(0, .05)] }, k.ivory);

  // Buildings: the same slate blocks with window rows; some sheared, rotated or lifted.
  for (const side of [-1, 1]) {
    for (let z = 4; z > -60; z -= rand(6.5, 8.5)) {
      const w = rand(4, 6.5), h = rand(8, 19), d = rand(5, 7), x = side * (7.4 + w / 2 + rand(0, 1.2));
      const tilt = side * rand(-.05, .07);
      k.box({ p: [x, h / 2 - .05, z], s: [w, h, d], r: [0, side * rand(-.06, .06), tilt] }, random() > .5 ? k.ivory : k.concrete);
      const win: Pose[] = [];
      for (let r = 1; r < h / 1.7 - 1; r++) for (let c = 0; c < 3; c++) win.push({ p: [x - side * (w / 2 + .02), r * 1.7, z - d / 3 + c * d / 3], s: [.03, .9, 1], r: [0, 0, tilt] });
      k.instances(win, k.dim);
      // Dimensional damage: an upper slice of the block turned out of register.
      if (random() > .62) k.box({ p: [x, h + rand(1.2, 3), z + rand(-1, 1)], s: [w * .9, rand(2, 4), d * .9], r: [rand(-.2, .2), rand(-.6, .6), rand(-.25, .25)] }, k.ivory);
    }
  }
  // Floating fragments held over the street.
  for (let i = 0; i < 9; i++) k.box({ p: [rand(-9, 9), rand(9, 18), rand(-55, 0)], s: [rand(.6, 2.4), rand(.3, 1), rand(.6, 2)], r: [rand(0, 3), rand(0, 3), rand(0, 3)] }, k.concrete);

  // The fallen service pipe Hiro ducks under halfway.
  k.box({ p: [0, 2.05, PIPE_Z], s: [14, .45, .45], r: [0, .12, -.09] }, k.metal);
  k.box({ p: [-6.2, 1, PIPE_Z - .4], s: [.4, 2.4, .4], r: [0, 0, .5] }, k.metal);

  // Signage: bilingual, a few surviving lights. Two point toward Bay 6.
  const signs: [string, number, number, string][] = [
    ['保守区画 BAY 6  →  220 m', -3.6, -9, '#8fe9ff'], ['港湾サービス / HARBOUR SERVICE', 3.9, -18, '#ff9a63'], ['BAY 6  ロボ整備  →  80 m', -3.7, -42, '#8fe9ff'],
  ];
  for (const [text, x, z, color] of signs) {
    k.box({ p: [x, 1.6, z], s: [.12, 3.2, .12] }, k.metal);
    // Boards face up the street, so they read as Hiro walks toward them.
    k.box({ p: [x - Math.sign(x) * 1.5, 3.25, z], s: [3.6, .55, .08] }, k.dark);
    k.label(text, { p: [x - Math.sign(x) * 1.5 + .25, 3.22, z + .05] }, 3.8, color);
  }
  // Street lamps: two dead, two still warm.
  const lamps: T.Vector3[] = [];
  for (const [x, z, live] of [[5.3, -6, true], [-5.3, -20, false], [5.3, -36, true], [-5.3, -50, false]] as [number, number, boolean][]) {
    k.box({ p: [x, 2.6, z], s: [.14, 5.2, .14], r: [0, 0, Math.sign(x) * .04] }, k.metal);
    k.box({ p: [x - Math.sign(x) * .6, 5.15, z], s: [1.3, .1, .1] }, k.metal);
    k.mesh(new T.SphereGeometry(.13, 12, 10), live ? k.basic('#ffc062', 1.6) : k.dark, { p: [x - Math.sign(x) * 1.2, 5.05, z] });
    if (live) lamps.push(new T.Vector3(x - Math.sign(x) * 1.2, 4.9, z));
  }

  // Bay 6: the maintenance yard's gate, the same facade the district search opens on.
  const gate = new T.Group(); gate.position.set(0, 0, GATE_Z); k.root.add(gate);
  k.box({ p: [0, 2.05, -.15], s: [11.2, 4.1, .6] }, k.concrete, gate);
  k.box({ p: [0, 1.55, .2], s: [5.2, 3.1, .08] }, k.dark, gate);
  for (const x of [-4.25, 4.25]) k.box({ p: [x, 1.85, .2], s: [2.2, 3.7, .2] }, k.metal, gate);
  k.box({ p: [0, 3.84, .22], s: [10.8, .38, .28] }, k.metal, gate);
  k.box({ p: [-4.4, 2.4, .36], s: [1.5, .38, .12] }, k.basic('#b18b5d', 1), gate);
  k.mesh(new T.BoxGeometry(3.8, .22, .05), k.basic('#d0b98e', 1.2), { p: [0, 3.55, .42] }, gate);
  k.label('BAY 6 · ROBOTICS MAINTENANCE  ロボ整備 第6', { p: [.9, 4.42, .4] }, 7.4, '#e8cf9c', gate);
  for (const x of [-2.6, 2.6]) k.box({ p: [x, .9, .1], s: [.08, 1.3, .08], r: [0, 0, -.26] }, k.metal, gate);
  k.haze({ p: [0, 1.6, GATE_Z + .35], s: [6, 3.6, 1] }, '#ffb066', .28);

  return { kit: k, lamps };
}

/** The live service cable: lies along the kerb, current pulsing toward Bay 6. */
function buildCable() {
  const points: T.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, p = PATH.getPointAt(t), tangent = PATH.getTangentAt(t);
    const side = new T.Vector3(-tangent.z, 0, tangent.x).normalize();
    points.push(p.clone().addScaledVector(side, 3.2).setY(.09 + Math.max(0, Math.sin(i * 1.7)) * .03));
  }
  // Up the gate pylon and into the yard.
  points.push(new T.Vector3(3.2, .09, -60), new T.Vector3(3.4, .2, GATE_Z + 1), new T.Vector3(3.3, 1.6, GATE_Z + .45), new T.Vector3(2.6, 2.4, GATE_Z + .45));
  const material = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float uTime;void main(){float band=pow(max(0.,sin((vUv.x*46.-uTime*2.2)*3.14159)),18.);vec3 base=vec3(.05,.07,.08);vec3 hot=vec3(1.,.66,.32);gl_FragColor=vec4(base+hot*(.18+band*1.8),1.);}',
  });
  const mesh = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 600, .045, 8, false), material);
  return { mesh, material };
}

function WalkWorld({ state, onProgress }: { state: React.MutableRefObject<WalkState>; onProgress: (p: number) => void }) {
  const { camera, scene } = useThree();
  const street = useMemo(buildStreet, []);
  const cable = useMemo(buildCable, []);
  const skyline = useMemo(() => {
    const city = createPortalDimension();
    city.group.position.set(0, -6, -128); city.group.scale.setScalar(1.3);
    city.group.traverse(o => { o.castShadow = false; });
    return city;
  }, []);
  const look = useMemo(() => new T.Vector3(), []), ahead = useMemo(() => new T.Vector3(), []), gate = useMemo(() => new T.Vector3(0, 2, GATE_Z), []);
  const steps = useRef(0), reported = useRef(-1);

  useEffect(() => {
    scene.add(street.kit.root, cable.mesh, skyline.group);
    return () => { scene.remove(street.kit.root, cable.mesh, skyline.group); street.kit.dispose(); cable.mesh.geometry.dispose(); cable.material.dispose(); skyline.dispose(); };
  }, [scene, street, cable, skyline]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .05), t = clock.elapsedTime, s = state.current;
    skyline.update(t, dt, reducedMotion, 0, 'approaching');
    cable.material.uniforms.uTime.value = t;
    // Walk: held input sets a pace, a scroll adds a step; the path is the only way.
    const goal = s.forward ? 3.3 : s.back ? -1.4 : 0;
    s.speed = T.MathUtils.damp(s.speed, goal + s.impulse * 3.5, 3, dt); s.impulse = Math.max(0, s.impulse - dt * 2.2);
    s.p = T.MathUtils.clamp(s.p + s.speed * dt / LENGTH, 0, 1);
    steps.current += Math.abs(s.speed) * dt * 2.1;
    const pos = PATH.getPointAt(s.p);
    const bob = reducedMotion ? 0 : Math.sin(steps.current * 2) * .035 * Math.min(1, Math.abs(s.speed) / 2.5);
    const duck = Math.exp(-Math.pow((pos.z - PIPE_Z) / 1.6, 2)) * .5;
    camera.position.set(pos.x + (reducedMotion ? 0 : Math.sin(steps.current) * .025), pos.y + bob - duck, pos.z);
    // Look down the route; near the end, the gate takes over. The pointer turns the head.
    PATH.getPointAt(Math.min(1, s.p + .05), ahead);
    look.lerp(ahead.lerp(gate, T.MathUtils.smoothstep(s.p, .8, 1)), 1 - Math.exp(-dt * 4));
    if (look.lengthSq() === 0) look.copy(ahead);
    camera.lookAt(look);
    camera.rotateY(-s.pointer.x * .5); camera.rotateX(-s.pointer.y * .22);
    const rounded = Math.round(s.p * 100);
    if (rounded !== reported.current) { reported.current = rounded; onProgress(s.p); }
  });

  return <>
    <color attach="background" args={['#0a1622']} />
    <fog attach="fog" args={['#1a3146', 18, 170]} />
    <hemisphereLight args={['#9ec6e4', '#0a1420', 1.4]} />
    <directionalLight position={[-8, 16, 6]} intensity={1.8} color="#bcd9ec" />
    <pointLight position={[0, 2.2, GATE_Z + 1.2]} intensity={14} distance={18} color="#ffae5e" />
    {street.lamps.map((p, i) => <pointLight key={i} position={p} intensity={5} distance={11} color="#ffc062" />)}
  </>;
}

export function Walk() {
  const state = useRef<WalkState>({ p: 0, speed: 0, forward: false, back: false, pointer: new T.Vector2(), impulse: 0 });
  const [progress, setProgress] = useState(0);
  const [moved, setMoved] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const said = useRef(new Set<number>());
  const arrived = progress > .985;
  // Development only: lets tooling place Hiro along the route (window.__lastGateWalk.p = 0..1).
  useEffect(() => { if (import.meta.env.DEV) (window as Window & { __lastGateWalk?: WalkState }).__lastGateWalk = state.current; }, []);

  useEffect(() => {
    for (const [at, text] of LINES) if (progress >= at && !said.current.has(at)) { said.current.add(at); setLine(text); }
  }, [progress]);
  useEffect(() => { if (!line) return; const t = window.setTimeout(() => setLine(null), 3600); return () => window.clearTimeout(t); }, [line]);

  const enter = () => {
    if (leaving) return; setLeaving(true);
    // Build the bay behind the fade so it's ready when the gate opens.
    window.setTimeout(() => { void import('./ServiceBay'); void import('./bayScene').then(m => m.prepareServiceBay()); }, 150);
    window.setTimeout(() => enterServiceBay(), reducedMotion ? 50 : 1100);
  };

  useEffect(() => {
    const s = state.current, fwd = ['KeyW', 'ArrowUp', 'Space'], back = ['KeyS', 'ArrowDown'];
    const down = (e: KeyboardEvent) => {
      if (fwd.includes(e.code)) { e.preventDefault(); s.forward = true; setMoved(true); }
      if (back.includes(e.code)) { e.preventDefault(); s.back = true; }
      if ((e.code === 'KeyE' || e.code === 'Enter') && s.p > .985) enter();
    };
    const up = (e: KeyboardEvent) => { if (fwd.includes(e.code)) s.forward = false; if (back.includes(e.code)) s.back = false; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); if (e.deltaY > 0) { s.impulse = Math.min(1.4, s.impulse + .45); setMoved(true); } };
    const move = (e: PointerEvent) => s.pointer.set((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2);
    const press = (e: PointerEvent) => { if (e.button === 0 && !(e.target as HTMLElement).closest('button')) { s.forward = true; setMoved(true); } };
    const release = () => { s.forward = false; };
    const blur = () => { s.forward = false; s.back = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointermove', move); window.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', press); window.removeEventListener('pointerup', release); window.removeEventListener('blur', blur);
    };
  });

  const metres = Math.max(0, Math.round((1 - progress) * LENGTH + (0 - GATE_Z - 56)));
  return <main className={`walk ${leaving ? 'walk-leaving' : ''}`} aria-label="Phase 4: the walk to Bay 6">
    <div className="walk-world"><Canvas dpr={[1, 1.4]} camera={{ fov: 54, near: .1, far: 460, position: [0, EYE, 8] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <WalkWorld state={state} onProgress={setProgress} />
    </Canvas></div>
    <div className="walk-grade" aria-hidden="true" />
    <header className="walk-brand"><span>The Last Gate</span><small>Phase 4 · North service district</small></header>
    <div className="walk-objective" role="status"><span>FOLLOW THE LIVE CABLE</span><b>Bay 6 <i>·</i> {metres} m</b></div>
    {line && <p className="walk-line" key={line} role="status"><small>HIRO</small>{line}</p>}
    {!moved && !arrived && <p className="walk-hint">HOLD <b>W</b> · SPACE · OR THE MOUSE TO WALK <i>·</i> SCROLL TO STEP</p>}
    {arrived && <button className="walk-enter" onClick={enter}>Enter Bay 6 <i>→</i></button>}
    <p className="sr-only">Hold W, Space or the mouse button to walk along the street, or scroll to step. Move the pointer to look around. At the gate, press Enter or E, or select Enter Bay 6.</p>
  </main>;
}

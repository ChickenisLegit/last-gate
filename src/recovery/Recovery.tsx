import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box3, CircleGeometry, Group, Mesh, MeshBasicMaterial, PointLight, Vector3 } from 'three';
import { assets } from '../systems/AssetManager';
import { mountChestBay } from '../characters/ChestBay';
import { createDistrict, type District } from './district';
import { journeyExtension, type JourneyWorld } from './journey';
import type { RecoveryStage } from './state';
import { reducedMotion } from '../config/experience';
import './recovery.css';

const damp = (current: Vector3, target: Vector3, lambda: number, dt: number) =>
  current.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-lambda * dt));

/** Landing composition: the lane on the left for the title, Baymax lying in the bay on the right. */
const LANDING_POS = new Vector3(-1.8, 3.1, 5.6), LANDING_LOOK = new Vector3(-.8, -.1, -4.6);

/** Shared, mutable intent the camera reads each frame without re-registering useFrame. */
/** Dev shortcut: ?recovery=journey skips the landing, as if START JOURNEY had been pressed. */
const DEV_JOURNEY = import.meta.env.DEV && new URLSearchParams(location.search).get('recovery') === 'journey';

type Intent = { stage: RecoveryStage; drag: boolean; yaw: number; pitch: number; lastX: number; lastY: number };

function Scene({ intent, journey, onReady, onError }: {
  intent: React.MutableRefObject<Intent>; journey: boolean; onReady: () => void; onError: () => void;
}) {
  const { camera, scene } = useThree();
  const district = useMemo<District>(createDistrict, []);
  const [world, setWorld] = useState<JourneyWorld | null>(null);
  const redLight = useRef<PointLight | null>(null);
  const camPos = useRef(district.stops[0].pos.clone());
  const camLook = useRef(district.stops[0].look.clone());
  const tmp = useRef(new Vector3());
  const look = useRef(new Vector3());
  const extension = journeyExtension();

  useEffect(() => {
    scene.add(district.group);
    let alive = true, mounted: JourneyWorld | null = null;
    assets.cloneBaymax().then(model => {
      if (!alive) return;
      // Unfold the seated legs, then lay the damaged shell on its back by the robotics bay.
      const meshes: Mesh[] = []; model.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; meshes.push(n); } });
      for (const side of [-1, 1]) {
        const hip = new Group(); hip.name = side < 0 ? 'hip-left' : 'hip-right'; hip.position.set(side * .53, .55, .28); model.add(hip); model.updateMatrixWorld(true);
        for (const mesh of meshes) {
          const p = mesh.position, sx = side * p.x;
          const thigh = Math.abs(sx - .57) < .06 && Math.abs(p.y - .48) < .06;
          const foot = Math.abs(sx - .71) < .06 && (Math.abs(p.y - .26) < .06 || Math.abs(p.y - .04) < .06) && p.z > 1.2;
          if (thigh || foot) hip.attach(mesh);
        }
        hip.rotation.x = 1.45;
      }
      model.rotation.order = 'YXZ';
      model.rotation.set(-Math.PI / 2, -.5, -.08);
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model);
      const center = bounds.getCenter(new Vector3());
      const a = district.baymaxAnchor;
      model.position.set(a.x - center.x, -1.22 - bounds.min.y, a.z - center.z);
      model.updateMatrixWorld(true);
      // Re-align from the transformed bounds so the soft shell cannot hover after rotation.
      const contactBounds = new Box3().setFromObject(model);
      model.position.y += -1.22 - contactBounds.min.y;
      // Keep the collapsed shell visibly grounded even when the landing camera settles in.
      const contactShadow = new Mesh(new CircleGeometry(1.85, 48), new MeshBasicMaterial({ color: '#02070b', transparent: true, opacity: .4, depthWrite: false, depthTest: false }));
      contactShadow.name = 'Baymax contact shadow';
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(a.x, -1.04, a.z);
      contactShadow.scale.set(1.55, .72, 1);
      contactShadow.renderOrder = 2;
      district.group.add(contactShadow);
      model.updateMatrixWorld(true);
      // The exact Phase 1 chest bay, closed over the seated combat chip.
      const bay = mountChestBay(model);
      // A faint, unstable red through the seam — the combat chip is still running.
      const rl = new PointLight('#ff3626', .9, 4, 1.8); rl.position.set(.42, 2.2, .9); model.add(rl); redLight.current = rl;
      scene.add(model);
      mounted = { baymax: model, bay, district };
      setWorld(mounted);
      onReady();
    }).catch(() => { if (alive) onError(); });
    return () => { alive = false; mounted?.bay.dispose(); mounted?.baymax.removeFromParent(); district.dispose(); };
  }, [district, scene, onReady, onError]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .05), time = clock.elapsedTime, i = intent.current;
    district.update(time, dt, reducedMotion);
    if (world && !(journey && extension)) world.bay.update({ t: time, open: 0, seated: 1, red: .9, seamGlow: .12 });
    if (redLight.current && !(journey && extension)) redLight.current.intensity = (.6 + .4 * Math.sin(time * 2.1)) * .6;
    // Once a journey extension takes over, it owns the camera.
    if (journey && extension) return;

    let lambda = 1.6;
    if (i.stage === 'arrive') {
      camPos.current.copy(district.stops[0].pos); camLook.current.copy(district.stops[0].look);
    } else if (i.stage === 'landing') {
      camPos.current.copy(LANDING_POS); camLook.current.copy(LANDING_LOOK);
      // Idle drift keeps the frame alive; drag looks around without leaving the composition.
      if (!reducedMotion) { camPos.current.x += Math.sin(time * .21) * .08; camPos.current.y += Math.cos(time * .17) * .05; }
      tmp.current.copy(camLook.current).sub(camPos.current);
      const x = tmp.current.x, z = tmp.current.z;
      tmp.current.x = x * Math.cos(i.yaw) - z * Math.sin(i.yaw); tmp.current.z = x * Math.sin(i.yaw) + z * Math.cos(i.yaw); tmp.current.y += i.pitch * 4;
      camLook.current.copy(camPos.current).add(tmp.current);
    } else if (world) {
      // No next phase on this branch: settle on Baymax's chest and hold.
      world.bay.chestNormal(tmp.current);
      const dock = world.bay.dockWorld();
      camPos.current.copy(dock).addScaledVector(tmp.current, 2.4); camPos.current.y += .6;
      camLook.current.copy(dock); lambda = 1.2;
    }
    damp(camera.position, camPos.current, lambda, dt);
    damp(look.current, camLook.current, lambda * 1.4, dt);
    camera.lookAt(look.current);
  });

  return world && journey && extension ? <extension.Scene world={world} /> : null;
}

export function Recovery() {
  const [stage, setStage] = useState<RecoveryStage>('arrive');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const extension = journeyExtension();
  const intent = useRef<Intent>({ stage, drag: false, yaw: 0, pitch: 0, lastX: 0, lastY: 0 });
  useEffect(() => { intent.current.stage = stage; }, [stage]);

  // Arrival: let the place breathe before the landing title appears.
  useEffect(() => {
    if (stage !== 'arrive' || !ready) return;
    const timer = window.setTimeout(() => setStage(DEV_JOURNEY ? 'journey' : 'landing'), DEV_JOURNEY || reducedMotion ? 300 : 3800);
    return () => window.clearTimeout(timer);
  }, [stage, ready]);

  const callbacks = useMemo(() => ({ ready: () => setReady(true), error: () => setError(true) }), []);
  const startJourney = () => { Object.assign(intent.current, { yaw: 0, pitch: 0 }); setStage('journey'); };

  // Drag-look on the landing only; the journey's own workspace takes input after that.
  useEffect(() => {
    const el = document.querySelector('.recovery-world') as HTMLElement | null; if (!el || stage !== 'landing') return;
    const down = (e: PointerEvent) => { intent.current.drag = true; intent.current.lastX = e.clientX; intent.current.lastY = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!intent.current.drag) return;
      const dx = (e.clientX - intent.current.lastX) / window.innerWidth, dy = (e.clientY - intent.current.lastY) / window.innerHeight;
      intent.current.lastX = e.clientX; intent.current.lastY = e.clientY;
      intent.current.yaw = Math.max(-.35, Math.min(.35, intent.current.yaw - dx * 1.2));
      intent.current.pitch = Math.max(-.12, Math.min(.18, intent.current.pitch - dy * .8));
    };
    const up = () => { intent.current.drag = false; };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); intent.current.drag = false; };
  }, [stage]);

  const journeyRunning = stage === 'journey' && !!extension;
  return (
    <main className={`recovery stage-${stage} ${journeyRunning ? 'journey-live' : ''}`} aria-label="The Last Gate" data-state="BAYMAX_RECOVERY">
      <div className="recovery-world">
        <Canvas shadows camera={{ position: [.4, 1.75, 9], fov: 46, near: .1, far: 120 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <Scene intent={intent} journey={stage === 'journey'} onReady={callbacks.ready} onError={callbacks.error} />
        </Canvas>
      </div>
      <div className="recovery-grade" aria-hidden="true" />
      <div className="recovery-arrival" aria-hidden="true" />

      {/* The landing page: the 3D city is the hero; the title and one action sit on the left. */}
      <header className={`recovery-title ${stage === 'arrive' ? '' : 'shown'}`} aria-hidden={stage === 'arrive'}>
        <h1>THE LAST GATE</h1>
        {stage === 'landing' && <button className="recovery-start" onClick={startJourney}>START JOURNEY</button>}
      </header>

      {stage === 'arrive' && (
        <section className="recovery-orient">
          {!ready && <p className="recovery-loading" role="status">Recovering signal…</p>}
          {ready && <p className="recovery-whisper">Another street. The same broken city.</p>}
        </section>
      )}

      {stage === 'journey' && !extension && (
        <section className="recovery-found">
          <p className="recovery-line" role="status"><small>HIRO</small>Baymax…</p>
        </section>
      )}
      {journeyRunning && extension && <extension.Overlay />}

      {stage !== 'journey' && <p className="recovery-signal" aria-hidden="true">SIGNAL RECOVERED · SAN FRANSOKYO / HARBOUR</p>}
      {error && <div className="recovery-error" role="alert">Baymax could not be loaded. <button onClick={() => location.reload()}>Reload</button></div>}
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { assets } from '../systems/AssetManager';
import { mountChestBay, type ChestBay } from '../characters/ChestBay';
import { createDistrict, type District } from './district';
import { reducedMotion } from '../config/experience';
import './recovery.css';

type Stage = 'arrive' | 'explore' | 'discover' | 'approach' | 'engineering';
type Tool = 'core' | 'power' | 'shell';
type CoreTarget = 'healthcare' | 'combat' | null;

const damp = (current: Vector3, target: Vector3, lambda: number, dt: number) =>
  current.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-lambda * dt));

/** Shared, mutable intent the camera director reads each frame without re-registering useFrame. */
type Intent = {
  stage: Stage; stopIndex: number; tool: Tool; target: CoreTarget; powerFixed: boolean;
  drag: boolean; yaw: number; pitch: number; lastX: number; lastY: number;
};

function Scene({ intent, onReady, onError, onDiscover }: {
  intent: React.MutableRefObject<Intent>; onReady: () => void; onError: () => void; onDiscover: () => void;
}) {
  const { camera, gl, scene } = useThree();
  const district = useMemo<District>(createDistrict, []);
  const bay = useRef<ChestBay | null>(null);
  const shell = useRef<Group | null>(null);
  const redLight = useRef<PointLight | null>(null);
  const powerLight = useRef<PointLight | null>(null);
  const connector = useRef<Mesh | null>(null);
  const camPos = useRef(district.stops[0].pos.clone());
  const camLook = useRef(district.stops[0].look.clone());
  const open = useRef(0);
  const connectorSeat = useRef(0);
  const discovered = useRef(false);
  const tmp = useRef(new Vector3());
  const tmpN = useRef(new Vector3());

  useEffect(() => {
    scene.add(district.group);
    let alive = true;
    assets.cloneBaymax().then(model => {
      if (!alive) return;
      // Unfold the seated legs, then lay the damaged shell on its back by the robotics bay.
      const meshes: Mesh[] = []; model.traverse(n => { if (n instanceof Mesh) meshes.push(n); });
      for (const side of [-1, 1]) {
        const hip = new Group(); hip.position.set(side * .53, .55, .28); model.add(hip); model.updateMatrixWorld(true);
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
      model.position.set(a.x - center.x, -1.0 - bounds.min.y, a.z - center.z);
      model.updateMatrixWorld(true);
      // Mount the exact Phase 1 chest bay + seated combat chip, re-skinned to match.
      bay.current = mountChestBay(model);
      // A faint, unstable red from the combat chip — the only warm-red in the scene.
      const rl = new PointLight('#ff3626', 1.4, 5, 1.8); rl.position.set(.42, 2.2, .9); model.add(rl); redLight.current = rl;
      // The loose charge connector and its unstable cyan light, beside the bay.
      const pl = new PointLight('#7fd4ff', 0, 4, 2); pl.position.set(.95, 2.0, .62); model.add(pl); powerLight.current = pl;
      const conn = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#4a5a66', metalness: .7, roughness: .4 })); conn.position.set(.78, 2.1, .72); conn.scale.set(.05, .05, .12); model.add(conn); connector.current = conn;
      scene.add(model); shell.current = model;
      onReady();
    }).catch(() => { if (alive) onError(); });
    return () => { alive = false; bay.current?.dispose(); district.dispose(); };
  }, [district, scene, onReady, onError]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .05), time = clock.elapsedTime, i = intent.current;
    district.update(time, dt, reducedMotion);

    // --- Camera target by stage ---
    let lambda = 2.2;
    if (i.stage === 'arrive' || i.stage === 'explore') {
      const stop = district.stops[Math.min(i.stopIndex, district.stops.length - 1)];
      tmp.current.copy(stop.pos);
      // Idle drift keeps the frame alive while Hiro takes the place in.
      if (!reducedMotion) { tmp.current.x += Math.sin(time * .3) * .05; tmp.current.y += Math.cos(time * .24) * .04; }
      camPos.current.copy(tmp.current);
      // Drag look: offset the look point around the camera.
      tmpN.current.copy(stop.look).sub(stop.pos);
      const yaw = i.yaw, pitch = i.pitch;
      const x = tmpN.current.x, z = tmpN.current.z;
      tmpN.current.x = x * Math.cos(yaw) - z * Math.sin(yaw);
      tmpN.current.z = x * Math.sin(yaw) + z * Math.cos(yaw);
      tmpN.current.y += pitch;
      camLook.current.copy(stop.pos).add(tmpN.current);
      lambda = 3;
      // Discovery: reaching the corner reveals Baymax beyond the collapsed gantry.
      if (i.stopIndex >= district.stops.length - 1 && !discovered.current) { discovered.current = true; onDiscover(); }
    } else if (i.stage === 'discover') {
      // Settle toward Baymax.
      camPos.current.copy(district.stops[2].pos);
      if (shell.current && bay.current) { bay.current.chestWorld(tmp.current); camLook.current.lerp(tmp.current.setY(tmp.current.y + .1), reducedMotion ? 1 : 1 - Math.exp(-2.6 * dt)); }
      lambda = 2.4;
    } else if ((i.stage === 'approach' || i.stage === 'engineering') && bay.current) {
      // Frame the chest along its own surface normal; the city stays behind Baymax.
      const dock = bay.current.dockWorld();
      bay.current.chestNormal(tmpN.current);
      const focusPower = i.stage === 'engineering' && i.tool === 'power';
      const dist = focusPower ? 1.5 : i.tool === 'shell' ? 2.6 : 1.15;
      tmp.current.copy(dock).addScaledVector(tmpN.current, dist);
      tmp.current.y += i.tool === 'shell' ? .5 : .28;
      tmp.current.x += focusPower ? .5 : i.target === 'combat' ? -.12 : i.target === 'healthcare' ? .12 : 0;
      // Gentle drag orbit in engineering.
      tmp.current.x += Math.sin(i.yaw) * .4; tmp.current.y += i.pitch * .4;
      camPos.current.copy(tmp.current);
      camLook.current.copy(dock);
      lambda = i.stage === 'approach' ? 2.4 : 3.2;
    }
    damp(camera.position, camPos.current, lambda, dt);
    // Smooth the look point itself for weight.
    camera.lookAt(camLook.current);

    // --- Chest bay reveal: opens once the program core is the focus. ---
    const wantOpen = (i.stage === 'engineering' && (i.tool === 'core' || i.tool === 'power')) ? 1 : 0;
    open.current += (wantOpen - open.current) * (reducedMotion ? 1 : Math.min(1, dt * 1.3));
    if (bay.current) bay.current.update({ t: time, open: open.current * 4.6, seated: 1, red: .9, seamGlow: .2 * open.current });
    if (redLight.current) redLight.current.intensity = (.6 + .4 * Math.sin(time * 2.1)) * (.4 + open.current);

    // --- Optional power repair: the connector seats and the charge light steadies. ---
    if (powerLight.current) {
      const unstable = reducedMotion ? .7 : .4 + .6 * Math.abs(Math.sin(time * 9));
      powerLight.current.intensity = i.powerFixed ? 2.2 : 1.1 * unstable * (i.tool === 'power' && i.stage === 'engineering' ? 1 : 0);
    }
    connectorSeat.current += ((i.powerFixed ? 1 : 0) - connectorSeat.current) * Math.min(1, dt * 4);
    if (connector.current) {
      connector.current.position.set(.78 + connectorSeat.current * .17, 2.1 - connectorSeat.current * .1, .72 - connectorSeat.current * .1);
      if (!reducedMotion && connectorSeat.current < .98) connector.current.rotation.z = Math.sin(time * 11) * .06 * (1 - connectorSeat.current);
    }
  });

  return null;
}

export function Recovery() {
  const [stage, setStage] = useState<Stage>('arrive');
  const [stopIndex, setStopIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [tool, setTool] = useState<Tool>('core');
  const [found, setFound] = useState<Set<CoreTarget>>(new Set());
  const [target, setTarget] = useState<CoreTarget>(null);
  const [powerFixed, setPowerFixed] = useState(false);
  const [notes, setNotes] = useState('');
  const brandSeen = stage === 'discover' || stage === 'approach' || stage === 'engineering';

  const intent = useRef<Intent>({ stage, stopIndex, tool, target, powerFixed, drag: false, yaw: 0, pitch: 0, lastX: 0, lastY: 0 });
  useEffect(() => { Object.assign(intent.current, { stage, stopIndex, tool, target, powerFixed }); }, [stage, stopIndex, tool, target, powerFixed]);

  // Arrival: let the place breathe before exploration is offered.
  useEffect(() => {
    if (stage !== 'arrive') return;
    const timer = window.setTimeout(() => setStage('explore'), reducedMotion ? 400 : 4600);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const callbacks = useMemo(() => ({ ready: () => setReady(true), error: () => setError(true) }), []);
  const onDiscover = useMemo(() => () => setStage(s => (s === 'explore' ? 'discover' : s)), []);

  const moveCloser = () => { if (stage === 'explore') setStopIndex(i => Math.min(i + 1, 2)); };
  const approach = () => { setStage('approach'); window.setTimeout(() => setStage('engineering'), reducedMotion ? 300 : 1500); };
  const selectTarget = (t: Exclude<CoreTarget, null>) => { setTarget(t); setFound(prev => new Set(prev).add(t)); };
  const bothFound = found.has('healthcare') && found.has('combat');

  // Pointer drag-look (exploration + engineering orbit); keyboard move; wheel disabled.
  useEffect(() => {
    const el = document.querySelector('.recovery-world') as HTMLElement | null; if (!el) return;
    const down = (e: PointerEvent) => { intent.current.drag = true; intent.current.lastX = e.clientX; intent.current.lastY = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!intent.current.drag) return;
      const dx = (e.clientX - intent.current.lastX) / window.innerWidth, dy = (e.clientY - intent.current.lastY) / window.innerHeight;
      intent.current.lastX = e.clientX; intent.current.lastY = e.clientY;
      intent.current.yaw = Math.max(-.6, Math.min(.6, intent.current.yaw - dx * 1.6));
      intent.current.pitch = Math.max(-.4, Math.min(.5, intent.current.pitch - dy * 1.4));
    };
    const up = () => { intent.current.drag = false; };
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,button')) return;
      if (['KeyW', 'ArrowUp', 'KeyE', 'Space'].includes(e.code)) { e.preventDefault(); moveCloser(); }
    };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); };
  }, [stage]);

  const statusLine = stage === 'engineering'
    ? (bothFound ? 'PHYSICAL REPAIR POSSIBLE · BEHAVIORAL RESTORATION UNAVAILABLE' : powerFixed ? 'CHEST POWER STABILISED' : 'BAYMAX · UNRESPONSIVE · ASSESSMENT IN PROGRESS')
    : 'SIGNAL RECOVERED · SAN FRANSOKYO / HARBOUR';

  return (
    <main className={`recovery stage-${stage}`} aria-label="Last Gate — Baymax recovery" data-state="BAYMAX_RECOVERY">
      <div className="recovery-world">
        <Canvas shadows camera={{ position: [.4, 1.75, 9], fov: 46, near: .1, far: 120 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <Scene intent={intent} onReady={callbacks.ready} onError={callbacks.error} onDiscover={onDiscover} />
        </Canvas>
      </div>
      <div className="recovery-grade" aria-hidden="true" />
      <div className="recovery-arrival" aria-hidden="true" />

      {/* Subtle identity — appears only once Baymax is found, never a website hero. */}
      <header className={`recovery-brand ${brandSeen ? 'shown' : ''}`} aria-hidden={!brandSeen}>
        THE LAST GATE<span>San Fransokyo · Harbour service district</span>
      </header>

      {/* Arrival / exploration prompts */}
      {(stage === 'arrive' || stage === 'explore') && (
        <section className="recovery-orient">
          {!ready && <p className="recovery-loading" role="status">Recovering signal…</p>}
          {ready && stage === 'arrive' && <p className="recovery-whisper">Another street. The same broken city.</p>}
          {ready && stage === 'explore' && <>
            <p className="recovery-hint" role="status">Drag to look · <b>W</b> or the control below to move</p>
            <button className="recovery-move" onClick={moveCloser} disabled={stopIndex >= 2}>{stopIndex >= 2 ? 'LOOKING…' : 'MOVE CLOSER ▸'}</button>
          </>}
        </section>
      )}

      {/* Discovery: quiet reaction, no giant text */}
      {stage === 'discover' && (
        <section className="recovery-found">
          <p className="recovery-line" role="status"><small>HIRO</small>Baymax…</p>
          <button className="recovery-approach" onClick={approach}>APPROACH BAYMAX ▸</button>
        </section>
      )}

      {/* Engineering interface — assembled around the same physical Baymax */}
      {stage === 'engineering' && (
        <>
          <nav className="eng-rail" aria-label="Subsystems">
            <p className="eng-rail-head">BAYMAX<span>RECOVERY</span></p>
            {(['core', 'power', 'shell'] as Tool[]).map(item => (
              <button key={item} aria-pressed={tool === item} onClick={() => setTool(item)}>
                <b>{item === 'core' ? 'Program core' : item === 'power' ? 'Chest power' : 'Outer shell'}</b>
                <span>{item === 'core' ? 'Chip bay' : item === 'power' ? 'Charge line' : 'Damage survey'}</span>
              </button>
            ))}
          </nav>

          <aside className="eng-tool" aria-label="Current task">
            {tool === 'core' && <>
              <p className="eng-eyebrow">Program core</p>
              <h1>Chip bay</h1>
              <p className="eng-body">The access bay is open. Inspect what Hiro left inside after the fight.</p>
              <div className="eng-targets">
                <button aria-pressed={target === 'healthcare'} onClick={() => selectTarget('healthcare')}>
                  <b>Healthcare slot</b>{found.has('healthcare') && <em>NOT DETECTED</em>}
                </button>
                <button aria-pressed={target === 'combat'} onClick={() => selectTarget('combat')}>
                  <b>Combat chip</b>{found.has('combat') && <em className="red">ACTIVE</em>}
                </button>
              </div>
              {target === 'healthcare' && <p className="eng-read">HEALTHCARE MODULE<br /><span>NOT DETECTED</span></p>}
              {target === 'combat' && <p className="eng-read">COMBAT PROGRAM<br /><span className="red">ACTIVE</span></p>}
              {bothFound && <p className="eng-verdict">Physical repair possible.<br /><span>Behavioral restoration unavailable.</span></p>}
            </>}
            {tool === 'power' && <>
              <p className="eng-eyebrow">Chest power</p>
              <h1>Charge line</h1>
              <p className="eng-body">A connector beside the bay has shaken loose. The chest light is unstable.</p>
              <button className="eng-action" disabled={powerFixed} onClick={() => setPowerFixed(true)}>{powerFixed ? 'CONNECTOR SEATED ✓' : 'SEAT CONNECTOR'}</button>
              {powerFixed && <p className="eng-read">CHEST POWER<br /><span>STABILISED</span></p>}
            </>}
            {tool === 'shell' && <>
              <p className="eng-eyebrow">Outer shell</p>
              <h1>Damage survey</h1>
              <p className="eng-body">Impact scoring and scorching across the armour. Structure holds; nothing to seal here yet.</p>
            </>}
            <label className="eng-notes">Field notes
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record what you notice…" rows={3} />
            </label>
          </aside>

          <footer className="eng-status" role="status" aria-live="polite">{statusLine}</footer>
        </>
      )}

      {stage !== 'engineering' && <p className="recovery-signal" aria-hidden="true">{statusLine}</p>}
      {error && <div className="recovery-error" role="alert">Baymax could not be loaded. <button onClick={() => location.reload()}>Reload</button></div>}
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box3, CanvasTexture, Group, Mesh, Vector3 } from 'three';
import { assets } from '../systems/AssetManager';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { SceneKit } from '../phase2/SceneKit';
import { reducedMotion } from '../config/experience';
import './recovery.css';

type Focus = 'overview' | 'shell' | 'chest';
const observations: Record<Focus, {title: string; detail: string}> = {
  overview: {title: 'Baymax is unresponsive', detail: 'He came through the rupture. No pursuit response is visible. His armour and outer shell show damage from the confrontation.'},
  shell: {title: 'Outer shell', detail: 'Impact damage is visible around the armour. A closer inspection is needed before anything can be moved safely.'},
  chest: {title: 'Chest access', detail: 'The combat chip is still inside. The access bay remains closed. No override or repair has been attempted.'},
};
function District({workspace, focus, onReady, onError}: {workspace: boolean; focus: Focus; onReady: () => void; onError: () => void}) {
  const city = useMemo(() => createPortalDimension(), []);
  const landmarks = useMemo(() => {
    const k = new SceneKit('Harbour service district');
    k.label('SAN FRANSOKYO / HARBOUR\nSERVICE ROAD  /  通行止', {p: [-4, 3, -9], r: [0, .2, -.15]}, 4);
    k.box({p: [-4, 1.4, -9.1], s: [.12, 3, .12], r: [0, 0, -.15]}, k.metal);
    // A derailed streetcar and a fallen service gantry distinguish this district.
    k.box({p: [3.9, .8, -15], s: [2.5, 2.1, 6], r: [.05, -.24, -.2]}, k.concrete);
    for (let i = 0; i < 4; i++) k.box({p: [2.55, 1.2, -13-i*1.2], s: [.05, .65, .8]}, k.dim);
    k.box({p: [-2, .3, -12], s: [6, .25, .3], r: [0, .3, -.07]}, k.metal);
    return k;
  }, []);
  const contactShadow = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,.55)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  const [model, setModel] = useState<Group | null>(null);
  const target = useMemo(() => new Vector3(), []);
  const look = useRef(new Vector3(0, .8, -4));
  useEffect(() => {
    let alive = true;
    assets.cloneBaymax().then(shell => {
      if (!alive) return;
      // Unfold the seated legs before laying the damaged shell on its back.
      const meshes: Mesh[] = [];
      shell.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
      for (const side of [-1, 1]) {
        const hip = new Group();
        hip.position.set(side*.53, .55, .28);
        shell.add(hip);
        shell.updateMatrixWorld(true);
        for (const mesh of meshes) {
          const p = mesh.position, sx = side*p.x;
          const thigh = Math.abs(sx-.57)<.06 && Math.abs(p.y-.48)<.06;
          const foot = Math.abs(sx-.71)<.06 && (Math.abs(p.y-.26)<.06 || Math.abs(p.y-.04)<.06) && p.z>1.2;
          if (thigh || foot) hip.attach(mesh);
        }
        hip.rotation.x = 1.45;
      }
      shell.name = 'Baymax / damaged recovery';
      shell.position.set(0, 0, 0);
      shell.rotation.order = 'YXZ';
      shell.rotation.set(-Math.PI / 2, -.35, -.08);
      // Disable residual combat lights without changing the cached source model.
      shell.traverse(node => { if (node.type === 'PointLight' || node.type === 'Sprite') node.visible = false; });
      shell.updateMatrixWorld(true);
      const bounds = new Box3();
      shell.traverseVisible(node => {
        if (!(node instanceof Mesh)) return;
        bounds.union(new Box3().setFromObject(node, true));
      });
      const center = bounds.getCenter(new Vector3());
      shell.position.set(-center.x, -.12-bounds.min.y, -4-center.z);
      setModel(shell); onReady();
    }).catch(() => {if (alive) onError();});
    return () => {alive = false;};
  }, [onReady, onError]);
  useEffect(() => () => {city.dispose(); landmarks.dispose(); contactShadow.dispose();}, [city, landmarks, contactShadow]);
  useFrame(({camera, clock}, delta) => {
    const dt = Math.min(delta, .05);
    city.update(clock.elapsedTime, dt, reducedMotion, 0, 'approaching');
    const close = workspace;
    target.set(close ? -1 : 1.2, close ? (focus === 'chest' ? 3.1 : 4.3) : 2.7, close ? .5 : 8);
    camera.position.lerp(target, reducedMotion ? 1 : 1-Math.exp(-dt*1.8));
    target.set(close ? 1.4 : 0, .8, -4);
    look.current.lerp(target, reducedMotion ? 1 : 1-Math.exp(-dt*2));
    camera.lookAt(look.current);
  });
  return <>
    <color attach="background" args={['#101c31']} /><fogExp2 attach="fog" args={['#253e59', .023]} />
    <group position={[0, 0, 7]}> <primitive object={city.group} /></group>
    <primitive object={landmarks.root} />
    <hemisphereLight args={['#b6d9ec', '#172132', 2]} /><directionalLight position={[-3, 8, 5]} intensity={1.5} color="#c3e7f5" />
    <mesh position={[0, -.125, -4]} rotation={[-Math.PI/2, 0, 0]} scale={[1, 1.5, 1]}><planeGeometry args={[4, 4]} /><meshBasicMaterial map={contactShadow} transparent depthWrite={false} /></mesh>
    {model && <primitive object={model} dispose={null} />}
  </>;
}
export function Recovery() {
  const [workspace, setWorkspace] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(false);
  const [focus, setFocus] = useState<Focus>('overview');
  const [notes, setNotes] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const callbacks = useMemo(() => ({ready: () => setReady(true), error: () => setError(true)}), []);
  useEffect(() => {if (workspace) heading.current?.focus();}, [workspace]);
  return <main className={`recovery ${workspace ? 'workspace' : ''}`} aria-label="Last Gate — Baymax recovery" data-state="BAYMAX_RECOVERY">
    <div className="recovery-world"><Canvas camera={{position: [1.2, 2.7, 8], fov: 49}} dpr={[1, 1.5]} gl={{antialias: true}}><District workspace={workspace} focus={focus} onReady={callbacks.ready} onError={callbacks.error} /></Canvas></div>
    <div className="recovery-arrival" aria-hidden="true" />
    <header className="recovery-brand">LAST GATE <span>San Fransokyo · Harbour district</span></header>
    {!workspace && <section className="recovery-entry"><p>He made it through.</p><h1>Baymax.</h1><p>Another street. The same broken city.<br />For the first time, he isn’t moving toward you.</p><button disabled={!ready} onClick={() => setWorkspace(true)}>{ready ? 'Approach Baymax' : 'Locating Baymax…'}</button></section>}
    {workspace && <aside className="recovery-panel" aria-label="Engineering workspace"><p className="recovery-eyebrow">Engineering workspace</p><h1 ref={heading} tabIndex={-1}>Baymax / initial inspection</h1><p className="recovery-status">Unresponsive · Assessment pending</p><nav aria-label="Inspection views">{(['overview', 'shell', 'chest'] as Focus[]).map(item => <button key={item} aria-pressed={focus === item} onClick={() => setFocus(item)}>{item === 'overview' ? 'Overview' : item === 'shell' ? 'Outer shell' : 'Chest access'}</button>)}</nav><section aria-live="polite"><h2>{observations[focus].title}</h2><p>{observations[focus].detail}</p></section><label className="recovery-notes">Field notes<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Record what you notice…" rows={4} /></label><p className="recovery-footnote">Visual observations only. Notes stay here until this page is closed.</p><button className="recovery-back" onClick={() => setWorkspace(false)}>Return to street view</button></aside>}
    {error && <div className="recovery-error" role="alert">Baymax could not be loaded. <button onClick={() => location.reload()}>Reload</button></div>}
  </main>;
}

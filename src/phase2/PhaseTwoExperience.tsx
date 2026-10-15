import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace } from 'three';
import { PhaseTwoDirector, type EntryStage, type Stage } from './model';
import { PhaseTwoRuntime } from './PhaseTwoRuntime';
import { PhaseTwoAudio } from './PhaseTwoAudio';
import { enterFracturePhase } from './entry';
import './phase-two.css';

const DevPanel = import.meta.env.DEV ? lazy(() => import('./PhaseTwoDebug')) : null;
const CHAPTERS: Record<Stage, [string, string]> = {
  fracture: ['11', 'THE FRACTURE'], afterimage: ['12', 'AFTERIMAGE'], build: ['13', 'PROJECT LATTICE'],
  lattice: ['13', 'AFTERIMAGE / ONLINE'], hunt: ['14', 'FALLING CITY'], descent: ['14', 'MODEL INCOMPLETE'],
  null: ['15', 'NULL CHAMBER'], ready: ['15', 'NULL CHAMBER'],
};

function PhaseScene({ director, audio }: { director: PhaseTwoDirector; audio: PhaseTwoAudio }) {
  const { gl, scene, camera, size, setDpr } = useThree();
  const runtime = useRef<PhaseTwoRuntime | null>(null);
  useEffect(() => {
    runtime.current = new PhaseTwoRuntime(gl, scene, camera as PerspectiveCamera, director, audio, setDpr);
    if (import.meta.env.DEV) (window as Window & { __latticePhaseII?: unknown }).__latticePhaseII = { director, gl };
    return () => { runtime.current?.dispose(); runtime.current = null; if (import.meta.env.DEV) delete (window as Window & { __latticePhaseII?: unknown }).__latticePhaseII; };
  }, [gl, scene, camera, director, audio, setDpr]);
  useEffect(() => { runtime.current?.resize(size.width, size.height); }, [size]);
  useFrame((_, dt) => runtime.current?.update(dt), 1);
  return null;
}

export function PhaseTwoExperience({ entry }: { entry: EntryStage }) {
  const director = useMemo(() => new PhaseTwoDirector(entry), [entry]);
  const audio = useMemo(() => new PhaseTwoAudio(), []);
  const snapshot = useSyncExternalStore(director.subscribe, director.getSnapshot);
  const [sound, setSound] = useState(false), [audioError, setAudioError] = useState(false), [error, setError] = useState('');
  const [number, chapter] = CHAPTERS[snapshot.stage];
  useEffect(() => () => { audio.dispose(); director.dispose(); }, [audio, director]);
  const toggleSound = async () => { try { await audio.setEnabled(!sound); setSound(!sound); setAudioError(false); } catch { setAudioError(true); } };
  return <main className={`phase-two p2-${snapshot.stage}`} aria-label="Project Lattice, Phase II: Afterimage">
    <div className="p2-world"><Canvas dpr={1} camera={{ fov: 51, near: .08, far: 340, position: [0, 2.1, 10] }} gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }} onCreated={({ gl }) => { gl.info.autoReset = false; gl.domElement.setAttribute('aria-label', 'Interactive dimensional environment'); gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setError('The graphics context was lost. Reload to restore the dimension.'); }); }}><PhaseScene director={director} audio={audio} /></Canvas></div>
    <div className="p2-bars" aria-hidden="true" /><div className="p2-identity" aria-hidden="true"><span>PROJECT <i>//</i> LATTICE</span><small>PHASE II <b>{number}</b></small></div>
    <button className="p2-audio" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute dimensional ambience' : 'Enable dimensional ambience'}><span className={sound ? 'p2-wave enabled' : 'p2-wave'} aria-hidden="true"><i /><i /><i /><i /></span>{audioError ? 'AUDIO UNAVAILABLE' : sound ? 'SOUND ON' : 'SOUND OFF'}</button>
    <div className="p2-chapter" key={snapshot.stage} aria-hidden="true"><small>{number} <i>/</i> UNKNOWN COORDINATES</small><span>{chapter}</span></div>
    {snapshot.model > 0 && <div className="p2-model" aria-label={`Dimensional model ${snapshot.model} percent`}><span>DIMENSION MODEL</span><b>{String(snapshot.model).padStart(2, '0')}<small>%</small></b><i style={{ '--model': `${snapshot.model}%` } as CSSProperties} /></div>}
    <div className="p2-subtitle" role="status" aria-live="polite">{snapshot.caption && <p key={snapshot.caption}><small>HIRO</small>{snapshot.caption}</p>}</div><div className="p2-telemetry" key={snapshot.message} aria-live="polite">{snapshot.message}</div>
    {snapshot.stage === 'descent' && <div className="p2-requirement"><span>MODEL INCOMPLETE</span><small>HIGH-ENERGY DISPLACEMENT REQUIRED</small></div>}
    {snapshot.action && <button className="p2-action" onClick={() => director.act()} onPointerDown={() => { director.recording = true; }} onPointerUp={() => { director.recording = false; }} onPointerLeave={() => { director.recording = false; }}>{snapshot.action}</button>}
    {snapshot.stage === 'build' && <span className="p2-rotate">Q / R ROTATE <i>SCROLL TO TURN</i></span>}{snapshot.stage === 'ready' && <button className="p2-replay" onClick={enterFracturePhase}>REPLAY PHASE II <span>↻</span></button>}
    {error && <div className="p2-error"><p>{error}</p><button onClick={() => location.reload()}>RECONNECT</button></div>}
    <p className="sr-only">Desktop experience. Point at the stable line to scan, or press E. Assemble three physical components by dragging them together, or press E for magnetic assistance. In Falling City press W or scroll to move forward. Focus on the attack scar or hold E to record it, then press E to follow it. The final scene ends with Baymax preparing his maximum attack.</p>
    {DevPanel && <Suspense fallback={null}><DevPanel director={director} /></Suspense>}
  </main>;
}

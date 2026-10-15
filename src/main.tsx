import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { enterFracturePhase, usePhaseTwoEntry } from './phase2/entry';
import { PhaseTwoHost } from './phase2/PhaseTwoHost';
import { enterFinalPhase, getDebugFinalStage, useFinalEntry } from './scenes/final/entry';
import { useSceneState } from './state/SceneStateManager';
import { Failure } from './ui/Failure';
import './ui/experience.css';

const Experience = lazy(() => import('./experience/ExperienceDirector').then(module => ({ default: module.ExperienceDirector })));
const FinalPhase = lazy(() => import('./scenes/final/FinalPhase').then(module => ({ default: module.FinalPhase })));

function supportsWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class AppBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error
      ? <Failure message="The experience could not start." detail="Reload to try again. If the problem continues, try a recent browser with hardware acceleration enabled." />
      : this.props.children;
  }
}

function DesktopGate() {
  const [supported, setSupported] = useState(innerWidth >= 1280);
  const [debugStage, setDebugStage] = useState(() => getDebugFinalStage(location.hash));
  const phase = useSceneState(state => state.phase);
  const phaseTwoEntry = usePhaseTwoEntry();
  const finalEntry = useFinalEntry();

  useEffect(() => {
    const resize = () => setSupported(innerWidth >= 1280);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const hash = () => setDebugStage(getDebugFinalStage(location.hash));
    window.addEventListener('hashchange', hash);
    return () => window.removeEventListener('hashchange', hash);
  }, []);

  useEffect(() => {
    if (phase !== 'handoff' || finalEntry.active || debugStage) return;
    const timer = window.setTimeout(enterFracturePhase, 6500);
    return () => window.clearTimeout(timer);
  }, [phase, finalEntry.active, debugStage]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const skipPhase = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.code !== 'KeyM') return;
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();

      if (debugStage) {
        window.dispatchEvent(new Event('lattice:skip-phase'));
        return;
      }
      if (finalEntry.active) {
        window.dispatchEvent(new Event('lattice:skip-phase'));
        return;
      }
      if (phaseTwoEntry.active) {
        enterFinalPhase();
        return;
      }

      const current = useSceneState.getState();
      if (current.phase === 'loading') return;
      if (current.phase === 'handoff') {
        enterFracturePhase();
        return;
      }
      const redWakePhases = ['booting', 'diagnostic', 'corrupting', 'threat', 'ignition', 'chase', 'fracture', 'pulled'];
      if (redWakePhases.includes(current.phase)) {
        useSceneState.setState({ chapter: 'THE_FRACTURE', phase: 'handoff', subtitle: '' });
        return;
      }
      useSceneState.setState({ chapter: 'RED_WAKE', phase: 'booting', subtitle: '' });
    };
    window.addEventListener('keydown', skipPhase);
    return () => window.removeEventListener('keydown', skipPhase);
  }, [debugStage, finalEntry.active, phaseTwoEntry.active]);

  if (!supported) {
    return <main className="desktop-required"><p>PROJECT <span>//</span> LATTICE</p><h1>DESKTOP EXPERIENCE</h1><span>1280PX+ DISPLAY REQUIRED</span></main>;
  }

  const finalStage = debugStage ?? (finalEntry.active ? finalEntry.initialStage : null);
  return <AppBoundary>
    <Suspense fallback={<main className="boot" role="status">LOADING EXPERIENCE…</main>}>
      {finalStage
        ? <FinalPhase key={`${finalEntry.run}-${finalStage}`} initialStage={finalStage} />
        : <PhaseTwoHost><Experience /></PhaseTwoHost>}
    </Suspense>
    {import.meta.env.DEV && <div className="phase-skip-hint" aria-hidden="true">CTRL + M <span>//</span> SKIP PHASE</div>}
  </AppBoundary>;
}

function App() {
  if (!supportsWebGL()) {
    return <Failure message="WebGL is unavailable or disabled." detail="This experience needs WebGL 2. Enable hardware acceleration or try a recent browser." />;
  }
  return <DesktopGate />;
}

createRoot(document.getElementById('root')!).render(<App />);

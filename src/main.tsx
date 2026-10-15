import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { useSceneState } from './state/SceneStateManager';
import { Failure } from './ui/Failure';
import './ui/experience.css';

const Experience = lazy(() => import('./experience/ExperienceDirector').then(module => ({ default: module.ExperienceDirector })));

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

  useEffect(() => {
    const resize = () => setSupported(innerWidth >= 1280);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const skipPhase = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.code !== 'KeyM') return;
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();

      // Phase 1 is the whole of this branch: the handoff card is where it ends.
      const current = useSceneState.getState();
      if (current.phase === 'loading' || current.phase === 'handoff') return;
      const redWakePhases = ['booting', 'diagnostic', 'corrupting', 'threat', 'ignition', 'chase', 'fracture', 'pulled'];
      if (redWakePhases.includes(current.phase)) {
        useSceneState.setState({ chapter: 'THE_FRACTURE', phase: 'handoff', subtitle: '' });
        return;
      }
      useSceneState.setState({ chapter: 'RED_WAKE', phase: 'booting', subtitle: '' });
    };
    window.addEventListener('keydown', skipPhase);
    return () => window.removeEventListener('keydown', skipPhase);
  }, []);

  if (!supported) {
    return <main className="desktop-required"><p>LAST GATE</p><h1>DESKTOP EXPERIENCE</h1><span>1280PX+ DISPLAY REQUIRED</span></main>;
  }

  return <AppBoundary>
    <Suspense fallback={<main className="boot" role="status">LOADING EXPERIENCE…</main>}>
      <Experience />
    </Suspense>
  </AppBoundary>;
}

function App() {
  if (!supportsWebGL()) {
    return <Failure message="WebGL is unavailable or disabled." detail="This experience needs WebGL 2. Enable hardware acceleration or try a recent browser." />;
  }
  return <DesktopGate />;
}

createRoot(document.getElementById('root')!).render(<App />);

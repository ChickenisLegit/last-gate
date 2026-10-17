import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePhaseSixEntry } from './entry';

const PhaseSix = lazy(() => import('./PhaseSix').then(module => ({ default: module.PhaseSix })));
const COVER: CSSProperties = { position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', background: '#05090d', color: '#89a5b5', font: '11px "IBM Plex Mono", monospace', letterSpacing: '.24em' };

/** Phase 6 takes over once Hiro goes after the signal; earlier phases render until then. */
export function PhaseSixHost({ children }: { children: ReactNode }) {
  const { active, step, run } = usePhaseSixEntry();
  if (!active) return children;
  return <Suspense fallback={<div role="status" style={COVER}>BAYMAX IS MOVING…</div>}><PhaseSix key={run} initial={step} /></Suspense>;
}

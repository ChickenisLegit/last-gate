import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePhaseFiveEntry } from './entry';

const PhaseFive = lazy(() => import('./PhaseFive').then(module => ({ default: module.PhaseFive })));
const COVER: CSSProperties = { position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', background: '#05090d', color: '#89a5b5', font: '11px "IBM Plex Mono", monospace', letterSpacing: '.24em' };

/** Phase 5 takes over once Hiro leaves the district with the limiter; earlier phases render until then. */
export function PhaseFiveHost({ children }: { children: ReactNode }) {
  const { active, step, run } = usePhaseFiveEntry();
  if (!active) return children;
  return <Suspense fallback={<div aria-hidden="true" style={COVER} />}><PhaseFive key={run} initial={step} /></Suspense>;
}

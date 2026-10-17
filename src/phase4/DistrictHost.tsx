import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { useDistrictEntry } from './entry';

const Walk = lazy(() => import('./Walk').then(module => ({ default: module.Walk })));
const DistrictExperience = lazy(() => import('./DistrictExperience').then(module => ({ default: module.DistrictExperience })));

/** Inline so it styles correctly before either Phase 4 stylesheet has loaded. */
const COVER: CSSProperties = { position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', background: '#05090d', color: '#89a5b5', font: '11px "IBM Plex Mono", monospace', letterSpacing: '.24em' };

/** Phase 4 takes over the page once Hiro leaves the board; earlier phases render until then. */
export function DistrictHost({ children }: { children: ReactNode }) {
  const { active, step, run } = useDistrictEntry();
  if (!active) return children;
  return <Suspense fallback={<div aria-hidden="true" style={COVER} />}>
    {step === 'walk' ? <Walk key={`walk-${run}`} /> : <DistrictExperience key={`district-${run}`} />}
  </Suspense>;
}

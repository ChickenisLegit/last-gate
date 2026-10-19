import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePhaseFiveEntry } from './entry';
import { LATER_LOADING } from '../presentation/SceneCurtain';

const PhaseFive = lazy(() => import('./PhaseFive').then(module => ({ default: module.PhaseFive })));
const COVER: CSSProperties = LATER_LOADING;

/** Phase 5 takes over once Hiro leaves the district with the limiter; earlier phases render until then. */
export function PhaseFiveHost({ children }: { children: ReactNode }) {
  const { active, step, run } = usePhaseFiveEntry();
  if (!active) return children;
  return <Suspense fallback={<div aria-hidden="true" style={COVER} />}><PhaseFive key={run} initial={step} /></Suspense>;
}

import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePhaseSixEntry } from './entry';
import { LATER_LOADING } from '../presentation/SceneCurtain';

const PhaseSix = lazy(() => import('./PhaseSix').then(module => ({ default: module.PhaseSix })));
const COVER: CSSProperties = LATER_LOADING;

/** Phase 6 takes over once Hiro goes after the signal; earlier phases render until then. */
export function PhaseSixHost({ children }: { children: ReactNode }) {
  const { active, step, run } = usePhaseSixEntry();
  if (!active) return children;
  return <Suspense fallback={<div role="status" aria-label="Loading" style={COVER} />}><PhaseSix key={run} initial={step} /></Suspense>;
}

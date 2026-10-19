import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { useDistrictEntry } from './entry';
import { LATER_LOADING } from '../presentation/SceneCurtain';

const Walk = lazy(() => import('./Walk').then(module => ({ default: module.Walk })));
const ServiceBay = lazy(() => import('./ServiceBay').then(module => ({ default: module.ServiceBay })));

/** Inline so it styles correctly before either Phase 4 stylesheet has loaded. */
const COVER: CSSProperties = LATER_LOADING;

/** Phase 4 takes over the page once Hiro leaves the board; earlier phases render until then. */
export function DistrictHost({ children }: { children: ReactNode }) {
  const { active, step, start, run } = useDistrictEntry();
  if (!active) return children;
  return <Suspense fallback={<div role="status" aria-label="Loading" style={COVER} />}>
    {step === 'walk' ? <Walk key={`walk-${run}`} /> : <ServiceBay key={`bay-${run}`} start={start} />}
  </Suspense>;
}

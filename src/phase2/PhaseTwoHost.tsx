import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { usePhaseTwoEntry } from './entry';
import { enterRecovery, useRecovery } from '../recovery/state';
const Recovery = lazy(() => import('../recovery/Recovery').then(module => ({default: module.Recovery})));


export function PhaseTwoHost({children}:{children:ReactNode}) {
  const recovering = useRecovery(s => s.active);
  if (recovering) return <Suspense fallback={<div className="recovery-cover" role="status">Returning to the city…</div>}><Recovery /></Suspense>;
  return <LegacyHost>{children}</LegacyHost>;
}
function LegacyHost({children}:{children:ReactNode}) {
  const {active}=usePhaseTwoEntry();
  useEffect(() => {if (active) enterRecovery();}, [active]);
  return active ? <div style={{position:'fixed',inset:0,background:'#101c31'}} role="status">Returning to the city…</div> : children;
}

import { lazy, Suspense, type ReactNode } from 'react';
import { usePhaseTwoEntry } from './entry';
import { useRecovery } from '../recovery/state';
const Recovery = lazy(() => import('../recovery/Recovery').then(module => ({default: module.Recovery})));

const PhaseTwo = lazy(()=>import('./PhaseTwoExperience').then(module=>({default:module.PhaseTwoExperience})));

export function PhaseTwoHost({children}:{children:ReactNode}) {
  const recovering = useRecovery(s => s.active);
  if (recovering) return <Suspense fallback={<div className="recovery-cover" role="status">Returning to the city…</div>}><Recovery /></Suspense>;
  return <LegacyHost>{children}</LegacyHost>;
}
function LegacyHost({children}:{children:ReactNode}) {
  const {active,entry,session}=usePhaseTwoEntry();
  return active ? <Suspense fallback={<div style={{position:'fixed',inset:0,background:'#deedf1'}} role="status" aria-label="Entering the fracture"/>}><PhaseTwo key={session} entry={entry}/></Suspense> : children;
}

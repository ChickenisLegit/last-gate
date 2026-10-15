import { lazy, Suspense, type ReactNode } from 'react';
import { usePhaseTwoEntry } from './entry';

const PhaseTwo = lazy(()=>import('./PhaseTwoExperience').then(module=>({default:module.PhaseTwoExperience})));

export function PhaseTwoHost({children}:{children:ReactNode}) {
  const {active,entry,session}=usePhaseTwoEntry();
  return active ? <Suspense fallback={<div style={{position:'fixed',inset:0,background:'#deedf1'}} role="status" aria-label="Entering the fracture"/>}><PhaseTwo key={session} entry={entry}/></Suspense> : children;
}

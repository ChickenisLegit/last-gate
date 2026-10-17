import { create } from 'zustand';

/** Phase 4 has two steps: the walk from Baymax to Bay 6, then the district clue search and case discovery. */
export type DistrictStep = 'walk' | 'district';

const param = import.meta.env.DEV ? new URLSearchParams(location.search).get('phase4') : null;
const devStep: DistrictStep | null = param === 'walk' || param === 'district' ? param : null;

type DistrictEntry = { active: boolean; step: DistrictStep; run: number };
export const useDistrictEntry = create<DistrictEntry>(() => ({ active: !!devStep, step: devStep ?? 'walk', run: 0 }));

/** From the engineering board: leave Baymax and follow the service current to Bay 6. */
export function enterDistrictWalk(): void {
  useDistrictEntry.setState(state => ({ active: true, step: 'walk', run: state.run + 1 }));
}

/** Arrive at Bay 6 (end of the walk, or a replay of the search). */
export function enterDistrictPhase(): void {
  useDistrictEntry.setState(state => ({ active: true, step: 'district', run: state.run + 1 }));
}

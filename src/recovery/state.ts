import { create } from 'zustand';
import { experience } from '../core/ExperienceFlow';

/** The Phase 2 beats: arrive in the district, orient, discover Baymax, approach, then recover. */
export type RecoveryStage = 'arrive' | 'explore' | 'discover' | 'approach' | 'engineering';

export const useRecovery = create<{ active: boolean }>(() => ({ active: false }));

/** The single Afterimage -> recovery handoff. Following the stored trace lands Hiro here. */
export function enterRecovery() {
  if (useRecovery.getState().active) return;
  experience.observe('BAYMAX_RECOVERY');
  useRecovery.setState({ active: true });
}

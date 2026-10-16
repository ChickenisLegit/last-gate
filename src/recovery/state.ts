import { create } from 'zustand';
import { experience } from '../core/ExperienceFlow';

/** Phase 2: arrive in a new district, then the landing page. START JOURNEY begins the website. */
export type RecoveryStage = 'arrive' | 'landing' | 'journey';

export const useRecovery = create<{ active: boolean }>(() => ({ active: false }));

/** The Phase 1 -> Phase 2 handoff: the displacement drops Hiro in another part of the city. */
export function enterRecovery() {
  if (useRecovery.getState().active) return;
  experience.observe('BAYMAX_RECOVERY');
  useRecovery.setState({ active: true });
}

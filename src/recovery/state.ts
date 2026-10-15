import { create } from 'zustand';
import { experience } from '../core/ExperienceFlow';

export const useRecovery = create<{active: boolean}>(() => ({active: false}));
export function enterRecovery() {
  if (useRecovery.getState().active) return;
  experience.observe('BAYMAX_RECOVERY');
  useRecovery.setState({active: true});
}

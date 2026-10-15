import { experience } from './ExperienceFlow';
import { useSceneState } from '../state/SceneStateManager';

// Checkpoints for the chapters that exist on this branch, registered once at module load
// (not inside a component effect, so remounts / hot reloads can't drop them).
// Phase branches register their own next to their scene code:
//   experience.registerCheckpoint('LATTICE', () => …)
let registered = false;
export function registerLegacyCheckpoints() {
  if (registered) return;
  registered = true;
  experience.registerCheckpoint('AWAKE', () => { useSceneState.getState().restart(); });
  experience.registerCheckpoint('SHELL', () => new Promise<void>(resolve => {
    useSceneState.getState().restart();
    // Same public inputs a viewer uses: skip the awakening, then walk to the shell.
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      useSceneState.getState().move(1);
      resolve();
    }, 60);
  }));
}
registerLegacyCheckpoints();

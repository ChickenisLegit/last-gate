import type { Group } from 'three';
import { BAYMAX_POSITION } from '../config/experience';

export class BaymaxController {
  constructor(public readonly shell: Group) {
    shell.position.set(...BAYMAX_POSITION);
    shell.rotation.y = -.18;
    shell.name = 'Baymax / dormant shell';
  }
  // Dormancy is deliberate. Future boot animation belongs to RED_WAKE.
  dispose() { this.shell.removeFromParent(); }
}

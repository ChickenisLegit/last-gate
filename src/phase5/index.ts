import { registerDistrictExit } from '../phase4/exit';
import { enterPhaseFive } from './entry';

// Phase 5 plugs into the end of the Phase 4 district: the limiter Hiro just built goes to Baymax.
// Importing this module once is the whole integration.
registerDistrictExit({ label: 'FIT THE LIMITER TO BAYMAX', go: enterPhaseFive });

export { PhaseFiveHost } from './PhaseFiveHost';

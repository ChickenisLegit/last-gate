import { registerEngineeringExit } from '../engineering/exit';
import { enterDistrictWalk } from './entry';

// Phase 4 plugs into the end of the Phase 3 board: the assessment's answer is to go and find
// a way to limit him. Importing this module once is the whole integration.
registerEngineeringExit({ label: 'SEARCH THE DISTRICT', go: enterDistrictWalk });

export { DistrictHost } from './DistrictHost';

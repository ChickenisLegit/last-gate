import { registerEngineeringExit } from '../engineering/exit';
import { enterDistrictWalk } from './entry';
import { transitionChapter } from '../presentation/chapterTransition';

// Phase 4 plugs into the end of the Phase 3 board: the assessment's answer is to go and find
// a way to limit him. Importing this module once is the whole integration.
registerEngineeringExit({ label: 'SEARCH THE DISTRICT', go: () => transitionChapter(enterDistrictWalk), prepare: () => import('./Walk') });

export { DistrictHost } from './DistrictHost';

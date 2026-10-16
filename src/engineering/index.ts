import { registerJourney } from '../recovery/journey';
import { BoardScene } from './BoardScene';
import { BoardOverlay } from './BoardOverlay';

// Phase 3 plugs into the Phase 2 landing: START JOURNEY opens the engineering board around the
// same Baymax, in the same scene. Importing this module once is the whole integration.
registerJourney({ Scene: BoardScene, Overlay: BoardOverlay });

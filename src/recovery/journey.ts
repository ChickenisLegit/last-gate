import type { ComponentType } from 'react';
import type { Group } from 'three';
import type { ChestBay } from '../characters/ChestBay';
import type { District } from './district';

/** What the Phase 2 landing hands on when START JOURNEY is pressed: the live world, not a copy. */
export type JourneyWorld = { baymax: Group; bay: ChestBay; district: District };

/**
 * The next phase plugs in here instead of editing the landing. Its Scene renders inside the
 * landing's Canvas and owns the camera from then on; its Overlay is the DOM workspace.
 * Without a registered journey (the phase2 branch on its own), the landing ends on Baymax.
 */
export type JourneyExtension = {
  Scene: ComponentType<{ world: JourneyWorld }>;
  Overlay: ComponentType;
};

let extension: JourneyExtension | null = null;
export function registerJourney(next: JourneyExtension) { extension = next; }
export function journeyExtension() { return extension; }

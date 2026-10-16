/**
 * Where the district leads once the temporary limit is built. The next phase registers itself
 * here, so Phase 4 never imports it. Without one (the phase4 branch on its own), the district
 * ends on its result.
 */
export type DistrictExit = { label: string; go: () => void };

let exit: DistrictExit | null = null;
export function registerDistrictExit(next: DistrictExit) { exit = next; }
export function districtExit() { return exit; }

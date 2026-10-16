/**
 * Where the board leads once the assessment is complete. The next phase registers itself here,
 * so the board never imports it. Without one (the phase3 branch on its own), the board ends on
 * its assessment.
 */
export type EngineeringExit = { label: string; go: () => void };

let exit: EngineeringExit | null = null;
export function registerEngineeringExit(next: EngineeringExit) { exit = next; }
export function engineeringExit() { return exit; }

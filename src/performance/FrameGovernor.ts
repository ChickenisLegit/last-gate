import { useQuality } from './Quality';

// Watches real frame time and steps HIGH → BALANCED once if the machine cannot hold
// the target. One-way during a run (no oscillating quality mid-scene), ignores
// hidden tabs, transitions and the first seconds after a chapter change
// (shader compilation hitches are expected there, not sustained load).

const WINDOW = 240;             // frames sampled (~4s at 60fps)
const BUDGET = 1 / 44;          // sustained average worse than ~44fps triggers fallback
const GRACE_AFTER_CHANGE = 3.5; // seconds

class FrameGovernor {
  private samples = new Float32Array(WINDOW);
  private index = 0;
  private count = 0;
  private grace = GRACE_AFTER_CHANGE;
  /** Smoothed frame time (s) for diagnostics. */
  frameTime = 1 / 60;
  enabled = new URLSearchParams(location.search).get('quality') === null && !import.meta.env.VITE_QUALITY;

  /** A chapter change or transition: restart the sampling window. */
  settle(seconds = GRACE_AFTER_CHANGE) { this.grace = Math.max(this.grace, seconds); this.count = 0; this.index = 0; }

  sample(dt: number, busy: boolean) {
    this.frameTime += (dt - this.frameTime) * .05;
    if (!this.enabled || busy || document.visibilityState !== 'visible' || dt <= .001 || dt > .2) return;
    if (this.grace > 0) { this.grace -= dt; return; }
    this.samples[this.index] = dt;
    this.index = (this.index + 1) % WINDOW;
    if (this.count < WINDOW) { this.count++; return; }
    let total = 0; for (let i = 0; i < WINDOW; i++) total += this.samples[i];
    const quality = useQuality.getState();
    if (total / WINDOW > BUDGET && quality.name === 'HIGH') {
      quality.set('BALANCED', true);
      if (import.meta.env.DEV) console.info(`[lattice] sustained ${(1000 * total / WINDOW).toFixed(1)}ms frames → BALANCED`);
      this.settle(5);
    }
    this.count = 0;
  }
}

export const frameGovernor = new FrameGovernor();

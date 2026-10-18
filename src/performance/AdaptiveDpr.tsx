import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useQuality } from './Quality';

// Phases 4–6 render in their own canvases. This keeps their frame rate up by trading resolution,
// not effects: the render scale steps down when frames run long and creeps back up when there is
// headroom. It starts at the top of the quality tier's range, waits out the first seconds (shader
// compilation hitches are not load), never steps up soon after a step down (no flicker between
// sizes), and caps the pixel count so a 4K screen doesn't render 1.5× of 4K.

const WINDOW = 2;              // seconds per sample
const SLOW = 1 / 50;           // average frame worse than 50 fps steps down
const FAST = 1 / 58;           // three windows better than 58 fps may step up
const CRAWL = 1 / 30;          // the frame-rate floor for phases 4–6
const FLOOR = .75;
const PIXEL_BUDGET = 1920 * 1080 * 1.5 * 1.5;

function range() {
  const preset = useQuality.getState().preset;
  const device = Math.max(window.devicePixelRatio || 1, 1.25);
  const byBudget = Math.sqrt(PIXEL_BUDGET / Math.max(1, window.innerWidth * window.innerHeight));
  const hi = Math.max(preset.dprMin, Math.min(preset.dprCap, device, byBudget));
  return { lo: Math.min(preset.dprMin, hi), hi };
}

export function AdaptiveDpr() {
  const setDpr = useThree(s => s.setDpr);
  const m = useRef({ dpr: 1, t: 0, n: 0, grace: 3, fast: 0, cool: 0 });

  useEffect(() => {
    const apply = () => { const { lo, hi } = range(); m.current.dpr = Math.min(hi, Math.max(lo, m.current.dpr)); setDpr(m.current.dpr); };
    m.current.dpr = range().hi; setDpr(m.current.dpr);
    window.addEventListener('resize', apply);
    const off = useQuality.subscribe((q, prev) => { if (q.name === prev.name) return; m.current.dpr = range().hi; m.current.grace = 3; setDpr(m.current.dpr); });
    return () => { window.removeEventListener('resize', apply); off(); };
  }, [setDpr]);

  useFrame((state, dt) => {
    const s = m.current;
    // A re-render of <Canvas> re-applies its dpr prop; put ours back.
    if (Math.abs(state.viewport.dpr - s.dpr) > .001) setDpr(s.dpr);
    if (document.visibilityState !== 'visible' || dt <= .001 || dt > .5) return;
    if (s.grace > 0) { s.grace -= dt; return; }
    s.cool = Math.max(0, s.cool - dt);
    s.t += dt; s.n++;
    if (s.t < WINDOW) return;
    const avg = s.t / s.n; s.t = 0; s.n = 0;
    const { lo, hi } = range();
    let next = s.dpr;
    // Under 50 fps steps down to the tier's floor; still under 30 fps there, it goes below 1:
    // a slightly soft image beats a stutter.
    if (avg > SLOW) { next = Math.max(avg > CRAWL ? FLOOR : lo, s.dpr - .15); s.fast = 0; s.cool = 8; }
    else if (avg < FAST) { if (++s.fast >= 3 && s.cool === 0) { next = Math.min(hi, s.dpr + .1); s.fast = 0; } }
    else s.fast = 0;
    if (Math.abs(next - s.dpr) > .001) { s.dpr = next; setDpr(next); }
  });
  return null;
}

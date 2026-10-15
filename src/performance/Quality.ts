import { create } from 'zustand';

// Desktop-only quality presets. HIGH is the presentation look; BALANCED is the
// emergency fallback that keeps the same identity (no low/mobile mode by design).

export type QualityName = 'HIGH' | 'BALANCED';
export type QualityPreset = {
  /** Upper bound for renderer pixel ratio. Never blindly devicePixelRatio = 2. */
  dprCap: number;
  /** Multiplier for particle / microbot / debris counts. */
  density: number;
  shadowMapSize: number;
  /** AO render-target scale and sample count. */
  aoScale: number;
  aoSamples: number;
  bloom: number;
  dof: boolean;
  /** Fraction of fog / mist layers to keep. */
  fogLayers: number;
  /** Max anisotropy for hero textures. */
  anisotropy: number;
};

export const QUALITY_PRESETS: Record<QualityName, QualityPreset> = {
  HIGH:     { dprCap: 1.5,  density: 1,   shadowMapSize: 2048, aoScale: .6, aoSamples: 12, bloom: 1,   dof: true, fogLayers: 1,   anisotropy: 8 },
  BALANCED: { dprCap: 1.15, density: .6,  shadowMapSize: 1024, aoScale: .4, aoSamples: 8,  bloom: .6,  dof: true, fogLayers: .65, anisotropy: 4 },
};

/** Keeps the full-screen pixel count near 1080p-at-1.5x regardless of monitor. */
export function pixelRatioFor(preset: QualityPreset, width = innerWidth, height = innerHeight, device = window.devicePixelRatio || 1) {
  const budget = 1920 * 1080 * preset.dprCap * preset.dprCap;
  const byBudget = Math.sqrt(budget / Math.max(1, width * height));
  // Never below 1 on desktop: under-sampling softens the image more than it saves.
  return Math.max(1, Math.min(device, preset.dprCap, byBudget));
}

function initialQuality(): QualityName {
  const forced = (new URLSearchParams(location.search).get('quality') ?? import.meta.env.VITE_QUALITY ?? '').toUpperCase();
  if (forced === 'HIGH' || forced === 'BALANCED') return forced;
  try { const saved = sessionStorage.getItem('lattice.quality'); if (saved === 'BALANCED') return saved; } catch { /* storage blocked */ }
  return 'HIGH';
}

type QualityState = { name: QualityName; preset: QualityPreset; dpr: number; auto: boolean; set: (name: QualityName, auto?: boolean) => void };
export const useQuality = create<QualityState>((set, get) => {
  const name = initialQuality();
  return {
    name, preset: QUALITY_PRESETS[name], dpr: pixelRatioFor(QUALITY_PRESETS[name]), auto: false,
    set: (next, auto = false) => {
      if (next === get().name) return;
      // Only a deliberate choice persists; an automatic fallback is re-evaluated on reload.
      if (!auto) try { sessionStorage.setItem('lattice.quality', next); } catch { /* storage blocked */ }
      set({ name: next, preset: QUALITY_PRESETS[next], dpr: pixelRatioFor(QUALITY_PRESETS[next]), auto });
    },
  };
});
export const quality = () => useQuality.getState().preset;

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const state = useQuality.getState(), dpr = pixelRatioFor(state.preset);
    if (Math.abs(dpr - state.dpr) > .01) useQuality.setState({ dpr });
  });
}

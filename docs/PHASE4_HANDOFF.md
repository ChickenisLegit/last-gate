# Phase 4 — Tasks 22–27 engineering handoff

Branch `phase4-tasks-22-27`, cut from `main@14aa6f5`. No phase branch was merged or cherry-picked.
Nearly everything is in **new modules**. The shared files have only small hook-point edits, so they're easy to re-apply after the phase branches merge.

## Systems

| Task | System | File |
|---|---|---|
| 22 | Master state list (BOOT → EPILOGUE), checkpoints, per-state camera mode / audio mix / entry transition / preload list, legacy phase → state map | `src/core/ExperienceStates.ts` |
| 22 | Scene contract `prepare / enter / update / exit / cleanup` + `SceneScope` (listeners, timers, RAF, GSAP, audio handles, GPU objects are freed on cleanup) | `src/core/SceneLifecycle.ts` |
| 22 | `experience.transitionTo(state, type)`: single transition path, lock-guarded (a double trigger returns `false`), 12 s watchdog, prepare timeout, always lands on the target. `jumpTo / restartCheckpoint / nextCheckpoint / restartExperience` | `src/core/ExperienceFlow.ts` |
| 22/26 | Interaction locks: `acquire` (auto-expiring), `exclusive`, `once`, `throttle`, reset on restart | `src/core/InteractionLock.ts` |
| 22 | Bridge inside `<Canvas>`: mirrors the legacy store into the flow, applies camera mode, mix, preloading and render policy per state, runs one shared frame hook | `src/core/RuntimeBridge.tsx` |
| 23 | 9 physical transitions, each with anticipation → action (scene swap while covered) → follow-through → settle: BLINK, RED_SCAN, DEBRIS_OCCLUSION, MICROBOT_SWARM, DIMENSION_FOLD, PORTAL_OVEREXPOSURE, FOG_PASS, DEPTH_COLLAPSE, CAMERA_OCCLUSION. Drawn on a half-res canvas that only draws while a transition is playing | `src/transitions/CinematicTransitions.ts` |
| 23 | Camera modes RECOVERY…HOME (look damping, inertia, max look, head motion, shake allowance, focus), blended over 1.2 s; impulse + decay shake from motivated sources only | `src/systems/CameraRig.ts` |
| 23 | Allocation-free signal channel (exposure, instability, blur, FOV) from transitions to the post stack and camera | `src/effects/CinematicSignals.ts` |
| 24 | One AudioContext, category buses (AMBIENCE, CHARACTER, MECHANICAL, PORTAL, IMPACT, MICROBOT, UI, MUSIC, LEGACY), narrative mix snapshots with crossfades, `silence()` beats, keyed loops (no duplicates), owner-scoped `stopOwner`, compressed-file loader that resolves to `null` on missing files, no live context before a user gesture, suspend while the tab is hidden | `src/audio/AudioMix.ts` |
| 25 | HIGH / BALANCED presets; DPR from a 1080p×1.5² pixel budget (cap 1.5 / 1.15, never below 1) | `src/performance/Quality.ts` |
| 25 | Frame governor: sustained >22.7 ms average over 240 frames → BALANCED once; ignores hidden tab, transitions and post-chapter-change grace; auto fallback is not persisted | `src/performance/FrameGovernor.ts` |
| 25 | Render policy: shadow map size capped per preset (the 4096 key light now renders at 2048), anisotropy capped | `src/performance/RenderPolicy.ts` |
| 25 | GPU microbot swarm: one draw call, shader-time motion, `uMorph` formation tween, distance + quality density LOD | `src/performance/InstancedSwarm.ts` |
| 25 | `shared()` resource cache, `distanceLOD()`, shared-safe `disposeObject()`, rate-limited shared ticker `frames.add(id, fn, hz)` | `SharedResources.ts`, `Disposal.ts`, `FrameScheduler.ts` |
| 26 | Dev / presentation HUD, recovery keys, scene audit (dev / presentation builds only, code-split) | `src/debug/DevTools.tsx`, `src/debug/SceneAudit.ts` |
| 27 | Cursor hides after 2.2 s idle, `F` toggles fullscreen (a denied request is ignored), in-world prompts lock during transitions | `src/core/ProductionLayer.tsx`, `src/ui/production.css` |
| 27 | Build hardening: console.log/info/debug are stripped, three.js / vendor are split into long-cached chunks | `vite.config.ts` |

## Shared files modified (and why)

- `src/experience/ExperienceDirector.tsx`: 3 imports, `dpr` from `useQuality`, `antialias:false, stencil:false` (the composer renders into render targets, so MSAA on the canvas was wasted; SMAA already handles edges), `<RuntimeBridge/>` inside the Canvas, `<ProductionLayer/>` in `<main>`.
- `src/systems/CameraDirector.ts`: one import, plus `cameraRig.apply(camera,dt)` placed just before `updateProjectionMatrix()`.
- `src/audio/AudioDirector.ts`: uses `audioEngine.ensure()` and connects its master to `audioEngine.bus('LEGACY')`. `dispose()` now disconnects instead of closing the shared context.
- `src/effects/CinematicPost.ts`: the ad-hoc 180-frame "medium" fallback is replaced by quality presets (AO scale/samples, bloom, DOF) and the governor. Signals are added to exposure, instability and DOF. Composer DPR is kept in sync with the renderer.
- `src/systems/AssetManager.ts` (not touched by any phase branch): `declare / load / get / preload` with optional-asset safety. `loadBaymax()` is unchanged.

## Merge-conflict risks

`red-wake-sequence` rewrites `ExperienceDirector`, `CameraDirector`, `AudioDirector`, `CinematicPost` and `SceneStateManager`. Expect conflicts on the first four. Resolve them by **keeping the phase branch's version** and re-applying the hook lines listed above (each is 1–5 lines). `SceneStateManager` and `config/*` were not modified. `dist/` was left untouched; rebuild it after the final merge.

## After the phase branches merge

1. Add new phases to `PHASE_STATE` in `ExperienceStates.ts` with `registerPhaseStates({...})`. Camera mode, mix and preloading then follow automatically.
2. Each chapter: `experience.registerCheckpoint('LATTICE', handler)` and `assets.declare('LATTICE', [...])`. Prefer an `ExperienceScene` + `SceneScope` for new scenes.
3. Move chapter changes to `experience.transitionTo(next, type)` instead of setting store state directly.
4. Microbots / debris: `InstancedSwarm` (one draw call) and `shared()` geometry and materials, never a component per bot.
5. Impacts: `cameraRig.shake('impact' | 'baymax-attack' | 'structure' | 'portal', strength)`. Silence beats: `audioEngine.silence(seconds)`.
6. Run the scene audit (Alt+Shift+A) per chapter. Current AWAKE/SHELL baseline: 374 meshes, 282 shadow casters, 12 lights, 93 transparent draws, ~80 draw calls recoverable with instancing (repeated windows and architecture in `PortalDimension.js`, owned by the phase branches).

## Debug / presentation controls

Compiled in only for `npm run dev`, or for a build made with `VITE_PRESENTATION=1`. A normal `npm run build` contains none of this (verified).

`Alt+Shift+F` HUD · `R` restart checkpoint · `0` restart experience · `N` next checkpoint · `1…9 - =` jump to checkpoint · `Q` toggle quality · `A` scene audit · `T` preview next transition (dev only) · `S` test shake (dev only). `?hud` opens the HUD on load and `?quality=BALANCED` forces a preset.

## Verification

- `tsc --noEmit` and `npm run build` pass.
- The production preview boots BOOT → AWAKE (approaching) on HIGH with a clean console.
- Transitions were checked visually as still frames. In a live run the scene swap lands at the covered moment (~1.2 s) and a duplicate trigger is rejected.
- Not verified live: the checkpoint jump, restart spam and blur-during-transition runs. The browser pane stopped delivering animation frames before those tests could run, so they need a pass on a real desktop browser.

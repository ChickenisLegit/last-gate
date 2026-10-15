# Baymax recovery boundary

The production story enters BAYMAX_RECOVERY when the Phase 1 handoff transition completes. The damaged harbour street is the Phase 2 destination; the Afterimage scene remains available as a development preview, and its stored-trace action also enters recovery.

Recovery reuses the portal-city environment with harbour service-road landmarks. AssetManager retains an untouched template of the loaded Baymax GLB before the opening controller articulates it. Recovery clones that template, unfolds the legs, and grounds the damaged shell using visible geometry. Entering the engineering workspace keeps the same Canvas and model mounted while moving the camera and revealing normal DOM controls.

Available interactions: approach, overview/shell/chest inspection views, temporary field notes, and return to the street view. Notes survive toggling the workspace, but do not persist after reload. No repair, override, portal puzzle, mission or escape follows this entry.

The legacy build, vector hunt, null chamber and final modules have been deleted from the source. The Phase II director (`src/phase2/model.ts`) now has only the `fracture` and `afterimage` stages, and `PhaseTwoRuntime` renders only the fracture world. `ExperienceStates` and the audio mix table are trimmed to the shipped arc (BOOT → BAYMAX_RECOVERY). `?phase2=fracture`, `?phase2=afterimage` and `?recovery=1` are development-only scene previews. Debug controls are development-only, including when VITE_PRESENTATION is set.

Validation: npm run build; with the development server running, node browser-check.mjs. CHECK_URL can select another server port. The browser check verifies that retired route parameters open the original experience, then advances the existing scene store to the handoff and checks direct recovery arrival, inspection controls, retained field notes and the same Canvas across workspace changes. It uses the existing bundled Playwright runtime and Chromium path. This is an integration smoke check, not a complete visual playback of every opening beat.

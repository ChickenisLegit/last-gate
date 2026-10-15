# Baymax recovery / diagnostics

## Canonical boundary

The opening, chip activation, corruption, chase and dimensional handoff remain the existing authored experience. After the handoff, production enters BAYMAX_RECOVERY directly. The floating Afterimage line, focus/scan requirement and recorded-trace action are removed from production. Legacy experimental modules remain unused in source.

The damaged harbour district is still part of the same portal-city. Baymax remains prone until Hiro approaches. Opening the service bench keeps the same model and Canvas, transitions to a normalized inspection pose, and unmounts/disposes the city environment. Street view restores the entry scene without resetting diagnostics or field notes.

## Inspection

The workspace uses normal DOM/CSS controls around a demand-rendered R3F viewport. Drag to orbit, scroll to zoom, click physical regions or select systems from the navigator. Selection smoothly focuses the camera. Exterior, internal and isolate modes expose the relevant geometry. The existing medical chest-access design is reused alongside clean program sockets, power distribution, sensor and actuator modules and paired thruster inspection housings.

Test points reveal findings. Opening the program bay reveals a physically empty healthcare socket and an occupied combat socket. Nothing creates, regenerates or substitutes the healthcare chip.

## Limited repairs

- Power distribution: isolate the damaged primary branch, then route through auxiliary rail B. Routing before isolation is rejected. The original core remains functional at 62% output; only its damaged distribution path is bypassed.
- Left thruster: rotate the keyed plug to 90 degrees, then seat it fully. Wrong orientation blocks insertion. Plug rotation and insertion appear on the 3D part, and its nozzle indicator changes after reconnection. Full flight is unavailable.
- Arm actuator: align the encoder to 12 degrees, within a 2-degree tolerance, and store the neutral reference after power is stable. The model responds to alignment. Incorrect calibration is rejected.

Right-thruster housing, damaged leg assemblies and scored armour cannot be completely restored with available parts. Stable power reduces right-thruster instability, but output remains limited. The service pose never grants an actuation command.

## Ending

Completion requires all eight subsystem investigations and all three limited repairs. Power is stable; movement is partial; thrusters are limited; sensors and combat logic are active. Baymax is physically usable within this limited envelope, but remains unsafe. Healthcare logic and safe direct control are unavailable. There is no override unit, replacement robot, portal mission or continuation.

## Verification

`npm run build` checks TypeScript and builds the tracked static site. `node --experimental-strip-types diagnostics-check.mjs` (Node 22.6+ / current Node 24 runtime) tests invalid repair attempts, valid repairs, completion gating and the missing-chip/control invariants.

With the Vite development server running, `node browser-check.mjs` verifies physical region selection, all investigations and repair controls, orbit/zoom, final findings, and idle rendering. `node scripts/check-recovery-flow.mjs` verifies the original opening entry, direct handoff without scanning, the same model and Canvas, city removal, retained notes and reduced-motion cover handling. Both use the existing bundled Playwright/Chromium paths. `CHECK_URL` selects the dev server (default port 4173); `CHECK_SCREENSHOT` optionally saves the diagnostics test's final screenshot.

Development-only previews: `?recovery=entry` opens the district; `?recovery=diagnostics` opens the service bench. Old `?phase2=fracture` and `?phase2=afterimage` development entries redirect to recovery. Production ignores all preview query parameters. No production chapter picker is provided.

Validation observed no browser errors. The exterior inspector rendered about 31–37 draw calls, and the idle workspace produced zero additional frames over the sampling interval. Integration checks advance the existing opening store to its handoff; they do not replay every cinematic beat in real time.

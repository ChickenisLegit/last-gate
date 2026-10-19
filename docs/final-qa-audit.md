# Final QA audit — cb21490

Phase 2 refinement is deferred at the user's request. Its earlier work is saved on `temp/backup-wip` (`5d58d0d`). This pass targets the walk to Bay 6 through the ending, and shared infrastructure only where required by that flow.

## Actual flow

| Handoff | Renderer / readiness |
| --- | --- |
| Engineering exit → district walk | `phase4/index` registers the existing exit; `DistrictHost` replaces the earlier Canvas. Walk uses `SceneQuality`. |
| Walk → Bay 6 | `transitionChapter`, prebuilt `takeServiceBay`, new Canvas; Bay 6 owns a depth/main/city/glass multipass renderer. Readiness follows compile, texture upload and warm frames. |
| Bay 6 → regulator installation | Registered `districtExit`; Phase Five mounts one Canvas and rebuilds the existing harbour/armoured Baymax. The physical regulator is `phase4/limiter.createLimiter`. |
| Installation → activation | Same Baymax and Canvas. The regulator seats across the chest on four supports, then Hiro powers him up while the camera remains in the bay. |
| Activation → telemetry | Same Canvas; BayScene unmounts and FacilityScene mounts under `transitionChapter`. Five existing console tasks remain. |
| Telemetry → Baymax entrance | Registered Phase Five exit; a new Phase Six Canvas recreates the completed relay. Baymax follows `WAKE_PATH`, lands in the yard, then strains against the regulator. |
| Relay → chase → gate | Same Canvas and actors; relay set is disposed and a prebuilt street set attached. First-person camera runs the authored street route. |
| Gate → regulator off → flight → regulator on → fall | Same Canvas, rig, chest bay and physical regulator. Thumb animation operates the separate handheld remote; the mounted unit remains `createLimiter`. |
| Fall → combat chip removal → capture cartridge → open portal | Same actors and set. Existing drag/hold interactions remain. Home is rendered into the gate's render target. |
| Portal crossing → home → healthcare chip → boot/end | Same Canvas and actors; home group changes scenes. The healthcare chip is fetched from the bin, seated in the canonical chest bay, and the armour comes off before Baymax rises. |

## Root causes addressed

- The pale home veil, white portal shader flash and fixed 6.5-second cover release could expose unready or blank scenes. The later covers now wait for renderer readiness, and crossing fades through black.
- `AdaptiveDpr`, `SceneQuality` and Canvas configuration previously wrote competing DPR values. All four later Canvases now hold one controlled DPR value; the governor changes it only after sustained frame-rate windows and never raises it under load.
- The visible armour was grounded using hidden white torso boxes and approximate ankle markers. Later Baymax instances now use actual skinned surface contacts, attach independent feet to the shin motion, and prevent negative ground bounce.
- The fitted feed prevented the chip bay from unseating at the ending. The white shell now receives the canonical bay before it rises.
- The shared regulator was shown at different apparent scales. Later scenes use one world scale and mount its unchanged geometry across the chest with measured supports and an attached feed.
- Telemetry's high dish shot crossed a neighboring roof. The camera now looks up at the clear face from the apron and routes through the actual rear opening.
- The chase's authored stalk/burst/lunge/stutter remain; bounded projectile, impact, debris and scar pools add visible consequences.
- Later panels use one readable UI face, with mono reserved for telemetry values and white labels on orange controls.

## Verification

Use real-GLB contact/attachment checks, sampled camera rails, deterministic impact lifecycle checks, production build, and a browser walkthrough of the existing interactions in order. Record actual results and remaining limits rather than assuming the pushed commit's report proves them.

Run `node scripts/later-refinement-check.mjs` from the repository root. It uses the real GLBs with a canvas-texture stub, independently reads visible vertices, checks flat and ramp contacts, chip-bay unseating, camera rails against room geometry, DPR downshift and projectile cleanup. The Node actor CPU timing is diagnostic, not a browser FPS claim.

Browser checks completed: walk → Bay 6 handoff; all three bay inspections; cable following; crate movement; both latches; lid and regulator pickup; compact 1024×600 scrolling; installation → 35% activation; the five telemetry tasks in order; Phase Six wake, limiter, chase, all three power rings, regulator-off faceoff, regulator-on fall, combat-chip removal, cartridge insertion, open portal, hauling/crossing, healthcare-chip retrieval and seating, reboot, and end card. The real renderer showed a blocked dish and a relay post in front of Baymax; both were corrected and visually rechecked. Screen captures are in `artifacts/later-qa/`.

## Phase Six follow-up

- Telemetry's final shot now matches Hiro's next eye position outside the broken rear wall, east of the receiver. The earlier indoor position put the roof between the camera and the aerial entrance. The limited sequence returns through the actual opening to the recorder. A foreground post and drum were moved clear of the landing view.
- Baymax now turns toward Hiro as he finishes the dive and follows his position while restrained. This presents the face, complete armour silhouette, chest-mounted regulator and thruster jets in the faceoff.
- The recovery camera previously moved just 0.62 m off the chest at an eye height of 1.06 m, inside the armour. It now clears the shoulder and looks down into the socket; the real-mesh raycast checks its sightline.
- Unconscious lying poses suppress combat tension and residual procedural motion. Chip inspection suppresses first-person breathing/bob. The regression check samples 180 frames to ensure the dock remains fixed even with the regulator's tension inputs.
- Existing scaffold lamps now cast two modest, unshadowed work-light cones: warm recovery light and a cool reader/gate rim. The powered frame has a restrained local glow; global exposure is unchanged.
- Browser cutoff test reached the fallen/chip-removal stage without a new black transition. The first recovery framing reproduced the user's clipped-armour screenshot and was corrected. Chip removal reaches the reader/cartridge step.
- The armour aperture is refreshed after the final ground correction and limited to the canonical bay's actual world-space rim. This fixes both red plating covering the chip and the oversized circular cut through the surrounding chest. The test probes the shader uniforms directly for center alignment and radius.
- Later armour keeps inner faces visible and removes the source's redundant coplanar face/visor surfaces. The supplied ZIP was inspected: its Phase Six actor is baked and unskinned; the other polished rig is renamed/merged and is explicitly not a drop-in replacement. Neither replaces the live animation rig. Only compatible matte-paint values are reused.
- Portal crossing no longer mixes the full-screen portal surface toward white or boosts the entire world's brightness. A black overlay covers the set handoff and fades into home, outside the displacement filter.
- The regulator's long axis is horizontal across the chest in both installation and Phase Six. Four short supports are measured against the real armour plate, and the feed is attached to the fitted body. The mount remains on the chest bone through the lie, fall and rise poses.
- Hiro's hauling view targets the actual visible boots after posing, keeping both hands attached to boot collars. Ten braced pulls advance monotonically across the ramp, with a brief settlement between pulls. The hand rig and original interaction flow are retained.
- The lying suit exposed a dark, open-looking shoulder joint in the home recovery shot. Recessed joint cores now follow the two live upper-arm bones and fill the visible cavities through the fall and haul poses.

The full working repository, including Git history and uncommitted edits, is copied to `D:\Last-gate-work`. Its own TypeScript check, real-GLB regression script, and production build at `D:\Last-gate-work\artifacts\later-qa\build` pass. A separate D: build with development entry shortcuts was walked in the browser from the regulator cutoff through the final end card: fall and impact, combat-chip extraction, reader insertion, portal and haul, home healthcare-chip retrieval and seating, Baymax's rise, and ending all completed. The normal production bundle was separately opened and reached its opening scene. After the shoulder-core change, a final shortcut-enabled D: build was visually checked from home recovery through the end card. Sustained laptop FPS has not been measured; Node contact timings are not substituted for it.

## Final canonical-body pass (supersedes the earlier separate-suit notes)

- The initial duplicated overlay was rejected in visual QA and removed. Combat red, purple inset and white face now shade the original closed body directly. There is no second body, floating abdominal panel or copied helmet surface. The original chest cutout shader and live engineering bay remain attached to the same body.
- The opening, recovery, installation and ending share the same 0.79 scale and body proportions. Healthcare restoration clears the combat finish on that same mesh. Composite roughness is 0.66 under the actual material maps.
- Recovery is an authored 30-degree semi-recline, with legs forward and a concrete backstop placed against the back. The engineering view takes over that existing world and pose.
- Installation uses the original `createLimiter` unit at its Bay 6 world scale. Its back seats onto four short measured supports, its front gauge faces outward, and the feed connects to the existing bay rim. Per the user's latest instruction, no Hiro character is added to this fitting sequence.
- The opening fight has three violent actions: the opening ranged miss, a roofline ranged miss, and the heavy landing. The intervening overhead pass uses an eased arc. Camera targets follow the live actor. Displacement keeps him visible for a single authored frame-member contact with a small spark scatter.
- The red combat card is the actual child removed from Baymax's dock. It is reparented to Hiro's pinch and then to the reader with preserved transforms and an alignment/seating animation. The relay capture remains the telemetry record; it no longer replaces the combat card at the reader.
- The narrow harbour view preserves the authored horizontal field of view, keeping both Baymax and the healthcare-chip bin on screen. The airborne regulator panel moves above the action on narrow screens so both feet and sole jets remain visible.

Latest automated validation: TypeScript passes; real-mesh checks pass for flat/ramp ground contact, unconscious chest stability, four short regulator supports and unchanged unit scale, recovery angle/framing, camera rails, effect expiry and DPR downshift. Opening flight projections pass at both 16:9 and 690x668, with head and feet inside the frame at all four sampled beats. Run the opening check with `node scripts/later-refinement-check.mjs scripts/opening-refinement-check.ts`.

Latest browser validation: completed regulator activation, telemetry capture pickup, a full uninterrupted pursuit, all three power rings, regulator off and Baymax approach, airborne cutoff, combat-card extraction, the actual card seating in the reader, portal haul/crossing, harbour view, healthcare-chip retrieval and seating, closing the bay, the white restoration/rise and final end card. Renderer console errors were checked.

## Opening portal and motion follow-up

- San Fransokyo turnback now aims at the actual Baymax through the opening. Hiro pauses before committing to return. The failing rim builds particle pull, debris acceleration and light flicker while retaining the existing crossing and story.
- Flight transitions start at the actor's previous position. The near pass follows one continuous Catmull–Rom curve, with safe shoulder clearance; the body follows the flight tangent and the head can look back independently. Fixed beat anchors prevent the trajectory from sliding with the camera.
- The opening launch rises 4.8m instead of 13m. The final dive has a 0.7-second authored descent, a short absorption pose and recovery. Its impact triggers at 2.35 seconds, when the real boot surface reaches the asphalt. A second position-smoothing layer no longer delays that contact.
- The displaced shoulder passes within 0.36m of the single broken-frame contact and spark point. Its debris member is visible before the hit; the scatter lasts 0.34 seconds.
- The expanded real-mesh check samples 156 frames across the important attacks at 16:9 and 690x668. All retain head/feet inside the viewport. Maximum actor movement per 60Hz frame is 0.403m, and boot clearance at impact is zero within floating-point tolerance. TypeScript and the later contact/interaction regressions pass.
- Browser playthrough reached the opening portal return, white Baymax/chip pickup, red activation, pursuit and airborne final anticipation, then the recovery handoff. Flight screenshot: `artifacts/later-qa/phase1-flight-current.png`. The automated contact check supplies precise landing timing; a screenshot is not substituted for that measurement.

Performance limitation: current in-app-browser audits measured approximately 29fps at DPR 0.75 in the portal and harbour scenes. A matching baseline comparison was not completed, so this report does not claim that a GPU FPS regression has been ruled out. Node CPU actor timings are diagnostic only. The production build removes the development frame logger.

Release validation: `npm run build` passes and rebuilds tracked `dist/`. The production preview on port 4179 was opened from the beginning and reached the San Fransokyo turnback with the centered white Baymax and unstable aperture; no console errors occurred after that production navigation. The later real-mesh/contact suite and expanded opening suite both pass. Portal return captures are in `artifacts/later-qa/portal-return-*.png`.

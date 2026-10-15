# Last Gate

The first desktop chapters of Path 1. The viewport is Hiro's vision: a blinking awakening, fractured San Fransokyo, a controlled approach to Baymax's silent shell, and a red chip beside his hand. Hiro picks it up, opens Baymax's chest bay and seats the chip. After a held silence Baymax wakes, seems himself for a moment, finds his healthcare directive missing, and locks onto Hiro as a threat. His attacks tear the portal city apart during a directed chase until a fracture corridor opens; Baymax is taken into it and Hiro is pulled through after him. Art direction targets 1920×1080. Viewports below 1280px show a desktop-required screen and do not mount WebGL.

## Run

Requires Node.js 20.19+ or 22.12+. Run `npm install`, then `npm run dev`, and open http://localhost:4173. `npm run build` checks TypeScript and generates the deployable static site in `dist/`. `npm run preview` serves that production build. `node server.mjs` also serves the built site without dependencies.

## Controls

- Awakening starts automatically. Escape or **Skip awakening** skips the blink sequence.
- Move the pointer to look around; how far Hiro can turn depends on the moment. On the approach, A / D or the left and right arrows step sideways.
- Scroll, hold Space / W / Arrow Up, or use the subtle move closer control to approach Baymax.
- Click Baymax, select the response marker, or press E to check for a response.
- Press and hold (mouse, or E / Space / Enter) on the chip to pick it up, and on the chest seam to release the access bay.
- Move the pointer to guide the chip toward the keyed socket; it aligns magnetically and seats itself. Click once it is close, or hold E to let the socket draw it in. While handling the chip, scroll or press + / − to zoom.
- During the attack Hiro keeps running on his own. Hold the mouse, Space, W or Arrow Up, or scroll, to sprint.
- Enable original synthesized ambience through the upper-right sound control. Audio starts only after a user gesture.
- Press R, or select **Replay** on the chapter card, to restart.

The sequence respects reduced motion. Keyboard operation, live captions, and asset/WebGL failure messages are included. A small MOVE // SCROLL hint appears only after inactivity. The first wheel input produces a small teaching step.

## Branches

Each phase lives on its own branch, and each branch builds on the one before it, so a phase's code is only ever added by its own branch:

| Branch | Adds | Plays |
|---|---|---|
| `main` | Phase 1: awakening, the shell, the chip, RED_WAKE, the fracture corridor | Phase 1 |
| `phase2` | Phase 2: Baymax recovery (harbour street, discovery, repair workspace, ending) | Phases 1–2 |
| `phase3` | Phase 3: the final sequence (Max Attack → vector capture → exit vector → escape → home → epilogue) | Phases 1–3 |
| `phase4` | Phase 4: the north service district power limiter | Phases 1–4 |

Fixes to a phase go on that phase's branch; rebase the later branches onto it afterwards.

## Chapter flow

This branch is Phase 1 only. The opening runs through RED_WAKE and the fracture corridor and ends on the PHASE I handoff card, which offers a replay. Phase 2 starts from that handoff on the `phase2` branch.

In development, **Ctrl+M** skips ahead: to RED_WAKE, then to the handoff card.

## Architecture

React, TypeScript, Vite, Three.js, React Three Fiber, Zustand, and GSAP. One Canvas and one experience controller coordinate BOOT → AWAKE → THE_SHELL → RED_WAKE → THE_FRACTURE. The phase graph lives in `SceneStateManager`; authored beat lengths, hold time and diagnostic lines live in `config/shell.ts`.

- **SequenceDirector** is the shared per-frame state: hold progress, chase progress along an authored spline, the attack schedule (charge, discharge, impact, tear), camera impulses, and grade signals. Systems subscribe to its events; nothing is triggered from React.
- **CameraDirector** exclusively owns the camera. Every phase after the approach is an authored shot that cross-blends from wherever the previous shot left the camera; shake, shoves and FOV punches come only from sequence impulses.
- **BaymaxController** articulates the shell (shoulder-hinged arms, head tracking, inflation, thruster) and carries corruption through eyes, armour emissive, chest seam and posture rather than twitching.
- **ChestAccess** builds the medical bay: an iris of three leaves, a real cavity opened with a depth mask, and a keyed dock whose outline repeats the chip's. **RedChip** and **ChipController** own the chip from asphalt to socket, including magnetic guidance.
- **RuptureSet** pools every bolt, impact, scar, tear, debris chunk and collapsing slab, and builds the fracture corridor. **WorldWarp** patches every environment material once with shared uniforms for impact ripples, road fold, architectural shear and the corridor's pull, so nothing recompiles mid-sequence.
- **AudioDirector** is fully synthesized: phase-mixed layers (air, breath, internal hum, corrupted hum, thrusters, corridor) and authored one-shots for each tactile and violent beat.
- TransitionDirector owns the eye-opening timeline. AssetManager loads the shell GLB once. The environment uses instanced windows, repeated details and drifting debris; particles render in a single point cloud.

The shared source is grouped into `src/experience`, `src/state`, `src/systems`, `src/characters`, `src/environment`, `src/transitions`, `src/audio`, `src/ui` and `src/config`, with transition and performance infrastructure in `src/core` and `src/performance`. Each later phase adds its own folders on its own branch: `src/phase2` and `src/recovery` (phase2), `src/scenes/final` (phase3), and `src/phase4` (phase4).

## Cinematic polish

The three-blink awakening uses one asymmetric SVG aperture with feathered edges. The camera combines an authored curved approach, damped mouse/head lag, restrained breathing and a settling gait. Actual depth of field racks from foreground to Baymax during awakening, then returns to normal before isolating him again at close range.

The post stack includes GTAO, high-threshold bloom, edge-only chromatic instability during awakening, linear-space SMAA and ACES output. The grade pass adds an impact-centred shockwave refraction, flash, a red edge intrusion during corruption, a cyan flood from the fracture, and the whiteout. Sprites and transparent layers are excluded from the AO and depth-of-field buffers. Every program the sequence needs is compiled behind the boot screen, and all lights exist from the first frame, so no effect stalls when it first appears. HIGH starts at 1.25× internal density with 4096px key shadows; it adapts to MEDIUM after sustained measured slow frames. No 60 FPS claim is made without hardware benchmarking.

The 1.75 art pass replaces green-grey with neutral/slate architecture and cyan atmospheric depth. PortalArt adds localized cyan/violet fractures with matching light spill, two feathered atmospheric shafts, three bilingual city signs, one surviving window and an amber traffic signal. Warm ivory skin and deep crimson metallic armor separate Baymax from the cool city. Dry aggregate asphalt, limited moisture patches and worn yellow markings create material contrast. The camera endpoint is backed off slightly to keep the chip and shell together; movement, blink timing, dialogue and chapter flow are unchanged.

The environment has close cable/glass/dust, the street and Baymax, displaced mid-distance structures, and distant fog masses. Deliberate anomalies include rotated upper floors, a vertical road, a duplicated bridge, detached windows, and a sliced building. Local haze and selected debris move slowly. Road and concrete have separate material responses; Baymax uses warm inflatable sheen, dark metallic armor, contact occlusion and imperceptible physical settling. The chip has a restrained emissive pulse and ground bounce. Ambience quiets during the approach while low pressure increases.

## Assets and generation

The stylized Baymax model, street geometry and textures, portal shader, and ambience are original procedural assets. `npm run assets` exports the reusable model to `public/models/baymax-shell.glb` (approximately 250 KB). This is an intentionally simplified approximation, ready to replace with a more detailed model. No external film model, soundtrack or voice recording is included. Interface fonts load from Google Fonts with local fallbacks. Dependency licenses remain with their installed packages.

This is a fan concept made for the supplied Big Hero 6 competition brief, without affiliation with Disney.
